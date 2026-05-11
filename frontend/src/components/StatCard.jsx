import React from "react";
import "./StatCard.css";

export default function StatCard({
  label, value, sub, accent = false, loading = false,
}) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      {loading ? (
        <div className="stat-skeleton" />
      ) : (
        <p className={`stat-number ${accent ? "accent" : ""}`}>
          {value ?? "—"}
        </p>
      )}
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  );
}