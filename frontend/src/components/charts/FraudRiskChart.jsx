import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  const level =
    score >= 80 ? "HIGH RISK" :
    score >= 50 ? "MEDIUM RISK" : "LOW RISK";
  const color =
    score >= 80 ? "#ff5050" :
    score >= 50 ? "#f0a500" : "#6496ff";

  return (
    <div className="custom-tooltip">
      <p className="custom-tooltip-label">{label}</p>
      <div className="custom-tooltip-item">
        <span className="custom-tooltip-dot" style={{ background: color }} />
        <span style={{ color }}>Score: {score} — {level}</span>
      </div>
    </div>
  );
};

export default function FraudRiskChart({ data = [], height = 200 }) {
  const getColor = (score) =>
    score >= 80 ? "#ff5050" :
    score >= 50 ? "#f0a500" : "#6496ff";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#1e2530" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#4a5568", fontSize: 9, fontFamily: "Share Tech Mono" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#4a5568", fontSize: 10, fontFamily: "Share Tech Mono" }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={80}
          stroke="rgba(255,80,80,0.3)"
          strokeDasharray="4 4"
          label={{ value: "HIGH", fill: "#ff5050", fontSize: 9,
                   fontFamily: "Share Tech Mono", position: "right" }}
        />
        <ReferenceLine
          y={50}
          stroke="rgba(240,165,0,0.3)"
          strokeDasharray="4 4"
          label={{ value: "MED", fill: "#f0a500", fontSize: 9,
                   fontFamily: "Share Tech Mono", position: "right" }}
        />
        <Bar dataKey="score" radius={[3, 3, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={getColor(entry.score)} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}