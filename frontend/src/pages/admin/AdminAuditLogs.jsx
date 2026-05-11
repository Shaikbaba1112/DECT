import React, { useEffect, useState, useCallback } from "react";
import { adminAPI } from "../../services/api";
import useToast     from "../../hooks/useToast";
import PageHeader   from "../../components/PageHeader";
import EmptyState   from "../../components/EmptyState";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminAuditLogs() {
  const { showToast }    = useToast();
  const [logs,   setLogs]   = useState([]);
  const [loading,setLoading]= useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? { action: search } : {};
      const res = await adminAPI.getAuditLogs(params);
      setLogs(res.data);
    } catch {
      showToast("Failed to load audit logs.", "error");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="page">
      <PageHeader
        title="Audit Logs"
        subtitle="Immutable record of all admin actions"
      />

      <div className="flex gap-3 mb-4">
        <input
          className="dect-input w-56"
          placeholder="Filter by action…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="font-mono text-xs text-muted self-center">
          {logs.length} records
        </span>
      </div>

      {loading ? (
        <LoadingSpinner text="LOADING LOGS…" />
      ) : logs.length === 0 ? (
        <EmptyState icon="📋" title="No audit logs found" />
      ) : (
        <div className="dect-card overflow-x-auto">
          <table className="dect-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Target</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="animate-fadeIn">
                  <td className="text-muted text-xs">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="font-mono text-xs font-bold">
                    {log.admin_username}
                  </td>
                  <td>
                    <span className="badge-active">
                      {log.action}
                    </span>
                  </td>
                  <td className="font-mono text-xs text-muted">
                    {log.target_model
                      ? `${log.target_model} #${log.target_id}`
                      : "—"}
                  </td>
                  <td className="font-mono text-xs text-muted">
                    {log.ip_address ?? "—"}
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