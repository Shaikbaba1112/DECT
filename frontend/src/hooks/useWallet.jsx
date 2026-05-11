import React, {
  createContext, useContext,
  useState, useEffect, useCallback,
} from "react";
import { ethers } from "ethers";

const WalletContext = createContext(null);

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || "";
const CREDIT_ADDRESS   = process.env.REACT_APP_CREDIT_ADDRESS   || "";

const MARKET_ABI = [
  "function createListing(uint256 _energyAmount, uint256 _basePricePerUnit, string _deviceType) returns (uint256)",
  "function purchaseEnergy(uint256 _listingId) payable",
  "function placeBid(uint256 _listingId, uint256 _offeredPricePerUnit, uint256 _energyAmount) payable returns (uint256)",
  "function acceptBid(uint256 _bidId)",
  "function rejectBid(uint256 _bidId)",
  "function counterBid(uint256 _bidId, uint256 _counterPricePerUnit)",
  "function acceptCounter(uint256 _bidId) payable",
  "function cancelListing(uint256 _listingId)",
  "function withdraw()",
  "function getDynamicPrice(uint256 _listingId) view returns (uint256, uint256, uint256)",
  "function getMarketStats() view returns (uint256, uint256, uint256, uint256, uint256)",
  "function ethBalances(address) view returns (uint256)",
  "function nextListingId() view returns (uint256)",
  "function paused() view returns (bool)",
  "event ListingCreated(uint256 indexed id, address indexed seller, uint256 energyAmount, uint256 basePricePerUnit, string deviceType)",
  "event EnergyPurchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 energyAmount, uint256 totalCost, uint256 multiplierUsed)",
  "event BidPlaced(uint256 indexed bidId, uint256 indexed listingId, address indexed buyer, uint256 offeredPricePerUnit, uint256 energyAmount)",
  "event BidAccepted(uint256 indexed bidId, uint256 indexed listingId, address indexed buyer, address seller, uint256 totalCost)",
];

