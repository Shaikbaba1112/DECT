import React from "react";
import "./ChartCard.css";

export default function ChartCard({ title, subtitle, children, action }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <p className="chart-card-title">{title}</p>
          {subtitle && <p className="chart-card-sub">{subtitle}</p>}
        </div>
        {action && <div className="chart-card-action">{action}</div>}
      </div>
      <div className="chart-card-body">{children}</div>
    </div>
  );
}