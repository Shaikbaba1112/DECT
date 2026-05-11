import React, { useState, useRef } from "react";
import { useAuth }   from "../../hooks/useAuth";
import { useWallet } from "../../hooks/useWallet";
import { authAPI }   from "../../services/api";
import useToast      from "../../hooks/useToast";
import PageHeader    from "../../components/PageHeader";
import {
  UserCircleIcon,
  WalletIcon,
  KeyIcon,
  CameraIcon,
} from "@heroicons/react/24/outline";

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
    old_password:     "",
    new_password:     "",
    confirm_password: "",
  });
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [linkingWallet,  setLinkingWallet]  = useState(false);
  const [errors, setErrors] = useState({});

  // ── Profile update ──────────────────────────────────────────────────────
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await authAPI.updateProfile(profileForm);
      updateUser(res.data.user || profileForm);
      showToast("Profile updated.", "success");
    } catch (err) {
      const data = err.response?.data || {};
      setErrors(data);
      showToast("Failed to update profile.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Password change ─────────────────────────────────────────────────────
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
        success: "Password changed successfully.",
        error:   "Failed to change password.",
      });
      setPasswordForm({
        old_password: "", new_password: "", confirm_password: "",
      });
      setErrors({});
    } catch (err) {
      const data = err.response?.data || {};
      setErrors(data);
    } finally {
      setSavingPassword(false);
    }
  };

  // ── Wallet link ─────────────────────────────────────────────────────────
 // Replace handleLinkWallet with this:
