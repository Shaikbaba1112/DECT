import React from "react";
import { useWallet } from "../hooks/useWallet";
import useToast      from "../hooks/useToast";
import "./WalletWidget.css";

export default function WalletWidget() {
  const { isConnected, connect, connecting,
          walletAddress, ethBalance,
          tknBalance, withdrawable,
          isCorrectNetwork }  = useWallet();
  const { showToast } = useToast();

  const handleConnect = async () => {
    try {
      await connect();
      showToast("Wallet connected!", "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  if (!isConnected) {
    return (
      <div className="dect-card wallet-widget-empty">
        <p>⬡</p>
        <p>Wallet not connected</p>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="btn-secondary"
          style={{ fontSize: "0.75rem" }}
        >
          {connecting ? "Connecting…" : "Connect MetaMask"}
        </button>
      </div>
    );
  }

  return (
    <div className="dect-card">
      {!isCorrectNetwork && (
        <div className="wallet-network-warning">
          ⚠ Switch MetaMask to Hardhat Local (Chain 1337)
        </div>
      )}

      <div className="wallet-status-row">
        <span className="wallet-dot" />
        <span className="wallet-status-label">Connected</span>
      </div>

      {[
        { label: "Address",
          value: `${walletAddress.slice(0,8)}…${walletAddress.slice(-4)}` },
        { label: "ETH Balance",
          value: `${parseFloat(ethBalance).toFixed(4)} ETH` },
        { label: "TKN Balance",
          value: `${parseFloat(tknBalance).toFixed(4)} TKN` },
        { label: "Withdrawable",
          value: `${parseFloat(withdrawable).toFixed(4)} ETH`,
          accent: true },
      ].map(({ label, value, accent }) => (
        <div key={label} className="wallet-row">
          <span className="wallet-row-label">{label}</span>
          <span className={`wallet-row-value ${accent ? "accent" : ""}`}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}