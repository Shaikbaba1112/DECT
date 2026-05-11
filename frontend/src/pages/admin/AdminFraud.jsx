import React, { useEffect, useState, useCallback } from "react";
import { adminAPI } from "../../services/api";
import useToast     from "../../hooks/useToast";
import PageHeader   from "../../components/PageHeader";
import StatusBadge  from "../../components/StatusBadge";
import EmptyState   from "../../components/EmptyState";
import LoadingSpinner from "../../components/LoadingSpinner";

const FILTERS = ["all", "open", "reviewed", "safe", "confirmed"];

export default function AdminFraud() {
  const { showToast, promiseToast } = useToast();
  const [flags,  setFlags]   = useState([]);
  const [loading,setLoading] = useState(true);
  const [filter, setFilter]  = useState("open");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? { status: filter } : {};
      const res = await adminAPI.getFraud(params);
      setFlags(res.data);
    } catch {
      showToast("Failed to load fraud flags.", "error");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (flag, newStatus) => {
    try {
      await promiseToast(
        adminAPI.reviewFraud(flag.id, { status: newStatus }),
        {
          loading: "Updating flag…",
          success: `Marked as ${newStatus}.`,
          error:   "Update failed.",
        }
      );
      load();
    } catch { /* handled */ }
  };

  const handleBan = async (flag) => {
    try {
      await promiseToast(adminAPI.banWallet(flag.id), {
        loading: "Banning wallet…",
        success: "Wallet banned.",
        error:   "Ban failed.",
      });
      load();
    } catch { /* handled */ }
  };

  const riskColor = (score) =>
    score >= 80 ? "text-danger" :
    score >= 50 ? "text-warning" : "text-muted";

  return (
    <div className="page">
      <PageHeader
        title="Fraud Detection"
        subtitle="Review auto-flagged suspicious activity"
      />

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
        <LoadingSpinner text="LOADING FLAGS…" />
      ) : flags.length === 0 ? (
        <EmptyState
          icon="✓"
          title={filter === "open" ? "No open flags" : "No flags found"}
          subtitle="All transactions look clean."
        />
      ) : (
        <div className="dect-card overflow-x-auto">
          <table className="dect-table">
            <thead>
              <tr>
                <th>Flag ID</th>
                <th>Wallet</th>
                <th>Risk Score</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Flagged By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.map(flag => (
                <tr key={flag.id} className="animate-fadeIn">
                  <td className="text-muted">#{flag.id}</td>
                  <td className="font-mono text-xs">
                    {flag.wallet_address.slice(0,10)}…
                  </td>
                  <td>
                    <span className={`font-mono text-sm font-bold
                                      ${riskColor(flag.risk_score)}`}>
                      {flag.risk_score}
                    </span>
                    <span className="font-mono text-xs text-muted">/100</span>
                  </td>
                  <td className="text-xs max-w-xs truncate">
                    {flag.reason}
                  </td>
                  <td><StatusBadge status={flag.status} /></td>
                  <td className="font-mono text-xs text-muted">
                    {flag.flagged_by}
                  </td>
                  <td>
                    {flag.status === "open" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReview(flag, "safe")}
                          className="font-mono text-xs text-accent hover:underline"
                        >
                          Safe
                        </button>
                        <button
                          onClick={() => handleBan(flag)}
                          className="font-mono text-xs text-danger hover:underline"
                        >
                          Ban
                        </button>
                      </div>
                    )}
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