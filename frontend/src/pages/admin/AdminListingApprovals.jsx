import React, { useEffect, useState, useCallback } from "react";
import { adminAPI }   from "../../services/api";
import { useWallet }  from "../../hooks/useWallet";
import useToast       from "../../hooks/useToast";
import PageHeader     from "../../components/PageHeader";
import EmptyState     from "../../components/EmptyState";
import LoadingSpinner from "../../components/LoadingSpinner";
import "./AdminListingApprovals.css";

export default function AdminListingApprovals() {
  const { formatEth }           = useWallet();
  const { showToast, promiseToast } = useToast();

  const [data,     setData]     = useState({ count: 0, results: [] });
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getListingApprovals();
      setData(res.data);
    } catch {
      showToast("Failed to load pending listings.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (listing) => {
    setActing(listing.id);
    try {
      await promiseToast(
        adminAPI.reviewListing(listing.id, { action: "approve" }),
        {
          loading: "Approving listing…",
          success: `Listing #${listing.listing_id} is now live!`,
          error:   "Failed to approve.",
        }
      );
      load();
    } catch { /* handled */ }
    finally { setActing(null); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActing(rejectModal.id);
    try {
      await promiseToast(
        adminAPI.reviewListing(rejectModal.id, {
          action: "reject",
          reason: rejectReason || "Does not meet platform requirements.",
        }),
        {
          loading: "Rejecting listing…",
          success: `Listing #${rejectModal.listing_id} rejected.`,
          error:   "Failed to reject.",
        }
      );
      setRejectModal(null);
      setRejectReason("");
      load();
    } catch { /* handled */ }
    finally { setActing(null); }
  };

  const DEVICE_ICONS = { solar: "☀", wind: "💨", battery: "🔋" };

  return (
    <div className="page">
      <PageHeader
        title="Listing Approvals"
        subtitle="Review and approve producer energy listings before they go live"
        action={
          <div className="approvals-header-badges">
            <span className="approval-badge-count">
              {data.count} pending
            </span>
            <button onClick={load} className="btn-ghost">
              ↻ Refresh
            </button>
          </div>
        }
      />

      {/* How it works */}
      <div className="approvals-info-bar">
        <div className="approvals-info-step">
          <span className="approvals-step-num">1</span>
          <div>
            <p className="approvals-step-title">Producer Lists Energy</p>
            <p className="approvals-step-sub">
              Listing created → status: Pending
            </p>
          </div>
        </div>
        <span className="approvals-step-arrow">→</span>
        <div className="approvals-info-step">
          <span className="approvals-step-num">2</span>
          <div>
            <p className="approvals-step-title">Admin Reviews</p>
            <p className="approvals-step-sub">
              You approve or reject here
            </p>
          </div>
        </div>
        <span className="approvals-step-arrow">→</span>
        <div className="approvals-info-step">
          <span className="approvals-step-num">3</span>
          <div>
            <p className="approvals-step-title">Goes Live</p>
            <p className="approvals-step-sub">
              Consumers can now buy
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="LOADING PENDING LISTINGS…" />
      ) : data.results.length === 0 ? (
        <EmptyState
          icon="✓"
          title="No pending listings"
          subtitle="All listings have been reviewed. New submissions will appear here."
        />
      ) : (
        <div className="approvals-grid">
          {data.results.map(listing => {
            const totalWei = (
              BigInt(listing.price_per_unit) *
              BigInt(listing.energy_amount)
            ).toString();
            const isActing = acting === listing.id;
            const icon     = DEVICE_ICONS[listing.device_type] || "⚡";

            return (
              <div key={listing.id} className="approval-card animate-fadeIn">

                {/* Card header */}
                <div className="approval-card-header">
                  <div className="approval-card-left">
                    <div className="approval-device-icon">{icon}</div>
                    <div>
                      <p className="approval-listing-id">
                        Listing #{listing.listing_id}
                      </p>
                      <p className="approval-producer">
                        by {listing.producer_username || "Unknown"}
                      </p>
                    </div>
                  </div>
                  <span className="badge badge-warning">PENDING</span>
                </div>

                {/* Details */}
                <div className="approval-details">
                  {[
                    { label: "Energy",      value: `${listing.energy_amount} Wh` },
                    { label: "Base Price",  value: `${formatEth(listing.base_price_per_unit)} ETH/Wh` },
                    { label: "Total Value", value: `${formatEth(totalWei)} ETH`, accent: true },
                    { label: "Device Type", value: listing.device_type,  capitalize: true },
                    { label: "Device",      value: listing.device_name || "—" },
                    { label: "Submitted",   value: new Date(listing.created_at).toLocaleString() },
                  ].map(({ label, value, accent, capitalize }) => (
                    <div key={label} className="approval-detail-row">
                      <span className="approval-detail-label">{label}</span>
                      <span className={`approval-detail-value
                        ${accent ? "accent" : ""}
                        ${capitalize ? "capitalize" : ""}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="approval-actions">
                  <button
                    onClick={() => handleApprove(listing)}
                    disabled={isActing}
                    className="approval-btn-approve"
                  >
                    {isActing ? "Processing…" : "✓ Approve & Publish"}
                  </button>
                  <button
                    onClick={() => setRejectModal(listing)}
                    disabled={isActing}
                    className="approval-btn-reject"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay">
          <div className="modal-box animate-slideUp">
            <div className="modal-header">
              <span className="modal-icon">⚠</span>
              <h3 className="modal-title">
                Reject Listing #{rejectModal.listing_id}
              </h3>
            </div>
            <p className="modal-message">
              The producer will be notified. Provide a reason so they
              can resubmit with corrections.
            </p>
            <div style={{ marginBottom: "1.25rem" }}>
              <label className="dect-label">Rejection Reason</label>
              <textarea
                className="dect-input"
                style={{ minHeight: "80px", resize: "vertical" }}
                placeholder="e.g. Insufficient device verification, price out of acceptable range…"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(""); }}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button onClick={handleReject} className="btn-danger">
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}