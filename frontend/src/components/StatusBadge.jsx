import React from "react";

const MAP = {
  active:      "badge badge-active",
  sold:        "badge badge-sold",
  cancelled:   "badge badge-sold",
  expired:     "badge badge-sold",
  paused:      "badge badge-warning",
  pending:     "badge badge-warning",
  accepted:    "badge badge-active",
  rejected:    "badge badge-danger",
  countered:   "badge badge-warning",
  open:        "badge badge-danger",
  reviewed:    "badge badge-warning",
  safe:        "badge badge-active",
  confirmed:   "badge badge-danger",
  online:      "badge badge-active",
  offline:     "badge badge-sold",
  maintenance: "badge badge-warning",
};

export default function StatusBadge({ status }) {
  const cls = MAP[status?.toLowerCase()] || "badge badge-sold";
  return <span className={cls}>{status?.toUpperCase()}</span>;
}