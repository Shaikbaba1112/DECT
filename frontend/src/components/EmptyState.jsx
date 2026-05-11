import React from "react";
import "./EmptyState.css";

export default function EmptyState({ icon = "⚡", title, subtitle, action }) {
  return (
    <div className="empty-state">
      <p className="empty-state-icon">{icon}</p>
      <p className="empty-state-title">{title}</p>
      {subtitle && <p className="empty-state-subtitle">{subtitle}</p>}
      {action}
    </div>
  );
}