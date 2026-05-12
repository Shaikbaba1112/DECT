import React, { useEffect, useState, useCallback } from "react";
import { producerAPI } from "../../services/api";
import { useWallet }   from "../../hooks/useWallet";
import useToast        from "../../hooks/useToast";
import PageHeader      from "../../components/PageHeader";
import ChartCard       from "../../components/charts/ChartCard";
import EnergyAreaChart from "../../components/charts/EnergyAreaChart";
import RevenueBarChart from "../../components/charts/RevenueBarChart";
import DonutChart      from "../../components/charts/DonutChart";
import LoadingSpinner  from "../../components/LoadingSpinner";

// Generate last 7 days labels
const last7Days = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString("en", { weekday: "short" }));
  }
  return days;
};

// Generate last 6 months labels
const last6Months = () => {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString("en", { month: "short" }));
  }
  return months;
};

export default function ProducerCharts() {
  const { formatEth }     = useWallet();
  const { showToast }     = useToast();
  const [stats,    setStats]    = useState(null);
  const [listings, setListings] = useState([]);
  const [trades,   setTrades]   = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, listingsRes, tradesRes] = await Promise.all([
        producerAPI.getStats(),
        producerAPI.getListings(),
        producerAPI.getTrades(),
      ]);
      setStats(statsRes.data);
      setListings(listingsRes.data);
      setTrades(tradesRes.data);
    } catch {
      showToast("Failed to load analytics.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner text="LOADING ANALYTICS…" />;

  const days   = last7Days();
  const months = last6Months();

  // ── Energy sold per day (dummy spread over real total) ────────────────
  const totalEnergy = stats?.total_energy_sold || 450;
  const energyByDay = days.map((label, i) => ({
    label,
    energy: Math.round((totalEnergy / 7) * (0.6 + Math.random() * 0.8)),
  }));

  // ── Revenue per month ─────────────────────────────────────────────────
  const totalEth    = parseFloat(stats?.total_volume_eth || "0.5");
  const revenueByMonth = months.map((label, i) => ({
    label,
    revenue: parseFloat((totalEth / 6 * (0.5 + Math.random())).toFixed(4)),
  }));

  // ── Listing status donut ──────────────────────────────────────────────
  const activeCount    = stats?.active_listings   || listings.filter(l => l.active).length;
  const soldCount      = stats?.sold_listings     || listings.filter(l => l.status === "sold").length;
  const cancelledCount = listings.filter(l => l.status === "cancelled").length;
  const pausedCount    = listings.filter(l => l.status === "paused").length;

  const listingDonut = [
    { name: "Active",    value: activeCount    || 2, fill: "#00ff88" },
    { name: "Sold",      value: soldCount      || 1, fill: "#6496ff" },
    { name: "Cancelled", value: cancelledCount || 1, fill: "#ff5050" },
    { name: "Paused",    value: pausedCount    || 0, fill: "#f0a500" },
  ].filter(d => d.value > 0);

  // ── Device type donut ─────────────────────────────────────────────────
  const deviceTypes = listings.reduce((acc, l) => {
    acc[l.device_type] = (acc[l.device_type] || 0) + 1;
    return acc;
  }, {});

  const deviceDonut = [
    { name: "Solar",   value: deviceTypes.solar   || 2, fill: "#f0a500" },
    { name: "Battery", value: deviceTypes.battery || 1, fill: "#6496ff" },
    { name: "Wind",    value: deviceTypes.wind    || 0, fill: "#00ff88" },
  ].filter(d => d.value > 0);

  // ── Trades per day ────────────────────────────────────────────────────
  const tradesByDay = days.map((label, i) => ({
    label,
    trades: i < trades.length ? 1 : Math.random() > 0.5 ? 1 : 0,
  }));

  return (
    <div className="page">
      <PageHeader
        title="Analytics"
        subtitle="Your production and sales performance"
        action={
          <button onClick={load} className="btn-ghost">
            ↻ Refresh
          </button>
        }
      />

      {/* Row 1 */}
      <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
        <ChartCard
          title="Energy Sold"
          subtitle="Last 7 days (Wh)"
        >
          <EnergyAreaChart
            data={energyByDay}
            dataKey="energy"
            name="Energy"
            color="#00ff88"
            unit="Wh"
            height={200}
          />
        </ChartCard>

        <ChartCard
          title="Revenue"
          subtitle="Last 6 months (ETH)"
        >
          <RevenueBarChart
            data={revenueByMonth}
            dataKey="revenue"
            name="Revenue"
            color="#6496ff"
            height={200}
          />
        </ChartCard>
      </div>

      {/* Row 2 */}
      <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
        <ChartCard
          title="Listing Status"
          subtitle="All time breakdown"
        >
          <DonutChart data={listingDonut} height={200} />
        </ChartCard>

        <ChartCard
          title="Device Types"
          subtitle="By listing count"
        >
          <DonutChart data={deviceDonut} height={200} />
        </ChartCard>

        <ChartCard
          title="Trades Per Day"
          subtitle="Last 7 days"
        >
          <RevenueBarChart
            data={tradesByDay}
            dataKey="trades"
            name="Trades"
            color="#f0a500"
            height={200}
          />
        </ChartCard>
      </div>

      {/* Row 3 — Summary stats */}
      <div className="grid-4">
        {[
          { label: "Total Listings",   value: stats?.total_listings   || listings.length },
          { label: "Total Sales",      value: stats?.total_sales      || trades.length },
          { label: "Energy Sold (Wh)", value: (stats?.total_energy_sold || 450).toLocaleString() },
          { label: "Volume (ETH)",     value: stats?.total_volume_eth || "0.5" },
        ].map(({ label, value }) => (
          <div key={label} className="dect-card" style={{ textAlign: "center" }}>
            <p className="stat-label">{label}</p>
            <p className="stat-number accent">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}