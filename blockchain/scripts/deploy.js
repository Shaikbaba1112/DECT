const { ethers, run, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const netName    = network.name;

  // ethers v5 — balance
  const balance = await deployer.getBalance();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Network:   ${netName}`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Balance:   ${ethers.utils.formatEther(balance)} ETH`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── Step 1: Deploy DECT_Credit ──────────────────────────────────────
  console.log("\n[1/3] Deploying DECT_Credit (TKN)...");
  const DECT_Credit   = await ethers.getContractFactory("DECT_Credit");
  const credit        = await DECT_Credit.deploy();
  await credit.deployed();
  const creditAddress = credit.address;
  console.log(`✓ DECT_Credit deployed: ${creditAddress}`);

  // Wait for confirmations on testnet
  if (netName === "sepolia") {
    console.log("  Waiting for 5 block confirmations...");
    await credit.deployTransaction.wait(5);
    console.log("  ✓ Confirmed");
  }

  // ── Step 2: Deploy EnergyMarket ────────────────────────────────────
  console.log("\n[2/3] Deploying EnergyMarket...");
  const EnergyMarket  = await ethers.getContractFactory("EnergyMarket");
  const market        = await EnergyMarket.deploy(
    creditAddress,
    deployer.address    // feeCollector
  );
  await market.deployed();
  const marketAddress = market.address;
  console.log(`✓ EnergyMarket deployed: ${marketAddress}`);

  if (netName === "sepolia") {
    console.log("  Waiting for 5 block confirmations...");
    await market.deployTransaction.wait(5);
    console.log("  ✓ Confirmed");
  }

  // ── Step 3: Authorize EnergyMarket to mint TKN ─────────────────────
  console.log("\n[3/3] Authorizing EnergyMarket as TKN minter...");
  const tx = await credit.addMinter(marketAddress);
  await tx.wait(netName === "sepolia" ? 3 : 1);
  console.log("✓ EnergyMarket authorized to mint TKN");

  // ── Step 4: Verify on Etherscan ────────────────────────────────────
  if (netName === "sepolia") {
    console.log("\n[4/4] Verifying on Etherscan...");

    try {
      console.log("  Verifying DECT_Credit...");
      await run("verify:verify", {
        address:              creditAddress,
        constructorArguments: [],
      });
      console.log("  ✓ DECT_Credit verified");
    } catch (e) {
      if (e.message.toLowerCase().includes("already verified")) {
        console.log("  ✓ DECT_Credit already verified");
      } else {
        console.warn("  ⚠ DECT_Credit verification failed:", e.message);
      }
    }

    try {
      console.log("  Verifying EnergyMarket...");
      await run("verify:verify", {
        address:              marketAddress,
        constructorArguments: [creditAddress, deployer.address],
      });
      console.log("  ✓ EnergyMarket verified");
    } catch (e) {
      if (e.message.toLowerCase().includes("already verified")) {
        console.log("  ✓ EnergyMarket already verified");
      } else {
        console.warn("  ⚠ EnergyMarket verification failed:", e.message);
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────
  const summary = {
    network:       netName,
    deployer:      deployer.address,
    DECT_Credit:   creditAddress,
    EnergyMarket:  marketAddress,
    deployedAt:    new Date().toISOString(),
  };

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Deployment complete");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`DECT_Credit  : ${creditAddress}`);
  console.log(`EnergyMarket : ${marketAddress}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (netName === "sepolia") {
    console.log("\nEtherscan links:");
    console.log(`  DECT_Credit  : https://sepolia.etherscan.io/address/${creditAddress}`);
    console.log(`  EnergyMarket : https://sepolia.etherscan.io/address/${marketAddress}`);
  }

  console.log("\nCopy these to your .env files:");
  console.log(`DECT_CREDIT_ADDRESS=${creditAddress}`);
  console.log(`CONTRACT_ADDRESS=${marketAddress}`);

  // Save to file
  const outDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${netName}.json`),
    JSON.stringify(summary, null, 2)
  );
  console.log(`\nDeployment saved to: deployments/${netName}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});