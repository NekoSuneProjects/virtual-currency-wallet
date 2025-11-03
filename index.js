const CryptoWallet = require("./src/cryptoWallet");

const wallet = new CryptoWallet();

(async () => {
  // Make sure database tables are synced before using

  const userId = "100463282099326976";

  // Give some crypto to user
  await wallet.giveCrypto(userId, "ethereum", 0.01);
  await wallet.giveCrypto(userId, "solana", 0.5);

  // Check balances
  console.log("ETH balance:", await wallet.getBalance(userId, "ethereum"));
  console.log("SOL balance:", await wallet.getBalance(userId, "solana"));

  // Convert crypto to fiat
  console.log("ETH in USD:", await wallet.convertCryptoToFiat(0.01, "ethereum"));

  // ----------------- Staking -----------------
  // Stake some Ethereum (must be in stakingTokens)
  const stakeEth = await wallet.stakeCrypto(userId, "ethereum", 0.01, 0.02); // 2% APY
  console.log("Staked ETH:", stakeEth ? "Success" : "Failed");

  // Stake some Solana
  const stakeSol = await wallet.stakeCrypto(userId, "solana", 0.2, 0.015); // 1.5% APY
  console.log("Staked SOL:", stakeSol ? "Success" : "Failed");

  // Get staking info
  const stakes = await wallet.getUserStakes(userId);
  console.log("User staking info:");
  stakes.forEach(s => {
    console.log({
      crypto: s.crypto,
      staked: s.staked,
      earned: s.earned,
      apy: s.apy
    });
  });

  // ----------------- Friends & Transfers -----------------
  // Add a friend
  await wallet.addFriend(userId, "200000000000000000");
  console.log("Friends:", await wallet.getFriends(userId));

  // Transfer to friend (must be in friends list)
  //await wallet.transferToFriend(userId, "200000000000000000", "ethereum", 0.001);

  // ----------------- Transactions -----------------
  const tx = await wallet.getTransactions(userId);

  console.log("Transactions:");
  tx.forEach(t => {
    console.log(`[${t.time}] ${t.type.toUpperCase()}: ${t.amount} ${t.crypto} | From: ${t.from} → To: ${t.to}`);
  });
})();