import React, { useEffect, useState } from "react";
import { walletAPI }  from "../../services/api";
import { useWallet }  from "../../hooks/useWallet";
import { useAuth }    from "../../hooks/useAuth";
import useToast       from "../../hooks/useToast";
import PageHeader     from "../../components/PageHeader";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState     from "../../components/EmptyState";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GiftIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

const TX_TYPE_ICONS = {
  earn:     BoltIcon,
  spend:    ArrowUpIcon,
  withdraw: ArrowDownIcon,
  topup:    ArrowUpIcon,
  reward:   GiftIcon,
};

const TX_TYPE_COLORS = {
  earn:     "text-accent",
  spend:    "text-danger",
  withdraw: "text-warning",
  topup:    "text-blue-400",
  reward:   "text-accent",
};

export default function WalletPage() {
  const { walletAddress, ethBalance, tknBalance,
          withdrawable, withdraw, refreshBalances } = useWallet();
  const { user }          = useAuth();
  const { showToast, promiseToast } = useToast();

  const [walletData, setWalletData]   = useState(null);
  const [txns,       setTxns]         = useState([]);
  const [loading,    setLoading]      = useState(true);
  const [withdrawing,setWithdrawing]  = useState(false);
  const [toppingUp,  setToppingUp]    = useState(false);
  const [claiming,   setClaiming]     = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: "", destination: "" });
  const [topupAmount,  setTopupAmount]  = useState("");
  const [txFilter,   setTxFilter]     = useState("all");

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    setLoading(true);
    try {
      const [walRes, txRes] = await Promise.all([
        walletAPI.getWallet(),
        walletAPI.getTransactions(),
      ]);
      setWalletData(walRes.data);
      setTxns(txRes.data);
    } catch {
      showToast("Failed to load wallet.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawETH = async () => {
    const amount = parseFloat(withdrawable);
    if (amount <= 0) {
      showToast("No ETH balance to withdraw.", "error");
      return;
    }
    setWithdrawing(true);
    try {
      await promiseToast(withdraw(), {
        loading: "Withdrawing ETH…",
        success: "ETH withdrawn to your wallet!",
        error:   "Withdrawal failed.",
      });
      refreshBalances();
      loadWallet();
    } catch { /* handled */ }
    finally { setWithdrawing(false); }
  };

  const handleWithdrawTKN = async (e) => {
    e.preventDefault();
    if (!withdrawForm.amount || !withdrawForm.destination) {
      showToast("Fill in all fields.", "error");
      return;
    }
    setWithdrawing(true);
    try {
      await promiseToast(walletAPI.withdraw(withdrawForm), {
        loading: "Processing TKN withdrawal…",
        success: "TKN withdrawal initiated.",
        error:   "Withdrawal failed.",
      });
      setWithdrawForm({ amount: "", destination: "" });
      loadWallet();
    } catch { /* handled */ }
    finally { setWithdrawing(false); }
  };

  const handleTopUp = async (e) => {
    e.preventDefault();
    if (!topupAmount || parseFloat(topupAmount) <= 0) {
      showToast("Enter a valid amount.", "error");
      return;
    }
    setToppingUp(true);
    try {
      await promiseToast(walletAPI.topUp({ amount: topupAmount }), {
        loading: "Topping up wallet…",
        success: `Added ${topupAmount} TKN to wallet.`,
        error:   "Top-up failed.",
      });
      setTopupAmount("");
      loadWallet();
    } catch { /* handled */ }
    finally { setToppingUp(false); }
  };

  const handleClaimRewards = async () => {
    setClaiming(true);
    try {
      await promiseToast(walletAPI.claimRewards(), {
        loading: "Claiming rewards…",
        success: "15 TKN rewards claimed!",
        error:   "Claim failed.",
      });
      loadWallet();
    } catch { /* handled */ }
    finally { setClaiming(false); }
  };

  const filteredTxns = txFilter === "all"
    ? txns
    : txns.filter(t => t.type === txFilter);

  if (loading) return <LoadingSpinner text="LOADING WALLET…" />;

  const wallet = walletData?.wallet;

  return (
    <div className="page">
      <PageHeader
        title="Wallet"
        subtitle="Manage your TKN credits and ETH earnings"
      />

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
                      gap-4 mb-8">
        <div className="stat-card">
          <p className="stat-label">TKN Balance</p>
          <p className="stat-number text-accent">
            {parseFloat(wallet?.balance || 0).toFixed(4)}
          </p>
          <p className="font-mono text-[10px] text-muted mt-1">DECT Credits</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">On-Chain TKN</p>
          <p className="stat-number">
            {parseFloat(tknBalance).toFixed(4)}
          </p>
          <p className="font-mono text-[10px] text-muted mt-1">Blockchain Balance</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">ETH Balance</p>
          <p className="stat-number">
            {parseFloat(ethBalance).toFixed(4)}
          </p>
          <p className="font-mono text-[10px] text-muted mt-1">MetaMask Wallet</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Withdrawable ETH</p>
          <p className={`stat-number ${parseFloat(withdrawable) > 0 ? "text-accent" : ""}`}>
            {parseFloat(withdrawable).toFixed(6)}
          </p>
          <p className="font-mono text-[10px] text-muted mt-1">From Contract</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — actions */}
        <div className="space-y-6">

          {/* Withdraw ETH */}
          <div className="dect-card">
            <p className="section-label">Withdraw ETH</p>
            <p className="font-sans text-xs text-muted mb-4 leading-relaxed">
              Withdraw your earned ETH from energy sales directly
              to your MetaMask wallet.
            </p>
            <div className="flex justify-between items-center mb-4">
              <span className="font-mono text-xs text-muted">Available</span>
              <span className={`font-mono text-sm font-bold
                                ${parseFloat(withdrawable) > 0
                                  ? "text-accent"
                                  : "text-muted"}`}>
                {parseFloat(withdrawable).toFixed(6)} ETH
              </span>
            </div>
            <button
              onClick={handleWithdrawETH}
              disabled={withdrawing || parseFloat(withdrawable) <= 0}
              className="btn-primary w-full"
            >
              {withdrawing
                ? "Processing…"
                : parseFloat(withdrawable) > 0
                ? `Withdraw ${parseFloat(withdrawable).toFixed(4)} ETH`
                : "No ETH to Withdraw"}
            </button>
          </div>

          {/* Withdraw TKN */}
          <div className="dect-card">
            <p className="section-label">Withdraw TKN</p>
            <form onSubmit={handleWithdrawTKN} className="space-y-3">
              <div>
                <label className="dect-label">Amount (min 10 TKN)</label>
                <input
                  className="dect-input"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 50"
                  value={withdrawForm.amount}
                  onChange={e => setWithdrawForm(f => ({
                    ...f, amount: e.target.value
                  }))}
                />
              </div>
              <div>
                <label className="dect-label">Destination (0x…)</label>
                <input
                  className="dect-input font-mono text-xs"
                  placeholder="0xYourWalletAddress"
                  value={withdrawForm.destination}
                  onChange={e => setWithdrawForm(f => ({
                    ...f, destination: e.target.value
                  }))}
                />
              </div>
              <button
                type="submit"
                disabled={withdrawing}
                className="btn-secondary w-full"
              >
                {withdrawing ? "Processing…" : "Withdraw TKN"}
              </button>
            </form>
          </div>

          {/* Top Up */}
          <div className="dect-card">
            <p className="section-label">Top Up TKN</p>
            <form onSubmit={handleTopUp} className="space-y-3">
              <div>
                <label className="dect-label">Amount (TKN)</label>
                <input
                  className="dect-input"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 100"
                  value={topupAmount}
                  onChange={e => setTopupAmount(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={toppingUp}
                className="btn-ghost w-full"
              >
                {toppingUp ? "Processing…" : "Top Up Wallet"}
              </button>
            </form>
          </div>

          {/* Claim rewards */}
          <div className="dect-card">
            <p className="section-label">Rewards</p>
            <p className="font-sans text-xs text-muted mb-3 leading-relaxed">
              Claim your incentive rewards (15 TKN per claim).
            </p>
            <button
              onClick={handleClaimRewards}
              disabled={claiming}
              className="btn-ghost w-full flex items-center
                         justify-center gap-2"
            >
              <GiftIcon className="w-4 h-4" />
              {claiming ? "Claiming…" : "Claim 15 TKN Reward"}
            </button>
          </div>
        </div>

        {/* Right — transaction history */}
        <div className="lg:col-span-2">
          <div className="dect-card">
            <div className="flex items-center justify-between mb-4">
              <p className="section-label mb-0">Transaction History</p>
              <div className="flex gap-2">
                {["all", "earn", "spend", "withdraw", "topup", "reward"].map(f => (
                  <button
                    key={f}
                    onClick={() => setTxFilter(f)}
                    className={`font-mono text-[10px] px-2 py-1 rounded
                                border capitalize transition-all duration-200
                                ${txFilter === f
                                  ? "border-accent text-accent bg-accent/10"
                                  : "border-border text-muted"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filteredTxns.length === 0 ? (
              <EmptyState
                icon="💳"
                title="No transactions yet"
                subtitle="Your TKN transaction history appears here."
              />
            ) : (
              <div className="space-y-2">
                {filteredTxns.map(tx => {
                  const Icon  = TX_TYPE_ICONS[tx.type]  || BoltIcon;
                  const color = TX_TYPE_COLORS[tx.type] || "text-muted";
                  const isPos = ["earn", "topup", "reward"].includes(tx.type);

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3
                                 border-b border-border pb-3
                                 last:border-0 last:pb-0"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center
                                       justify-center flex-shrink-0
                                       ${color} bg-current/10`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-textPrimary
                                      capitalize">
                          {tx.type}
                        </p>
                        <p className="font-mono text-[10px] text-muted truncate">
                          {tx.description}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-mono text-sm font-bold ${color}`}>
                          {isPos ? "+" : ""}{parseFloat(tx.amount).toFixed(4)} TKN
                        </p>
                        <p className="font-mono text-[10px] text-muted">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lifetime stats */}
          <div className="dect-card mt-4">
            <p className="section-label">Lifetime Stats</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Earned",     value: `${parseFloat(wallet?.total_earned || 0).toFixed(2)} TKN` },
                { label: "Total Withdrawn",  value: `${parseFloat(wallet?.total_withdrawn || 0).toFixed(2)} TKN` },
                { label: "Net Balance",      value: `${parseFloat(wallet?.balance || 0).toFixed(2)} TKN` },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="font-mono text-xs text-muted mb-1">{label}</p>
                  <p className="font-mono text-sm text-textPrimary font-bold">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}