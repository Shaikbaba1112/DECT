import React, { useEffect, useState } from "react";
import { consumerAPI } from "../../services/api";
import { useWallet }   from "../../hooks/useWallet";
import useToast        from "../../hooks/useToast";
import PageHeader      from "../../components/PageHeader";
import StatusBadge     from "../../components/StatusBadge";
import EmptyState      from "../../components/EmptyState";
import LoadingSpinner  from "../../components/LoadingSpinner";

const FILTERS = ["all", "pending", "accepted", "rejected", "countered"];

export default function ConsumerBids() {
  const { formatEth }    = useWallet();
  const { showToast }    = useToast();
  const [bids,   setBids]   = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading,setLoading]= useState(true);

  useEffect(() => {
    setLoading(true);
    const params = filter !== "all" ? { status: filter } : {};
    consumerAPI.getBids(params)
      .then(r => setBids(r.data))
      .catch(() => showToast("Failed to load bids.", "error"))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="page">
      <PageHeader title="My Bids" subtitle="Track your bid status" />

      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-mono text-xs px-3 py-1.5 rounded border
                        capitalize transition-all duration-200
                        ${filter === f
                          ? "border-accent text-accent bg-accent/10"
                          : "border-border text-muted hover:border-muted"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner text="LOADING BIDS…" />
      ) : bids.length === 0 ? (
        <EmptyState
          icon="📬"
          title="No bids found"
          subtitle="Place bids on listings in the marketplace."
        />
      ) : (
        <div className="dect-card overflow-x-auto">
          <table className="dect-table">
            <thead>
              <tr>
                <th>Bid ID</th>
                <th>Listing</th>
                <th>Energy</th>
                <th>Your Offer</th>
                <th>Total</th>
                <th>Counter Offer</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {bids.map(bid => (
                <tr key={bid.id} className="animate-fadeIn">
                  <td className="text-muted">#{bid.id}</td>
                  <td className="text-muted">#{bid.listing_id_field}</td>
                  <td>{bid.energy_amount} Wh</td>
                  <td className="font-mono">
                    {formatEth(bid.offered_price_per_unit)} ETH/Wh
                  </td>
                  <td className="text-accent font-mono">
                    {formatEth(bid.total_offered)} ETH
                  </td>
                  <td className="font-mono text-warning">
                    {bid.counter_price
                      ? `${formatEth(bid.counter_price)} ETH/Wh`
                      : "—"}
                  </td>
                  <td><StatusBadge status={bid.status} /></td>
                  <td className="text-muted">
                    {new Date(bid.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}