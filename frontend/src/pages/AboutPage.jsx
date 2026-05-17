import React from "react";
import { Link } from "react-router-dom";
import LandingNavbar from "../components/LandingNavbar";
import "./InfoPages.css";

export default function AboutPage() {
  return (
    <div className="info-page">
      <LandingNavbar />
      <div className="info-shell">
        <div className="info-hero">
          <div>
            <p className="section-label">About DECT</p>
            <h1>Purpose-built for decentralized energy markets.</h1>
            <p className="info-text">
              DECT connects energy producers, buyers, and regulators with a
              secure, transparent marketplace. Our platform makes clean energy
              trading efficient, fair, and easy to manage.
            </p>
          </div>
          <div className="info-actions">
            <Link className="primary-btn" to="/register">Join Now</Link>
            <Link className="secondary-btn" to="/login">Sign In</Link>
          </div>
        </div>

        <div className="about-grid">
          <div className="page-card">
            <h2>Your Energy Network</h2>
            <p>
              Connect renewable energy sellers and buyers into a single trusted
              trading environment.
            </p>
          </div>
          <div className="page-card">
            <h2>Transparent Pricing</h2>
            <p>
              See real-time market rates and historical price trends before you
              bid.
            </p>
          </div>
          <div className="page-card">
            <h2>Trust & Safety</h2>
            <p>
              Built-in fraud detection and access control keep trades secure and
              compliant.
            </p>
          </div>
          <div className="page-card">
            <h2>Designed for Scale</h2>
            <p>
              Whether you manage a single producer or a large portfolio, DECT is
              built to support growing energy markets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
