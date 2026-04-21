import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Staff from "@/pages/Staff";
import Analytics from "@/pages/Analytics";
import { theme } from "@/lib/theme";
import logo from "@/assets/rATEL-LOGO.png";
import { BarChart3, LayoutGrid, LogOut, Users } from "lucide-react";

type Page = "dashboard" | "staff" | "analytics";

export default function App() {
  const { token, logout } = useAuthStore();
  const [page, setPage] = useState<Page>("dashboard");

  if (!token) return <Login />;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: theme.page }}>
      {/* Sidebar */}
      <div style={{
        width: "220px",
        background: theme.sidebar,
        borderRight: `1px solid ${theme.sidebarBorder}`,
        display: "flex",
        flexDirection: "column",
        padding: "24px 16px",
        flexShrink: 0,
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.06)",
      }}>
        {/* Logo */}
        <div style={{
          display: "flex", alignItems: "center",
          gap: "12px", marginBottom: "40px", padding: "10px 25px",
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "15px",
        }}>
          <div style={{
            background: "rgba(255,255,255,0.96)",
            borderRadius: "12px",
            padding: "8px 12px",
            boxShadow: "0 10px 24px rgba(7, 33, 73, 0.16)",
          }}>
            <img
              src={logo}
              alt="RATEL"
              style={{ width: "108px", height: "auto", display: "block" }}
            />
          </div>
          
        </div>

        {/* Nav */}
        {[
          { id: "dashboard", icon: LayoutGrid, label: "Attendance" },
          { id: "analytics", icon: BarChart3, label: "Analytics" },
          { id: "staff", icon: Users, label: "Staff" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id as Page)}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: page === item.id
                ? "rgba(255,255,255,0.16)" : "transparent",
              border: page === item.id
                ? "1px solid rgba(255,255,255,0.24)"
                : "1px solid transparent",
              color: page === item.id
                ? "#ffffff" : "rgba(255,255,255,0.68)",
              borderRadius: "10px", padding: "10px 12px",
              fontSize: "13px", fontWeight: "600",
              cursor: "pointer", width: "100%",
              textAlign: "left", marginBottom: "4px",
            }}
          >
            <item.icon size={16} strokeWidth={2.2} />
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
            color: "rgba(255,255,255,0.6)", borderRadius: "10px",
            padding: "10px 12px", fontSize: "13px",
            cursor: "pointer", width: "100%", textAlign: "left",
          }}
        >
          <LogOut size={16} strokeWidth={2.2} /> Logout
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto", background: theme.page }}>
        {page === "dashboard" && <Dashboard />}
        {page === "analytics" && <Analytics />}
        {page === "staff" && <Staff />}
      </div>
    </div>
  );
}
