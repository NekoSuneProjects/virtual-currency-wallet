# Virtual Currency Wallet

A full virtual cryptocurrency wallet system designed for Discord bots,
games, or simulated trading environments.\
Supports balances, staking, trading, orders, friends, transactions, and
more --- all backed by SQLite via Sequelize.

------------------------------------------------------------------------

## ✅ Features

### **Wallet & Balances**

-   Add/remove crypto from users
-   Dynamic crypto list loaded from config.json\
-   Convert crypto → fiat (USD by default, configurable)

### **Staking System**

-   Supports selected staking tokens (Solana, Ethereum, ZENZO, etc.)
-   APY-based reward growth
-   Tracks:
    -   **staked**
    -   **earned rewards**
    -   **unstaked amounts**
-   Auto-updates earnings when checked or unstaked

### **Trading / Swapping**

-   Swap one crypto → another using live price API\
-   Price conversion uses NekoGecko API (CoinGecko wrapper)

### **Orderbook Trading (Exchange-like system)**

-   Users can place:
    -   **buy orders**
    -   **sell orders**
-   Automatic matching engine
-   Locked balances for sell orders
-   Partial and full order fills

### **Friends System**

-   Add friends\
-   Friend requests\
-   Auto-decline pending requests after 1 hour\
-   Transfer crypto only to friends

### **Transactions**

Each transaction includes: -
`type: send, receive, staked, unstaked, rewardStake` - timestamps -
from/to fields - crypto + amount

------------------------------------------------------------------------

## 📦 Installation

``` bash
npm install your-crypto-wallet-package
```

Or clone your repo:

``` bash
git clone https://github.com/yourname/crypto-wallet
cd crypto-wallet
npm install
```

------------------------------------------------------------------------

## ✅ Example Usage

``` js
const CryptoWallet = require("./src/cryptoWallet");

const wallet = new CryptoWallet("./config.json");

(async () => {
  await wallet.giveCrypto("123", "bitcoin", 0.01);
  console.log(await wallet.getBalance("123", "bitcoin"));

  console.log(await wallet.convertCryptoToFiat(0.01, "bitcoin"));

  const tx = await wallet.getTransactions("123");
  console.log(tx);
})();
```

------------------------------------------------------------------------

## ⚙️ config.json Example

``` json
{
  "defaultFiatCurrency": "usd"
}
```

------------------------------------------------------------------------

## 📚 Database Models

Uses **Sequelize + SQLite** with: - User - Balance - Transaction -
Friend - FriendRequest - Stake - Order

Database files auto-sync on startup.

------------------------------------------------------------------------

## 🔧 Staking Example

``` js
await wallet.stakeCrypto("123", "solana", 5, 0.10); // 10% APY stake
await wallet.unstakeCrypto("123", "solana");
```

------------------------------------------------------------------------

## 🔄 Swapping Example

``` js
await wallet.swapCrypto("123", "bitcoin", "ethereum", 0.01);
```

------------------------------------------------------------------------

## 🛒 Orderbook Example

``` js
await wallet.placeOrder("123", "sell", "bitcoin/ethereum", 0.01, 30000);
await wallet.placeOrder("555", "buy", "bitcoin/ethereum", 0.01, 31000);
```

Auto-matching triggers instantly.

------------------------------------------------------------------------

## 🧾 Transaction Output Example

``` json
{
  "id": 1,
  "type": "send",
  "from": "123",
  "to": "555",
  "crypto": "bitcoin",
  "amount": 0.01,
  "time": "11/3/2025, 12:00 PM"
}
```

------------------------------------------------------------------------

## ✅ Perfect for

✅ Discord bots\
✅ Virtual economy systems\
✅ Game integrations\
✅ Crypto simulators\
✅ Learning exchange & staking systems

------------------------------------------------------------------------

## 📄 License

MIT License

------------------------------------------------------------------------

## 🤝 Contributions

PRs are welcome!
