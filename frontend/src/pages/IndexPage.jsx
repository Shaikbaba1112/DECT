import React from "react";
import { Link } from "react-router-dom";
import LandingNavbar from "../components/LandingNavbar";
import "./IndexPage.css";

export default function IndexPage() {
  return (
    <div className="container">
      <LandingNavbar />

      <section className="hero">
        <div className="hero-left">
          <div className="tagline">Decentralized Energy Trading</div>
          <h1>
            Trade energy with <span>speed</span> and <span>security</span>.
          </h1>
          <p>
            Welcome to DECT — the premium blockchain marketplace for energy buyers,
            sellers, and administrators. Register, sign in, and explore the most
            intuitive energy trading experience.
          </p>

          <div className="hero-buttons">
            <Link className="primary-btn" to="/register">Create Account</Link>
            <Link className="secondary-btn" to="/login">Sign In</Link>
          </div>

          <div className="stats" id="features">
            <div className="stat">
              <h2>24/7</h2>
              <p>Real-time market monitoring and trading.</p>
            </div>
            <div className="stat">
              <h2>Secure</h2>
              <p>Blockchain-backed transactions with full transparency.</p>
            </div>
          </div>
        </div>

        <div className="hero-right">
          <div className="energy-card">
            <div className="energy-icon">⚡</div>
            <h3>Live Market Pulse</h3>
            <p>
              View instant pricing, analytics, and trading insights for energy assets.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
