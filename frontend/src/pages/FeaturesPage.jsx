import React from "react";
import { Link } from "react-router-dom";
import LandingNavbar from "../components/LandingNavbar";
import "./InfoPages.css";

export default function FeaturesPage() {
  return (
    <div className="info-page">
      <LandingNavbar />
      <div className="info-shell">
        <div className="info-hero">
          <div>
            <p className="section-label">Features</p>
            <h1>Built for clean energy trading and market clarity.</h1>
            <p className="info-text">
              DECT delivers a modern platform for energy buyers, sellers, and
              administrators with live market intelligence, secure bid execution,
              and transparent analytics.
            </p>
          </div>
          <div className="info-actions">
            <Link className="primary-btn" to="/register">Create Account</Link>
            <Link className="secondary-btn" to="/login">Sign In</Link>
          </div>
        </div>

        <div className="feature-grid">
          <div className="page-card">
            <h2>Market Intelligence</h2>
            <p>Track energy prices, demand shifts, and bid activity in real time.</p>
          </div>
          <div className="page-card">
            <h2>Secure Trading</h2>
            <p>Transactions are backed by blockchain security for full auditability.</p>
          </div>
          <div className="page-card">
            <h2>Role-Based Dashboards</h2>
            <p>Separate producer, consumer, and admin views with tailored workflows.</p>
          </div>
          <div className="page-card">
            <h2>Analytics & Reporting</h2>
            <p>Measure performance, fraud risk, and trade liquidity with ease.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
