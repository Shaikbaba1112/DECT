import React, { useEffect, useState } from "react";
import { settingsAPI } from "../../services/api";
import { useAuth }     from "../../hooks/useAuth";
import useToast        from "../../hooks/useToast";
import PageHeader      from "../../components/PageHeader";
import LoadingSpinner  from "../../components/LoadingSpinner";
import {
  BoltIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/outline";

export default function AutoTradePage() {
  const { user }          = useAuth();
  const { showToast, promiseToast } = useToast();

  const [settings, setSettings] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    settingsAPI.getAutoTrade()
      .then(r => setSettings(r.data))
      .catch(() => showToast("Failed to load auto-trade settings.", "error"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field, value) => {
    setSettings(s => ({ ...s, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await promiseToast(settingsAPI.updateAutoTrade(settings), {
        loading: "Saving auto-trade rules…",
        success: "Auto-trade settings saved.",
        error:   "Failed to save.",
      });
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner text="LOADING SETTINGS…" />;

  const isProducer = user?.role === "producer" || user?.role === "both";
  const isConsumer = user?.role === "consumer" || user?.role === "both";

  return (
    <div className="page">
      <PageHeader
        title="Auto-Trade"
        subtitle="Set rules for automatic buying and selling"
      />

      {/* Master toggle */}
      <div className="dect-card mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm text-textPrimary font-bold">
              Auto-Trading
            </p>
            <p className="font-sans text-xs text-muted mt-0.5">
              Enable automatic trading based on the rules below.
            </p>
          </div>
          <button
            onClick={() => handleChange("is_active", !settings?.is_active)}
            className={`w-12 h-6 rounded-full transition-all duration-300
                        relative flex-shrink-0
                        ${settings?.is_active
                          ? "bg-accent"
                          : "bg-border"}`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full
                          bg-bg transition-all duration-300
                          ${settings?.is_active ? "left-7" : "left-1"}`}
            />
          </button>
        </div>

        {settings?.is_active && (
          <div className="mt-3 p-2.5 rounded border border-accent/30
                          bg-accent/5 font-mono text-xs text-accent">
            ⚡ Auto-trading is active. Rules below will execute automatically.
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* Consumer rules */}
        {isConsumer && (
          <div className="dect-card">
            <p className="section-label">
              <ShoppingCartIcon className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
              Auto-Buy Rules (Consumer)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="dect-label">Max Buy Price (ETH/Wh)</label>
                <input
                  className="dect-input"
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 0.002"
                  value={settings?.max_price_per_kwh || ""}
                  onChange={e => handleChange("max_price_per_kwh", e.target.value)}
                />
                <p className="font-mono text-[10px] text-muted mt-1">
                  Don't buy if price exceeds this
                </p>
              </div>
              <div>
                <label className="dect-label">Max Energy Per Trade (Wh)</label>
                <input
                  className="dect-input"
                  type="number"
                  placeholder="e.g. 500"
                  value={settings?.max_kwh_per_trade || ""}
                  onChange={e => handleChange("max_kwh_per_trade", e.target.value)}
                />
                <p className="font-mono text-[10px] text-muted mt-1">
                  Maximum Wh to buy in one auto-trade
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Producer rules */}
        {isProducer && (
          <div className="dect-card">
            <p className="section-label">
              <BoltIcon className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
              Auto-Sell Rules (Producer)
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="dect-label">Min Sell Price (ETH/Wh)</label>
                <input
                  className="dect-input"
                  type="number"
                  step="0.0001"
                  placeholder="e.g. 0.001"
                  value={settings?.min_price_per_kwh || ""}
                  onChange={e => handleChange("min_price_per_kwh", e.target.value)}
                />
                <p className="font-mono text-[10px] text-muted mt-1">
                  Don't sell below this price
                </p>
              </div>
              <div>
                <label className="dect-label">Sell When Battery Above (%)</label>
                <input
                  className="dect-input"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 80"
                  value={settings?.sell_when_battery_pct || ""}
                  onChange={e => handleChange("sell_when_battery_pct", e.target.value)}
                />
                <p className="font-mono text-[10px] text-muted mt-1">
                  Auto-list when battery exceeds this %
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Active hours */}
        <div className="dect-card">
          <p className="section-label">Active Trading Hours</p>
          <p className="font-sans text-xs text-muted mb-4">
            Only execute auto-trades within this time window.
            Leave blank for 24/7 trading.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="dect-label">Start Time</label>
              <input
                className="dect-input"
                type="time"
                value={settings?.active_start_time || ""}
                onChange={e => handleChange("active_start_time", e.target.value)}
              />
            </div>
            <div>
              <label className="dect-label">End Time</label>
              <input
                className="dect-input"
                type="time"
                value={settings?.active_end_time || ""}
                onChange={e => handleChange("active_end_time", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving…" : "Save Auto-Trade Rules"}
          </button>
          <button
            type="button"
            onClick={() => handleChange("is_active", false)}
            className="btn-ghost"
          >
            Disable Auto-Trade
          </button>
        </div>
      </form>
    </div>
  );
}