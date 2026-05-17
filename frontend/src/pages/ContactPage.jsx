import React from "react";
import { Link } from "react-router-dom";
import LandingNavbar from "../components/LandingNavbar";
import "./InfoPages.css";

export default function ContactPage() {
  return (
    <div className="info-page">
      <LandingNavbar />
      <div className="info-shell">
        <div className="info-hero">
          <div>
            <p className="section-label">Contact</p>
            <h1>Need help with your energy trading setup?</h1>
            <p className="info-text">
              Reach out to our support team for onboarding, account help, or
              marketplace guidance.
            </p>
          </div>
          <div className="info-actions">
            <Link className="primary-btn" to="/register">Create Account</Link>
            <Link className="secondary-btn" to="/login">Sign In</Link>
          </div>
        </div>

        <div className="contact-grid">
          <div className="page-card">
            <h2>Support</h2>
            <p>support@dectenergy.com</p>
          </div>
          <div className="page-card">
            <h2>Sales</h2>
            <p>sales@dectenergy.com</p>
          </div>
          <div className="page-card">
            <h2>Office</h2>
            <p>123 Energy Street, Web3 City</p>
          </div>
        </div>
      </div>
    </div>
  );
}
