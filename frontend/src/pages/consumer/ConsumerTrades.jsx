import React, { useEffect, useState } from "react";
import { consumerAPI } from "../../services/api";
import { useWallet }   from "../../hooks/useWallet";
import useToast        from "../../hooks/useToast";
import PageHeader      from "../../components/PageHeader";
import EmptyState      from "../../components/EmptyState";
import LoadingSpinner  from "../../components/LoadingSpinner";

export default function ConsumerTrades() {
  const { formatEth }    = useWallet();
  const { showToast }    = useToast();
  const [trades, setTrades]   = useState([]);
  const [loading,setLoading]  = useState(true);

  useEffect(() => {
    consumerAPI.getTrades()
      .then(r => setTrades(r.data))
      .catch(() => showToast("Failed to load trades.", "error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <PageHeader title="Trade History" subtitle="All your energy purchases" />

      {loading ? (
        <LoadingSpinner text="LOADING TRADES…" />
      ) : trades.length === 0 ? (
        <EmptyState
          icon="🛒"
          title="No trades yet"
          subtitle="Purchase energy from the marketplace."
        />
      ) : (
        <div className="dect-card overflow-x-auto">
          <table className="dect-table">
            <thead>
              <tr>
                <th>Tx Hash</th>
                <th>Seller</th>
                <th>Energy</th>
                <th>Paid (ETH)</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {trades.map(tx => (
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
                    {tx.seller_username ||
                     `${tx.seller_address.slice(0,8)}…`}
                  </td>
                  <td>{tx.energy_amount} Wh</td>
                  <td className="text-accent font-mono">
                    {formatEth(tx.total_cost)} ETH
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