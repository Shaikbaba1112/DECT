import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth }  from "../../hooks/useAuth";
import useToast     from "../../hooks/useToast";
import "./Auth.css";

const ROLES = [
  { value: "consumer", label: "Consumer", icon: "🛒",
    desc: "Buy energy from producers." },
  { value: "producer", label: "Producer", icon: "🏭",
    desc: "Sell surplus energy." },
  { value: "both",     label: "Both",     icon: "⚡",
    desc: "Buy and sell energy." },
];

export default function RegisterPage() {
  const { register }  = useAuth();
  const navigate      = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    username: "", email: "", password: "",
    password_confirm: "", role: "consumer",
  });
  const [loading, setLoading] = useState(false);
  const [errors,  setErrors]  = useState({});

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrors(err => ({ ...err, [e.target.name]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.username) e.username = "Username is required.";
    if (!form.email)    e.email    = "Email is required.";
    if (!form.password) e.password = "Password is required.";
    if (form.password.length < 8)
      e.password = "Password must be at least 8 characters.";
    if (form.password !== form.password_confirm)
      e.password_confirm = "Passwords do not match.";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const role = await register(form);
      showToast("Account created! Welcome to DECT.", "success");
      if (role === "producer") navigate("/producer");
      else                     navigate("/consumer");
    } catch (err) {
      if (err.fieldErrors) setErrors(err.fieldErrors);
      else setErrors({ general: err.message || "Registration failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ alignItems: "flex-start", paddingTop: "2rem" }}>
      <div className="auth-box" style={{ maxWidth: "520px" }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">⚡</div>
          <div className="auth-logo-name">DECT</div>
          <div className="auth-logo-sub">CREATE YOUR ACCOUNT</div>
        </div>

        <div className="dect-card">
          <h2 className="auth-card-title">Register</h2>

          {errors.general && (
            <div className="auth-error mb-4">{errors.general}</div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <label className="dect-label">Username</label>
              <input
                className={`dect-input ${errors.username ? "error" : ""}`}
                type="text"
                name="username"
                placeholder="your_username"
                value={form.username}
                onChange={handleChange}
              />
              {errors.username && <p className="field-error">{errors.username}</p>}
            </div>

            <div>
              <label className="dect-label">Email</label>
              <input
                className={`dect-input ${errors.email ? "error" : ""}`}
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
              />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>

            <div>
              <label className="dect-label">Password</label>
              <input
                className={`dect-input ${errors.password ? "error" : ""}`}
                type="password"
                name="password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChange}
              />
              {errors.password && <p className="field-error">{errors.password}</p>}
            </div>

            <div>
              <label className="dect-label">Confirm Password</label>
              <input
                className={`dect-input ${errors.password_confirm ? "error" : ""}`}
                type="password"
                name="password_confirm"
                placeholder="Repeat password"
                value={form.password_confirm}
                onChange={handleChange}
              />
              {errors.password_confirm && (
                <p className="field-error">{errors.password_confirm}</p>
              )}
            </div>

            <div>
              <label className="dect-label">Account Role</label>
              <div className="role-selector">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    className={`role-btn ${form.role === r.value ? "selected" : ""}`}
                    onClick={() => setForm(f => ({ ...f, role: r.value }))}
                  >
                    <div className="role-btn-icon">{r.icon}</div>
                    <div className="role-btn-label">{r.label}</div>
                    <div className="role-btn-desc">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>

        {form.role === "producer" && (
          <div className="auth-note">
            ⚠ Producer accounts require admin verification before listing energy.
          </div>
        )}
      </div>
    </div>
  );
}