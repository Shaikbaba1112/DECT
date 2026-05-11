import React, { useEffect, useState } from "react";
import { broadcastAPI } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import "./BroadcastBanner.css";

export default function BroadcastBanner() {
  const { isAuthenticated }       = useAuth();
  const [broadcast, setBroadcast] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    broadcastAPI.getActive()
      .then(r => { if (r.data.broadcast) setBroadcast(r.data.broadcast); })
      .catch(() => {});
  }, [isAuthenticated]);

  if (!broadcast || dismissed) return null;

  const icons = {
    info: "ℹ", warning: "⚠", critical: "✕", maintenance: "🔧"
  };

  return (
    <div className={`broadcast-banner ${broadcast.alert_type}`}>
      <span className="broadcast-icon">
        {icons[broadcast.alert_type]}
      </span>
      <span className="broadcast-msg">{broadcast.message}</span>
      <span className="broadcast-type">{broadcast.alert_type}</span>
      <button
        className="broadcast-close"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}