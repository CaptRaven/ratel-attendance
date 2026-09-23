import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { updateMe, changePassword, forgotPassword, resetPassword, getMe } from "@/lib/api";
import type { User } from "@/lib/api";
import { theme } from "@/lib/theme";
import {
  User as UserIcon,
  Lock,
  KeyRound,
  ShieldCheck,
  Building,
  Mail,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sliders,
  Sparkles,
  Save,
} from "lucide-react";

export default function Settings() {
  const { user: storeUser, setAuth, token } = useAuthStore();
  const [user, setUser] = useState<User | null>(storeUser);
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "preferences">("profile");

  // Profile Form state
  const [fullName, setFullName] = useState(storeUser?.full_name || "");
  const [email, setEmail] = useState(storeUser?.email || "");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Password Change Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Forgot Password / Reset Token state
  const [forgotEmail, setForgotEmail] = useState(storeUser?.email || "");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotToken, setForgotToken] = useState<string | null>(null);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  // Reset Password using token
  const [resetTokenInput, setResetTokenInput] = useState("");
  const [resetNewPass, setResetNewPass] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState("");
  const [resetError, setResetError] = useState("");

  // Preferences state
  const [locationId, setLocationId] = useState(
    localStorage.getItem("ratel_preferred_location") || user?.location_id || "ratel-hq"
  );
  const [autoRefresh, setAutoRefresh] = useState(
    localStorage.getItem("ratel_auto_refresh") !== "false"
  );
  const [refreshInterval, setRefreshInterval] = useState(
    localStorage.getItem("ratel_refresh_interval") || "10"
  );
  const [prefSuccess, setPrefSuccess] = useState("");

  useEffect(() => {
    // Fetch current user details on mount
    getMe()
      .then((updatedUser) => {
        setUser(updatedUser);
        setFullName(updatedUser.full_name);
        setEmail(updatedUser.email);
        setForgotEmail(updatedUser.email);
        if (token) {
          setAuth(token, updatedUser);
        }
      })
      .catch((err) => console.error("Failed to load user profile:", err));
  }, []);

  // Update Profile Handler
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileSuccess("");
    setProfileError("");

    try {
      const updated = await updateMe({ full_name: fullName, email });
      setUser(updated);
      if (token) setAuth(token, updated);
      setProfileSuccess("Profile updated successfully!");
    } catch (err: any) {
      setProfileError(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setProfileLoading(false);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.response?.data?.detail || "Failed to change password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  // Forgot Password Token Request
  const handleRequestResetToken = async () => {
    setForgotLoading(true);
    setForgotError("");
    setForgotMessage("");
    setForgotToken(null);

    try {
      const res = await forgotPassword(forgotEmail);
      setForgotMessage(res.message);
      if (res.reset_token) {
        setForgotToken(res.reset_token);
        setResetTokenInput(res.reset_token);
      }
    } catch (err: any) {
      setForgotError(err.response?.data?.detail || "Failed to request reset token.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Reset Password Handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");

    if (!resetTokenInput) {
      setResetError("Please enter a valid reset token.");
      return;
    }

    if (resetNewPass.length < 6) {
      setResetError("New password must be at least 6 characters.");
      return;
    }

    setResetLoading(true);
    try {
      await resetPassword(resetTokenInput, resetNewPass);
      setResetSuccess("Password reset successfully! You can now log in with your new password.");
      setResetNewPass("");
      setResetTokenInput("");
      setForgotToken(null);
    } catch (err: any) {
      setResetError(err.response?.data?.detail || "Failed to reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = () => {
    localStorage.setItem("ratel_preferred_location", locationId);
    localStorage.setItem("ratel_auto_refresh", String(autoRefresh));
    localStorage.setItem("ratel_refresh_interval", refreshInterval);
    setPrefSuccess("Preferences saved successfully!");
    setTimeout(() => setPrefSuccess(""), 3000);
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: "1080px", margin: "0 auto", color: theme.text }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", margin: "0 0 6px 0", letterSpacing: "-0.5px" }}>
          Account & System Settings
        </h1>
        <p style={{ color: theme.textMuted, fontSize: "14px", margin: 0 }}>
          Manage your administrator profile, update passwords, and configure kiosk preferences.
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: "8px",
        marginBottom: "28px",
        borderBottom: `1px solid ${theme.panelBorder}`,
        paddingBottom: "12px",
      }}>
        {[
          { id: "profile", label: "My Profile", icon: UserIcon },
          { id: "security", label: "Security & Password", icon: Lock },
          { id: "preferences", label: "Kiosk Preferences", icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                borderRadius: "10px",
                border: "none",
                background: isActive ? theme.primary : "transparent",
                color: isActive ? "white" : theme.textMuted,
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: isActive ? "0 4px 12px rgba(15, 79, 157, 0.25)" : "none",
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Panels */}
      {activeTab === "profile" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>
          {/* Main Profile Edit Form */}
          <div style={{
            background: theme.panel,
            backdropFilter: "blur(18px)",
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: "20px",
            padding: "32px",
            boxShadow: theme.shadow,
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
              <UserIcon size={20} color={theme.primary} />
              Profile Details
            </h2>

            {profileSuccess && (
              <div style={{
                background: theme.successSoft,
                color: theme.success,
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "14px",
                border: `1px solid ${theme.successSoft}`,
              }}>
                <CheckCircle2 size={18} />
                {profileSuccess}
              </div>
            )}

            {profileError && (
              <div style={{
                background: theme.dangerSoft,
                color: theme.danger,
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "14px",
                border: `1px solid ${theme.dangerSoft}`,
              }}>
                <AlertCircle size={18} />
                {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: theme.panelStrong,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: "10px",
                    color: theme.text,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: theme.panelStrong,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: "10px",
                    color: theme.text,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                  Employee ID (Read Only)
                </label>
                <input
                  type="text"
                  value={user?.employee_id || ""}
                  disabled
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "rgba(0,0,0,0.04)",
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: "10px",
                    color: theme.textSoft,
                    fontSize: "14px",
                    cursor: "not-allowed",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                style={{
                  alignSelf: "flex-start",
                  background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px 24px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: profileLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(15, 79, 157, 0.2)",
                }}
              >
                <Save size={16} />
                {profileLoading ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Account Summary Sidebar Card */}
          <div style={{
            background: theme.panel,
            backdropFilter: "blur(18px)",
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: "20px",
            padding: "24px",
            boxShadow: theme.shadow,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            height: "fit-content",
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: theme.text }}>Account Info</h3>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: theme.primarySoft, borderRadius: "12px" }}>
              <ShieldCheck size={24} color={theme.primary} />
              <div>
                <div style={{ fontSize: "11px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase" }}>Role</div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: theme.primary }}>{user?.role?.toUpperCase() || "ADMIN"}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "rgba(0,0,0,0.03)", borderRadius: "12px" }}>
              <Building size={20} color={theme.textMuted} />
              <div>
                <div style={{ fontSize: "11px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase" }}>Location</div>
                <div style={{ fontSize: "13px", fontWeight: "600" }}>{user?.location_id || "ratel-hq"}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "rgba(0,0,0,0.03)", borderRadius: "12px" }}>
              <Sparkles size={20} color={theme.textMuted} />
              <div>
                <div style={{ fontSize: "11px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase" }}>Face Recognition</div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: user?.is_face_enrolled ? theme.success : theme.textMuted }}>
                  {user?.is_face_enrolled ? "Enrolled" : "Not Enrolled"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security & Password Tab */}
      {activeTab === "security" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Change Password Card */}
          <div style={{
            background: theme.panel,
            backdropFilter: "blur(18px)",
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: "20px",
            padding: "32px",
            boxShadow: theme.shadow,
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
              <KeyRound size={20} color={theme.primary} />
              Change Password
            </h2>
            <p style={{ color: theme.textMuted, fontSize: "13px", marginBottom: "20px" }}>
              Update your password to keep your administrator account secure.
            </p>

            {passwordSuccess && (
              <div style={{
                background: theme.successSoft,
                color: theme.success,
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
              }}>
                <CheckCircle2 size={18} />
                {passwordSuccess}
              </div>
            )}

            {passwordError && (
              <div style={{
                background: theme.dangerSoft,
                color: theme.danger,
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
              }}>
                <AlertCircle size={18} />
                {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>
                  Current Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "12px 42px 12px 16px",
                      background: theme.panelStrong,
                      border: `1px solid ${theme.panelBorder}`,
                      borderRadius: "10px",
                      color: theme.text,
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: theme.textSoft, cursor: "pointer" }}
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>
                  New Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{
                      width: "100%",
                      padding: "12px 42px 12px 16px",
                      background: theme.panelStrong,
                      border: `1px solid ${theme.panelBorder}`,
                      borderRadius: "10px",
                      color: theme.text,
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: theme.textSoft, cursor: "pointer" }}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>
                  Confirm New Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "12px 42px 12px 16px",
                      background: theme.panelStrong,
                      border: `1px solid ${theme.panelBorder}`,
                      borderRadius: "10px",
                      color: theme.text,
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: theme.textSoft, cursor: "pointer" }}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                style={{
                  marginTop: "8px",
                  background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: passwordLoading ? "not-allowed" : "pointer",
                }}
              >
                {passwordLoading ? "Updating Password..." : "Update Password"}
              </button>
            </form>
          </div>

          {/* Forgot Password / Reset Card */}
          <div style={{
            background: theme.panel,
            backdropFilter: "blur(18px)",
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: "20px",
            padding: "32px",
            boxShadow: theme.shadow,
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
              <Mail size={20} color={theme.accent} />
              Forgot / Reset Password
            </h2>
            <p style={{ color: theme.textMuted, fontSize: "13px", marginBottom: "20px" }}>
              Generate a password reset token for any account or reset your password directly using a valid reset token.
            </p>

            {/* Step 1: Request Reset Token */}
            <div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: `1px solid ${theme.panelBorder}` }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px" }}>
                Account Email
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="user@ratel.com"
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: theme.panelStrong,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: "10px",
                    color: theme.text,
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={handleRequestResetToken}
                  disabled={forgotLoading}
                  style={{
                    background: theme.accent,
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    padding: "10px 16px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: forgotLoading ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {forgotLoading ? "Generating..." : "Get Reset Token"}
                </button>
              </div>

              {forgotMessage && (
                <p style={{ color: theme.primary, fontSize: "12px", marginTop: "8px", marginBottom: 0 }}>
                  {forgotMessage}
                </p>
              )}
              {forgotError && (
                <p style={{ color: theme.danger, fontSize: "12px", marginTop: "8px", marginBottom: 0 }}>
                  {forgotError}
                </p>
              )}

              {forgotToken && (
                <div style={{ marginTop: "12px", padding: "10px", background: "rgba(15, 79, 157, 0.08)", borderRadius: "8px", wordBreak: "break-all" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: theme.primary, marginBottom: "4px" }}>GENERATED RESET TOKEN:</div>
                  <code style={{ fontSize: "11px", color: theme.text }}>{forgotToken}</code>
                </div>
              )}
            </div>

            {/* Step 2: Reset Password Form */}
            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "700", margin: 0 }}>Complete Reset with Token</h3>

              {resetSuccess && (
                <div style={{ background: theme.successSoft, color: theme.success, padding: "10px 14px", borderRadius: "8px", fontSize: "12px" }}>
                  {resetSuccess}
                </div>
              )}

              {resetError && (
                <div style={{ background: theme.dangerSoft, color: theme.danger, padding: "10px 14px", borderRadius: "8px", fontSize: "12px" }}>
                  {resetError}
                </div>
              )}

              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  Reset Token
                </label>
                <input
                  type="text"
                  value={resetTokenInput}
                  onChange={(e) => setResetTokenInput(e.target.value)}
                  placeholder="Paste reset token here"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: theme.panelStrong,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: "8px",
                    color: theme.text,
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={resetNewPass}
                  onChange={(e) => setResetNewPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: theme.panelStrong,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: "8px",
                    color: theme.text,
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                style={{
                  background: theme.primary,
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: resetLoading ? "not-allowed" : "pointer",
                }}
              >
                {resetLoading ? "Resetting..." : "Submit New Password"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === "preferences" && (
        <div style={{
          background: theme.panel,
          backdropFilter: "blur(18px)",
          border: `1px solid ${theme.panelBorder}`,
          borderRadius: "20px",
          padding: "32px",
          maxWidth: "640px",
          boxShadow: theme.shadow,
        }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
            <Sliders size={20} color={theme.primary} />
            Kiosk & App Preferences
          </h2>
          <p style={{ color: theme.textMuted, fontSize: "13px", marginBottom: "24px" }}>
            Configure default location tags and live dashboard refresh rates.
          </p>

          {prefSuccess && (
            <div style={{ background: theme.successSoft, color: theme.success, padding: "12px 16px", borderRadius: "10px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
              <CheckCircle2 size={18} />
              {prefSuccess}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                Default Location Identifier
              </label>
              <input
                type="text"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                placeholder="e.g. ratel-hq"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: theme.panelStrong,
                  border: `1px solid ${theme.panelBorder}`,
                  borderRadius: "10px",
                  color: theme.text,
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: "rgba(0,0,0,0.02)", borderRadius: "12px", border: `1px solid ${theme.panelBorder}` }}>
              <div>
                <div style={{ fontWeight: "600", fontSize: "14px" }}>Live Attendance Auto-Refresh</div>
                <div style={{ color: theme.textMuted, fontSize: "12px" }}>Automatically pull latest check-ins on dashboard</div>
              </div>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ width: "20px", height: "20px", cursor: "pointer" }}
              />
            </div>

            {autoRefresh && (
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>
                  Refresh Interval (Seconds)
                </label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: theme.panelStrong,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: "10px",
                    color: theme.text,
                    fontSize: "14px",
                    outline: "none",
                  }}
                >
                  <option value="5">5 Seconds</option>
                  <option value="10">10 Seconds</option>
                  <option value="30">30 Seconds</option>
                  <option value="60">60 Seconds</option>
                </select>
              </div>
            )}

            <button
              onClick={handleSavePreferences}
              style={{
                alignSelf: "flex-start",
                background: theme.primary,
                color: "white",
                border: "none",
                borderRadius: "10px",
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                marginTop: "10px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Save size={16} />
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
