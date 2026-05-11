import React, { useEffect, useState } from "react";
import { adminAPI } from "../../services/api";
import useToast     from "../../hooks/useToast";
import PageHeader   from "../../components/PageHeader";
import EmptyState   from "../../components/EmptyState";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminApprovals() {
  const { showToast, promiseToast } = useToast();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminAPI.getPendingApprovals()
      .then(r => setPending(r.data))
      .catch(() => showToast("Failed to load approvals.", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handle = async (user, action) => {
    try {
      await promiseToast(
        adminAPI.approveProducer(user.id, { action }),
        {
          loading: action === "approve" ? "Approving…" : "Rejecting…",
          success: action === "approve" ? "Producer approved!" : "Rejected.",
          error:   "Action failed.",
        }
      );
      load();
    } catch { /* handled */ }
  };

  return (
    <div className="page">
      <PageHeader
        title="Producer Approvals"
        subtitle="Verify new producer accounts before they can list energy"
      />

      {loading ? (
        <LoadingSpinner text="LOADING APPROVALS…" />
      ) : pending.length === 0 ? (
        <EmptyState
          icon="✓"
          title="No pending approvals"
          subtitle="All producer accounts have been reviewed."
        />
      ) : (
        <div className="space-y-4">
          {pending.map(user => (
            <div key={user.id} className="dect-card animate-fadeIn">
              <div className="flex items-start justify-between
                              gap-4 flex-wrap">
                <div className="space-y-1">
                  <p className="font-mono text-sm text-textPrimary font-bold">
                    {user.username}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {user.email}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    Wallet: {user.wallet_address
                      ? `${user.wallet_address.slice(0,10)}…`
                      : "Not connected"}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    Joined: {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handle(user, "approve")}
                    className="btn-primary text-xs"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handle(user, "reject")}
                    className="btn-danger text-xs"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}