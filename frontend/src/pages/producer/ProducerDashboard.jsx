import React, { useEffect, useState, useCallback } from "react";
import { useNavigate }     from "react-router-dom";
import { producerAPI, marketAPI } from "../../services/api";
import { useWallet }       from "../../hooks/useWallet";
import useToast            from "../../hooks/useToast";
import PageHeader          from "../../components/PageHeader";
import StatCard            from "../../components/StatCard";
import MultiplierBadge     from "../../components/MultiplierBadge";
import WalletWidget        from "../../components/WalletWidget";
import LoadingSpinner      from "../../components/LoadingSpinner";
import EmptyState          from "../../components/EmptyState";
import StatusBadge         from "../../components/StatusBadge";
import {
  BoltIcon,
  CurrencyDollarIcon,
  ListBulletIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";

export default function ProducerDashboard() {
  const navigate            = useNavigate();
  const { withdraw, withdrawable, refreshBalances,
        formatEth, isConnected, connect } = useWallet();
  const { showToast, promiseToast } = useToast();

  const [stats,       setStats]       = useState(null);
  const [listings,    setListings]    = useState([]);
  const [multiplier,  setMultiplier]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  // Replace the load function:
const load = useCallback(async () => {
  setLoading(true);
  try {
    const [statsRes, listingsRes] = await Promise.all([
      producerAPI.getStats(),
      producerAPI.getListings({ status: "active" }),
    ]);
    setStats(statsRes.data);
    setListings(listingsRes.data.slice(0, 5));

    // Market stats — may fail if blockchain not running
    try {
      const mktRes = await marketAPI.getStats();
      setMultiplier(mktRes.data);
    } catch {
      setMultiplier(null);
    }
  } catch (err) {
    showToast("Failed to load dashboard.", "error");
    console.error(err);
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => { load(); }, [load]);


// Replace handleWithdraw:
    const handleWithdraw = async () => {
      if (!isConnected) {
        try {
          await connect();
        } catch {
          showToast("Connect MetaMask first.", "error");
          return;
        }
      }

      const amount = parseFloat(withdrawable);
      if (amount <= 0) {
        showToast("No balance to withdraw.", "error");
        return;
      }

      setWithdrawing(true);
      try {
        await promiseToast(withdraw(), {
          loading: "Processing withdrawal…",
          success: "Withdrawal successful!",
          error:   "Withdrawal failed.",
        });
        refreshBalances();
      } catch { /* handled */ }
      finally { setWithdrawing(false); }
    };
  if (loading) return <LoadingSpinner text="LOADING DASHBOARD…" />;

  const hasBalance = parseFloat(withdrawable) > 0;

  return (
    <div className="page">
      <PageHeader
        title="Producer Dashboard"
        subtitle="Manage your energy listings and earnings"
        action={
          <button
            onClick={() => navigate("/producer/listings")}
            className="btn-primary"
          >
            + New Listing
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Listings"
          value={stats?.active_listings ?? 0}
          icon={ListBulletIcon}
          accent
        />
        <StatCard
          label="Total Sales"
          value={stats?.total_sales ?? 0}
          icon={ArrowsRightLeftIcon}
        />
        <StatCard
          label="Energy Sold (Wh)"
          value={stats?.total_energy_sold?.toLocaleString() ?? 0}
          icon={BoltIcon}
        />
        <StatCard
          label="Volume (ETH)"
          value={stats?.total_volume_eth ?? "0"}
          icon={CurrencyDollarIcon}
          accent
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Market Multiplier */}
          {multiplier && (
            <div className="dect-card">
              <p className="section-label">Live Market Multiplier</p>
              <div className="flex items-center gap-6 flex-wrap">
                <MultiplierBadge multiplier={multiplier.multiplier} />
                <div className="space-y-1">
                  <p className="font-sans text-sm text-textPrimary">
                    Your listings earn{" "}
                    <span className="text-accent font-bold">
                      {(multiplier.multiplier / 100).toFixed(2)}x
                    </span>{" "}
                    your base price right now.
                  </p>
                  <p className="font-mono text-xs text-muted">
                    Supply: {multiplier.supply} listings &nbsp;|&nbsp;
                    Demand: {multiplier.demand} recent buys
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {multiplier.multiplier > 100
                      ? "⬆ High demand — great time to list."
                      : multiplier.multiplier < 100
                      ? "⬇ Low demand — consider waiting."
                      : "→ Balanced market."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Active Listings */}
          <div className="dect-card">
            <div className="flex items-center justify-between mb-4">
              <p className="section-label mb-0">Recent Active Listings</p>
              <button
                onClick={() => navigate("/producer/listings")}
                className="font-mono text-xs text-accent hover:underline"
              >
                View All →
              </button>
            </div>

            {listings.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No active listings"
                subtitle="Create your first listing to start selling energy."
                action={
                  <button
                    onClick={() => navigate("/producer/listings")}
                    className="btn-secondary text-xs"
                  >
                    Create Listing
                  </button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="dect-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Energy</th>
                      <th>Base Price</th>
                      <th>Device</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map(l => (
                      <tr key={l.id}>
                        <td className="text-muted">#{l.listing_id}</td>
                        <td>{l.energy_amount} Wh</td>
                        <td>{formatEth(l.base_price_per_unit)} ETH/Wh</td>
                        <td className="capitalize">{l.device_type}</td>
                        <td><StatusBadge status={l.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Earnings */}
          <div className="dect-card">
            <p className="section-label">Earnings</p>
            <div className="space-y-3">
              <div>
                <p className="font-mono text-xs text-muted uppercase
                               tracking-wider mb-1">
                  Withdrawable
                </p>
                <p className={`font-mono text-2xl font-bold
                               ${hasBalance ? "text-accent" : "text-muted"}`}>
                  {parseFloat(withdrawable).toFixed(6)} ETH
                </p>
              </div>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Earnings accumulate on-chain after each sale.
                Withdraw to your wallet at any time.
              </p>
              <button
                onClick={handleWithdraw}
                disabled={!hasBalance || withdrawing}
                className="btn-primary w-full"
              >
                {withdrawing
                  ? "Processing…"
                  : hasBalance
                  ? `Withdraw ${parseFloat(withdrawable).toFixed(4)} ETH`
                  : "No Balance"}
              </button>
            </div>
          </div>

          {/* Wallet */}
          <div>
            <p className="section-label">Wallet</p>
            <WalletWidget />
          </div>

          {/* Quick links */}
          <div className="dect-card">
            <p className="section-label">Quick Actions</p>
            <div className="space-y-2">
              {[
                { label: "View Bid Inbox",    to: "/producer/bids" },
                { label: "Manage Devices",    to: "/producer/devices" },
                { label: "Trade History",     to: "/producer/trades" },
                { label: "Pause All Listings",action: "pause" },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() =>
                    item.to
                      ? navigate(item.to)
                      : producerAPI.pauseAll().then(() => {
                          showToast("All listings paused.", "success");
                          load();
                        })
                  }
                  className="w-full text-left font-mono text-xs
                             text-textSecondary hover:text-accent
                             border border-border hover:border-accent/40
                             rounded px-3 py-2.5 transition-all duration-200"
                >
                  {item.label} →
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}