import React, { useEffect, useState, useCallback } from "react";
import { marketAPI }   from "../../services/api";
import { useWallet }   from "../../hooks/useWallet";
import { useAuth }     from "../../hooks/useAuth";
import useToast        from "../../hooks/useToast";
import PageHeader      from "../../components/PageHeader";
import MultiplierBadge from "../../components/MultiplierBadge";
import EmptyState      from "../../components/EmptyState";
import LoadingSpinner  from "../../components/LoadingSpinner";
import { ethers } from "ethers";

const SORT_OPTIONS = [
  { value: "newest",     label: "Newest First" },
  { value: "price_asc",  label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "energy_asc", label: "Energy: Low → High" },
];

const DEVICE_TYPES = ["all", "solar", "wind", "battery"];

export default function ConsumerMarket() {
  const { user }                           = useAuth();
  const { purchaseEnergy, placeBid,
          getDynamicPrice, formatEth,
          parseEth, isConnected }          = useWallet();
  const { showToast, promiseToast }        = useToast();

  const [listings,     setListings]     = useState([]);
  const [prices,       setPrices]       = useState({});
  const [market,       setMarket]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [loadingPrices,setLoadingPrices]= useState(false);
  const [search,       setSearch]       = useState("");
  const [sortBy,       setSortBy]       = useState("newest");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [buyingId,     setBuyingId]     = useState(null);
  const [bidModal,     setBidModal]     = useState(null);
  const [bidForm,      setBidForm]      = useState({ price: "", energy: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (deviceFilter !== "all") params.device_type = deviceFilter;
      const [listRes, mktRes] = await Promise.all([
        marketAPI.getListings(params),
        marketAPI.getStats(),
      ]);
      setListings(listRes.data);
      setMarket(mktRes.data);
    } catch {
      showToast("Failed to load marketplace.", "error");
    } finally {
      setLoading(false);
    }
  }, [deviceFilter]);

  useEffect(() => { load(); }, [load]);

  // Load dynamic prices when listings change
  useEffect(() => {
    if (!listings.length || !isConnected) return;
    loadDynamicPrices();
  }, [listings, isConnected]);

  const loadDynamicPrices = async () => {
    setLoadingPrices(true);
    const updated = {};
    for (const l of listings) {
      try {
        const p = await getDynamicPrice(l.listing_id);
        if (p) updated[l.listing_id] = p;
      } catch { /* skip inactive */ }
    }
    setPrices(updated);
    setLoadingPrices(false);
  };

  const handleDirectBuy = async (listing) => {
    if (!isConnected) { showToast("Connect wallet first.", "error"); return; }
    const price = prices[listing.listing_id];
    if (!price)  { showToast("Price not loaded.", "error"); return; }

    setBuyingId(listing.listing_id);
    try {
      await promiseToast(
        purchaseEnergy(listing.listing_id, price.totalCost.toString())
          .then(() => marketAPI.syncListing(listing.listing_id)),
        {
          loading: "Confirm in MetaMask…",
          success: `Purchased ${listing.energy_amount} Wh!`,
          error:   "Purchase failed.",
        }
      );
      load();
    } catch { /* handled */ }
    finally { setBuyingId(null); }
  };

  const handlePlaceBid = async () => {
    if (!isConnected) { showToast("Connect wallet first.", "error"); return; }
    if (!bidForm.price || !bidForm.energy) {
      showToast("Fill in both fields.", "error");
      return;
    }
    const priceWei  = parseEth(bidForm.price).toString();
    const energyWh  = parseInt(bidForm.energy);

    try {
      await promiseToast(
        placeBid(bidModal.listing_id, priceWei, energyWh)
          .then(({ bidId }) =>
            marketAPI.syncListing(bidModal.listing_id).then(() => bidId)
          ),
        {
          loading: "Placing bid on-chain…",
          success: "Bid placed successfully!",
          error:   "Bid failed.",
        }
      );
      setBidModal(null);
      setBidForm({ price: "", energy: "" });
      load();
    } catch { /* handled */ }
  };

  // Filter + sort
  const filtered = listings
    .filter(l => {
      if (!search) return true;
      const f = search.toLowerCase();
      return (
        String(l.listing_id).includes(f) ||
        l.device_type?.toLowerCase().includes(f) ||
        String(l.energy_amount).includes(f)
      );
    })
    .sort((a, b) => {
      if (sortBy === "price_asc")
        return Number(BigInt(a.base_price_per_unit) -
                      BigInt(b.base_price_per_unit));
      if (sortBy === "price_desc")
        return Number(BigInt(b.base_price_per_unit) -
                      BigInt(a.base_price_per_unit));
      if (sortBy === "energy_asc")
        return a.energy_amount - b.energy_amount;
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const isMine = (listing) =>
    user?.wallet_address?.toLowerCase() ===
    listing.seller?.toLowerCase();

  return (
    <div className="page">
      <PageHeader
        title="Marketplace"
        subtitle="Browse and purchase available energy"
      />

      {/* Market banner */}
      {market && (
        <div className="dect-card mb-6 flex items-center
                        gap-6 flex-wrap">
          <MultiplierBadge multiplier={market.multiplier} />
          <div>
            <p className="font-mono text-xs text-textPrimary">
              Dynamic pricing active —{" "}
              <span className="text-accent">
                {(market.multiplier / 100).toFixed(2)}x
              </span>{" "}
              current multiplier
            </p>
            <p className="font-mono text-xs text-muted mt-0.5">
              {market.supply} listings &nbsp;|&nbsp;
              {market.demand} recent purchases
            </p>
          </div>
          <button
            onClick={loadDynamicPrices}
            disabled={loadingPrices}
            className="btn-ghost text-xs ml-auto"
          >
            {loadingPrices ? "Updating…" : "↻ Refresh Prices"}
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          className="dect-input w-56"
          placeholder="Search listings…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="dect-input w-44"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          {DEVICE_TYPES.map(dt => (
            <button
              key={dt}
              onClick={() => setDeviceFilter(dt)}
              className={`font-mono text-xs px-3 py-1.5 rounded border
                          capitalize transition-all duration-200
                          ${deviceFilter === dt
                            ? "border-accent text-accent bg-accent/10"
                            : "border-border text-muted hover:border-muted"}`}
            >
              {dt}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="LOADING LISTINGS…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="⚡"
          title="No listings available"
          subtitle="Check back later or adjust your filters."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2
                        lg:grid-cols-3 gap-4">
          {filtered.map(l => {
            const dynPrice = prices[l.listing_id];
            const isBuying = buyingId === l.listing_id;
            const mine     = isMine(l);
            const baseTotal = (
              BigInt(l.base_price_per_unit) *
             BigInt(l.energy_amount)
            ).toString();

            return (
              <div
                key={l.id}
                className={`dect-card-hover animate-fadeIn
                            ${mine ? "opacity-60" : ""}`}
              >
                {/* Header */}
                <div className="flex justify-between items-center mb-3">
                  <span className="font-mono text-xs text-muted">
                    #{l.listing_id}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted capitalize">
                      {l.device_type}
                    </span>
                    {mine && (
                      <span className="badge-warning">YOURS</span>
                    )}
                  </div>
                </div>

                {/* Energy */}
                <div className="flex items-baseline gap-1.5 mb-4">
                  <span className="font-mono text-4xl font-bold text-textPrimary">
                    {l.energy_amount}
                  </span>
                  <span className="font-mono text-sm text-muted">Wh</span>
                </div>

                {/* Pricing */}
                <div className="space-y-1.5 mb-4">
                  {dynPrice ? (
                    <>
                      <div className="flex justify-between border-b
                                      border-border pb-1.5">
                        <span className="font-mono text-xs text-muted">
                          Base Price
                        </span>
                        <span className="font-mono text-xs
                                         text-muted line-through">
                          {formatEth(l.base_price_per_unit)} ETH/Wh
                        </span>
                      </div>
                      <div className="flex justify-between border-b
                                      border-border pb-1.5">
                        <span className="font-mono text-xs text-muted">
                          Dynamic Price
                        </span>
                        <span className="font-mono text-xs text-textPrimary">
                          {formatEth(dynPrice.dynamicPricePerUnit.toString())} ETH/Wh
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-xs text-muted">
                          Total Cost
                        </span>
                        <span className="font-mono text-sm text-accent font-bold">
                          {formatEth(dynPrice.totalCost.toString())} ETH
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="font-mono text-xs text-muted">
                        Total Cost
                      </span>
                      <span className="font-mono text-sm text-accent font-bold">
                        {formatEth(baseTotal)} ETH
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!mine && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDirectBuy(l)}
                      disabled={isBuying || !dynPrice}
                      className="btn-primary flex-1 text-xs py-2"
                    >
                      {isBuying ? "Processing…" : "Buy Now"}
                    </button>
                    <button
                      onClick={() => {
                        setBidModal(l);
                        setBidForm({ price: "", energy: String(l.energy_amount) });
                      }}
                      className="btn-secondary text-xs py-2 px-3"
                    >
                      Bid
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bid Modal */}
      {bidModal && (
        <div className="fixed inset-0 z-50 flex items-center
                        justify-center bg-black/60 backdrop-blur-sm">
          <div className="dect-card w-full max-w-sm mx-4 animate-slideUp">
            <p className="font-mono text-sm text-textPrimary mb-1">
              Place a Bid
            </p>
            <p className="font-mono text-xs text-muted mb-4">
              Listing #{bidModal.listing_id} —{" "}
              {bidModal.energy_amount} Wh available
            </p>

            <div className="space-y-4 mb-5">
              <div>
                <label className="dect-label">Energy Amount (Wh)</label>
                <input
                  className="dect-input"
                  type="number"
                  max={bidModal.energy_amount}
                  value={bidForm.energy}
                  onChange={e => setBidForm(f => ({...f, energy: e.target.value}))}
                />
              </div>
              <div>
                <label className="dect-label">Offer Price/Wh (ETH)</label>
                <input
                  className="dect-input"
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 0.001"
                  value={bidForm.price}
                  onChange={e => setBidForm(f => ({...f, price: e.target.value}))}
                />
              </div>
              {bidForm.price && bidForm.energy && (
                <div className="flex justify-between p-3
                                rounded border border-border bg-bg/50">
                  <span className="font-mono text-xs text-muted">
                    Total Deposit
                  </span>
                  <span className="font-mono text-sm text-accent font-bold">
                    {(parseFloat(bidForm.price) *
                      parseFloat(bidForm.energy)).toFixed(6)} ETH
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setBidModal(null); setBidForm({ price: "", energy: "" }); }}
                className="btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handlePlaceBid}
                className="btn-primary flex-1"
              >
                Place Bid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}