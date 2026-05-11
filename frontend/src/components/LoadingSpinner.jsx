import React from "react";
import "./LoadingSpinner.css";

export default function LoadingSpinner({ size = "md", text }) {
  return (
    <div className="loading-spinner">
      <span className={`spinner-icon ${size}`}>⚡</span>
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
}