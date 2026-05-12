import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="custom-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="custom-tooltip-item">
          <span
            className="custom-tooltip-dot"
            style={{ background: p.color || "#00ff88" }}
          />
          <span style={{ color: p.color || "#00ff88" }}>
            {p.name}: {p.value} ETH
          </span>
        </div>
      ))}
    </div>
  );
};

export default function RevenueBarChart({
  data = [],
  dataKey = "value",
  name = "Revenue",
  color = "#00ff88",
  height = 200,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
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
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey={dataKey} name={name} radius={[3, 3, 0, 0]}>
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={color}
              fillOpacity={0.7 + (index % 3) * 0.1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}