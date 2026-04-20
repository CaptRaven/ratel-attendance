import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Staff from "@/pages/Staff";
import Analytics from "@/pages/Analytics";

type Page = "dashboard" | "staff" | "analytics";

export default function App() {
  const { token, logout } = useAuthStore();
  const [page, setPage] = useState<Page>("dashboard");

  if (!token) return <Login />;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <div style={{
        width: "220px",
        background: "rgba(0,0,0,0.3)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 16px",
        flexShrink: 0,
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      }}>
        {/* Logo */}
        <div style={{
          display: "flex", alignItems: "center",
          gap: "10px", marginBottom: "40px", padding: "0 8px",
        }}>
          <div style={{
            width: "32px", height: "32px",
            background: "linear-gradient(135deg, #e94560, #c23152)",
            borderRadius: "10px", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontWeight: "800", fontSize: "14px", color: "white",
          }}>R</div>
          <span style={{
            color: "white", fontWeight: "700", fontSize: "15px",
          }}>Ratel</span>
        </div>

        {/* Nav */}
        {[
          { id: "dashboard", icon: "▦", label: "Attendance" },
          { id: "analytics", icon: "📊", label: "Analytics" },
          { id: "staff", icon: "👥", label: "Staff" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id as Page)}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: page === item.id
                ? "rgba(233,69,96,0.15)" : "transparent",
              border: page === item.id
                ? "1px solid rgba(233,69,96,0.25)"
                : "1px solid transparent",
              color: page === item.id
                ? "#e94560" : "rgba(255,255,255,0.5)",
              borderRadius: "10px", padding: "10px 12px",
              fontSize: "13px", fontWeight: "600",
              cursor: "pointer", width: "100%",
              textAlign: "left", marginBottom: "4px",
            }}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}

        {/* Logout */}
        <button
          onClick={logout}
          style={{
            marginTop: "auto",
            display: "flex", alignItems: "center", gap: "10px",
            background: "transparent", border: "1px solid transparent",
            color: "rgba(255,255,255,0.3)", borderRadius: "10px",
            padding: "10px 12px", fontSize: "13px",
            cursor: "pointer", width: "100%", textAlign: "left",
          }}
        >
          <span>→</span> Logout
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {page === "dashboard" && <Dashboard />}
        {page === "analytics" && <Analytics />}
        {page === "staff" && <Staff />}
      </div>
    </div>
  );
}