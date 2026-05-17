import React from "react";
import { Link } from "react-router-dom";
import LandingNavbar from "../components/LandingNavbar";
import "./InfoPages.css";

export default function PricingPage() {
  return (
    <div className="info-page">
      <LandingNavbar />
      <div className="info-shell">
        <div className="info-hero">
          <div>
            <p className="section-label">Pricing</p>
            <h1>Choose the plan that matches your energy role.</h1>
            <p className="info-text">
              DECT offers flexible onboarding for market participants, with fast
              setup and ongoing support for producers, consumers, and administrators.
            </p>
          </div>
          <div className="info-actions">
            <Link className="primary-btn" to="/register">Get Started</Link>
            <Link className="secondary-btn" to="/login">Sign In</Link>
          </div>
        </div>

        <div className="pricing-grid">
          <div className="page-card">
            <h2>Starter</h2>
            <p>Perfect for new energy buyers who want to explore trading.</p>
            <strong>Free</strong>
          </div>
          <div className="page-card">
            <h2>Market</h2>
            <p>Designed for active producers and consumers with live bidding.</p>
            <strong>$29/month</strong>
          </div>
          <div className="page-card">
            <h2>Enterprise</h2>
            <p>Advanced analytics, fraud risk alerts, and admin controls.</p>
            <strong>$99/month</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
