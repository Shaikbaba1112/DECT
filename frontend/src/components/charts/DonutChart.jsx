import React from "react";
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="custom-tooltip-item">
        <span
          className="custom-tooltip-dot"
          style={{ background: payload[0].payload.fill }}
        />
        <span style={{ color: payload[0].payload.fill }}>
          {payload[0].name}: {payload[0].value}
        </span>
      </div>
    </div>
  );
};

const renderLegend = (props) => {
  const { payload } = props;
  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "0.75rem",
      justifyContent: "center",
      marginTop: "0.75rem",
    }}>
      {payload.map((entry, i) => (
        <div key={i} style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          fontFamily: "Share Tech Mono",
          fontSize: "0.65rem",
          color: "#8899aa",
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: entry.color,
            display: "inline-block",
          }} />
          {entry.value}
        </div>
      ))}
    </div>
  );
};

export default function DonutChart({
  data = [],
  height = 220,
  innerRadius = 55,
  outerRadius = 85,
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          dataKey="value"
          strokeWidth={0}
          paddingAngle={3}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={renderLegend} />
      </PieChart>
    </ResponsiveContainer>
  );
}