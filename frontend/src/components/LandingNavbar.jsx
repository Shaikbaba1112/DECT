import React from "react";
import { Link } from "react-router-dom";
import "./LandingNavbar.css";

export default function LandingNavbar() {
  return (
    <nav className="navbar">
      <div className="logo">
        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          DECT <span>Energy</span>
        </Link>
      </div>
      <ul className="nav-links">
        <li><Link to="/features">Features</Link></li>
        <li><Link to="/about">About</Link></li>
        <li><Link to="/pricing">Pricing</Link></li>
        <li><Link to="/contact">Contact</Link></li>
      </ul>
      <div className="nav-btns">
        <Link className="login-btn" to="/login">Sign In</Link>
        <Link className="signup-btn" to="/register">Register</Link>
      </div>
    </nav>
  );
}
