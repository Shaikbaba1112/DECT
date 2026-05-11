const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with account:", deployer.address);
  console.log(
    "Balance:",
    ethers.utils.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  // ── Step 1: Deploy DECT_Credit ──────────────────────────────────────────
  console.log("\n[1/2] Deploying DECT_Credit (TKN)...");
  const DECT_Credit = await ethers.getContractFactory("DECT_Credit");
  const credit      = await DECT_Credit.deploy();
  await credit.deployed();
  const creditAddress =  credit.address;
  console.log("DECT_Credit deployed to:", creditAddress);

  // ── Step 2: Deploy EnergyMarket ────────────────────────────────────────
  console.log("\n[2/2] Deploying EnergyMarket...");
  const EnergyMarket = await ethers.getContractFactory("EnergyMarket");
  const market       = await EnergyMarket.deploy(
    creditAddress,
    deployer.address   // feeCollector = deployer for local dev
  );
  await market.deployed();
  const marketAddress =  market.address;
  console.log("EnergyMarket deployed to:", marketAddress);

  // ── Step 3: Authorize EnergyMarket to mint TKN ─────────────────────────
  console.log("\n[3/3] Authorizing EnergyMarket as TKN minter...");
  const tx = await credit.addMinter(marketAddress);
  await tx.wait();
  console.log("EnergyMarket authorized to mint TKN");

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("\n✅ Deployment complete");
  console.log("─────────────────────────────────────────");
  console.log("DECT_Credit  :", creditAddress);
  console.log("EnergyMarket :", marketAddress);
  console.log("\nAdd these to your .env files:");
  console.log(`DECT_CREDIT_ADDRESS=${creditAddress}`);
  console.log(`CONTRACT_ADDRESS=${marketAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});