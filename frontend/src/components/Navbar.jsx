import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth }   from "../hooks/useAuth";
import { useWallet } from "../hooks/useWallet";
import useToast      from "../hooks/useToast";
import "./Navbar.css";

export default function Navbar({ onToggleSidebar }) {
  const { user, logout }                        = useAuth();
  const { walletAddress, connect, connecting,
          ethBalance, isConnected, initialized } = useWallet();
  const { showToast }                           = useToast();
  const navigate                                = useNavigate();

  const handleConnect = async () => {
    try {
      await connect();
      showToast("Wallet connected!", "success");
    } catch (e) {
      showToast(e.message || "Connection failed.", "error");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0,6)}…${walletAddress.slice(-4)}`
    : null;

  const roleBadgeClass = {
    admin:    "badge badge-admin",
    producer: "badge badge-active",
    consumer: "badge badge-blue",
    both:     "badge badge-active",
  }[user?.role] || "badge badge-sold";

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="navbar-toggle" onClick={onToggleSidebar}>
          ☰
        </button>
        <div className="navbar-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">DECT</span>
        </div>
      </div>

      <div className="navbar-right">
        {user && (
          <span className={roleBadgeClass}>{user.role}</span>
        )}

        {/* Only show wallet UI after init */}
        {initialized && (
          isConnected ? (
            <div className="wallet-connected">
              <span className="wallet-dot" />
              <span className="wallet-addr">{shortAddr}</span>
              <span className="wallet-bal">
                {parseFloat(ethBalance).toFixed(3)} ETH
              </span>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="btn-connect-wallet"
            >
              ⬡ {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
          )
        )}

        {user && (
          <button
            onClick={() => navigate("/profile")}
            className="navbar-username"
          >
            {user.username}
          </button>
        )}

        <button
          className="btn-logout"
          onClick={handleLogout}
          title="Logout"
        >
          ⏻
        </button>
      </div>
    </nav>
  );
}