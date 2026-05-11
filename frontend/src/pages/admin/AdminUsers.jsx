import React, { useEffect, useState, useCallback } from "react";
import { adminAPI } from "../../services/api";
import useToast     from "../../hooks/useToast";
import PageHeader   from "../../components/PageHeader";
import StatusBadge  from "../../components/StatusBadge";
import EmptyState   from "../../components/EmptyState";
import LoadingSpinner from "../../components/LoadingSpinner";
import ConfirmModal from "../../components/ConfirmModal";

export default function AdminUsers() {
  const { showToast, promiseToast } = useToast();

  const [users,  setUsers]  = useState([]);
  const [loading,setLoading]= useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [actionTarget, setActionTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (roleFilter !== "all") params.role = roleFilter;
      if (search) params.search = search;
      const res = await adminAPI.getUsers(params);
      setUsers(res.data);
    } catch {
      showToast("Failed to load users.", "error");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const handleSuspend = async () => {
    if (!actionTarget) return;
    const action = actionTarget.user.is_active ? "suspend" : "activate";
    try {
      await promiseToast(
        adminAPI.suspendUser(actionTarget.user.id, { action }),
        {
          loading: `${action === "suspend" ? "Suspending" : "Activating"}…`,
          success: `User ${action}d.`,
          error:   "Action failed.",
        }
      );
      load();
    } catch { /* handled */ }
    finally { setActionTarget(null); }
  };

  const ROLES = ["all", "consumer", "producer", "both", "admin"];

  const roleBadge = (role) => {
    const cls = {
      admin:    "badge-warning",
      producer: "badge-active",
      consumer: "text-blue-400 border border-blue-400/25 bg-blue-400/10 font-mono text-xs px-2 py-0.5 rounded",
      both:     "badge-active",
    }[role] || "badge-sold";
    return <span className={cls}>{role?.toUpperCase()}</span>;
  };

  return (
    <div className="page">
      <PageHeader
        title="User Management"
        subtitle="View and manage all platform users"
      />

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          className="dect-input w-56"
          placeholder="Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          {ROLES.map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`font-mono text-xs px-3 py-1.5 rounded border
                          capitalize transition-all duration-200
                          ${roleFilter === r
                            ? "border-accent text-accent bg-accent/10"
                            : "border-border text-muted hover:border-muted"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="LOADING USERS…" />
      ) : users.length === 0 ? (
        <EmptyState icon="👥" title="No users found" />
      ) : (
        <div className="dect-card overflow-x-auto">
          <table className="dect-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Verified</th>
                <th>Status</th>
                <th>Wallet</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="animate-fadeIn">
                  <td className="font-mono text-sm font-bold">
                    {user.username}
                  </td>
                  <td className="text-muted text-xs">{user.email}</td>
                  <td>{roleBadge(user.role)}</td>
                  <td>
                    {user.is_verified
                      ? <span className="text-accent font-mono text-xs">✓ YES</span>
                      : <span className="text-muted font-mono text-xs">— NO</span>}
                  </td>
                  <td>
                    <StatusBadge status={user.is_active ? "active" : "offline"} />
                  </td>
                  <td className="font-mono text-xs text-muted">
                    {user.wallet_address
                      ? `${user.wallet_address.slice(0,8)}…`
                      : "—"}
                  </td>
                  <td className="font-mono text-xs text-accent">
                    {user.wallet_balance} TKN
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setActionTarget({ user, action: "suspend" })}
                        className={`font-mono text-xs hover:underline
                                    ${user.is_active
                                      ? "text-danger"
                                      : "text-accent"}`}
                      >
                        {user.is_active ? "Suspend" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!actionTarget}
        title={actionTarget?.user?.is_active
          ? "Suspend User"
          : "Activate User"}
        message={`${actionTarget?.user?.is_active
          ? "Suspend"
          : "Activate"} ${actionTarget?.user?.username}?`}
        confirmLabel={actionTarget?.user?.is_active ? "Suspend" : "Activate"}
        danger={actionTarget?.user?.is_active}
        onConfirm={handleSuspend}
        onCancel={() => setActionTarget(null)}
      />
    </div>
  );
}