import { useState } from "react";
import { login } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { theme } from "@/lib/theme";
import logo from "@/assets/rATEL-LOGO.png";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await login(email, password);
      setAuth(data.access_token, data.user);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
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
            <label style={{
              color: theme.textMuted,
              fontSize: "12px",
              fontWeight: "600",
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "8px",
            }}>Password</label>
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
    </div>
  );
}
