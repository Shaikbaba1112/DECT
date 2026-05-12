import React, { useEffect, useState, useCallback } from "react";
import { producerAPI } from "../../services/api";
import useToast        from "../../hooks/useToast";
import PageHeader      from "../../components/PageHeader";
import StatusBadge     from "../../components/StatusBadge";
import EmptyState      from "../../components/EmptyState";
import LoadingSpinner  from "../../components/LoadingSpinner";
import ConfirmModal    from "../../components/ConfirmModal";
import {
  SunIcon, CloudIcon, BoltIcon,
} from "@heroicons/react/24/outline";

const DEVICE_ICONS = {
  solar:   SunIcon,
  wind:    CloudIcon,
  battery: BoltIcon,
};

export default function ProducerDevices() {
  const { showToast, promiseToast } = useToast();

  const [devices,     setDevices]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [form, setForm] = useState({
    name: "", device_type: "solar",
    capacity_kw: "", smart_meter_id: "",
  });

  const load = useCallback(async () => {
  setLoading(true);
  try {
    const res = await producerAPI.getDevices();
    setDevices(res.data);
  } catch (err) {
    showToast("Failed to load devices.", "error");
    console.error(err);
  } finally {
    setLoading(false);
  }
}, []);

  useEffect(() => { load(); }, [load]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.name || !form.capacity_kw) {
      showToast("Name and capacity are required.", "error");
      return;
    }
    setSaving(true);
    try {
      await producerAPI.registerDevice(form);
      showToast("Device registered!", "success");
      setForm({ name: "", device_type: "solar",
                capacity_kw: "", smart_meter_id: "" });
      setShowForm(false);
      load();
    } catch {
      showToast("Failed to register device.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await promiseToast(producerAPI.deleteDevice(deleteTarget.id), {
        loading: "Removing device…",
        success: "Device removed.",
        error:   "Failed to remove device.",
      });
      load();
    } catch { /* handled */ }
    finally { setDeleteTarget(null); }
  };

  return (
    <div className="page">
      <PageHeader
        title="My Devices"
        subtitle="Manage your energy generation hardware"
        action={
          <button
            onClick={() => setShowForm(s => !s)}
            className="btn-primary"
          >
            {showForm ? "✕ Close" : "+ Register Device"}
          </button>
        }
      />

      {/* Register form */}
      {showForm && (
        <div className="dect-card mb-6 animate-slideUp">
          <p className="section-label">Register New Device</p>
          <form onSubmit={handleRegister}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="dect-label">Device Name</label>
              <input
                className="dect-input"
                placeholder="Solar Panel A"
                value={form.name}
                onChange={e => setForm(f => ({...f, name: e.target.value}))}
              />
            </div>
            <div>
              <label className="dect-label">Device Type</label>
              <select
                className="dect-input"
                value={form.device_type}
                onChange={e => setForm(f => ({...f, device_type: e.target.value}))}
              >
                <option value="solar">Solar Panel</option>
                <option value="wind">Wind Turbine</option>
                <option value="battery">Battery Storage</option>
              </select>
            </div>
            <div>
              <label className="dect-label">Capacity (kW)</label>
              <input
                className="dect-input"
                type="number"
                step="0.1"
                placeholder="5.0"
                value={form.capacity_kw}
                onChange={e => setForm(f => ({...f, capacity_kw: e.target.value}))}
              />
            </div>
            <div>
              <label className="dect-label">Smart Meter ID (optional)</label>
              <input
                className="dect-input"
                placeholder="SM-00492"
                value={form.smart_meter_id}
                onChange={e => setForm(f => ({...f, smart_meter_id: e.target.value}))}
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving ? "Registering…" : "Register Device"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <LoadingSpinner text="LOADING DEVICES…" />
      ) : devices.length === 0 ? (
        <EmptyState
          icon="🔌"
          title="No devices registered"
          subtitle="Register your solar panels, wind turbines or batteries."
          action={
            <button
              onClick={() => setShowForm(true)}
              className="btn-secondary text-xs"
            >
              Register Device
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map(device => {
            const Icon = DEVICE_ICONS[device.device_type] || BoltIcon;
            return (
              <div key={device.id} className="dect-card-hover animate-fadeIn">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent/10
                                    border border-accent/20
                                    flex items-center justify-center">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-mono text-sm text-textPrimary font-bold">
                        {device.name}
                      </p>
                      <p className="font-mono text-xs text-muted capitalize">
                        {device.device_type}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={device.status} />
                </div>

                {[
                  { label: "Capacity",  value: `${device.capacity_kw} kW` },
                  { label: "Output",    value: `${device.current_output} kW` },
                  { label: "Meter ID",  value: device.smart_meter_id || "—" },
                ].map(({ label, value }) => (
                  <div key={label}
                       className="flex justify-between border-b border-border
                                  py-1.5 last:border-0">
                    <span className="font-mono text-xs text-muted">{label}</span>
                    <span className="font-mono text-xs text-textPrimary">{value}</span>
                  </div>
                ))}

                <button
                  onClick={() => setDeleteTarget(device)}
                  className="mt-4 font-mono text-xs text-danger
                             hover:underline"
                >
                  Remove Device
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Remove Device"
        message={`Remove "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Remove"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}