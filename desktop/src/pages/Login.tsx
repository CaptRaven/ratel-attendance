import { useState } from "react";
import { login, forgotPassword, resetPassword } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { theme } from "@/lib/theme";
import logo from "@/assets/rATEL-LOGO.png";
import { Eye, EyeOff, KeyRound, X, CheckCircle2 } from "lucide-react";

export default function Login() {
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await login(email, password);
      setAuth(data.access_token, data.user);
    } catch (err: any) {
      const d = err.response?.data?.detail;
      if (typeof d === "string") {
        setError(d);
      } else if (Array.isArray(d) && d.length > 0) {
        setError(d[0]?.msg || "Login failed");
      } else {
        setError("Login failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestToken = async () => {
    if (!resetEmail) {
      setForgotError("Please enter your registered email address.");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    setForgotMessage("");

    try {
      const res = await forgotPassword(resetEmail);
      setForgotMessage(res.message);
      if (res.reset_token) {
        setResetToken(res.reset_token);
        setForgotStep("reset");
      }
    } catch (err: any) {
      setForgotError(err.response?.data?.detail || "Failed to request reset token.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken || !newPassword) {
      setForgotError("Please fill out all fields.");
      return;
    }
    if (newPassword.length < 6) {
      setForgotError("New password must be at least 6 characters.");
      return;
    }

    setForgotLoading(true);
    setForgotError("");

    try {
      await resetPassword(resetToken, newPassword);
      setForgotSuccess("Password reset successfully! You can now log in.");
    } catch (err: any) {
      setForgotError(err.response?.data?.detail || "Failed to reset password.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: theme.pageAlt,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "24px",
      position: "relative",
    }}>
      <div style={{
        background: theme.panel,
        backdropFilter: "blur(18px)",
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: "24px",
        padding: "48px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: theme.shadow,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <img
            src={logo}
            alt="RATEL"
            style={{
              width: "160px",
              maxWidth: "100%",
              height: "auto",
              marginBottom: "16px",
            }}
          />
          <h1 style={{
            color: theme.text,
            fontSize: "28px",
            fontWeight: "700",
            margin: "0 0 6px 0",
            letterSpacing: "-0.5px",
          }}>Ratel Attendance</h1>
          <p style={{ color: theme.textMuted, fontSize: "14px", margin: 0 }}>
            Admin Portal
          </p>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{
              color: theme.textMuted,
              fontSize: "12px",
              fontWeight: "600",
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "8px",
            }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ratel.com"
              style={{
                width: "100%",
                background: theme.panelStrong,
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: "12px",
                padding: "14px 16px",
                color: theme.text,
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{
                color: theme.textMuted,
                fontSize: "12px",
                fontWeight: "600",
                letterSpacing: "0.8px",
                textTransform: "uppercase",
              }}>Password</label>

              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setShowForgotModal(true);
                  setForgotStep("request");
                  setForgotError("");
                  setForgotSuccess("");
                  setForgotMessage("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: theme.accent,
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Forgot Password?
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                style={{
                  width: "100%",
                  background: theme.panelStrong,
                  border: `1px solid ${theme.panelBorder}`,
                  borderRadius: "12px",
                  padding: "14px 48px 14px 16px",
                  color: theme.text,
                  fontSize: "15px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "14px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: theme.textSoft,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p style={{
              color: theme.danger,
              fontSize: "13px",
              textAlign: "center",
              margin: 0,
              background: theme.dangerSoft,
              padding: "10px",
              borderRadius: "8px",
              border: `1px solid ${theme.dangerSoft}`,
            }}>{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              background: loading
                ? "rgba(15, 79, 157, 0.45)"
                : `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
              color: "white",
              border: "none",
              borderRadius: "12px",
              padding: "15px",
              fontSize: "15px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: "8px",
              letterSpacing: "0.3px",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(10, 30, 60, 0.5)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "20px",
        }}>
          <div style={{
            background: theme.panelStrong,
            borderRadius: "20px",
            padding: "32px",
            width: "100%",
            maxWidth: "420px",
            boxShadow: theme.shadow,
            border: `1px solid ${theme.panelBorder}`,
            position: "relative",
          }}>
            <button
              onClick={() => setShowForgotModal(false)}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                background: "none",
                border: "none",
                color: theme.textMuted,
                cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <KeyRound size={24} color={theme.primary} />
              <h2 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Reset Password</h2>
            </div>

            {forgotSuccess ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <CheckCircle2 size={48} color={theme.success} style={{ marginBottom: "16px" }} />
                <p style={{ color: theme.text, fontSize: "14px", fontWeight: "600", margin: "0 0 20px 0" }}>
                  {forgotSuccess}
                </p>
                <button
                  onClick={() => setShowForgotModal(false)}
                  style={{
                    width: "100%",
                    background: theme.primary,
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    padding: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <div>
                {forgotError && (
                  <div style={{
                    background: theme.dangerSoft,
                    color: theme.danger,
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    marginBottom: "16px",
                  }}>
                    {forgotError}
                  </div>
                )}

                {forgotStep === "request" ? (
                  <div>
                    <p style={{ color: theme.textMuted, fontSize: "13px", marginTop: 0, marginBottom: "20px" }}>
                      Enter your account email to receive a password reset token.
                    </p>
                    <div style={{ marginBottom: "20px" }}>
                      <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, display: "block", marginBottom: "6px" }}>
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="admin@ratel.com"
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          background: theme.panel,
                          border: `1px solid ${theme.panelBorder}`,
                          borderRadius: "10px",
                          color: theme.text,
                          fontSize: "14px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    {forgotMessage && (
                      <p style={{ color: theme.primary, fontSize: "12px", marginBottom: "16px" }}>
                        {forgotMessage}
                      </p>
                    )}
                    <button
                      onClick={handleRequestToken}
                      disabled={forgotLoading}
                      style={{
                        width: "100%",
                        background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                        color: "white",
                        border: "none",
                        borderRadius: "10px",
                        padding: "12px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: forgotLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {forgotLoading ? "Requesting Token..." : "Request Reset Token"}
                    </button>
                    {resetToken && (
                      <button
                        onClick={() => setForgotStep("reset")}
                        style={{
                          width: "100%",
                          background: "none",
                          border: "none",
                          color: theme.accent,
                          fontSize: "13px",
                          fontWeight: "600",
                          cursor: "pointer",
                          marginTop: "12px",
                        }}
                      >
                        I already have a reset token →
                      </button>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleCompleteReset} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, display: "block", marginBottom: "6px" }}>
                        Reset Token
                      </label>
                      <input
                        type="text"
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        placeholder="Paste reset token"
                        required
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          background: theme.panel,
                          border: `1px solid ${theme.panelBorder}`,
                          borderRadius: "10px",
                          color: theme.text,
                          fontSize: "13px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted, display: "block", marginBottom: "6px" }}>
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          background: theme.panel,
                          border: `1px solid ${theme.panelBorder}`,
                          borderRadius: "10px",
                          color: theme.text,
                          fontSize: "14px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading}
                      style={{
                        width: "100%",
                        background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                        color: "white",
                        border: "none",
                        borderRadius: "10px",
                        padding: "12px",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: forgotLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {forgotLoading ? "Resetting Password..." : "Submit New Password"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setForgotStep("request")}
                      style={{
                        background: "none",
                        border: "none",
                        color: theme.textMuted,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      ← Back to Email Request
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

