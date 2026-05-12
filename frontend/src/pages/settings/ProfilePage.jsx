import React, { useState, useRef } from "react";
import { useAuth }   from "../../hooks/useAuth";
import { useWallet } from "../../hooks/useWallet";
import { authAPI }   from "../../services/api";
import useToast      from "../../hooks/useToast";
import PageHeader    from "../../components/PageHeader";


export default function ProfilePage() {
  const { user, updateUser, refreshProfile } = useAuth();
  const { walletAddress, connect, isConnected } = useWallet();
  const { showToast, promiseToast } = useToast();
  const fileRef = useRef(null);

  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    email:    user?.email    || "",
  });
  const [passwordForm, setPasswordForm] = useState({
    old_password: "", new_password: "", confirm_password: "",
  });
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [linkingWallet,  setLinkingWallet]  = useState(false);
  const [unlinking,      setUnlinking]      = useState(false);
  const [errors,         setErrors]         = useState({});

  // ── Profile update ──────────────────────────────────────────────────
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await authAPI.updateProfile(profileForm);
      updateUser(profileForm);
      showToast("Profile updated.", "success");
      setErrors({});
    } catch (err) {
      setErrors(err.response?.data || {});
      showToast("Failed to update profile.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Password change ─────────────────────────────────────────────────
  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setErrors({ confirm_password: "Passwords do not match." });
      return;
    }
    setSavingPassword(true);
    try {
      await promiseToast(authAPI.changePassword(passwordForm), {
        loading: "Changing password…",
        success: "Password changed.",
        error:   "Failed to change password.",
      });
      setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
      setErrors({});
    } catch (err) {
      setErrors(err.response?.data || {});
    } finally {
      setSavingPassword(false);
    }
  };

  // ── Link wallet ─────────────────────────────────────────────────────
  const handleLinkWallet = async () => {
    setLinkingWallet(true);
    try {
      let address = walletAddress;
      if (!isConnected) {
        address = await connect();
      }
      if (!address) {
        showToast("No wallet address found.", "error");
        return;
      }
      await authAPI.connectWallet(address);
      showToast("Wallet linked successfully!", "success");
      await refreshProfile();
    } catch (err) {
      const msg =
        err.response?.data?.wallet_address?.[0] ||
        err.response?.data?.error ||
        err.message ||
        "Failed to link wallet.";
      showToast(msg, "error");
    } finally {
      setLinkingWallet(false);
    }
  };

  // ── Unlink wallet ───────────────────────────────────────────────────
  const handleUnlinkWallet = async () => {
    setUnlinking(true);
    try {
      await promiseToast(authAPI.unlinkWallet(), {
        loading: "Unlinking wallet…",
        success: "Wallet unlinked.",
        error:   "Failed to unlink.",
      });
      await refreshProfile();
    } catch { /* handled */ }
    finally { setUnlinking(false); }
  };

  const roleBadgeClass = {
    admin:    "badge badge-admin",
    producer: "badge badge-active",
    consumer: "badge badge-blue",
    both:     "badge badge-active",
  }[user?.role] || "badge badge-sold";

  return (
    <div className="page">
      <PageHeader title="Profile" subtitle="Manage your account details" />

      <div className="profile-layout">

        {/* Left sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Avatar + summary */}
          <div className="dect-card profile-avatar-section">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {user?.profile_avatar
                  ? <img src={user.profile_avatar} alt="avatar" />
                  : user?.username?.[0]?.toUpperCase()}
              </div>
              <button
                className="profile-avatar-btn"
                onClick={() => fileRef.current?.click()}
                title="Change avatar"
              >
                📷
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append("profile_avatar", file);
                  try {
                    await authAPI.updateProfile(formData);
                    await refreshProfile();
                    showToast("Avatar updated.", "success");
                  } catch {
                    showToast("Failed to upload.", "error");
                  }
                }}
              />
            </div>

            <p className="profile-username">{user?.username}</p>
            <p className="profile-email">{user?.email}</p>

            <span className={roleBadgeClass}>{user?.role}</span>

            {user?.role === "producer" && (
              <div className={`profile-verified ${user?.is_verified ? "yes" : "pending"}`}>
                {user?.is_verified ? "✓ Verified Producer" : "⏳ Pending Verification"}
              </div>
            )}

            <p className="profile-member-since">
              Member since{" "}
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : "—"}
            </p>
          </div>

          {/* Wallet card */}
          <div className="dect-card">
            <p className="section-label">Linked Wallet</p>

            {user?.wallet_address ? (
              <div className="wallet-link-status">
                <div className="wallet-link-connected">
                  <span className="wallet-link-dot" />
                  <span className="wallet-link-connected-label">Connected</span>
                </div>
                <p className="wallet-link-addr">{user.wallet_address}</p>

                {/* Wallet actions */}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <button
                    onClick={handleLinkWallet}
                    disabled={linkingWallet}
                    className="btn-ghost"
                    style={{ flex: 1, fontSize: "0.72rem", padding: "0.5rem" }}
                  >
                    {linkingWallet ? "Switching…" : "Switch Wallet"}
                  </button>
                  <button
                    onClick={handleUnlinkWallet}
                    disabled={unlinking}
                    className="btn-danger"
                    style={{ flex: 1, fontSize: "0.72rem", padding: "0.5rem" }}
                  >
                    {unlinking ? "Unlinking…" : "Unlink"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="wallet-link-status">
                <p className="wallet-link-hint">
                  Link your MetaMask wallet to enable blockchain trading.
                </p>
                <button
                  onClick={handleLinkWallet}
                  disabled={linkingWallet}
                  className="btn-secondary w-full"
                  style={{ marginTop: "0.75rem", fontSize: "0.75rem" }}
                >
                  {linkingWallet ? "Linking…" : "⬡ Link MetaMask Wallet"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right — forms */}
        <div className="profile-forms">

          {/* Account details */}
          <div className="dect-card">
            <p className="section-label">Account Details</p>
            <form onSubmit={handleProfileSave}>
              <div className="profile-form-grid" style={{ marginBottom: "1rem" }}>
                <div>
                  <label className="dect-label">Username</label>
                  <input
                    className={`dect-input ${errors.username ? "error" : ""}`}
                    value={profileForm.username}
                    onChange={e => setProfileForm(f => ({
                      ...f, username: e.target.value
                    }))}
                  />
                  {errors.username && (
                    <p className="field-error">{errors.username}</p>
                  )}
                </div>
                <div>
                  <label className="dect-label">Email</label>
                  <input
                    className={`dect-input ${errors.email ? "error" : ""}`}
                    type="email"
                    value={profileForm.email}
                    onChange={e => setProfileForm(f => ({
                      ...f, email: e.target.value
                    }))}
                  />
                  {errors.email && (
                    <p className="field-error">{errors.email}</p>
                  )}
                </div>
                <div>
                  <label className="dect-label">Role</label>
                  <div className="dect-input"
                       style={{ background: "rgba(255,255,255,0.02)",
                                color: "var(--muted)", textTransform: "capitalize" }}>
                    {user?.role}
                  </div>
                </div>
                <div>
                  <label className="dect-label">Account ID</label>
                  <div className="dect-input"
                       style={{ background: "rgba(255,255,255,0.02)",
                                color: "var(--muted)", fontSize: "0.7rem",
                                overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user?.id?.slice(0, 18)}…
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="btn-primary"
              >
                {savingProfile ? "Saving…" : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Change password */}
          <div className="dect-card">
            <p className="section-label">Change Password</p>
            <form onSubmit={handlePasswordSave}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <label className="dect-label">Current Password</label>
                  <input
                    className={`dect-input ${errors.error ? "error" : ""}`}
                    type="password"
                    placeholder="••••••••"
                    value={passwordForm.old_password}
                    onChange={e => setPasswordForm(f => ({
                      ...f, old_password: e.target.value
                    }))}
                  />
                  {errors.error && (
                    <p className="field-error">{errors.error}</p>
                  )}
                </div>
                <div className="profile-form-grid">
                  <div>
                    <label className="dect-label">New Password</label>
                    <input
                      className={`dect-input ${errors.new_password ? "error" : ""}`}
                      type="password"
                      placeholder="Min. 8 characters"
                      value={passwordForm.new_password}
                      onChange={e => setPasswordForm(f => ({
                        ...f, new_password: e.target.value
                      }))}
                    />
                    {errors.new_password && (
                      <p className="field-error">{errors.new_password}</p>
                    )}
                  </div>
                  <div>
                    <label className="dect-label">Confirm New Password</label>
                    <input
                      className={`dect-input ${errors.confirm_password ? "error" : ""}`}
                      type="password"
                      placeholder="Repeat password"
                      value={passwordForm.confirm_password}
                      onChange={e => setPasswordForm(f => ({
                        ...f, confirm_password: e.target.value
                      }))}
                    />
                    {errors.confirm_password && (
                      <p className="field-error">{errors.confirm_password}</p>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="btn-primary"
              >
                {savingPassword ? "Changing…" : "Change Password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}