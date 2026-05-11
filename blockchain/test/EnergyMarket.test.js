const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
describe("DECT System", function () {

  // ── Fixture ───────────────────────────────────────────────────────────────
  async function deployFixture() {
    const [owner, seller, buyer, other, feeCollector] = await ethers.getSigners();

    // Deploy DECT_Credit
    const DECT_Credit = await ethers.getContractFactory("DECT_Credit");
    await credit.deployed(); // v5 uses .deployed()
    // Deploy EnergyMarket
    const EnergyMarket = await ethers.getContractFactory("EnergyMarket");
    const market       = await EnergyMarket.deploy(
      credit.address,
      feeCollector.address
    );

    // Authorize market to mint TKN
    await credit.addMinter( market.address );

    return { market, credit, owner, seller, buyer, other, feeCollector };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const ENERGY      = 100n;
  const BASE_PRICE  = ethers.utils.parseEther("0.001");
  const DEVICE_TYPE = "solar";

  async function createListing(market, seller) {
    return market.connect(seller).createListing(ENERGY, BASE_PRICE, DEVICE_TYPE);
  }

  async function getDynamicTotal(market, id) {
    const [, totalCost] = await market.getDynamicPrice(id);
    return totalCost;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  DECT_Credit Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe("DECT_Credit (TKN)", function () {

    it("has correct name and symbol", async function () {
      const { credit } = await loadFixture(deployFixture);
      expect(await credit.name()).to.equal("DECT Credit");
      expect(await credit.symbol()).to.equal("TKN");
    });

    it("owner can add minter", async function () {
      const { credit, owner, other } = await loadFixture(deployFixture);
      await credit.connect(owner).addMinter(other.address);
      expect(await credit.minters(other.address)).to.equal(true);
    });

    it("minter can mint tokens", async function () {
      const { credit, owner, buyer } = await loadFixture(deployFixture);
      await credit.connect(owner).mint(buyer.address, 1000n);
      expect(await credit.balanceOf(buyer.address)).to.equal(1000n);
    });

    it("non-minter cannot mint", async function () {
      const { credit, buyer } = await loadFixture(deployFixture);
      await expect(credit.connect(buyer).mint(buyer.address, 1000n))
        .to.be.revertedWith("Not authorized to mint");
    });

    it("user can burn own tokens", async function () {
      const { credit, owner, buyer } = await loadFixture(deployFixture);
      await credit.connect(owner).mint(buyer.address, 1000n);
      await credit.connect(buyer).burn(500n);
      expect(await credit.balanceOf(buyer.address)).to.equal(500n);
    });

    it("transfer works correctly", async function () {
      const { credit, owner, buyer, other } = await loadFixture(deployFixture);
      await credit.connect(owner).mint(buyer.address, 1000n);
      await credit.connect(buyer).transfer(other.address, 300n);
      expect(await credit.balanceOf(buyer.address)).to.equal(700n);
      expect(await credit.balanceOf(other.address)).to.equal(300n);
    });

    it("approve and transferFrom work", async function () {
      const { credit, owner, buyer, other } = await loadFixture(deployFixture);
      await credit.connect(owner).mint(buyer.address, 1000n);
      await credit.connect(buyer).approve(other.address, 500n);
      await credit.connect(other).transferFrom(buyer.address, other.address, 300n);
      expect(await credit.balanceOf(other.address)).to.equal(300n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  EnergyMarket — Listing Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe("EnergyMarket — Listings", function () {

    it("creates listing and emits event", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await expect(createListing(market, seller))
        .to.emit(market, "ListingCreated")
        .withArgs(0, seller.address, ENERGY, BASE_PRICE, DEVICE_TYPE);
    });

    it("stores listing data correctly", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const l = await market.getListing(0);
      expect(l.seller).to.equal(seller.address);
      expect(l.energyAmount).to.equal(ENERGY);
      expect(l.basePricePerUnit).to.equal(BASE_PRICE);
      expect(l.active).to.equal(true);
      expect(l.deviceType).to.equal(DEVICE_TYPE);
    });

    it("increments listing IDs", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await createListing(market, seller);
      await createListing(market, seller);
      expect((await market.getListing(1)).id).to.equal(1n);
    });

    it("tracks seller listings", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await createListing(market, seller);
      await createListing(market, seller);
      const ids = await market.getSellerListings(seller.address);
      expect(ids.length).to.equal(2);
    });

    it("rejects zero energy", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await expect(market.connect(seller).createListing(0, BASE_PRICE, DEVICE_TYPE))
        .to.be.revertedWith("Energy amount must be > 0");
    });

    it("rejects zero price", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await expect(market.connect(seller).createListing(ENERGY, 0, DEVICE_TYPE))
        .to.be.revertedWith("Price must be > 0");
    });

    it("seller can cancel listing", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await createListing(market, seller);
      await expect(market.connect(seller).cancelListing(0))
        .to.emit(market, "ListingCancelled").withArgs(0);
      expect((await market.getListing(0)).active).to.equal(false);
    });

    it("non-seller cannot cancel", async function () {
      const { market, seller, other } = await loadFixture(deployFixture);
      await createListing(market, seller);
      await expect(market.connect(other).cancelListing(0))
        .to.be.revertedWith("Not your listing");
    });

    it("cannot cancel inactive listing", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await createListing(market, seller);
      await market.connect(seller).cancelListing(0);
      await expect(market.connect(seller).cancelListing(0))
        .to.be.revertedWith("Already inactive");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  EnergyMarket — Dynamic Pricing Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe("EnergyMarket — Dynamic Pricing", function () {

    it("returns BASE when no listings", async function () {
      const { market } = await loadFixture(deployFixture);
      expect(await market.getMultiplier()).to.equal(100n);
    });

    it("returns MIN when supply > demand", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await createListing(market, seller);
      expect(await market.getMultiplier()).to.equal(50n);
    });

    it("getDynamicPrice returns correct values", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const [dynPrice, totalCost, multiplier] = await market.getDynamicPrice(0);
      // Ethers v5 math: Use .mul() instead of *
      expect(totalCost).to.equal(dynPrice.mul(ENERGY));
      expect(multiplier).to.be.gte(50n);
    });

    it("getDynamicPrice reverts on inactive listing", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await createListing(market, seller);
      await market.connect(seller).cancelListing(0);
      await expect(market.getDynamicPrice(0))
        .to.be.revertedWith("Listing not active");
    });

    it("multiplier clamped between MIN and MAX", async function () {
      const { market } = await loadFixture(deployFixture);
      expect(await market.MIN_MULTIPLIER()).to.equal(50n);
      expect(await market.MAX_MULTIPLIER()).to.equal(300n);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  EnergyMarket — Direct Purchase Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe("EnergyMarket — Direct Purchase", function () {

    it("allows buyer to purchase at dynamic price", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const total = await getDynamicTotal(market, 0);
      await expect(
        market.connect(buyer).purchaseEnergy(0, { value: total })
      ).to.emit(market, "EnergyPurchased");
    });

    it("marks listing inactive after purchase", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const total = await getDynamicTotal(market, 0);
      await market.connect(buyer).purchaseEnergy(0, { value: total });
      expect((await market.getListing(0)).active).to.equal(false);
    });

    it("credits seller ETH balance minus fee", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const total = await getDynamicTotal(market, 0);
      await market.connect(buyer).purchaseEnergy(0, { value: total });
      const [fee, sellerAmount] = await market.calculateFee(total);
      expect(await market.ethBalances(seller.address)).to.equal(sellerAmount);
    });

    it("credits fee collector", async function () {
      const { market, seller, buyer, feeCollector } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const total = await getDynamicTotal(market, 0);
      await market.connect(buyer).purchaseEnergy(0, { value: total });
      const [fee] = await market.calculateFee(total);
      expect(await market.ethBalances(feeCollector.address)).to.equal(fee);
    });

    it("mints TKN to seller after purchase", async function () {
      const { market, credit, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const total = await getDynamicTotal(market, 0);
      await market.connect(buyer).purchaseEnergy(0, { value: total });
      const tknBalance = await credit.balanceOf(seller.address);
      expect(tknBalance).to.be.gt(0n);
    });

    it("reverts on wrong ETH amount", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      await expect(
        market.connect(buyer).purchaseEnergy(0, { value: 1n })
      ).to.be.revertedWith("Incorrect ETH sent");
    });

    it("reverts on self-purchase", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const total = await getDynamicTotal(market, 0);
      await expect(
        market.connect(seller).purchaseEnergy(0, { value: total })
      ).to.be.revertedWith("Cannot buy your own listing");
    });

    it("reverts on inactive listing", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const total = await getDynamicTotal(market, 0);
      await market.connect(buyer).purchaseEnergy(0, { value: total });
      await expect(
        market.connect(buyer).purchaseEnergy(0, { value: total })
      ).to.be.revertedWith("Listing is not active");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  EnergyMarket — Bid System Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe("EnergyMarket — Bid System", function () {

    it("buyer can place a bid", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const deposit = BASE_PRICE.mul(ENERGY);
      await expect(
        market.connect(buyer).placeBid(0, BASE_PRICE, ENERGY, { value: deposit })
      ).to.emit(market, "BidPlaced")
        .withArgs(0, 0, buyer.address, BASE_PRICE, ENERGY);
    });

    it("tracks buyer bids", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const deposit = BASE_PRICE.mul(ENERGY);
      await market.connect(buyer).placeBid(0, BASE_PRICE, ENERGY, { value: deposit });
      const ids = await market.getBuyerBids(buyer.address);
      expect(ids.length).to.equal(1);
    });

    it("seller can accept bid", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const deposit = BASE_PRICE.mul(ENERGY);
      await market.connect(buyer).placeBid(0, BASE_PRICE, ENERGY, { value: deposit });
      await expect(market.connect(seller).acceptBid(0))
        .to.emit(market, "BidAccepted");
      expect((await market.getBid(0)).status).to.equal(1); // Accepted
    });

    it("accept bid mints TKN to seller", async function () {
      const { market, credit, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const deposit = BASE_PRICE.mul(ENERGY);
      await market.connect(buyer).placeBid(0, BASE_PRICE, ENERGY, { value: deposit });
      await market.connect(seller).acceptBid(0);
      expect(await credit.balanceOf(seller.address)).to.be.gt(0n);
    });

    it("seller can reject bid and buyer is refunded", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const deposit = BASE_PRICE.mul(ENERGY);
      await market.connect(buyer).placeBid(0, BASE_PRICE, ENERGY, { value: deposit });
      await expect(market.connect(seller).rejectBid(0))
        .to.emit(market, "BidRejected").withArgs(0)
        .and.to.changeEtherBalance(buyer, deposit);
    });

    it("seller can counter a bid", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const deposit = BASE_PRICE.mul(ENERGY);
      const counterPrice = BASE_PRICE.mul(2);
      await market.connect(buyer).placeBid(0, BASE_PRICE, ENERGY, { value: deposit });
      await expect(market.connect(seller).counterBid(0, counterPrice))
        .to.emit(market, "BidCountered").withArgs(0, counterPrice);
      expect((await market.getBid(0)).counterPrice).to.equal(counterPrice);
    });

    it("non-seller cannot accept bid", async function () {
      const { market, seller, buyer, other } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const deposit = BASE_PRICE.mul(ENERGY);
      await market.connect(buyer).placeBid(0, BASE_PRICE, ENERGY, { value: deposit });
      await expect(market.connect(other).acceptBid(0))
        .to.be.revertedWith("Not your listing");
    });

    it("cannot bid on own listing", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const deposit = BASE_PRICE.mul(ENERGY);
      await expect(
        market.connect(seller).placeBid(0, BASE_PRICE, ENERGY, { value: deposit })
      ).to.be.revertedWith("Cannot bid on own listing");
    });

    it("cannot bid wrong deposit amount", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      await expect(
        market.connect(buyer).placeBid(0, BASE_PRICE, ENERGY, { value: 1n })
      ).to.be.revertedWith("Deposit must equal bid total");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  EnergyMarket — Withdraw Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe("EnergyMarket — Withdraw", function () {

    it("seller can withdraw ETH", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const total = await getDynamicTotal(market, 0);
      await market.connect(buyer).purchaseEnergy(0, { value: total });
      const [, sellerAmount] = await market.calculateFee(total);
      await expect(market.connect(seller).withdraw())
        .to.emit(market, "Withdrawn")
        .and.to.changeEtherBalance(seller, sellerAmount);
    });

    it("clears ETH balance after withdraw", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const total = await getDynamicTotal(market, 0);
      await market.connect(buyer).purchaseEnergy(0, { value: total });
      await market.connect(seller).withdraw();
      expect(await market.ethBalances(seller.address)).to.equal(0n);
    });

    it("reverts with nothing to withdraw", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await expect(market.connect(seller).withdraw())
        .to.be.revertedWith("Nothing to withdraw");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  EnergyMarket — Admin Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe("EnergyMarket — Admin", function () {

    it("owner can pause system", async function () {
      const { market, owner } = await loadFixture(deployFixture);
      await expect(market.connect(owner).pause())
        .to.emit(market, "Paused");
      expect(await market.paused()).to.equal(true);
    });

    it("owner can unpause system", async function () {
      const { market, owner } = await loadFixture(deployFixture);
      await market.connect(owner).pause();
      await expect(market.connect(owner).unpause())
        .to.emit(market, "Unpaused");
      expect(await market.paused()).to.equal(false);
    });

    it("cannot create listing when paused", async function () {
      const { market, owner, seller } = await loadFixture(deployFixture);
      await market.connect(owner).pause();
      await expect(
        market.connect(seller).createListing(ENERGY, BASE_PRICE, DEVICE_TYPE)
      ).to.be.revertedWith("System is paused");
    });

    it("cannot purchase when paused", async function () {
      const { market, owner, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const total = await getDynamicTotal(market, 0);
      await market.connect(owner).pause();
      await expect(
        market.connect(buyer).purchaseEnergy(0, { value: total })
      ).to.be.revertedWith("System is paused");
    });

    it("non-owner cannot pause", async function () {
      const { market, seller } = await loadFixture(deployFixture);
      await expect(market.connect(seller).pause())
        .to.be.revertedWith("Not owner");
    });

    it("owner can update fee", async function () {
      const { market, owner } = await loadFixture(deployFixture);
      await expect(market.connect(owner).setFee(100n))
        .to.emit(market, "FeeUpdated").withArgs(100n);
      expect(await market.feeBasisPoints()).to.equal(100n);
    });

    it("fee cannot exceed 10%", async function () {
      const { market, owner } = await loadFixture(deployFixture);
      await expect(market.connect(owner).setFee(1001n))
        .to.be.revertedWith("Fee too high");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  EnergyMarket — Market Stats
  // ─────────────────────────────────────────────────────────────────────────

  describe("EnergyMarket — Market Stats", function () {

    it("returns correct stats after activity", async function () {
      const { market, seller, buyer } = await loadFixture(deployFixture);
      await createListing(market, seller);
      const total = await getDynamicTotal(market, 0);
      await market.connect(buyer).purchaseEnergy(0, { value: total });

      const [supply, demand, multiplier, totalListings, allPurchases]
        = await market.getMarketStats();

      expect(totalListings).to.equal(1n);
      expect(allPurchases).to.equal(1n);
      expect(supply).to.equal(0n);
    });
  });
});