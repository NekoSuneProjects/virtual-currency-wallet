const { sequelize, User, Balance, Transaction, Friend, Stake, OrderModel, FriendRequest } = require("./database");
const { Op } = require("sequelize");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

class CryptoWallet {
    constructor(configPath) {
        this.configPath = configPath || path.join(__dirname, "config.json");
        this.config = this.loadConfig(this.configPath);
        // list of allowed staking tokens
        this.stakingTokens = [
            "solana",
            "zenzo",
            "pivx",
            "stakecube",
            "ethereum",
            "flits",
            "polygon-ecosystem-token"
        ];
        // Important: await sync all models before using them
        this.init();
    }

    async init() {
        try {
            await sequelize.sync({ force: false }); // create tables if missing, apply changes
            console.log("Database synced ✅");
        } catch (e) {
            console.error("Error syncing database:", e);
        }
    }

    // ---------- Config ----------
    loadConfig(configPath) {
        const data = fs.readFileSync(configPath, "utf8");
        return JSON.parse(data);
    }

    saveConfig() {
        fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    }

    updateFiatCurrency(fiat) {
        this.config.defaultFiatCurrency = fiat.toLowerCase();
        this.saveConfig();
    }

    // ---------- Price ----------
    async getPrice(crypto) {
        const fiat = this.config.defaultFiatCurrency;
        const url = `https://api.nekosunevr.co.uk/v5/cryptoapi/nekogeko/prices/${fiat}?id=${crypto}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.current_price) throw new Error("Crypto not found");
        return data.current_price;
    }

    async convertCryptoToFiat(amount, crypto) {
        const price = await this.getPrice(crypto);
        return amount * price;
    }

    // ---------- Users ----------
    async ensureUser(userId) {
        await User.findOrCreate({ where: { userId } });
    }

    // ---------- Balances ----------
    async getBalance(userId, crypto) {
        const bal = await Balance.findOne({ where: { userId, crypto } });
        return bal ? bal.amount : 0;
    }

    async giveCrypto(userId, crypto, amount) {
        await this.ensureUser(userId);
        const [bal] = await Balance.findOrCreate({
            where: { userId, crypto },
            defaults: { amount: 0 }
        });
        bal.amount += amount;
        await bal.save();
        return bal.amount;
    }

    // ---------- Friends ----------
    async addFriend(userId, friendId) {
        if (userId === friendId) return false;
        await this.ensureUser(userId);
        await this.ensureUser(friendId);
        const [f] = await Friend.findOrCreate({ where: { userId, friendId } });
        return !!f;
    }

    async getFriends(userId) {
        const friends = await Friend.findAll({ where: { userId } });
        return friends.map(f => f.friendId);
    }

    async sendFriendRequest(senderId, receiverId) {
        if (senderId === receiverId) return false;

        await this.ensureUser(senderId);
        await this.ensureUser(receiverId);

        // Check existing friendship
        const friends = await this.getFriends(senderId);
        if (friends.includes(receiverId)) return false;

        // Create request
        const [req, created] = await FriendRequest.findOrCreate({
            where: { senderId, receiverId },
            defaults: { status: "pending", createdAt: Date.now() }
        });

        if (!created) return false; // already requested

        // Optional: send Discord embed to receiver here
        return req;
    }

    async respondFriendRequest(receiverId, senderId, accept = true) {
        const req = await FriendRequest.findOne({ where: { senderId, receiverId, status: "pending" } });
        if (!req) return false;

        if (accept) {
            await this.addFriend(senderId, receiverId);
            req.status = "accepted";
        } else {
            req.status = "declined";
        }

        await req.save();
        return req;
    }

    static async autoDeclineFriendRequests() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        const pendingRequests = await FriendRequest.findAll({
            where: { status: "pending" }
        });

        for (const req of pendingRequests) {
            if (now - req.createdAt > oneHour) {
                req.status = "declined";
                await req.save();
            }
        }
    }

    async getPendingRequests(userId) {
        const requests = await FriendRequest.findAll({
            where: { receiverId: userId, status: "pending" }
        });

        return requests.map(r => ({
            sender: r.senderId,
            requestedAt: new Date(r.createdAt).toLocaleString()
        }));
    }

    async transferToFriend(senderId, friendId, crypto, amount) {
        const friends = await this.getFriends(senderId);
        if (!friends.includes(friendId)) return false;
        return await this.transfer(senderId, friendId, crypto, amount);
    }

    // ---------- Transactions ----------
    async transfer(senderId, receiverId, crypto, amount) {
        const senderBalance = await this.getBalance(senderId, crypto);
        if (senderBalance < amount) return false;

        await this.giveCrypto(senderId, crypto, -amount);
        await this.giveCrypto(receiverId, crypto, amount);

        await Transaction.create({
            senderId,
            receiverId,
            crypto,
            amount,
            timestamp: Date.now()
        });

        return true;
    }

    async getTransactions(userId, limit = 50) {
        const transactions = await Transaction.findAll({
            where: { [Op.or]: [{ senderId: userId }, { receiverId: userId }] },
            order: [["timestamp", "DESC"]],
            limit
        });

        if (!transactions || transactions.length === 0) return [];

        return transactions.map(t => {
            let type = "";
            let from = t.senderId;
            let to = t.receiverId;

            if (t.senderId === userId && t.receiverId) {
                type = "send";
            } else if (t.receiverId === userId && t.senderId && t.senderId !== "reward") {
                type = "receive";
            } else if (t.senderId === userId && !t.receiverId) {
                type = "staked";
                from = userId;
                to = "stake";
            } else if (!t.senderId && t.receiverId === userId) {
                type = "unstaked";
                from = "stake";
                to = userId;
            } else if (t.senderId === "reward" && t.receiverId === userId) {
                type = "rewardStake";
                from = "stakeReward";
                to = userId;
            }

            return {
                id: t.id,
                type,
                from,
                to,
                crypto: t.crypto,
                amount: t.amount,
                timestamp: t.timestamp,
                time: new Date(t.timestamp).toLocaleString()
            };
        });
    }

    // ---------- Staking ----------
    async stakeCrypto(userId, crypto, amount, apy = 0.01) {
        if (!this.stakingTokens.includes(crypto)) return false; // only allowed tokens

        const balance = await this.getBalance(userId, crypto);
        if (balance < amount) return false;

        // remove from balance
        await this.giveCrypto(userId, crypto, -amount);

        // Record staking transaction
        await Transaction.create({
            senderId: userId,
            receiverId: null,
            crypto,
            amount,
            timestamp: Date.now()
        });

        // create or update stake
        let stake = await Stake.findOne({ where: { userId, crypto } });
        if (stake) {
            await this.updateStakeRewards(stake);
            stake.amount += amount;
            stake.apy = apy;
            stake.lastUpdated = Date.now();
            await stake.save();
        } else {
            stake = await Stake.create({
                userId,
                crypto,
                amount,
                earned: 0,
                apy,
                lastUpdated: Date.now()
            });
        }

        return true;
    }

    async unstakeCrypto(userId, crypto) {
        const stake = await Stake.findOne({ where: { userId, crypto } });
        if (!stake) return false;

        await this.updateStakeRewards(stake); // update earned before unstaking
        const total = stake.amount + stake.earned;

        await this.giveCrypto(userId, crypto, total);

        // Record unstake transaction
        await Transaction.create({
            senderId: null,
            receiverId: userId,
            crypto,
            amount: stake.amount,
            timestamp: Date.now()
        });

        // Record rewards transaction if earned > 0
        if (stake.earned > 0) {
            await Transaction.create({
                senderId: "reward",
                receiverId: userId,
                crypto,
                amount: stake.earned,
                timestamp: Date.now()
            });
        }

        await stake.destroy();

        return { staked: stake.amount, earned: stake.earned, total };
    }

    async getUserStakes(userId) {
        const stakes = await Stake.findAll({ where: { userId } });
        const updated = [];
        for (const s of stakes) {
            await this.updateStakeRewards(s); // update earned before showing
            updated.push({
                crypto: s.crypto,
                staked: s.amount.toFixed(8),
                earned: s.earned.toFixed(8),
                apy: s.apy,
                lastUpdated: s.lastUpdated
            });
        }
        return updated;
    }

    // ---------- Internal: update staking rewards ----------
    async updateStakeRewards(stake) {
        const now = Date.now();
        const msElapsed = now - stake.lastUpdated;
        const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);

        const reward = stake.amount * stake.apy * daysElapsed;
        stake.earned += reward;
        stake.lastUpdated = now;
        await stake.save();
    }

    // ----------------- Trading / Swapping -----------------
    /**
     * Trade crypto from one token to another
     * @param {string} userId - User ID
     * @param {string} fromCrypto - Crypto to spend
     * @param {string} toCrypto - Crypto to receive
     * @param {number} amount - Amount of fromCrypto to spend
     */
    // ----------------- Trading / Swapping -----------------
    async swapCrypto(userId, fromCrypto, toCrypto, amount) {
        if (fromCrypto === toCrypto) return false;
        if (amount <= 0) return false;

        const fromBalance = await this.getBalance(userId, fromCrypto);
        if (fromBalance < amount) return false;

        const fromPrice = await this.getPrice(fromCrypto);
        const toPrice = await this.getPrice(toCrypto);

        const fiatValue = amount * fromPrice;
        const toAmount = fiatValue / toPrice;

        await this.giveCrypto(userId, fromCrypto, -amount);
        await this.giveCrypto(userId, toCrypto, toAmount);

        // Record swap transaction
        await Transaction.create({
            senderId: userId,
            receiverId: userId,
            crypto: `${fromCrypto}->${toCrypto}`,
            amount,
            timestamp: Date.now()
        });

        return { from: amount, fromCrypto, to: toAmount, toCrypto };
    }

    async placeOrder(userId, type, cryptoPair, amount, price) {
        await this.ensureUser(userId);

        // Check balance for sell orders
        if (type === "sell") {
            const [fromCrypto] = cryptoPair.split("/");
            const balance = await this.getBalance(userId, fromCrypto);
            if (balance < amount) return false;
            await this.giveCrypto(userId, fromCrypto, -amount); // lock tokens in order
        }

        const order = await OrderModel.create({ userId, type, cryptoPair, amount, price });

        // Try to match order immediately
        await this.matchOrders(order);

        return order;
    }

    async matchOrders(newOrder) {
        const [base, quote] = newOrder.cryptoPair.split("/");

        const oppositeType = newOrder.type === "buy" ? "sell" : "buy";

        // Find matching orders
        const matchingOrders = await OrderModel.findAll({
            where: {
                cryptoPair: newOrder.cryptoPair,
                type: oppositeType,
                status: "open",
                price: newOrder.type === "buy" ? { [Op.lte]: newOrder.price } : { [Op.gte]: newOrder.price }
            },
            order: [["price", newOrder.type === "buy" ? "ASC" : "DESC"]] // best price first
        });

        let remaining = newOrder.amount;

        for (const order of matchingOrders) {
            const available = order.amount - order.filled;
            const tradeAmount = Math.min(remaining, available);

            // Update filled amounts
            order.filled += tradeAmount;
            if (order.filled >= order.amount) order.status = "filled";
            else order.status = "partial";
            await order.save();

            newOrder.filled += tradeAmount;
            if (newOrder.filled >= newOrder.amount) newOrder.status = "filled";
            else newOrder.status = "partial";
            await newOrder.save();

            // Transfer crypto between buyer and seller
            if (newOrder.type === "buy") {
                await this.giveCrypto(newOrder.userId, base, tradeAmount); // buyer gets base
                await this.giveCrypto(order.userId, base, 0); // seller already locked
            } else {
                await this.giveCrypto(order.userId, base, tradeAmount); // buyer gets base
                await this.giveCrypto(newOrder.userId, base, 0); // seller already locked
            }

            remaining -= tradeAmount;
            if (remaining <= 0) break;
        }
    }
}

setInterval(() => {
    CryptoWallet.autoDeclineFriendRequests().catch(e => console.error("Auto-decline failed:", e));
}, 5 * 60 * 1000); // every 5 mins

module.exports = CryptoWallet;
