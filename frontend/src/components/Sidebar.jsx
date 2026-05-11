import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./Sidebar.css";

const PRODUCER_LINKS = [
  { to: "/producer",           label: "Dashboard" },
  { to: "/producer/listings",  label: "My Listings" },
  { to: "/producer/bids",      label: "Bid Inbox" },
  { to: "/producer/devices",   label: "Devices" },
  { to: "/producer/trades",    label: "Trade History" },
];

const CONSUMER_LINKS = [
  { to: "/consumer",           label: "Dashboard" },
  { to: "/consumer/market",    label: "Marketplace" },
  { to: "/consumer/bids",      label: "My Bids" },
  { to: "/consumer/trades",    label: "Trades" },
];

const ADMIN_LINKS = [
  { to: "/admin",              label: "Dashboard" },
  { to: "/admin/users",        label: "Users" },
  { to: "/admin/transactions", label: "Transactions" },
  { to: "/admin/fraud",        label: "Fraud" },
  { to: "/admin/approvals",    label: "Approvals" },
  { to: "/admin/audit-logs",   label: "Audit Logs" },
  { to: "/admin/settings",     label: "Settings" },
];

const SHARED_LINKS = [
  { to: "/wallet",              label: "Wallet" },
  { to: "/profile",             label: "Profile" },
  { to: "/settings/alerts",     label: "Price Alerts" },
  { to: "/settings/auto-trade", label: "Auto-Trade" },
];

export default function Sidebar({ open }) {
  const { user } = useAuth();
  if (!open) return null;

  const mainLinks =
    user?.role === "admin"    ? ADMIN_LINKS    :
    user?.role === "producer" ? PRODUCER_LINKS :
    user?.role === "both"     ? [...PRODUCER_LINKS, ...CONSUMER_LINKS] :
    CONSUMER_LINKS;

  const linkClass = ({ isActive }) =>
    isActive ? "sidebar-link active" : "sidebar-link";

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <p className="sidebar-section-label">
          {user?.role?.toUpperCase()} MENU
        </p>

        {mainLinks.map(({ to, label }) => (
          <NavLink key={to} to={to} end className={linkClass}>
            {label}
          </NavLink>
        ))}

        {user?.role !== "admin" && (
          <>
            <hr className="sidebar-divider" />
            <p className="sidebar-section-label">Account</p>
            {SHARED_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to} className={linkClass}>
                {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <p className="sidebar-user-name">{user?.username}</p>
            <p className="sidebar-user-email">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}