const handleLinkWallet = async () => {
  setLinkingWallet(true);
  try {
    // Step 1 — get wallet address
    let address = walletAddress;
    if (!isConnected) {
      address = await connect();
    }
    if (!address) {
      showToast("No wallet address found.", "error");
      return;
    }

    // Step 2 — link to account
    await authAPI.connectWallet(address);
    showToast("Wallet linked!", "success");

    // Step 3 — refresh profile to update UI
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


  const roleBadgeColor = {
    admin:    "text-warning border-warning/40 bg-warning/10",
    producer: "text-accent  border-accent/40  bg-accent/10",
    consumer: "text-blue-400 border-blue-400/40 bg-blue-400/10",
    both:     "text-accent  border-accent/40  bg-accent/10",
  }[user?.role] || "text-muted border-border";

  return (
    <div className="page">
      <PageHeader
        title="Profile"
        subtitle="Manage your account details"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — avatar + summary */}
        <div className="space-y-4">
          <div className="dect-card flex flex-col items-center
                          text-center gap-4 py-8">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full
                              bg-accent/20 border-2 border-accent/40
                              flex items-center justify-center">
                {user?.profile_avatar ? (
                  <img
                    src={user.profile_avatar}
                    alt="avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="font-mono text-3xl font-bold text-accent">
                    {user?.username?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 w-6 h-6
                           bg-accent rounded-full flex items-center
                           justify-center hover:bg-accent/80 transition-colors"
              >
                <CameraIcon className="w-3 h-3 text-bg" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
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
                    showToast("Failed to upload avatar.", "error");
                  }
                }}
              />
            </div>

            <div>
              <p className="font-mono text-lg font-bold text-textPrimary">
                {user?.username}
              </p>
              <p className="font-mono text-xs text-muted">{user?.email}</p>
            </div>

            {/* Role badge */}
            <span className={`font-mono text-xs px-3 py-1 rounded
                              border uppercase tracking-widest
                              ${roleBadgeColor}`}>
              {user?.role}
            </span>

            {/* Verified status */}
            {user?.role === "producer" && (
              <div className={`font-mono text-xs px-3 py-1.5 rounded border w-full
                               ${user?.is_verified
                                 ? "text-accent border-accent/30 bg-accent/10"
                                 : "text-warning border-warning/30 bg-warning/10"}`}>
                {user?.is_verified
                  ? "✓ Verified Producer"
                  : "⏳ Pending Verification"}
              </div>
            )}

            {/* Account created */}
            <p className="font-mono text-[10px] text-muted/50">
              Member since{" "}
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString()
                : "—"}
            </p>
          </div>

          {/* Wallet link card */}
          <div className="dect-card">
            <p className="section-label">
              <WalletIcon className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
              Linked Wallet
            </p>
            {user?.wallet_address ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent
                                   shadow-[0_0_5px_#00ff88]" />
                  <span className="font-mono text-xs text-accent">
                    Linked
                  </span>
                </div>
                <p className="font-mono text-xs text-muted break-all">
                  {user.wallet_address}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-sans text-xs text-muted">
                  Link your MetaMask wallet to enable blockchain trading.
                </p>
                <button
                  onClick={handleLinkWallet}
                  disabled={linkingWallet}
                  className="btn-secondary w-full text-xs"
                >
                  {linkingWallet ? "Linking…" : "Link MetaMask Wallet"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right — forms */}
        <div className="lg:col-span-2 space-y-6">

          {/* Profile form */}
          <div className="dect-card">
            <p className="section-label">
              <UserCircleIcon className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
              Account Details
            </p>
            <form onSubmit={handleProfileSave} className="space-y-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="dect-label">Username</label>
                  <input
                    className={`dect-input ${errors.username ? "border-danger" : ""}`}
                    value={profileForm.username}
                    onChange={e => setProfileForm(f => ({
                      ...f, username: e.target.value
                    }))}
                  />
                  {errors.username && (
                    <p className="font-mono text-xs text-danger mt-1">
                      {errors.username}
                    </p>
                  )}
                </div>
                <div>
                  <label className="dect-label">Email</label>
                  <input
                    className={`dect-input ${errors.email ? "border-danger" : ""}`}
                    type="email"
                    value={profileForm.email}
                    onChange={e => setProfileForm(f => ({
                      ...f, email: e.target.value
                    }))}
                  />
                  {errors.email && (
                    <p className="font-mono text-xs text-danger mt-1">
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Read-only fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="dect-label">Role</label>
                  <div className="dect-input bg-bg/50 text-muted capitalize">
                    {user?.role}
                  </div>
                </div>
                <div>
                  <label className="dect-label">Account ID</label>
                  <div className="dect-input bg-bg/50 text-muted
                                  font-mono text-xs truncate">
                    {user?.id}
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

          {/* Password form */}
          <div className="dect-card">
            <p className="section-label">
              <KeyIcon className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
              Change Password
            </p>
            <form onSubmit={handlePasswordSave} className="space-y-4">

              <div>
                <label className="dect-label">Current Password</label>
                <input
                  className={`dect-input ${errors.error ? "border-danger" : ""}`}
                  type="password"
                  placeholder="••••••••"
                  value={passwordForm.old_password}
                  onChange={e => setPasswordForm(f => ({
                    ...f, old_password: e.target.value
                  }))}
                />
                {errors.error && (
                  <p className="font-mono text-xs text-danger mt-1">
                    {errors.error}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="dect-label">New Password</label>
                  <input
                    className={`dect-input ${errors.new_password ? "border-danger" : ""}`}
                    type="password"
                    placeholder="Min. 8 characters"
                    value={passwordForm.new_password}
                    onChange={e => setPasswordForm(f => ({
                      ...f, new_password: e.target.value
                    }))}
                  />
                  {errors.new_password && (
                    <p className="font-mono text-xs text-danger mt-1">
                      {errors.new_password}
                    </p>
                  )}
                </div>
                <div>
                  <label className="dect-label">Confirm New Password</label>
                  <input
                    className={`dect-input
                      ${errors.confirm_password ? "border-danger" : ""}`}
                    type="password"
                    placeholder="Repeat password"
                    value={passwordForm.confirm_password}
                    onChange={e => setPasswordForm(f => ({
                      ...f, confirm_password: e.target.value
                    }))}
                  />
                  {errors.confirm_password && (
                    <p className="font-mono text-xs text-danger mt-1">
                      {errors.confirm_password}
                    </p>
                  )}
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