import React, { useEffect, useState, useCallback } from "react";
import { producerAPI, marketAPI } from "../../services/api";
import { useWallet }  from "../../hooks/useWallet";
import useToast       from "../../hooks/useToast";
import PageHeader     from "../../components/PageHeader";
import StatusBadge    from "../../components/StatusBadge";
import EmptyState     from "../../components/EmptyState";
import LoadingSpinner from "../../components/LoadingSpinner";
import ConfirmModal   from "../../components/ConfirmModal";
import MultiplierBadge from "../../components/MultiplierBadge";


const FILTERS = ["all", "active", "sold", "cancelled", "paused"];

export default function ProducerListings() {
 const { createListing, cancelListing: cancelOnChain,
        formatEth, parseEth,
        isConnected, connect,       // ← add connect
        initialized }               = useWallet();

  const { showToast, promiseToast } = useToast();

  const [listings,    setListings]    = useState([]);
  const [filter,      setFilter]      = useState("all");
  const [loading,     setLoading]     = useState(true);
  const [multiplier,  setMultiplier]  = useState(null);
  const [showForm,    setShowForm]    = useState(false);
  const [creating,    setCreating]    = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  const [form, setForm] = useState({
    energy: "", price: "", deviceType: "solar", expires: "",
  });

  const load = useCallback(async () => {
  setLoading(true);
  try {
    const params = filter !== "all" ? { status: filter } : {};
    const listRes = await producerAPI.getListings(params);
    setListings(listRes.data);

    try {
      const mktRes = await marketAPI.getStats();
      setMultiplier(mktRes.data?.multiplier ?? null);
    } catch {
      setMultiplier(null);
    }
  } catch (err) {
    showToast("Failed to load listings.", "error");
    console.error(err);
  } finally {
    setLoading(false);
  }
}, [filter]);

  useEffect(() => { load(); }, [load]);


// Replace the handleCreate guard block:
  const handleCreate = async (e) => {
    e.preventDefault();

    // If not connected, try to connect first
    if (!isConnected) {
      try {
        showToast("Connecting wallet…", "pending");
        await connect();
        showToast("dismiss");
      } catch {
        showToast("dismiss");
        showToast("Connect MetaMask first.", "error");
        return;
      }
    }

    if (!form.energy || !form.price) {
      showToast("Fill in all required fields.", "error");
      return;
    }

    setCreating(true);
    try {
      showToast("Confirm transaction in MetaMask…", "pending");
      const priceWei = parseEth(form.price);
      const { listingId } = await createListing(
        form.energy,
        priceWei,
        form.deviceType
      );
      showToast("dismiss");

      if (listingId !== null && listingId >= 0) {
        await marketAPI.syncListing(listingId);
      } else {
        // Fallback sync
        for (let i = 0; i < 10; i++) {
          try { await marketAPI.syncListing(i); } catch { break; }
        }
      }

      showToast("Listing created!", "success");
      setForm({ energy: "", price: "", deviceType: "solar", expires: "" });
      setShowForm(false);
      load();
    } catch (e) {
      showToast("dismiss");
      showToast(e.message || "Transaction failed.", "error");
    } finally {
      setCreating(false);
    }
  };


  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await promiseToast(
        cancelOnChain(cancelTarget.listing_id).then(() =>
          marketAPI.syncListing(cancelTarget.listing_id)
        ),
        {
          loading: "Cancelling listing…",
          success: "Listing cancelled.",
          error:   "Cancellation failed.",
        }
      );
      load();
    } catch { /* handled */ }
    finally { setCancelTarget(null); }
  };

  const totalValue = (listing) => {
    try {
      return (BigInt(listing.price_per_unit) *
              BigInt(listing.energy_amount)).toString();
    } catch { return "0"; }
  };

  return (
    <div className="page">
      <PageHeader
        title="My Listings"
        subtitle="Create and manage your energy listings"
        action={
          <button
            onClick={() => setShowForm(s => !s)}
            className="btn-primary"
          >
            {showForm ? "✕ Close" : "+ New Listing"}
          </button>
        }
      />

      {/* Create Form */}
      {showForm && (
        <div className="dect-card mb-6 animate-slideUp">
          <p className="section-label">New Listing</p>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              <div>
                <label className="dect-label">Energy Amount (Wh)</label>
                <input
                  className="dect-input"
                  type="number"
                  placeholder="e.g. 100"
                  value={form.energy}
                  onChange={e => setForm(f => ({...f, energy: e.target.value}))}
                />
              </div>

              <div>
                <label className="dect-label">Base Price/Wh (ETH)</label>
                <input
                  className="dect-input"
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 0.001"
                  value={form.price}
                  onChange={e => setForm(f => ({...f, price: e.target.value}))}
                />
              </div>

              <div>
                <label className="dect-label">Device Type</label>
                <select
                  className="dect-input"
                  value={form.deviceType}
                  onChange={e => setForm(f => ({...f, deviceType: e.target.value}))}
                >
                  <option value="solar">Solar</option>
                  <option value="wind">Wind</option>
                  <option value="battery">Battery</option>
                </select>
              </div>

              <div>
                <label className="dect-label">Total Value</label>
                <div className="dect-input bg-bg/50 text-accent">
                  {form.energy && form.price
                    ? `${(parseFloat(form.energy) * parseFloat(form.price)).toFixed(6)} ETH`
                    : "—"}
                </div>
              </div>
            </div>

            {multiplier && (
              <div className="flex items-center gap-3 p-3
                              rounded border border-border bg-bg/50">
                <MultiplierBadge multiplier={multiplier} />
                <p className="font-mono text-xs text-muted">
                  At current multiplier, buyers will pay{" "}
                  <span className="text-accent">
                    {form.price
                      ? (parseFloat(form.price) * multiplier / 100).toFixed(6)
                      : "—"}
                  </span>
                  {" "}ETH/Wh
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={creating}
              className="btn-primary"
            >
              {creating
                ? "Creating…"
                : !isConnected
                ? "Connect Wallet & Create"
                : "Create Listing"}
            </button>
          </form>
        </div>
      )}

      {/* Filter tabs */}
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
          </button>
        ))}
      </div>
      // Add this notice inside the listings table after the filter tabs:
    {listings.filter(l => l.status === "pending").length > 0 && (
      <div className="pending-notice">
        <span>⏳</span>
        <div>
          <p className="pending-notice-title">
            {listings.filter(l => l.status === "pending").length} listing(s) awaiting admin approval
          </p>
          <p className="pending-notice-sub">
            Your listings will go live on the marketplace once an admin approves them.
            This usually takes a few minutes.
          </p>
        </div>
      </div>
    )}
      {/* Listings table */}
      {loading ? (
        <LoadingSpinner text="LOADING LISTINGS…" />
      ) : listings.length === 0? (
        <EmptyState
          icon="📋"
          title="No listings found"
          subtitle="Create your first listing to start selling energy."
        />
      ) : (
        <div className="dect-card overflow-x-auto">
          <table className="dect-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Energy</th>
                <th>Base Price</th>
                <th>Total Value</th>
                <th>Device</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {listings.map(l => (
                <tr key={l.id} className="animate-fadeIn">
                  <td className="text-muted font-mono">
                    #{l.listing_id}
                  </td>
                  <td>{l.energy_amount} Wh</td>
                  <td className="font-mono">
                    {formatEth(l.base_price_per_unit)} ETH
                  </td>
                  <td className="text-accent font-mono">
                    {formatEth(totalValue(l))} ETH
                  </td>
                  <td className="capitalize text-muted">{l.device_type}</td>
                  <td><StatusBadge status={l.status} /></td>
                  <td className="text-muted">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    {l.active && (
                      <button
                        onClick={() => setCancelTarget(l)}
                        className="font-mono text-xs text-danger
                                   hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!cancelTarget}
        title="Cancel Listing"
        message={`Cancel listing #${cancelTarget?.listing_id}? This will remove it from the marketplace.`}
        confirmLabel="Cancel Listing"
        danger
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}