const CREDIT_ABI = [
  "function getBalance(address _account) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(null);
  const [signer,        setSigner]        = useState(null);
  const [provider,      setProvider]      = useState(null);
  const [ethBalance,    setEthBalance]    = useState("0");
  const [tknBalance,    setTknBalance]    = useState("0");
  const [withdrawable,  setWithdrawable]  = useState("0");
  const [connecting,    setConnecting]    = useState(false);
  const [chainId,       setChainId]       = useState(null);
  const [initialized,   setInitialized]   = useState(false);

  // ── Init wallet from address ──────────────────────────────────────────
  const initWallet = useCallback(async (address) => {
    if (!address || !window.ethereum) return;
    try {
      const prov    = new ethers.BrowserProvider(window.ethereum);
      const sign    = await prov.getSigner();
      const network = await prov.getNetwork();

      setProvider(prov);
      setSigner(sign);
      setWalletAddress(address.toLowerCase());
      setChainId(Number(network.chainId));

      await fetchBalances(address, prov);
    } catch (e) {
      console.error("Wallet init error:", e);
    }
  }, []);

  // ── Fetch balances ────────────────────────────────────────────────────
  const fetchBalances = async (address, prov) => {
    if (!address || !prov) return;
    try {
      const ethBal = await prov.getBalance(address);
      setEthBalance(ethers.formatEther(ethBal));

      if (CREDIT_ADDRESS) {
        try {
          const credit = new ethers.Contract(CREDIT_ADDRESS, CREDIT_ABI, prov);
          const tkn    = await credit.getBalance(address);
          setTknBalance(ethers.formatEther(tkn));
        } catch { setTknBalance("0"); }
      }

      if (CONTRACT_ADDRESS) {
        try {
          const market = new ethers.Contract(CONTRACT_ADDRESS, MARKET_ABI, prov);
          const wd     = await market.ethBalances(address);
          setWithdrawable(ethers.formatEther(wd));
        } catch { setWithdrawable("0"); }
      }
    } catch (e) {
      console.warn("Balance fetch error:", e);
    }
  };

  // ── Auto-detect on mount ──────────────────────────────────────────────
  useEffect(() => {
    const autoDetect = async () => {
      if (!window.ethereum) {
        setInitialized(true);
        return;
      }
      try {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });
        if (accounts && accounts[0]) {
          await initWallet(accounts[0]);
        }
      } catch (e) {
        console.warn("Auto-detect error:", e);
      } finally {
        setInitialized(true);
      }
    };
    autoDetect();
  }, [initWallet]);

  // ── Listen for MetaMask events ────────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;

    const onAccountChange = async (accounts) => {
      if (accounts && accounts[0]) {
        await initWallet(accounts[0]);
      } else {
        setWalletAddress(null);
        setSigner(null);
        setProvider(null);
        setEthBalance("0");
        setTknBalance("0");
        setWithdrawable("0");
      }
    };

    const onChainChange = () => window.location.reload();

    window.ethereum.on("accountsChanged", onAccountChange);
    window.ethereum.on("chainChanged",    onChainChange);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountChange);
      window.ethereum.removeListener("chainChanged",    onChainChange);
    };
  }, [initWallet]);

  // ── Connect wallet ────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask not found. Please install it.");
    }
    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts && accounts[0]) {
        await initWallet(accounts[0]);
        return accounts[0];
      }
    } finally {
      setConnecting(false);
    }
  }, [initWallet]);

  // ── Refresh balances ──────────────────────────────────────────────────
  const refreshBalances = useCallback(async () => {
    if (walletAddress && provider) {
      await fetchBalances(walletAddress, provider);
    }
  }, [walletAddress, provider]);

  // ── Get contract ──────────────────────────────────────────────────────
  const getMarketContract = useCallback(() => {
    if (!signer)           throw new Error("Wallet not connected.");
    if (!CONTRACT_ADDRESS) throw new Error("Contract address not configured.");
    return new ethers.Contract(CONTRACT_ADDRESS, MARKET_ABI, signer);
  }, [signer]);

  // ── Parse listing ID from receipt ────────────────────────────────────
  const parseListingId = (receipt) => {
    const iface = new ethers.Interface([
      "event ListingCreated(uint256 indexed id, address indexed seller, uint256 energyAmount, uint256 basePricePerUnit, string deviceType)"
    ]);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name === "ListingCreated") return Number(parsed.args[0]);
      } catch { /* skip */ }
    }
    // Fallback — read nextListingId from chain
    return null;
  };

  // ── Parse bid ID from receipt ─────────────────────────────────────────
  const parseBidId = (receipt) => {
    const iface = new ethers.Interface([
      "event BidPlaced(uint256 indexed bidId, uint256 indexed listingId, address indexed buyer, uint256 offeredPricePerUnit, uint256 energyAmount)"
    ]);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name === "BidPlaced") return Number(parsed.args[0]);
      } catch { /* skip */ }
    }
    return null;
  };

  // ── Contract actions ──────────────────────────────────────────────────

  const createListing = useCallback(async (energyWh, basePriceWei, deviceType) => {
    const contract = getMarketContract();
    const tx       = await contract.createListing(
      BigInt(energyWh),
      BigInt(basePriceWei.toString()),
      deviceType || "solar",
    );
    const receipt  = await tx.wait();
    let listingId  = parseListingId(receipt);

    // Fallback — read nextListingId - 1
    if (listingId === null && provider && CONTRACT_ADDRESS) {
      try {
        const readContract = new ethers.Contract(
          CONTRACT_ADDRESS, MARKET_ABI, provider
        );
        const next = await readContract.nextListingId();
        listingId  = Number(next) - 1;
      } catch { /* ignore */ }
    }

    await refreshBalances();
    return { receipt, listingId };
  }, [getMarketContract, provider, refreshBalances]);

  const purchaseEnergy = useCallback(async (listingId, totalCostWei) => {
    const contract = getMarketContract();
    const tx       = await contract.purchaseEnergy(listingId, {
      value: BigInt(totalCostWei.toString()),
    });
    const receipt  = await tx.wait();
    await refreshBalances();
    return receipt;
  }, [getMarketContract, refreshBalances]);

  const placeBid = useCallback(async (listingId, offeredPriceWei, energyWh) => {
    const contract = getMarketContract();
    const deposit  = BigInt(offeredPriceWei.toString()) * BigInt(energyWh);
    const tx       = await contract.placeBid(
      listingId,
      BigInt(offeredPriceWei.toString()),
      BigInt(energyWh),
      { value: deposit },
    );
    const receipt  = await tx.wait();
    const bidId    = parseBidId(receipt);
    await refreshBalances();
    return { receipt, bidId };
  }, [getMarketContract, refreshBalances]);

  const acceptBid = useCallback(async (bidId) => {
    const contract = getMarketContract();
    const tx       = await contract.acceptBid(bidId);
    const receipt  = await tx.wait();
    await refreshBalances();
    return receipt;
  }, [getMarketContract, refreshBalances]);

  const rejectBid = useCallback(async (bidId) => {
    const contract = getMarketContract();
    const tx       = await contract.rejectBid(bidId);
    const receipt  = await tx.wait();
    await refreshBalances();
    return receipt;
  }, [getMarketContract, refreshBalances]);

  const counterBid = useCallback(async (bidId, counterPriceWei) => {
    const contract = getMarketContract();
    const tx       = await contract.counterBid(
      bidId, BigInt(counterPriceWei.toString())
    );
    return tx.wait();
  }, [getMarketContract]);

  const cancelListing = useCallback(async (listingId) => {
    const contract = getMarketContract();
    const tx       = await contract.cancelListing(listingId);
    const receipt  = await tx.wait();
    await refreshBalances();
    return receipt;
  }, [getMarketContract, refreshBalances]);

  const withdraw = useCallback(async () => {
    const contract = getMarketContract();
    const tx       = await contract.withdraw();
    const receipt  = await tx.wait();
    await refreshBalances();
    return receipt;
  }, [getMarketContract, refreshBalances]);

  const getDynamicPrice = useCallback(async (listingId) => {
    if (!provider || !CONTRACT_ADDRESS) return null;
    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS, MARKET_ABI, provider
      );
      const result   = await contract.getDynamicPrice(listingId);
      return {
        dynamicPricePerUnit: result[0],
        totalCost:           result[1],
        multiplier:          Number(result[2]),
      };
    } catch (e) {
      console.warn("getDynamicPrice error:", e);
      return null;
    }
  }, [provider]);

  const getMarketStats = useCallback(async () => {
    if (!provider || !CONTRACT_ADDRESS) return null;
    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS, MARKET_ABI, provider
      );
      const result   = await contract.getMarketStats();
      return {
        supply:        Number(result[0]),
        demand:        Number(result[1]),
        multiplier:    Number(result[2]),
        totalListings: Number(result[3]),
        allPurchases:  Number(result[4]),
      };
    } catch (e) {
      console.warn("getMarketStats error:", e);
      return null;
    }
  }, [provider]);

  // ── Helpers ───────────────────────────────────────────────────────────
  const formatEth = useCallback((wei) => {
    try {
      if (wei === null || wei === undefined) return "0.0";
      return ethers.formatEther(BigInt(wei.toString()));
    } catch {
      return "0.0";
    }
  }, []);

  const parseEth = useCallback((eth) => {
    try {
      return ethers.parseEther(eth.toString());
    } catch {
      return 0n;
    }
  }, []);

  const isCorrectNetwork = chainId === 1337;

  const value = {
    // State
    walletAddress,
    signer,
    provider,
    ethBalance,
    tknBalance,
    withdrawable,
    connecting,
    chainId,
    initialized,
    isCorrectNetwork,
    isConnected: !!walletAddress,

    // Actions
    connect,
    refreshBalances,

    // Contract
    createListing,
    purchaseEnergy,
    placeBid,
    acceptBid,
    rejectBid,
    counterBid,
    cancelListing,
    withdraw,
    getDynamicPrice,
    getMarketStats,

    // Helpers
    formatEth,
    parseEth,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}