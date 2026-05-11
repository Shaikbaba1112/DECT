import React, { useEffect, useState, useCallback } from "react";
import { useNavigate }                from "react-router-dom";
import { consumerAPI, marketAPI }     from "../../services/api";
import { useWallet }                  from "../../hooks/useWallet";
import useToast                       from "../../hooks/useToast";
import PageHeader                     from "../../components/PageHeader";
import StatCard                       from "../../components/StatCard";
import MultiplierBadge                from "../../components/MultiplierBadge";
import WalletWidget                   from "../../components/WalletWidget";
import LoadingSpinner                 from "../../components/LoadingSpinner";
import EmptyState                     from "../../components/EmptyState";
import StatusBadge                    from "../../components/StatusBadge";
import {
  BoltIcon, ShoppingCartIcon,
  ArrowsRightLeftIcon, CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

export default function ConsumerDashboard() {
  const navigate = useNavigate();
  const { formatEth }     = useWallet();
  const { showToast }     = useToast();

  const [stats,    setStats]    = useState(null);
  const [bids,     setBids]     = useState([]);
  const [trades,   setTrades]   = useState([]);
  const [market,   setMarket]   = useState(null);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, bidsRes, tradesRes, mktRes] = await Promise.all([
        consumerAPI.getStats(),
        consumerAPI.getBids({ status: "pending" }),
        consumerAPI.getTrades(),
        marketAPI.getStats(),
      ]);
      setStats(statsRes.data);
      setBids(bidsRes.data.slice(0, 3));
      setTrades(tradesRes.data.slice(0, 5));
      setMarket(mktRes.data);
    } catch {
      showToast("Failed to load dashboard.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner text="LOADING DASHBOARD…" />;

  return (
    <div className="page">
      <PageHeader
        title="Consumer Dashboard"
        subtitle="Browse and purchase energy from producers"
        action={
          <button
            onClick={() => navigate("/consumer/market")}
            className="btn-primary"
          >
            Browse Market →
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Available Listings"
          value={stats?.available_listings ?? 0}
          icon={ShoppingCartIcon}
          accent
        />
        <StatCard
          label="Your Purchases"
          value={stats?.total_purchases ?? 0}
          icon={ArrowsRightLeftIcon}
        />
        <StatCard
          label="Energy Bought (Wh)"
          value={stats?.total_energy_bought?.toLocaleString() ?? 0}
          icon={BoltIcon}
        />
        <StatCard
          label="Total Spent (ETH)"
          value={stats?.total_spent_eth ?? "0"}
          icon={CurrencyDollarIcon}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left */}
        <div className="lg:col-span-2 space-y-6">

          {/* Market overview */}
          {market && (
            <div className="dect-card">
              <p className="section-label">Market Status</p>
              <div className="flex items-center gap-6 flex-wrap">
                <MultiplierBadge multiplier={market.multiplier} />
                <div className="space-y-1">
                  <p className="font-sans text-sm text-textPrimary">
                    Current price multiplier:{" "}
                    <span className="text-accent font-bold">
                      {(market.multiplier / 100).toFixed(2)}x
                    </span>
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {market.supply} listings available
                    &nbsp;|&nbsp;
                    {market.demand} recent purchases
                  </p>
                </div>
                <button
                  onClick={() => navigate("/consumer/market")}
                  className="btn-secondary text-xs ml-auto"
                >
                  Browse →
                </button>
              </div>
            </div>
          )}

          {/* Pending bids */}
          <div className="dect-card">
            <div className="flex items-center justify-between mb-4">
              <p className="section-label mb-0">Pending Bids</p>
              <button
                onClick={() => navigate("/consumer/bids")}
                className="font-mono text-xs text-accent hover:underline"
              >
                View All →
              </button>
            </div>

            {bids.length === 0 ? (
              <EmptyState
                icon="📬"
                title="No pending bids"
                subtitle="Place bids on listings in the marketplace."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="dect-table">
                  <thead>
                    <tr>
                      <th>Listing</th>
                      <th>Energy</th>
                      <th>Your Offer</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bids.map(bid => (
                      <tr key={bid.id}>
                        <td className="text-muted">#{bid.listing_id_field}</td>
                        <td>{bid.energy_amount} Wh</td>
                        <td className="font-mono text-accent">
                          {formatEth(bid.total_offered)} ETH
                        </td>
                        <td><StatusBadge status={bid.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent trades */}
          <div className="dect-card">
            <div className="flex items-center justify-between mb-4">
              <p className="section-label mb-0">Recent Purchases</p>
              <button
                onClick={() => navigate("/consumer/trades")}
                className="font-mono text-xs text-accent hover:underline"
              >
                View All →
              </button>
            </div>

            {trades.length === 0 ? (
              <EmptyState
                icon="🛒"
                title="No purchases yet"
                subtitle="Buy energy from the marketplace."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="dect-table">
                  <thead>
                    <tr>
                      <th>Tx Hash</th>
                      <th>Seller</th>
                      <th>Energy</th>
                      <th>Paid</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map(tx => (
                      <tr key={tx.id}>
                        <td>
                          <a
                            href={`https://sepolia.etherscan.io/tx/${tx.tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-accent
                                       hover:underline"
                          >
                            {tx.tx_hash.slice(0,10)}…
                          </a>
                        </td>
                        <td className="font-mono text-xs text-muted">
                          {tx.seller_username ||
                           `${tx.seller_address.slice(0,8)}…`}
                        </td>
                        <td>{tx.energy_amount} Wh</td>
                        <td className="text-accent font-mono">
                          {formatEth(tx.total_cost)} ETH
                        </td>
                        <td className="text-muted">
                          {new Date(tx.timestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <div>
            <p className="section-label">Wallet</p>
            <WalletWidget />
          </div>

          {/* Quick actions */}
          <div className="dect-card">
            <p className="section-label">Quick Actions</p>
            <div className="space-y-2">
              {[
                { label: "Browse Marketplace", to: "/consumer/market" },
                { label: "My Bids",            to: "/consumer/bids" },
                { label: "Trade History",       to: "/consumer/trades" },
                { label: "Price Alerts",        to: "/settings/alerts" },
                { label: "Auto-Trade Rules",    to: "/settings/auto-trade" },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.to)}
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