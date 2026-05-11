import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth }  from "../../hooks/useAuth";
import useToast     from "../../hooks/useToast";
import "./Auth.css";

export default function LoginPage() {
  const { login }     = useAuth();
  const navigate      = useNavigate();
  const { showToast } = useToast();

  const [form,    setForm]    = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError("Both fields are required.");
      return;
    }
    setLoading(true);
    try {
      const role = await login(form.username, form.password);
      showToast("Login successful!", "success");
      if (role === "admin")         navigate("/admin");
      else if (role === "producer") navigate("/producer");
      else                          navigate("/consumer");
    } catch (err) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <div className="auth-logo-icon">⚡</div>
          <div className="auth-logo-name">DECT</div>
          <div className="auth-logo-sub">DECENTRALIZED ENERGY TRADING</div>
        </div>

        <div className="dect-card">
          <h2 className="auth-card-title">Sign In</h2>

          {error && <div className="auth-error mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <label className="dect-label">Username</label>
              <input
                className="dect-input"
                type="text"
                name="username"
                placeholder="your_username"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="dect-label">Password</label>
              <input
                className="dect-input"
                type="password"
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
              style={{ marginTop: "0.5rem" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="auth-footer">
            No account?{" "}
            <Link to="/register">Register here</Link>
          </p>
        </div>

        <p className="auth-bottom">POWERED BY ARBITRUM BLOCKCHAIN</p>
      </div>
    </div>
  );
}