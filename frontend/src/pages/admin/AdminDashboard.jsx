import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminAPI }    from "../../services/api";
import useToast        from "../../hooks/useToast";
import PageHeader      from "../../components/PageHeader";
import StatCard        from "../../components/StatCard";
import LoadingSpinner  from "../../components/LoadingSpinner";
import MultiplierBadge from "../../components/MultiplierBadge";
import ConfirmModal    from "../../components/ConfirmModal";
import {
  UsersIcon, ArrowsRightLeftIcon, ListBulletIcon,
  ShieldExclamationIcon, BoltIcon, CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

export default function AdminDashboard() {
  const navigate          = useNavigate();
  const { showToast, promiseToast } = useToast();

  const [overview,    setOverview]    = useState(null);
  const [status,      setStatus]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [pauseModal,  setPauseModal]  = useState(false);
  const [pausing,     setPausing]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, stRes] = await Promise.all([
        adminAPI.getOverview(),
        adminAPI.getStatus(),
      ]);
      setOverview(ovRes.data);
      setStatus(stRes.data);
    } catch {
      showToast("Failed to load overview.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePause = async () => {
    setPausing(true);
    try {
      await promiseToast(
        overview?.system_paused
          ? adminAPI.resume()
          : adminAPI.pause({ reason: "Admin initiated pause" }),
        {
          loading: overview?.system_paused ? "Resuming…" : "Pausing system…",
          success: overview?.system_paused ? "System resumed." : "System paused.",
          error:   "Failed.",
        }
      );
      setPauseModal(false);
      load();
    } catch { /* handled */ }
    finally { setPausing(false); }
  };

  if (loading) return <LoadingSpinner text="LOADING OVERVIEW…" />;

  const isPaused = overview?.system_paused;

  return (
    <div className="page">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Full platform visibility and control"
        action={
          <div className="flex gap-3">
            <button onClick={() => load()} className="btn-ghost text-xs">
              ↻ Refresh
            </button>
            <button
              onClick={() => setPauseModal(true)}
              className={isPaused ? "btn-primary text-xs" : "btn-danger text-xs"}
            >
              {isPaused ? "▶ Resume System" : "⏸ Pause System"}
            </button>
          </div>
        }
      />

      {/* System paused banner */}
      {isPaused && (
        <div className="mb-6 p-4 rounded border border-danger/30
                        bg-danger/10 font-mono text-sm text-danger
                        animate-fadeIn flex items-center gap-3">
          <span className="text-xl">⏸</span>
          <div>
            <p className="font-bold">System is currently paused</p>
            <p className="text-xs text-danger/70 mt-0.5">
              All write operations are blocked for regular users.
            </p>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Users"
          value={overview?.total_users}
          icon={UsersIcon}
        />
        <StatCard
          label="Total Listings"
          value={overview?.total_listings}
          icon={ListBulletIcon}
        />
        <StatCard
          label="Transactions"
          value={overview?.total_transactions}
          icon={ArrowsRightLeftIcon}
          accent
        />
        <StatCard
          label="Volume (ETH)"
          value={overview?.total_volume_eth}
          icon={CurrencyDollarIcon}
          accent
        />
        <StatCard
          label="Producers"
          value={overview?.total_producers}
          icon={BoltIcon}
        />
        <StatCard
          label="Consumers"
          value={overview?.total_consumers}
          icon={UsersIcon}
        />
        <StatCard
          label="Pending Approvals"
          value={overview?.pending_approvals}
          icon={UsersIcon}
          accent={overview?.pending_approvals > 0}
        />
        <StatCard
          label="Open Fraud Flags"
          value={overview?.open_fraud_flags}
          icon={ShieldExclamationIcon}
          accent={overview?.open_fraud_flags > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Contract status */}
        <div className="dect-card">
          <p className="section-label">Contract Status</p>
          <div className="space-y-3">
            {[
              {
                label: "Connection",
                value: status?.connected ? "Connected" : "Disconnected",
                accent: status?.connected,
              },
              {
                label: "Current Block",
                value: status?.current_block?.toLocaleString() ?? "—",
              },
              {
                label: "Contract Balance",
                value: `${status?.contract_balance_eth ?? "0"} ETH`,
                accent: true,
              },
              {
                label: "Address",
                value: status?.contract_address
                  ? `${status.contract_address.slice(0,8)}…`
                  : "—",
              },
            ].map(({ label, value, accent }) => (
              <div key={label}
                   className="flex justify-between border-b
                              border-border pb-2 last:border-0 last:pb-0">
                <span className="font-mono text-xs text-muted">{label}</span>
                <span className={`font-mono text-xs
                                  ${accent ? "text-accent" : "text-textPrimary"}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick nav */}
        <div className="dect-card">
          <p className="section-label">Quick Navigation</p>
          <div className="space-y-2">
            {[
              { label: "User Management",   to: "/admin/users",        badge: overview?.pending_approvals },
              { label: "All Transactions",  to: "/admin/transactions" },
              { label: "Fraud Flags",       to: "/admin/fraud",        badge: overview?.open_fraud_flags },
              { label: "Producer Approvals",to: "/admin/approvals",    badge: overview?.pending_approvals },
              { label: "Audit Logs",        to: "/admin/audit-logs" },
              { label: "System Settings",   to: "/admin/settings" },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => navigate(item.to)}
                className="w-full flex items-center justify-between
                           font-mono text-xs text-textSecondary
                           hover:text-accent border border-border
                           hover:border-accent/40 rounded px-3 py-2.5
                           transition-all duration-200"
              >
                <span>{item.label} →</span>
                {item.badge > 0 && (
                  <span className="bg-danger/20 text-danger
                                   font-mono text-[10px] px-1.5 py-0.5
                                   rounded">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Market overview */}
        <div className="dect-card">
          <p className="section-label">Market Overview</p>
          <div className="space-y-3">
            {[
              { label: "Active Listings", value: overview?.active_listings },
              { label: "Sold Listings",   value: overview?.sold_listings },
              { label: "Energy Traded",   value: `${overview?.total_energy_traded?.toLocaleString()} Wh` },
              { label: "Unique Producers",value: overview?.unique_producers },
              { label: "Unique Consumers",value: overview?.unique_consumers },
            ].map(({ label, value }) => (
              <div key={label}
                   className="flex justify-between border-b
                              border-border pb-2 last:border-0 last:pb-0">
                <span className="font-mono text-xs text-muted">{label}</span>
                <span className="font-mono text-xs text-textPrimary">
                  {value ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={pauseModal}
        title={isPaused ? "Resume System" : "Pause System"}
        message={
          isPaused
            ? "This will allow all users to trade again."
            : "This will block all write operations for regular users."
        }
        confirmLabel={isPaused ? "Resume" : "Pause"}
        danger={!isPaused}
        loading={pausing}
        onConfirm={handlePause}
        onCancel={() => setPauseModal(false)}
      />
    </div>
  );
}