const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");

// Database path fixed to bot root
const dbPath = path.join(process.cwd(), "wallets.db");
const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: dbPath,
    logging: false
});

// USERS TABLE
const User = sequelize.define("User", {
    userId: {
        type: DataTypes.STRING,
        primaryKey: true,
        unique: true  // optional, primary key implies unique
    }
}, {
    freezeTableName: true
});

// FRIENDS
const Friend = sequelize.define("Friend", {
    userId: DataTypes.STRING,
    friendId: DataTypes.STRING
}, { freezeTableName: true });

// BALANCES TABLE
const Balance = sequelize.define("Balance", {
    userId: DataTypes.STRING,
    crypto: DataTypes.STRING,
    amount: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    }
}, { freezeTableName: true });

// TRANSACTIONS TABLE
const Transaction = sequelize.define("Transaction", {
    senderId: DataTypes.STRING,
    receiverId: DataTypes.STRING,
    crypto: DataTypes.STRING,
    amount: DataTypes.FLOAT,
    timestamp: DataTypes.INTEGER
}, { freezeTableName: true });

// STAKES
const Stake = sequelize.define("Stake", {
    userId: DataTypes.STRING,
    crypto: DataTypes.STRING,
    amount: { type: DataTypes.FLOAT, defaultValue: 0 },
    earned: { type: DataTypes.FLOAT, defaultValue: 0 },
    apy: { type: DataTypes.FLOAT, defaultValue: 0.01 }, // default 1% daily rate for demo
    lastUpdated: { type: DataTypes.INTEGER, defaultValue: () => Date.now() }
}, { freezeTableName: true });

const OrderModel = sequelize.define("Order", {
    userId: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM("buy", "sell"), allowNull: false }, // buy or sell
    cryptoPair: { type: DataTypes.STRING, allowNull: false }, // e.g., "bitcoin/ethereum"
    amount: { type: DataTypes.FLOAT, allowNull: false }, // amount of crypto to buy/sell
    price: { type: DataTypes.FLOAT, allowNull: false }, // price per unit (in defaultFiatCurrency)
    filled: { type: DataTypes.FLOAT, defaultValue: 0 }, // how much has been filled
    status: { type: DataTypes.ENUM("open", "partial", "filled", "cancelled"), defaultValue: "open" }
}, { freezeTableName: true });

const FriendRequest = sequelize.define("FriendRequest", {
    senderId: { type: DataTypes.STRING, allowNull: false },
    receiverId: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.ENUM("pending", "accepted", "declined"), defaultValue: "pending" },
    createdAt: { type: DataTypes.INTEGER, defaultValue: () => Date.now() }
}, { freezeTableName: true });

// relationships
User.hasMany(Balance, { foreignKey: "userId" });
Balance.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Friend, { foreignKey: "userId" });
User.hasMany(Stake, { foreignKey: "userId" });

Friend.belongsTo(User, { foreignKey: "userId" });
Friend.belongsTo(User, { foreignKey: "friendId" });

User.hasMany(OrderModel, { foreignKey: "userId" });
OrderModel.belongsTo(User, { foreignKey: "userId" });

User.hasMany(FriendRequest, { foreignKey: "receiverId" });
User.hasMany(FriendRequest, { foreignKey: "senderId" });
FriendRequest.belongsTo(User, { foreignKey: "senderId", as: "sender" });
FriendRequest.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });

module.exports = {
    sequelize,
    User,
    Balance,
    Transaction,
    Friend,
    Stake,
    OrderModel,
    FriendRequest
};
