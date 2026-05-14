import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Staff from "@/pages/Staff";
import Analytics from "@/pages/Analytics";
import { theme } from "@/lib/theme";
import logo from "@/assets/rATEL-LOGO.png";
import { BarChart3, LayoutGrid, LogOut, Users, ChevronLeft, ChevronRight } from "lucide-react";

type Page = "dashboard" | "staff" | "analytics";

export default function App() {
  const { token, logout } = useAuthStore();
  const [page, setPage] = useState<Page>("dashboard");
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!token) return <Login />;

  return (
    <div style={{ display: "flex", height: "100vh", background: theme.page, overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{
        width: isCollapsed ? "72px" : "220px",
        background: theme.sidebar,
        borderRight: `1px solid ${theme.sidebarBorder}`,
        display: "flex",
        flexDirection: "column",
        padding: "24px 12px",
        flexShrink: 0,
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.06)",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
      }}>
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            position: "absolute",
            right: "-12px",
            top: "32px",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: theme.primary,
            border: `1px solid ${theme.sidebarBorder}`,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Logo */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          gap: "12px", marginBottom: "40px", 
          padding: isCollapsed ? "10px 0" : "10px 16px",
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "15px",
          overflow: "hidden",
        }}>
          <div style={{
            background: "rgba(255,255,255,0.96)",
            borderRadius: "12px",
            padding: isCollapsed ? "6px" : "8px 12px",
            boxShadow: "0 10px 24px rgba(7, 33, 73, 0.16)",
            flexShrink: 0,
          }}>
            <img
              src={logo}
              alt="RATEL"
              style={{ 
                width: isCollapsed ? "24px" : "108px", 
                height: isCollapsed ? "24px" : "auto", 
                objectFit: "contain",
                display: "block" 
              }}
            />
          </div>
        </div>

        {/* Nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
          {[
            { id: "dashboard", icon: LayoutGrid, label: "Attendance" },
            { id: "analytics", icon: BarChart3, label: "Analytics" },
            { id: "staff", icon: Users, label: "Staff" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id as Page)}
              title={isCollapsed ? item.label : ""}
              style={{
                display: "flex", 
                alignItems: "center", 
                justifyContent: isCollapsed ? "center" : "flex-start",
                gap: isCollapsed ? "0" : "10px",
                background: page === item.id
                  ? "rgba(255,255,255,0.16)" : "transparent",
                border: page === item.id
                  ? "1px solid rgba(255,255,255,0.24)"
                  : "1px solid transparent",
                color: page === item.id
                  ? "#ffffff" : "rgba(255,255,255,0.68)",
                borderRadius: "10px", 
                padding: "10px 12px",
                fontSize: "13px", fontWeight: "600",
                cursor: "pointer", 
                width: "100%",
                textAlign: "left",
                transition: "all 0.2s ease",
              }}
            >
              <item.icon size={18} strokeWidth={2.2} />
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          ))}

          {/* Logout */}
          <button
            onClick={logout}
            title={isCollapsed ? "Logout" : ""}
            style={{
              marginTop: "auto",
              display: "flex", 
              alignItems: "center", 
              justifyContent: isCollapsed ? "center" : "flex-start",
              gap: isCollapsed ? "0" : "10px",
              background: "transparent", border: "1px solid transparent",
              color: "rgba(255,255,255,0.6)", borderRadius: "10px",
              padding: "10px 12px", fontSize: "13px",
              cursor: "pointer", width: "100%", textAlign: "left",
              transition: "all 0.2s ease",
            }}
          >
            <LogOut size={18} strokeWidth={2.2} />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflowY: "auto", background: theme.page }}>
        {page === "dashboard" && <Dashboard />}
        {page === "analytics" && <Analytics />}
        {page === "staff" && <Staff />}
      </div>
    </div>
  );
}
