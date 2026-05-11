import React, { useEffect, useState, useCallback } from "react";
import { adminAPI } from "../../services/api";
import { useWallet } from "../../hooks/useWallet";
import useToast     from "../../hooks/useToast";
import PageHeader   from "../../components/PageHeader";
import EmptyState   from "../../components/EmptyState";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function AdminTransactions() {
  const { formatEth }     = useWallet();
  const { showToast }     = useToast();
  const [txns,   setTxns]   = useState([]);
  const [loading,setLoading]= useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = search ? { search } : {};
      const res = await adminAPI.getAllTransactions(params);
      setTxns(res.data);
    } catch {
      showToast("Failed to load transactions.", "error");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="page">
      <PageHeader
        title="All Transactions"
        subtitle="Platform-wide trade history"
      />

      <div className="flex gap-3 mb-4">
        <input
          className="dect-input w-72"
          placeholder="Search by hash, buyer or seller…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="font-mono text-xs text-muted self-center">
          {txns.length} results
        </span>
      </div>

      {loading ? (
        <LoadingSpinner text="LOADING TRANSACTIONS…" />
      ) : txns.length === 0 ? (
        <EmptyState icon="📊" title="No transactions found" />
      ) : (
        <div className="dect-card overflow-x-auto">
          <table className="dect-table">
            <thead>
              <tr>
                <th>Tx Hash</th>
                <th>Buyer</th>
                <th>Seller</th>
                <th>Energy</th>
                <th>Total (ETH)</th>
                <th>Multiplier</th>
                <th>Block</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {txns.map(tx => (
                <tr key={tx.id} className="animate-fadeIn">
                  <td>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${tx.tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-accent hover:underline"
                    >
                      {tx.tx_hash.slice(0,10)}…
                    </a>
                  </td>
                  <td className="font-mono text-xs text-muted">
                    {tx.buyer_address.slice(0,8)}…
                  </td>
                  <td className="font-mono text-xs text-muted">
                    {tx.seller_address.slice(0,8)}…
                  </td>
                  <td>{tx.energy_amount} Wh</td>
                  <td className="text-accent font-mono">
                    {formatEth(tx.total_cost)} ETH
                  </td>
                  <td className="font-mono text-xs">
                    {(tx.multiplier_used / 100).toFixed(2)}x
                  </td>
                  <td className="text-muted font-mono text-xs">
                    {tx.block_number ?? "—"}
                  </td>
                  <td className="text-muted">
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}