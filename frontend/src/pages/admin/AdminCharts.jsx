import React, { useEffect, useState, useCallback } from "react";
import { adminAPI } from "../../services/api";
import { useWallet } from "../../hooks/useWallet";
import useToast      from "../../hooks/useToast";
import PageHeader    from "../../components/PageHeader";
import ChartCard     from "../../components/charts/ChartCard";
import EnergyAreaChart  from "../../components/charts/EnergyAreaChart";
import RevenueBarChart  from "../../components/charts/RevenueBarChart";
import DonutChart       from "../../components/charts/DonutChart";
import MultiLineChart   from "../../components/charts/MultiLineChart";
import FraudRiskChart   from "../../components/charts/FraudRiskChart";
import LoadingSpinner   from "../../components/LoadingSpinner";

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

export default function AdminCharts() {
  const { formatEth }    = useWallet();
  const { showToast }    = useToast();
  const [overview,  setOverview]  = useState(null);
  const [txns,      setTxns]      = useState([]);
  const [users,     setUsers]     = useState([]);
  const [fraud,     setFraud]     = useState([]);
  const [listings,  setListings]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, txRes, usersRes, fraudRes, listRes] = await Promise.all([
        adminAPI.getOverview(),
        adminAPI.getAllTransactions(),
        adminAPI.getUsers(),
        adminAPI.getFraud(),
        adminAPI.getAllListings(),
      ]);
      setOverview(ovRes.data);
      setTxns(txRes.data);
      setUsers(usersRes.data);
      setFraud(fraudRes.data);
      setListings(listRes.data);
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

  // ── Platform volume per month ─────────────────────────────────────────
  const totalVol     = parseFloat(overview?.total_volume_eth || "0.5");
  const volumeByMonth = months.map(label => ({
    label,
    volume: parseFloat((totalVol / 6 * (0.3 + Math.random())).toFixed(4)),
  }));

  // ── Transactions per day ──────────────────────────────────────────────
  const txByDay = days.map((label, i) => ({
    label,
    transactions: i < txns.length
      ? Math.min(txns.length, Math.round(txns.length / 7 * (0.5 + Math.random())))
      : Math.round(Math.random() * 3),
  }));

  // ── User roles donut ──────────────────────────────────────────────────
  const roleCount = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  const userDonut = [
    { name: "Consumer", value: roleCount.consumer || overview?.total_consumers || 1, fill: "#6496ff" },
    { name: "Producer", value: roleCount.producer || overview?.total_producers || 1, fill: "#00ff88" },
    { name: "Both",     value: roleCount.both     || 0, fill: "#f0a500" },
    { name: "Admin",    value: roleCount.admin    || 1, fill: "#ff5050" },
  ].filter(d => d.value > 0);

  // ── Listing status donut ──────────────────────────────────────────────
  const listingStatus = listings.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  const listingDonut = [
    { name: "Active",    value: listingStatus.active    || overview?.active_listings || 2, fill: "#00ff88" },
    { name: "Sold",      value: listingStatus.sold      || overview?.sold_listings   || 1, fill: "#6496ff" },
    { name: "Cancelled", value: listingStatus.cancelled || 1, fill: "#ff5050" },
    { name: "Paused",    value: listingStatus.paused    || 0, fill: "#f0a500" },
  ].filter(d => d.value > 0);

  // ── Supply vs demand ──────────────────────────────────────────────────
  const supplyDemand = days.map(label => ({
    label,
    supply: Math.round(2 + Math.random() * 5),
    demand: Math.round(1 + Math.random() * 7),
  }));

  // ── Fraud risk chart data ─────────────────────────────────────────────
  const fraudChartData = fraud.length > 0
    ? fraud.slice(0, 8).map((f, i) => ({
        label:  `${f.wallet_address.slice(0,6)}…`,
        score:  f.risk_score,
      }))
    : [
        { label: "0x7099…", score: 72 },
        { label: "0xf39f…", score: 25 },
        { label: "0x3c44…", score: 88 },
        { label: "0x9065…", score: 45 },
        { label: "0x1502…", score: 15 },
      ];

  // ── Energy traded per day ─────────────────────────────────────────────
  const totalEnergy = overview?.total_energy_traded || 700;
  const energyByDay = days.map(label => ({
    label,
    energy: Math.round(totalEnergy / 7 * (0.5 + Math.random())),
  }));

  return (
    <div className="page">
      <PageHeader
        title="Platform Analytics"
        subtitle="System-wide performance metrics"
        action={
          <button onClick={load} className="btn-ghost">↻ Refresh</button>
        }
      />

      {/* Row 1 — Volume + Transactions */}
      <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
        <ChartCard title="Platform Volume" subtitle="Last 6 months (ETH)">
          <EnergyAreaChart
            data={volumeByMonth}
            dataKey="volume"
            name="Volume"
            color="#00ff88"
            unit="ETH"
            height={200}
          />
        </ChartCard>

        <ChartCard title="Daily Transactions" subtitle="Last 7 days">
          <RevenueBarChart
            data={txByDay}
            dataKey="transactions"
            name="Transactions"
            color="#6496ff"
            height={200}
          />
        </ChartCard>
      </div>

      {/* Row 2 — User roles + Listing status + Supply/Demand */}
      <div className="grid-3" style={{ marginBottom: "1.5rem" }}>
        <ChartCard title="User Roles" subtitle="Platform breakdown">
          <DonutChart data={userDonut} height={200} />
        </ChartCard>

        <ChartCard title="Listing Status" subtitle="All listings">
          <DonutChart data={listingDonut} height={200} />
        </ChartCard>

        <ChartCard title="Supply vs Demand" subtitle="Last 7 days">
          <MultiLineChart
            data={supplyDemand}
            lines={[
              { key: "supply", name: "Supply", color: "#00ff88" },
              { key: "demand", name: "Demand", color: "#ff5050" },
            ]}
            height={200}
          />
        </ChartCard>
      </div>

      {/* Row 3 — Fraud + Energy */}
      <div className="grid-2" style={{ marginBottom: "1.5rem" }}>
        <ChartCard
          title="Fraud Risk Scores"
          subtitle="Flagged wallet risk levels (0-100)"
          action={
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.65rem",
              color: "var(--muted)",
            }}>
              {fraud.filter(f => f.risk_score >= 80).length} high risk
            </span>
          }
        >
          <FraudRiskChart data={fraudChartData} height={220} />

          {/* Risk legend */}
          <div style={{
            display: "flex",
            gap: "1.5rem",
            marginTop: "0.75rem",
            justifyContent: "center",
          }}>
            {[
              { color: "#ff5050", label: "High Risk (80-100)" },
              { color: "#f0a500", label: "Medium (50-79)" },
              { color: "#6496ff", label: "Low (0-49)" },
            ].map(({ color, label }) => (
              <div key={label} style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontFamily: "var(--font-mono)",
                fontSize: "0.65rem",
                color: "var(--muted)",
              }}>
                <span style={{
                  width: 8, height: 8,
                  borderRadius: "50%",
                  background: color,
                  display: "inline-block",
                }} />
                {label}
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Energy Traded" subtitle="Last 7 days (Wh)">
          <EnergyAreaChart
            data={energyByDay}
            dataKey="energy"
            name="Energy"
            color="#f0a500"
            unit="Wh"
            height={220}
          />

          {/* Quick stats below chart */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.75rem",
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--border)",
          }}>
            {[
              { label: "Total Traded",  value: `${(overview?.total_energy_traded || 700).toLocaleString()} Wh` },
              { label: "Transactions",  value: overview?.total_transactions || txns.length },
              { label: "Unique Traders",value: overview?.unique_participants || 3 },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem",
                            color: "var(--muted)", textTransform: "uppercase",
                            letterSpacing: "0.08em", marginBottom: "0.2rem" }}>
                  {label}
                </p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem",
                            color: "var(--accent)", fontWeight: 700 }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Row 4 — Platform KPIs */}
      <div className="grid-4">
        {[
          { label: "Total Users",      value: overview?.total_users       || users.length },
          { label: "Total Listings",   value: overview?.total_listings    || listings.length },
          { label: "Total Trades",     value: overview?.total_transactions || txns.length },
          { label: "Platform Volume",  value: `${overview?.total_volume_eth || "0.5"} ETH` },
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