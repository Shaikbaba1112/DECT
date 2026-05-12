import React from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

const CustomTooltip = ({ active, payload, label, unit = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="custom-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="custom-tooltip-item">
          <span
            className="custom-tooltip-dot"
            style={{ background: p.color }}
          />
          <span style={{ color: p.color }}>
            {p.name}: {p.value} {unit}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function EnergyAreaChart({
  data = [],
  dataKey = "value",
  name = "Energy",
  color = "#00ff88",
  unit = "Wh",
  height = 200,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1e2530" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#4a5568", fontSize: 10, fontFamily: "Share Tech Mono" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#4a5568", fontSize: 10, fontFamily: "Share Tech Mono" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip unit={unit} />} />
        <Area
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${dataKey})`}
          dot={false}
          activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}