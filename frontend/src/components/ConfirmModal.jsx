import React from "react";
import "./ConfirmModal.css";

export default function ConfirmModal({
  open, title = "Are you sure?", message,
  confirmLabel = "Confirm", cancelLabel = "Cancel",
  danger = false, loading = false, onConfirm, onCancel,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-icon">
            {danger ? "⚠" : "?"}
          </span>
          <h3 className="modal-title">{title}</h3>
        </div>
        {message && <p className="modal-message">{message}</p>}
        <div className="modal-actions">
          <button onClick={onCancel} className="btn-ghost" disabled={loading}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={danger ? "btn-danger" : "btn-primary"}
            disabled={loading}
          >
            {loading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}