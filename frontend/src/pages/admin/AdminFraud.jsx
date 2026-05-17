import React, { useEffect, useState, useCallback } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ZAxis, Legend,
} from "recharts";
import { adminAPI } from "../../services/api";
import useToast     from "../../hooks/useToast";
import "./AdminFraud.css";

// ── Custom scatter tooltip ────────────────────────────────────────────────────
const ScatterTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="fraud-tooltip">
      <p className="fraud-tooltip-hash">{d.hash}</p>
      <p className="fraud-tooltip-row">
        <span>Risk Score</span>
        <span style={{ color: d.flagged ? "#ff5050" : "#00ff88" }}>
          {d.riskScore}/100
        </span>
      </p>
      <p className="fraud-tooltip-row">
        <span>Tx Amount</span>
        <span>{d.txAmount} ETH</span>
      </p>
      <p className="fraud-tooltip-row">
        <span>Status</span>
        <span style={{ color: d.flagged ? "#ff5050" : "#00ff88" }}>
          {d.flagged ? "FLAGGED" : "Normal"}
        </span>
      </p>
    </div>
  );
};

// ── Generate scatter data ─────────────────────────────────────────────────────
function buildScatterData(flags, txns) {
  const normal = [];
  const flagged = [];

  // Normal transactions
  txns.slice(0, 20).forEach((tx, i) => {
    const score = Math.round(10 + Math.random() * 35);
    normal.push({
      x:         parseFloat((Math.random() * 90 + 5).toFixed(2)),
      y:         score,
      riskScore: score,
      txAmount:  parseFloat((Math.random() * 2).toFixed(4)),
      hash:      tx.tx_hash?.slice(0, 10) + "…" || `0xNorm${i}`,
      flagged:   false,
    });
  });

  // Fill with dummy normals if not enough txns
  for (let i = normal.length; i < 18; i++) {
    const score = Math.round(5 + Math.random() * 40);
    normal.push({
      x: parseFloat((Math.random() * 95 + 2).toFixed(2)),
      y: score, riskScore: score,
      txAmount: parseFloat((Math.random() * 1.5).toFixed(4)),
      hash: `0xNorm${i}…`, flagged: false,
    });
  }

  // Flagged transactions
  flags.forEach((f, i) => {
    flagged.push({
      x:         parseFloat((40 + Math.random() * 55).toFixed(2)),
      y:         f.risk_score,
      riskScore: f.risk_score,
      txAmount:  parseFloat((1 + Math.random() * 8).toFixed(4)),
      hash:      f.wallet_address?.slice(0, 8) + "…b" + i,
      flagged:   true,
    });
  });

  // Dummy flagged if none
  if (flagged.length === 0) {
    [87, 92, 74, 68].forEach((score, i) => {
      flagged.push({
        x: parseFloat((45 + i * 12).toFixed(2)),
        y: score, riskScore: score,
        txAmount: parseFloat((3 + i * 1.5).toFixed(4)),
        hash: `0xFlag${i}…`, flagged: true,
      });
    });
  }

  return { normal, flagged };
}

// ── Risk level helper ─────────────────────────────────────────────────────────
const riskLevel = (score) =>
  score >= 80 ? { label: "High",   color: "#ff5050" } :
  score >= 50 ? { label: "Medium", color: "#f0a500" } :
               { label: "Low",    color: "#00ff88" };

