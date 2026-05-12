import React from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
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
            style={{ background: p.color }}
          />
          <span style={{ color: p.color }}>
            {p.name}: {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function MultiLineChart({
  data = [],
  lines = [],
  height = 220,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
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
          width={35}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{
            fontFamily: "Share Tech Mono",
            fontSize: "0.65rem",
            color: "#8899aa",
            paddingTop: "0.75rem",
          }}
        />
        {lines.map((line, i) => (
          <Line
            key={i}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: line.color, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}