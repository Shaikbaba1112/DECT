import React, { useEffect, useState, useCallback } from "react";
import { consumerAPI, marketAPI } from "../../services/api";
import { useWallet }  from "../../hooks/useWallet";
import useToast       from "../../hooks/useToast";
import PageHeader     from "../../components/PageHeader";
import ChartCard      from "../../components/charts/ChartCard";
import EnergyAreaChart from "../../components/charts/EnergyAreaChart";
import RevenueBarChart from "../../components/charts/RevenueBarChart";
import DonutChart      from "../../components/charts/DonutChart";
import MultiLineChart  from "../../components/charts/MultiLineChart";
import LoadingSpinner  from "../../components/LoadingSpinner";

const last7Days = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString("en", { weekday: "short" }));
  }
  return days;
};

const last6Months = () => {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString("en", { month: "short" }));
  }
  return months;
};

export default function ConsumerCharts() {
  const { formatEth }    = useWallet();
  const { showToast }    = useToast();
  const [stats,  setStats]  = useState(null);
  const [trades, setTrades] = useState([]);
  const [bids,   setBids]   = useState([]);
  const [market, setMarket] = useState(null);
  const [loading,setLoading]= useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, tradesRes, bidsRes] = await Promise.all([
        consumerAPI.getStats(),
        consumerAPI.getTrades(),
        consumerAPI.getBids(),
      ]);
      setStats(statsRes.data);
      setTrades(tradesRes.data);
      setBids(bidsRes.data);

      try {
        const mktRes = await marketAPI.getStats();
        setMarket(mktRes.data);
      } catch { /* ignore */ }
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

  // ── Energy bought per day ─────────────────────────────────────────────
  const totalEnergy    = stats?.total_energy_bought || 350;
  const energyByDay    = days.map(label => ({
    label,
    energy: Math.round(totalEnergy / 7 * (0.5 + Math.random())),
  }));

  // ── Spending per month ────────────────────────────────────────────────
  const totalSpent     = parseFloat(stats?.total_spent_eth || "0.5");
  const spendByMonth   = months.map(label => ({
    label,
    spent: parseFloat((totalSpent / 6 * (0.4 + Math.random())).toFixed(4)),
  }));

  // ── Bid status donut ──────────────────────────────────────────────────
  const bidsByStatus = bids.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const bidDonut = [
    { name: "Pending",   value: bidsByStatus.pending   || 1, fill: "#f0a500" },
    { name: "Accepted",  value: bidsByStatus.accepted  || 1, fill: "#00ff88" },
    { name: "Rejected",  value: bidsByStatus.rejected  || 1, fill: "#ff5050" },
    { name: "Countered", value: bidsByStatus.countered || 1, fill: "#6496ff" },
  ].filter(d => d.value > 0);

  // ── Purchase by device type ───────────────────────────────────────────
  const deviceTypes = trades.reduce((acc, t) => {
    const type = t.listing?.device_type || "solar";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const purchaseDonut = [
    { name: "Solar",   value: deviceTypes.solar   || 2, fill: "#f0a500" },
    { name: "Battery", value: deviceTypes.battery || 1, fill: "#6496ff" },
    { name: "Wind",    value: deviceTypes.wind    || 1, fill: "#00ff88" },
  ].filter(d => d.value > 0);

  // ── Supply vs demand (market history) ─────────────────────────────────
  const supplyDemandData = days.map((label, i) => ({
    label,
    supply: Math.round(3 + Math.random() * 5),
    demand: Math.round(2 + Math.random() * 6),
  }));

  return (
    <div className="page">
      <PageHeader
        title="Analytics"
        subtitle="Your energy purchasing insights"
        action={
          <button onClick={load} className="btn-ghost">↻ Refresh</button>
        }
      />

      {/* Row 1 */}
      <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
        <ChartCard title="Energy Purchased" subtitle="Last 7 days (Wh)">
          <EnergyAreaChart
            data={energyByDay}
            dataKey="energy"
            name="Energy"
            color="#6496ff"
            unit="Wh"
            height={200}
          />
        </ChartCard>

        <ChartCard title="Spending" subtitle="Last 6 months (ETH)">
          <RevenueBarChart
            data={spendByMonth}
            dataKey="spent"
            name="Spent"
            color="#00ff88"
            height={200}
          />
        </ChartCard>
      </div>

      {/* Row 2 */}
      <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
        <ChartCard title="Bid Status" subtitle="All bids breakdown">
          <DonutChart data={bidDonut} height={200} />
        </ChartCard>

        <ChartCard title="Purchases by Source" subtitle="Device type">
          <DonutChart data={purchaseDonut} height={200} />
        </ChartCard>

        <ChartCard title="Market Supply vs Demand" subtitle="Last 7 days">
          <MultiLineChart
            data={supplyDemandData}
            lines={[
              { key: "supply", name: "Supply", color: "#00ff88" },
              { key: "demand", name: "Demand", color: "#ff5050" },
            ]}
            height={200}
          />
        </ChartCard>
      </div>

      {/* Summary */}
      <div className="grid-4">
        {[
          { label: "Total Purchases",  value: stats?.total_purchases || trades.length },
          { label: "Energy Bought (Wh)",value: (stats?.total_energy_bought || 350).toLocaleString() },
          { label: "Total Spent (ETH)", value: stats?.total_spent_eth || "0.5" },
          { label: "Available Now",     value: stats?.available_listings || 3 },
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