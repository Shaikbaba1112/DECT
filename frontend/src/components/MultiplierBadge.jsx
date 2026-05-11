import React from "react";
import "./MultiplierBadge.css";

export default function MultiplierBadge({ multiplier }) {
  const display = (multiplier / 100).toFixed(2) + "x";
  const level =
    multiplier >= 200 ? "high" :
    multiplier <= 75  ? "low"  : "normal";
  const labels = { high: "HIGH DEMAND", normal: "BALANCED", low: "LOW DEMAND" };

  return (
    <div className={`multiplier-badge ${level}`}>
      <span className="multiplier-value">{display}</span>
      <span className="multiplier-label">{labels[level]}</span>
    </div>
  );
}