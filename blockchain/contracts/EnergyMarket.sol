// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


import "./DECT_Credit.sol";

contract EnergyMarket {

    // ─────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────

    struct EnergyListing {
        uint256 id;
        address seller;
        uint256 energyAmount;       // Wh
        uint256 basePricePerUnit;   // wei per Wh (base)
        bool    active;
        uint256 createdAt;
        string  deviceType;         // solar / wind / battery
    }

    struct Bid {
        uint256 id;
        uint256 listingId;
        address buyer;
        uint256 offeredPricePerUnit; // wei per Wh
        uint256 energyAmount;        // Wh requested
        BidStatus status;
        uint256 counterPrice;        // set if producer counters
        uint256 createdAt;
    }

    enum BidStatus {
        Pending,
        Accepted,
        Rejected,
        Countered
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    address public  owner;
    bool    public  paused;

    DECT_Credit public  creditToken;

    uint256 public  nextListingId;
    uint256 public  nextBidId;
    uint256 public  totalPurchases;
    uint256 public  recentPurchases;
    uint256 public  windowStart;

    uint256 public  constant WINDOW_SIZE     = 10;
    uint256 public  constant MIN_MULTIPLIER  = 50;
    uint256 public  constant MAX_MULTIPLIER  = 300;
    uint256 public  constant BASE_MULTIPLIER = 100;

    // Fee: basis points (50 = 0.5%)
    uint256 public  feeBasisPoints   = 50;
    address public  feeCollector;

    mapping(uint256 => EnergyListing) public listings;
    mapping(uint256 => Bid)           public bids;
    mapping(address => uint256)       public ethBalances;   // ETH earned
    mapping(address => uint256[])     public sellerListings;
    mapping(address => uint256[])     public buyerBids;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event ListingCreated(
        uint256 indexed id,
        address indexed seller,
        uint256 energyAmount,
        uint256 basePricePerUnit,
        string  deviceType
    );

    event ListingCancelled(uint256 indexed id);

    event BidPlaced(
        uint256 indexed bidId,
        uint256 indexed listingId,
        address indexed buyer,
        uint256 offeredPricePerUnit,
        uint256 energyAmount
    );

    event BidAccepted(
        uint256 indexed bidId,
        uint256 indexed listingId,
        address indexed buyer,
        address seller,
        uint256 totalCost
    );

    event BidRejected(uint256 indexed bidId);

    event BidCountered(
        uint256 indexed bidId,
        uint256 counterPrice
    );

    event EnergyPurchased(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 energyAmount,
        uint256 totalCost,
        uint256 multiplierUsed
    );

    event Withdrawn(address indexed seller, uint256 amount);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event FeeUpdated(uint256 newFeeBasisPoints);

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "System is paused");
        _;
    }

    modifier whenPaused() {
        require(paused, "System is not paused");
        _;
    }

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    constructor(address _creditToken, address _feeCollector) {
        owner        = msg.sender;
        feeCollector = _feeCollector;
        creditToken  = DECT_Credit(_creditToken);
        windowStart  = block.number;
    }

    // ─────────────────────────────────────────────
    //  Dynamic Pricing
    // ─────────────────────────────────────────────

    function getActiveListingCount() public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].active) count++;
        }
        return count;
    }

    function _updateWindow() internal {
        if (block.number >= windowStart + WINDOW_SIZE) {
            windowStart     = block.number;
            recentPurchases = 0;
        }
    }

    function getMultiplier() public view returns (uint256) {
        uint256 supply = getActiveListingCount();
        uint256 demand = recentPurchases;

        if (supply == 0) return BASE_MULTIPLIER;

        uint256 ratio;
        if (demand == 0) {
            ratio = MIN_MULTIPLIER;
        } else {
            ratio = (demand * BASE_MULTIPLIER) / supply;
        }

        if (ratio < MIN_MULTIPLIER) return MIN_MULTIPLIER;
        if (ratio > MAX_MULTIPLIER) return MAX_MULTIPLIER;
        return ratio;
    }

  function getDynamicPrice(uint256 _listingId)
    public
    view
    returns (
        uint256 dynamicPricePerUnit,
        uint256 totalCost,
        uint256 multiplier
    )
{
    EnergyListing storage l = listings[_listingId];

    require(l.active, "Listing not active");

    multiplier = getMultiplier();

    dynamicPricePerUnit =
        (l.basePricePerUnit * multiplier) / BASE_MULTIPLIER;

    totalCost = dynamicPricePerUnit * l.energyAmount;
}
    // ─────────────────────────────────────────────
    //  Fee Calculation
    // ─────────────────────────────────────────────

    function calculateFee(uint256 amount)
        public
        view
        returns (uint256 fee, uint256 sellerAmount)
    {
        fee          = (amount * feeBasisPoints) / 10000;
        sellerAmount = amount - fee;
    }

    // ─────────────────────────────────────────────
    //  Listing Functions
    // ─────────────────────────────────────────────

    function createListing(
        uint256 _energyAmount,
        uint256 _basePricePerUnit,
        string  calldata _deviceType
    )
        external
        whenNotPaused
        returns (uint256)
    {
        require(_energyAmount     > 0, "Energy amount must be > 0");
        require(_basePricePerUnit > 0, "Price must be > 0");

        uint256 id = nextListingId++;
        listings[id] = EnergyListing({
            id:               id,
            seller:           msg.sender,
            energyAmount:     _energyAmount,
            basePricePerUnit: _basePricePerUnit,
            active:           true,
            createdAt:        block.timestamp,
            deviceType:       _deviceType
        });

        sellerListings[msg.sender].push(id);

        emit ListingCreated(
            id,
            msg.sender,
            _energyAmount,
            _basePricePerUnit,
            _deviceType
        );
        return id;
    }

    function cancelListing(uint256 _listingId)
        external
        whenNotPaused
    {
        EnergyListing storage listing = listings[_listingId];
        require(listing.seller == msg.sender, "Not your listing");
        require(listing.active,               "Already inactive");
        listing.active = false;
        emit ListingCancelled(_listingId);
    }

    // ─────────────────────────────────────────────
    //  Direct Purchase
    // ─────────────────────────────────────────────

    function purchaseEnergy(uint256 _listingId)
        external
        payable
        whenNotPaused
    {
        EnergyListing storage listing = listings[_listingId];

        require(listing.active,               "Listing is not active");
        require(listing.seller != msg.sender, "Cannot buy your own listing");

        (, uint256 totalCost, uint256 mult) = getDynamicPrice(_listingId);
        require(msg.value == totalCost, "Incorrect ETH sent");

        // Fee split
        (uint256 fee, uint256 sellerAmount) = calculateFee(msg.value);

        _updateWindow();
        recentPurchases++;
        totalPurchases++;

        listing.active = false;
        ethBalances[listing.seller] += sellerAmount;
        ethBalances[feeCollector]   += fee;

        // Mint TKN to seller (1 TKN per 1000 wei earned)
        uint256 tkn = sellerAmount / 1000;
        if (tkn > 0) {
            creditToken.mint(listing.seller, tkn);
        }

        emit EnergyPurchased(
            _listingId,
            msg.sender,
            listing.seller,
            listing.energyAmount,
            totalCost,
            mult
        );
    }

    // ─────────────────────────────────────────────
    //  Bid System
    // ─────────────────────────────────────────────

    function placeBid(
        uint256 _listingId,
        uint256 _offeredPricePerUnit,
        uint256 _energyAmount
    )
        external
        payable
        whenNotPaused
        returns (uint256)
    {
        EnergyListing storage listing = listings[_listingId];
        require(listing.active,               "Listing not active");
        require(listing.seller != msg.sender, "Cannot bid on own listing");
        require(_offeredPricePerUnit > 0,     "Price must be > 0");
        require(
            _energyAmount > 0 &&
            _energyAmount <= listing.energyAmount,
            "Invalid energy amount"
        );

        // Buyer deposits ETH upfront to guarantee bid
        uint256 requiredDeposit = _offeredPricePerUnit * _energyAmount;
        require(msg.value == requiredDeposit, "Deposit must equal bid total");

        uint256 bidId = nextBidId++;
        bids[bidId] = Bid({
            id:                  bidId,
            listingId:           _listingId,
            buyer:               msg.sender,
            offeredPricePerUnit: _offeredPricePerUnit,
            energyAmount:        _energyAmount,
            status:              BidStatus.Pending,
            counterPrice:        0,
            createdAt:           block.timestamp
        });

        buyerBids[msg.sender].push(bidId);

        emit BidPlaced(
            bidId,
            _listingId,
            msg.sender,
            _offeredPricePerUnit,
            _energyAmount
        );
        return bidId;
    }

    function acceptBid(uint256 _bidId)
        external
        whenNotPaused
    {
        Bid storage bid = bids[_bidId];
        EnergyListing storage listing = listings[bid.listingId];

        require(listing.seller == msg.sender,     "Not your listing");
        require(listing.active,                    "Listing not active");
        require(bid.status == BidStatus.Pending ||
                bid.status == BidStatus.Countered, "Bid not actionable");

        uint256 totalCost = bid.offeredPricePerUnit * bid.energyAmount;
        (uint256 fee, uint256 sellerAmount) = calculateFee(totalCost);

        bid.status     = BidStatus.Accepted;
        listing.active = false;

        _updateWindow();
        recentPurchases++;
        totalPurchases++;

        ethBalances[msg.sender]   += sellerAmount;
        ethBalances[feeCollector] += fee;

        // Mint TKN to seller
        uint256 tkn = sellerAmount / 1000;
        if (tkn > 0) {
            creditToken.mint(msg.sender, tkn);
        }

        emit BidAccepted(
            _bidId,
            bid.listingId,
            bid.buyer,
            msg.sender,
            totalCost
        );
    }

    function rejectBid(uint256 _bidId)
        external
        whenNotPaused
    {
        Bid storage bid = bids[_bidId];
        EnergyListing storage listing = listings[bid.listingId];

        require(listing.seller == msg.sender, "Not your listing");
        require(bid.status == BidStatus.Pending ||
                bid.status == BidStatus.Countered, "Bid not actionable");

        bid.status = BidStatus.Rejected;

        // Refund buyer deposit
        uint256 refund = bid.offeredPricePerUnit * bid.energyAmount;
        (bool ok, ) = payable(bid.buyer).call{value: refund}("");
        require(ok, "Refund failed");

        emit BidRejected(_bidId);
    }

    function counterBid(uint256 _bidId, uint256 _counterPricePerUnit)
        external
        whenNotPaused
    {
        Bid storage bid = bids[_bidId];
        EnergyListing storage listing = listings[bid.listingId];

        require(listing.seller == msg.sender, "Not your listing");
        require(bid.status == BidStatus.Pending, "Can only counter pending bids");
        require(_counterPricePerUnit > 0,        "Counter price must be > 0");

        bid.status       = BidStatus.Countered;
        bid.counterPrice = _counterPricePerUnit;

        emit BidCountered(_bidId, _counterPricePerUnit);
    }

    function acceptCounter(uint256 _bidId)
        external
        payable
        whenNotPaused
    {
        Bid storage bid = bids[_bidId];

        require(bid.buyer == msg.sender,          "Not your bid");
        require(bid.status == BidStatus.Countered, "No counter to accept");

        uint256 originalDeposit = bid.offeredPricePerUnit * bid.energyAmount;
        uint256 newTotal        = bid.counterPrice * bid.energyAmount;

        if (newTotal > originalDeposit) {
            // Buyer pays the difference
            require(
                msg.value == newTotal - originalDeposit,
                "Send the difference"
            );
        } else if (newTotal < originalDeposit) {
            // Refund the difference to buyer
            require(msg.value == 0, "No extra payment needed");
            uint256 refund = originalDeposit - newTotal;
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "Refund failed");
        }

        // Update bid price to counter price
        bid.offeredPricePerUnit = bid.counterPrice;
        bid.status = BidStatus.Pending;

        // Now accept it
        EnergyListing storage listing = listings[bid.listingId];
        (uint256 fee, uint256 sellerAmount) = calculateFee(newTotal);

        bid.status     = BidStatus.Accepted;
        listing.active = false;

        _updateWindow();
        recentPurchases++;
        totalPurchases++;

        ethBalances[listing.seller] += sellerAmount;
        ethBalances[feeCollector]   += fee;

        uint256 tkn = sellerAmount / 1000;
        if (tkn > 0) {
            creditToken.mint(listing.seller, tkn);
        }

        emit BidAccepted(
            _bidId,
            bid.listingId,
            msg.sender,
            listing.seller,
            newTotal
        );
    }

    // ─────────────────────────────────────────────
    //  Withdraw
    // ─────────────────────────────────────────────

    function withdraw() external {
        uint256 amount = ethBalances[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        ethBalances[msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    // ─────────────────────────────────────────────
    //  Admin Functions
    // ─────────────────────────────────────────────

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner whenPaused {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function setFee(uint256 _feeBasisPoints) external onlyOwner {
        require(_feeBasisPoints <= 1000, "Fee too high"); // max 10%
        feeBasisPoints = _feeBasisPoints;
        emit FeeUpdated(_feeBasisPoints);
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
    }

    // ─────────────────────────────────────────────
    //  View Functions
    // ─────────────────────────────────────────────

    function getListing(uint256 _listingId)
        external
        view
        returns (EnergyListing memory)
    {
        return listings[_listingId];
    }

    function getBid(uint256 _bidId)
        external
        view
        returns (Bid memory)
    {
        return bids[_bidId];
    }

    function getSellerListings(address _seller)
        external
        view
        returns (uint256[] memory)
    {
        return sellerListings[_seller];
    }

    function getBuyerBids(address _buyer)
        external
        view
        returns (uint256[] memory)
    {
        return buyerBids[_buyer];
    }

    function getMarketStats()
        external
        view
        returns (
            uint256 supply,
            uint256 demand,
            uint256 multiplier,
            uint256 totalListings,
            uint256 allPurchases
        )
    {
        supply        = getActiveListingCount();
        demand        = recentPurchases;
        multiplier    = getMultiplier();
        totalListings = nextListingId;
        allPurchases  = totalPurchases;
    }
}