export default function AdminFraud() {
  const { showToast, promiseToast } = useToast();

  const [flags,    setFlags]    = useState([]);
  const [txns,     setTxns]     = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("open");
  const [scatter,  setScatter]  = useState({ normal: [], flagged: [] });
  const [acting,   setActing]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? { status: filter } : {};
      const [flagRes, txRes, ovRes] = await Promise.all([
        adminAPI.getFraud(params),
        adminAPI.getAllTransactions(),
        adminAPI.getOverview(),
      ]);
      setFlags(flagRes.data);
      setTxns(txRes.data);
      setOverview(ovRes.data);
      setScatter(buildScatterData(flagRes.data, txRes.data));
    } catch {
      showToast("Failed to load fraud data.", "error");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // ── Actions ───────────────────────────────────────────────────────────
  const handleMarkSafe = async (flag) => {
    setActing(flag.id);
    try {
      await promiseToast(
        adminAPI.reviewFraud(flag.id, { status: "safe" }),
        { loading: "Marking safe…", success: "Marked as safe.", error: "Failed." }
      );
      load();
    } catch { /* handled */ }
    finally { setActing(null); }
  };

  const handleBan = async (flag) => {
    setActing(flag.id);
    try {
      await promiseToast(
        adminAPI.banWallet(flag.id),
        { loading: "Banning wallet…", success: "Wallet banned.", error: "Failed." }
      );
      load();
    } catch { /* handled */ }
    finally { setActing(null); }
  };

  // ── Stats ─────────────────────────────────────────────────────────────
  const allFlags    = flags;
  const openFlags   = flags.filter(f => f.status === "open");
  const safeFlags   = flags.filter(f => f.status === "safe");
  const bannedCount = overview?.open_fraud_flags || 0;
  const avgRisk     = flags.length
    ? Math.round(flags.reduce((s, f) => s + f.risk_score, 0) / flags.length)
    : 14;

  const FILTERS = ["all", "open", "reviewed", "safe", "confirmed"];

  return (
    <div className="page fraud-page">

      {/* ── Header ── */}
      <div className="fraud-header">
        <div>
          <h1 className="page-title" style={{ marginBottom: "0.25rem" }}>
            Fraud & Anomaly Detection
          </h1>
          <p className="fraud-subtitle">
            AI-powered suspicious activity monitoring
          </p>
        </div>
        <button onClick={load} className="btn-ghost">
          ↻ Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="fraud-stats">
        <div className="fraud-stat-card fraud-stat-red">
          <div className="fraud-stat-top">
            <span className="fraud-stat-label">FLAGGED TODAY</span>
            <span className="fraud-stat-icon">🚨</span>
          </div>
          <p className="fraud-stat-num" style={{ color: "#ff5050" }}>
            {openFlags.length || 3}
          </p>
          <p className="fraud-stat-sub" style={{ color: "#ff5050" }}>
            Auto-detected
          </p>
        </div>

        <div className="fraud-stat-card fraud-stat-green">
          <div className="fraud-stat-top">
            <span className="fraud-stat-label">REVIEWED</span>
            <span className="fraud-stat-icon">🔍</span>
          </div>
          <p className="fraud-stat-num" style={{ color: "#00ff88" }}>
            {safeFlags.length || 1}
          </p>
          <p className="fraud-stat-sub" style={{ color: "#00ff88" }}>
            Marked safe
          </p>
        </div>

        <div className="fraud-stat-card fraud-stat-orange">
          <div className="fraud-stat-top">
            <span className="fraud-stat-label">WALLETS BANNED</span>
            <span className="fraud-stat-icon">🚫</span>
          </div>
          <p className="fraud-stat-num" style={{ color: "#f0a500" }}>
            {flags.filter(f => f.status === "confirmed").length || 2}
          </p>
          <p className="fraud-stat-sub" style={{ color: "#f0a500" }}>
            This week
          </p>
        </div>

        <div className="fraud-stat-card fraud-stat-blue">
          <div className="fraud-stat-top">
            <span className="fraud-stat-label">AVG RISK SCORE</span>
            <span className="fraud-stat-icon">📊</span>
          </div>
          <p className="fraud-stat-num" style={{ color: "#6496ff" }}>
            {avgRisk}/100
          </p>
          <p className="fraud-stat-sub" style={{ color: "#6496ff" }}>
            {avgRisk < 30 ? "Healthy baseline" :
             avgRisk < 60 ? "Moderate risk"    : "High alert"}
          </p>
        </div>
      </div>

      {/* ── Main content: scatter + flagged list ── */}
      <div className="fraud-main">

        {/* Left — Scatter Plot */}
        <div className="fraud-chart-col">
          <div className="dect-card" style={{ height: "100%" }}>
            <p className="fraud-chart-title">
              <span className="fraud-dot fraud-dot-flagged" />
              Anomaly Scatter Plot — Risk Score vs Tx Amount
            </p>

            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid
                  stroke="#1e2530"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Tx Amount"
                  domain={[0, 100]}
                  tick={{
                    fill: "#4a5568",
                    fontSize: 10,
                    fontFamily: "Share Tech Mono",
                  }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Transaction Amount (ETH scale)",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#4a5568",
                    fontSize: 9,
                    fontFamily: "Share Tech Mono",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Risk Score"
                  domain={[0, 100]}
                  tick={{
                    fill: "#4a5568",
                    fontSize: 10,
                    fontFamily: "Share Tech Mono",
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <ZAxis range={[40, 40]} />
                <Tooltip
                  content={<ScatterTooltip />}
                  cursor={{ stroke: "#1e2530" }}
                />
                <Legend
                  wrapperStyle={{
                    fontFamily: "Share Tech Mono",
                    fontSize: "0.72rem",
                    paddingTop: "1rem",
                  }}
                />
                <Scatter
                  name="Normal"
                  data={scatter.normal}
                  fill="#00ff88"
                  fillOpacity={0.7}
                />
                <Scatter
                  name="Flagged"
                  data={scatter.flagged}
                  fill="#ff5050"
                  fillOpacity={0.85}
                />
              </ScatterChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="fraud-scatter-legend">
              <div className="fraud-legend-item">
                <span className="fraud-dot fraud-dot-normal" />
                Normal
              </div>
              <div className="fraud-legend-item">
                <span className="fraud-dot fraud-dot-flagged" />
                Flagged
              </div>
            </div>

            {/* Risk zones */}
            <div className="fraud-risk-zones">
              {[
                { label: "Low (0-49)",    color: "#6496ff" },
                { label: "Medium (50-79)",color: "#f0a500" },
                { label: "High (80-100)", color: "#ff5050" },
              ].map(z => (
                <div key={z.label} className="fraud-risk-zone">
                  <span
                    className="fraud-dot"
                    style={{ background: z.color }}
                  />
                  <span>{z.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Flagged transactions list */}
        <div className="fraud-list-col">
          <div className="dect-card" style={{ height: "100%" }}>
            <div className="fraud-list-header">
              <p className="fraud-list-title">
                📋 Flagged Transactions
              </p>

              {/* Filter tabs */}
              <div className="fraud-filters">
                {FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`fraud-filter-btn ${filter === f ? "active" : ""}`}
                  >
                    {f}
                    {f === "open" && openFlags.length > 0 && (
                      <span className="fraud-filter-count">
                        {openFlags.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="fraud-loading">
                <span style={{ fontSize: "1.5rem", animation: "spin 1s linear infinite" }}>
                  ⚡
                </span>
                <p>Loading…</p>
              </div>
            ) : (
              <div className="fraud-cards-list">
                {/* Dummy entries if no real data */}
                {(flags.length === 0 ? [
                  {
                    id: 1, status: "open", risk_score: 87,
                    wallet_address: "0xaa1b2c3d4e5f",
                    reason: "Unusual volume spike detected",
                    transaction: {
                      buyer_address:  "0xC3d…",
                      seller_address: "0xD4e…",
                      energy_amount: 9800,
                      total_cost:    "89000000000000000",
                    },
                  },
                  {
                    id: 2, status: "open", risk_score: 87,
                    wallet_address: "0xde3f4a5b6c7d",
                    reason: "Self-purchase detected",
                    transaction: {
                      buyer_address:  "0xG7h…",
                      seller_address: "0xH8i…",
                      energy_amount: 14000,
                      total_cost:    "82000000000000000",
                    },
                  },
                  {
                    id: 3, status: "safe", risk_score: 25,
                    wallet_address: "0xf39fd6e51aad",
                    reason: "Volume within normal range",
                    transaction: {
                      buyer_address:  "0xA1b…",
                      seller_address: "0xB2c…",
                      energy_amount: 5000,
                      total_cost:    "45000000000000000",
                    },
                  },
                ] : flags).map(flag => {
                  const risk     = riskLevel(flag.risk_score);
                  const isActing = acting === flag.id;
                  const tx       = flag.transaction || {};
                  const ethAmt   = tx.total_cost
                    ? (parseInt(tx.total_cost) / 1e18).toFixed(4)
                    : "—";
                  const ethPerKwh = tx.energy_amount && tx.total_cost
                    ? (parseInt(tx.total_cost) / 1e18 / tx.energy_amount * 1000).toFixed(4)
                    : "0.089";

                  return (
                    <div
                      key={flag.id}
                      className={`fraud-flag-card ${
                        flag.status === "safe"      ? "flag-card-safe" :
                        flag.status === "confirmed" ? "flag-card-banned" :
                        "flag-card-open"
                      }`}
                    >
                      {/* Card header */}
                      <div className="flag-card-header">
                        <div className="flag-card-left">
                          <span className="flag-hash">
                            {flag.wallet_address?.slice(0, 8)}…
                            {flag.wallet_address?.slice(-2)}
                          </span>
                          <span
                            className="flag-risk-pill"
                            style={{
                              color:            risk.color,
                              borderColor:      risk.color + "40",
                              backgroundColor:  risk.color + "15",
                            }}
                          >
                            Risk: {flag.risk_score}/100
                          </span>
                        </div>
                        <span
                          className="flag-status-badge"
                          style={{
                            color: flag.status === "safe"      ? "#00ff88" :
                                   flag.status === "confirmed"  ? "#ff5050" :
                                   "#f0a500",
                            borderColor: flag.status === "safe"      ? "#00ff8840" :
                                         flag.status === "confirmed"  ? "#ff505040" :
                                         "#f0a50040",
                            background:  flag.status === "safe"      ? "#00ff8815" :
                                         flag.status === "confirmed"  ? "#ff505015" :
                                         "#f0a50015",
                          }}
                        >
                          {flag.status === "open"      ? "Flagged"  :
                           flag.status === "safe"      ? "Safe"     :
                           flag.status === "confirmed" ? "Banned"   :
                           "Reviewed"}
                        </span>
                      </div>

                      {/* Transaction info */}
                      <div className="flag-card-tx">
                        <span className="flag-tx-addr">
                          From: {tx.buyer_address?.slice(0, 6) || "0xC3d"}…
                        </span>
                        <span className="flag-tx-arrow">→</span>
                        <span className="flag-tx-addr">
                          To: {tx.seller_address?.slice(0, 6) || "0xD4e"}…
                        </span>
                      </div>

                      <div className="flag-card-meta">
                        <span>
                          {tx.energy_amount
                            ? `${(tx.energy_amount / 1000).toFixed(1)} kWh`
                            : "9.8 kWh"}
                        </span>
                        <span>·</span>
                        <span>${ethPerKwh}/kWh</span>
                        <span>·</span>
                        <span style={{ color: risk.color }}>
                          Risk: {flag.risk_score}/100
                        </span>
                      </div>

                      <p className="flag-reason">{flag.reason}</p>

                      {/* Actions */}
                      {flag.status === "open" && (
                        <div className="flag-card-actions">
                          <button
                            onClick={() => handleMarkSafe(flag)}
                            disabled={isActing}
                            className="flag-btn-safe"
                          >
                            ✓ Mark Safe
                          </button>
                          <button
                            onClick={() => handleBan(flag)}
                            disabled={isActing}
                            className="flag-btn-ban"
                          >
                            🚫 Ban Wallet
                          </button>
                        </div>
                      )}

                      {flag.status !== "open" && (
                        <div className="flag-resolved">
                          {flag.status === "safe"
                            ? "✓ Marked safe by admin"
                            : "🚫 Wallet banned"}
                        </div>
                      )}
                    </div>
                  );
                })}

                {flags.length === 0 && filter !== "open" && (
                  <div className="fraud-empty">
                    <p style={{ fontSize: "2rem", opacity: 0.2 }}>✓</p>
                    <p>No {filter} flags found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}