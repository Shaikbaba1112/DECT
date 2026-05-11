import React, { useEffect, useState, useCallback } from "react";
import { producerAPI } from "../../services/api";
import { useWallet }   from "../../hooks/useWallet";
import useToast        from "../../hooks/useToast";
import PageHeader      from "../../components/PageHeader";
import StatusBadge     from "../../components/StatusBadge";
import EmptyState      from "../../components/EmptyState";
import LoadingSpinner  from "../../components/LoadingSpinner";
import { ethers } from 'ethers';

export default function ProducerBids() {
  const { acceptBid, rejectBid, counterBid,
          formatEth, isConnected } = useWallet();
  const { showToast, promiseToast } = useToast();

  const [bids,         setBids]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState("pending");
  const [counterModal, setCounterModal] = useState(null);
  const [counterPrice, setCounterPrice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? { status: filter } : {};
      const res    = await producerAPI.getBids(params);
      setBids(res.data);
    } catch {
      showToast("Failed to load bids.", "error");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (bid) => {
    if (!isConnected) {
      showToast("Connect wallet first.", "error");
      return;
    }
    try {
      await promiseToast(
        acceptBid(bid.on_chain_bid_id).then(() =>
          producerAPI.respondBid(bid.id, { action: "accept" })
        ),
        {
          loading: "Accepting bid on-chain…",
          success: "Bid accepted!",
          error:   "Failed to accept bid.",
        }
      );
      load();
    } catch { /* handled */ }
  };

  const handleReject = async (bid) => {
    try {
      await promiseToast(
        rejectBid(bid.on_chain_bid_id).then(() =>
          producerAPI.respondBid(bid.id, { action: "reject" })
        ),
        {
          loading: "Rejecting bid…",
          success: "Bid rejected.",
          error:   "Failed to reject bid.",
        }
      );
      load();
    } catch { /* handled */ }
  };

  const handleCounter = async () => {
    if (!counterPrice) {
      showToast("Enter a counter price.", "error");
      return;
    }
    const { ethers } = await import("ethers");
    const priceWei   = ethers.parseEther(counterPrice).toString();
    try {
      await promiseToast(
        counterBid(counterModal.on_chain_bid_id, priceWei).then(() =>
          producerAPI.respondBid(counterModal.id, {
            action: "counter",
            counter_price: priceWei,
          })
        ),
        {
          loading: "Sending counter offer…",
          success: "Counter offer sent!",
          error:   "Failed to counter.",
        }
      );
      setCounterModal(null);
      setCounterPrice("");
      load();
    } catch { /* handled */ }
  };

  const FILTERS = ["all", "pending", "accepted", "rejected", "countered"];

  return (
    <div className="page">
      <PageHeader
        title="Bid Inbox"
        subtitle="Review and respond to buyer bids"
      />

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-mono text-xs px-3 py-1.5 rounded border
                        transition-all duration-200 capitalize
                        ${filter === f
                          ? "border-accent text-accent bg-accent/10"
                          : "border-border text-muted hover:border-muted"}`}
          >
            {f}
            {f === "pending" && (
              <span className="ml-1.5 bg-warning/20 text-warning
                               font-mono text-[9px] px-1 rounded">
                {bids.filter(b => b.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner text="LOADING BIDS…" />
      ) : bids.length === 0 ? (
        <EmptyState
          icon="📬"
          title="No bids found"
          subtitle="When buyers bid on your listings they appear here."
        />
      ) : (
        <div className="dect-card overflow-x-auto">
          <table className="dect-table">
            <thead>
              <tr>
                <th>Bid ID</th>
                <th>Listing</th>
                <th>Buyer</th>
                <th>Energy</th>
                <th>Offered Price</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bids.map(bid => {
                const total = (
                  BigInt(bid.offered_price_per_unit) *
                 BigInt(bid.energy_amount)
                ).toString();
                return (
                  <tr key={bid.id} className="animate-fadeIn">
                    <td className="text-muted">#{bid.id}</td>
                    <td className="text-muted">#{bid.listing_id_field}</td>
                    <td className="font-mono text-xs text-muted">
                      {bid.buyer_username}
                    </td>
                    <td>{bid.energy_amount} Wh</td>
                    <td className="font-mono">
                      {formatEth(bid.offered_price_per_unit)} ETH/Wh
                    </td>
                    <td className="text-accent font-mono">
                      {formatEth(total)} ETH
                    </td>
                    <td>
                      <StatusBadge status={bid.status} />
                      {bid.counter_price && (
                        <p className="font-mono text-[10px] text-warning mt-1">
                          Counter: {formatEth(bid.counter_price)} ETH/Wh
                        </p>
                      )}
                    </td>
                    <td>
                      {bid.status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAccept(bid)}
                            className="font-mono text-xs text-accent
                                       hover:underline"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => setCounterModal(bid)}
                            className="font-mono text-xs text-warning
                                       hover:underline"
                          >
                            Counter
                          </button>
                          <button
                            onClick={() => handleReject(bid)}
                            className="font-mono text-xs text-danger
                                       hover:underline"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Counter Modal */}
      {counterModal && (
        <div className="fixed inset-0 z-50 flex items-center
                        justify-center bg-black/60 backdrop-blur-sm">
          <div className="dect-card w-full max-w-sm mx-4 animate-slideUp">
            <p className="font-mono text-sm text-textPrimary mb-4">
              Counter Offer — Bid #{counterModal.id}
            </p>
            <div className="mb-4">
              <label className="dect-label">Your Counter Price (ETH/Wh)</label>
              <input
                className="dect-input"
                type="number"
                step="0.0001"
                placeholder="e.g. 0.002"
                value={counterPrice}
                onChange={e => setCounterPrice(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setCounterModal(null); setCounterPrice(""); }}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleCounter}
                className="btn-primary flex-1"
              >
                Send Counter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}