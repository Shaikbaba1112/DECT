import React from "react";
import EmptyState    from "./EmptyState";
import LoadingSpinner from "./LoadingSpinner";

export default function DataTable({
  columns,
  data,
  loading = false,
  emptyTitle,
  emptySubtitle,
  keyField = "id",
}) {
  if (loading) return <LoadingSpinner text="LOADING DATA…" />;

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle || "No data found"}
        subtitle={emptySubtitle}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="dect-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row[keyField] ?? idx} className="animate-fadeIn">
              {columns.map(col => (
                <td key={col.key}>
                  {col.render
                    ? col.render(row[col.key], row)
                    : (row[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}