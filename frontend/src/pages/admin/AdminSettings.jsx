import React, { useEffect, useState } from "react";
import { adminAPI } from "../../services/api";
import useToast     from "../../hooks/useToast";
import PageHeader   from "../../components/PageHeader";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminSettings() {
  const { showToast, promiseToast } = useToast();

  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    alert_type: "info", recipients: "all", message: "",
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    adminAPI.getPricingConfig()
      .then(r => setPricing(r.data))
      .catch(() => showToast("Failed to load config.", "error"))
      .finally(() => setLoading(false));
  }, []);

  const handleSavePricing = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await promiseToast(adminAPI.updatePricingConfig(pricing), {
        loading: "Saving pricing config…",
        success: "Pricing config updated.",
        error:   "Failed to save.",
      });
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.message.trim()) {
      showToast("Message is required.", "error");
      return;
    }
    setSending(true);
    try {
      await promiseToast(adminAPI.sendBroadcast(broadcastForm), {
        loading: "Sending broadcast…",
        success: "Broadcast sent to all users.",
        error:   "Failed to send.",
      });
      setBroadcastForm({ alert_type: "info", recipients: "all", message: "" });
    } catch { /* handled */ }
    finally { setSending(false); }
  };

  if (loading) return <LoadingSpinner text="LOADING SETTINGS…" />;

  return (
    <div className="page">
      <PageHeader
        title="System Settings"
        subtitle="Configure pricing, fees, and broadcasts"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pricing config */}
        <div className="dect-card">
          <p className="section-label">Dynamic Pricing Config</p>
          {pricing && (
            <form onSubmit={handleSavePricing} className="space-y-4">
              {[
                { key: "supply_weight",         label: "Supply Weight (0-1)" },
                { key: "demand_weight",         label: "Demand Weight (0-1)" },
                { key: "min_price_floor",       label: "Min Price Floor (ETH)" },
                { key: "max_price_ceiling",     label: "Max Price Ceiling (ETH)" },
                { key: "update_frequency_secs", label: "Update Frequency (sec)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="dect-label">{label}</label>
                  <input
                    className="dect-input"
                    type="number"
                    step="0.01"
                    value={pricing[key] ?? ""}
                    onChange={e => setPricing(p => ({
                      ...p, [key]: e.target.value
                    }))}
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving ? "Saving…" : "Save Config"}
              </button>
            </form>
          )}
        </div>

        {/* Broadcast */}
        <div className="dect-card">
          <p className="section-label">Send Broadcast</p>
          <form onSubmit={handleBroadcast} className="space-y-4">
            <div>
              <label className="dect-label">Alert Type</label>
              <select
                className="dect-input"
                value={broadcastForm.alert_type}
                onChange={e => setBroadcastForm(f => ({
                  ...f, alert_type: e.target.value
                }))}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>

            <div>
              <label className="dect-label">Recipients</label>
              <select
                className="dect-input"
                value={broadcastForm.recipients}
                onChange={e => setBroadcastForm(f => ({
                  ...f, recipients: e.target.value
                }))}
              >
                <option value="all">All Users</option>
                <option value="consumers">Consumers Only</option>
                <option value="producers">Producers Only</option>
              </select>
            </div>

            <div>
              <label className="dect-label">Message</label>
              <textarea
                className="dect-input h-28 resize-none"
                placeholder="Enter broadcast message…"
                value={broadcastForm.message}
                onChange={e => setBroadcastForm(f => ({
                  ...f, message: e.target.value
                }))}
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="btn-primary w-full"
            >
              {sending ? "Sending…" : "Send Broadcast"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}