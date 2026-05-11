import React, { useEffect, useState } from "react";
import { settingsAPI } from "../../services/api";
import useToast        from "../../hooks/useToast";
import PageHeader      from "../../components/PageHeader";
import EmptyState      from "../../components/EmptyState";
import LoadingSpinner  from "../../components/LoadingSpinner";
import ConfirmModal    from "../../components/ConfirmModal";
import {
  BellIcon,
  BellSlashIcon,
} from "@heroicons/react/24/outline";

export default function AlertsPage() {
  const { showToast, promiseToast } = useToast();

  const [alerts,     setAlerts]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState({
    alert_above: "", alert_below: "",
  });

  const load = () => {
    setLoading(true);
    settingsAPI.getAlerts()
      .then(r => setAlerts(r.data))
      .catch(() => showToast("Failed to load alerts.", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.alert_above && !form.alert_below) {
      showToast("Set at least one threshold.", "error");
      return;
    }
    setSaving(true);
    try {
      await promiseToast(settingsAPI.createAlert(form), {
        loading: "Creating alert…",
        success: "Price alert created.",
        error:   "Failed to create alert.",
      });
      setForm({ alert_above: "", alert_below: "" });
      setShowForm(false);
      load();
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  const handleToggle = async (alert) => {
    try {
      await settingsAPI.updateAlert(alert.id, {
        is_active: !alert.is_active,
      });
      load();
      showToast(
        `Alert ${alert.is_active ? "disabled" : "enabled"}.`,
        "success"
      );
    } catch {
      showToast("Failed to toggle alert.", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await promiseToast(settingsAPI.deleteAlert(deleteTarget.id), {
        loading: "Deleting alert…",
        success: "Alert deleted.",
        error:   "Failed to delete.",
      });
      load();
    } catch { /* handled */ }
    finally { setDeleteTarget(null); }
  };

  return (
    <div className="page">
      <PageHeader
        title="Price Alerts"
        subtitle="Get notified when energy prices cross your thresholds"
        action={
          <button
            onClick={() => setShowForm(s => !s)}
            className="btn-primary"
          >
            {showForm ? "✕ Close" : "+ New Alert"}
          </button>
        }
      />

      {/* Create form */}
      {showForm && (
        <div className="dect-card mb-6 animate-slideUp">
          <p className="section-label">New Price Alert</p>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="dect-label">
                  Alert Above (ETH/Wh)
                </label>
                <input
                  className="dect-input"
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 0.003"
                  value={form.alert_above}
                  onChange={e => setForm(f => ({
                    ...f, alert_above: e.target.value
                  }))}
                />
                <p className="font-mono text-[10px] text-muted mt-1">
                  Notify when price rises above this
                </p>
              </div>
              <div>
                <label className="dect-label">
                  Alert Below (ETH/Wh)
                </label>
                <input
                  className="dect-input"
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 0.001"
                  value={form.alert_below}
                  onChange={e => setForm(f => ({
                    ...f, alert_below: e.target.value
                  }))}
                />
                <p className="font-mono text-[10px] text-muted mt-1">
                  Notify when price drops below this
                </p>
              </div>
            </div>

            {/* Preview */}
            {(form.alert_above || form.alert_below) && (
              <div className="p-3 rounded border border-border
                              bg-bg/50 font-mono text-xs text-muted">
                Notify me when price{" "}
                {form.alert_above && (
                  <span className="text-danger">
                    rises above {form.alert_above} ETH/Wh
                  </span>
                )}
                {form.alert_above && form.alert_below && " or "}
                {form.alert_below && (
                  <span className="text-accent">
                    drops below {form.alert_below} ETH/Wh
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Creating…" : "Create Alert"}
            </button>
          </form>
        </div>
      )}

      {/* Alerts list */}
      {loading ? (
        <LoadingSpinner text="LOADING ALERTS…" />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="No price alerts"
          subtitle="Create alerts to be notified when prices move."
          action={
            <button
              onClick={() => setShowForm(true)}
              className="btn-secondary text-xs"
            >
              Create Alert
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert.id}
              className={`dect-card animate-fadeIn
                          ${!alert.is_active ? "opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between gap-4">

                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center
                                 justify-center flex-shrink-0
                                 ${alert.is_active
                                   ? "bg-accent/10 border border-accent/25"
                                   : "bg-border"}`}>
                  {alert.is_active
                    ? <BellIcon className="w-5 h-5 text-accent" />
                    : <BellSlashIcon className="w-5 h-5 text-muted" />}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex gap-4 flex-wrap">
                    {alert.alert_above && (
                      <span className="font-mono text-xs">
                        Above:{" "}
                        <span className="text-danger font-bold">
                          {alert.alert_above} ETH/Wh
                        </span>
                      </span>
                    )}
                    {alert.alert_below && (
                      <span className="font-mono text-xs">
                        Below:{" "}
                        <span className="text-accent font-bold">
                          {alert.alert_below} ETH/Wh
                        </span>
                      </span>
                    )}
                  </div>
                  {alert.last_triggered_at && (
                    <p className="font-mono text-[10px] text-muted mt-1">
                      Last triggered:{" "}
                      {new Date(alert.last_triggered_at).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(alert)}
                    className={`w-10 h-5 rounded-full relative
                                transition-all duration-300
                                ${alert.is_active ? "bg-accent" : "bg-border"}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full
                                  bg-bg transition-all duration-300
                                  ${alert.is_active ? "left-5" : "left-0.5"}`}
                    />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(alert)}
                    className="font-mono text-xs text-danger hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Alert"
        message="This price alert will be permanently removed."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}