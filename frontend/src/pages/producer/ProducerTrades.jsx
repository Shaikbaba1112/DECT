import React, { useEffect, useState } from "react";
import { producerAPI }  from "../../services/api";
import { useWallet }    from "../../hooks/useWallet";
import useToast         from "../../hooks/useToast";
import PageHeader       from "../../components/PageHeader";
import EmptyState       from "../../components/EmptyState";
import LoadingSpinner   from "../../components/LoadingSpinner";

export default function ProducerTrades() {
  const { formatEth }     = useWallet();
  const { showToast }     = useToast();
  const [trades, setTrades]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    producerAPI.getTrades()
      .then(r => setTrades(r.data))
      .catch(() => showToast("Failed to load trades.", "error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <PageHeader
        title="Trade History"
        subtitle="All completed sales"
      />

      {loading ? (
        <LoadingSpinner text="LOADING TRADES…" />
      ) : trades.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No trades yet"
          subtitle="Completed sales will appear here."
        />
      ) : (
        <div className="dect-card overflow-x-auto">
          <table className="dect-table">
            <thead>
              <tr>
                <th>Tx Hash</th>
                <th>Buyer</th>
                <th>Energy</th>
                <th>Earned (ETH)</th>
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
                    {tx.buyer_username || `${tx.buyer_address.slice(0,8)}…`}
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