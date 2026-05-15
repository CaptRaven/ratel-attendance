import { useState, useEffect, useRef } from "react";
import {
  createSession,
  closeSession,
  getSessionAttendance,
  exportAttendanceCSV,
  getActiveSession,
  rotateToken,
  clearAllAttendance,
} from "@/lib/api";
import { useSessionStore } from "@/store/sessionStore";
import { useAuthStore } from "@/store/authStore";
import QRDisplay from "@/components/QRDisplay";
import AttendeeList from "@/components/AttendeeList";
import { theme } from "@/lib/theme";
import { Download, Play, Square } from "lucide-react";

const WS_BASE_URL = import.meta.env.VITE_WS_URL || "wss://ratel-attendance.onrender.com";

export default function Dashboard() {
  const { token, user } = useAuthStore();
  const { session, attendees, setSession, addAttendee, clearSession } = useSessionStore();
  const [sessionName, setSessionName] = useState("");
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const shouldReconnectRef = useRef(false);

  const loadSessionAttendance = async (sessionId: string) => {
    try {
      const data = await getSessionAttendance(sessionId);
      // Filter out duplicates and add
      data.records.forEach(addAttendee);
    } catch (err) {
      console.error("Failed to load session attendance:", err);
    }
  };

  const getBusinessDayName = () => {
    const now = new Date();
    // If before 6 AM, it's still "yesterday's" business day
    const date = now.getHours() < 6 ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : now;
    return `Session ${date.toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  const startSession = async (customName?: string) => {
    const name = typeof customName === "string" ? customName : getBusinessDayName();
    setLoading(true);
    try {
      const newSession = await createSession(name, "ratel-hq");
      setSession(newSession);
      connectWebSocket(newSession.session_id);
      await loadSessionAttendance(newSession.session_id);
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setLoading(false);
    }
  };

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const disconnectWebSocket = () => {
    shouldReconnectRef.current = false;
    clearReconnectTimeout();
    wsRef.current?.close();
    wsRef.current = null;
  };

  const connectWebSocket = (sessionId: string) => {
    activeSessionIdRef.current = sessionId;
    shouldReconnectRef.current = true;
    clearReconnectTimeout();
    wsRef.current?.close();

    const ws = new WebSocket(`${WS_BASE_URL}/ws/sessions/${sessionId}?token=${token}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "checkin") {
        addAttendee({
          employee: data.employee,
          employee_id: data.employee_id,
          status: data.status,
          check_status: data.action,
          checked_in_at: data.checked_in_at,
          checked_out_at: data.checked_out_at,
        });
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (!shouldReconnectRef.current || activeSessionIdRef.current !== sessionId) {
        return;
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket(sessionId);
      }, 3000);
    };

    wsRef.current = ws;
  };

  const endSession = async () => {
    if (!session) return;
    try {
      await closeSession(session.session_id);
      disconnectWebSocket();
      activeSessionIdRef.current = null;
      clearSession();
      setSessionName("");
    } catch (err) {
      console.error("Failed to close session:", err);
    }
  };

  const handleClearAttendance = async () => {
    if (!confirm("Are you sure you want to PERMANENTLY delete ALL attendance logs?")) return;
    try {
      await clearAllAttendance();
      alert("All records cleared.");
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to clear");
    }
  };

  const checkAndRotateSession = async () => {
    try {
      const activeSession = await getActiveSession();
      const now = new Date();
      const createdAt = new Date(activeSession.created_at);
      
      const last6AM = new Date();
      if (now.getHours() < 6) last6AM.setDate(now.getDate() - 1);
      last6AM.setHours(6, 0, 0, 0);

      if (createdAt < last6AM) {
        await closeSession(activeSession.session_id);
        await startSession();
      } else {
        const rotated = await rotateToken(activeSession.session_id);
        setSession({ ...activeSession, qr_token: rotated.qr_token });
        connectWebSocket(activeSession.session_id);
        await loadSessionAttendance(activeSession.session_id);
      }
    } catch (err) {
      await startSession();
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    const init = async () => {
      await checkAndRotateSession();
      
      interval = setInterval(() => {
        const now = new Date();
        if (now.getHours() === 6 && now.getMinutes() === 0) {
          void checkAndRotateSession();
        }
      }, 60000);
    };

    void init();
    return () => clearInterval(interval);
  }, []); // Only on mount

  const handleExportMonthlySummary = async () => {
    try {
      alert("Generating Monthly Summary (1 row per employee)...");
      await exportAttendanceCSV(); 
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  useEffect(() => () => {
    disconnectWebSocket();
    activeSessionIdRef.current = null;
  }, []);

  const baseStyle = {
    minHeight: "100vh",
    background: theme.page,
    padding: "32px",
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    color: theme.text,
    boxSizing: "border-box" as const,
  };

  return (
    <div style={baseStyle}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "40px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          
          <div>
            <h1 style={{
              color: theme.text,
              fontSize: "20px",
              fontWeight: "700",
              margin: 0,
              letterSpacing: "-0.3px",
            }}>Ratel Attendance</h1>
            <p style={{
              color: theme.textMuted,
              fontSize: "13px",
              margin: 0,
            }}>Welcome, {user?.full_name}</p>
          </div>
        </div>

      </div>

      {!session ? (
        /* ── Start Session ── */
        <div style={{
          maxWidth: "480px",
          margin: "80px auto 0",
        }}>
          <div style={{
            background: theme.panel,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: "24px",
            padding: "48px",
            boxShadow: theme.shadow,
          }}>
            <h2 style={{
              color: theme.text,
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 8px 0",
              textAlign: "center",
            }}>Start Attendance Session</h2>
            <p style={{
              color: theme.textMuted,
              fontSize: "14px",
              textAlign: "center",
              margin: "0 0 32px 0",
            }}>Give this session a name to begin</p>

            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Morning Standup"
              onKeyDown={(e) => e.key === "Enter" && startSession()}
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
                marginBottom: "16px",
              }}
            />
            <button
              onClick={() => startSession()}
              disabled={loading || !sessionName.trim()}
              style={{
                width: "100%",
                background: loading || !sessionName.trim()
                  ? "rgba(15, 79, 157, 0.4)"
                  : `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "15px",
                fontSize: "15px",
                fontWeight: "600",
                cursor: loading || !sessionName.trim() ? "not-allowed" : "pointer",
                letterSpacing: "0.3px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              {!loading && <Play size={16} strokeWidth={2.4} />}
              {loading ? "Starting..." : "Start Session"}
            </button>
          </div>
        </div>
      ) : (
        /* ── Active Session ── */
        <div>
          {/* Session Bar */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: theme.panel,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: "16px",
            padding: "16px 24px",
            marginBottom: "24px",
            boxShadow: theme.shadow,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: theme.success,
                  boxShadow: `0 0 8px ${theme.success}`,
                }} />
                <h2 style={{
                  color: theme.text,
                  fontSize: "18px",
                  fontWeight: "700",
                  margin: 0,
                }}>{session.name}</h2>
              </div>
              <p style={{
                color: theme.textMuted,
                fontSize: "13px",
                margin: "4px 0 0 0",
              }}>
                Session active · {attendees.length} checked in
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleClearAttendance}
                style={{
                  background: "transparent",
                  border: `1px solid ${theme.dangerSoft}`,
                  color: theme.danger,
                  padding: "10px 16px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                Clear All Logs
              </button>
              <button
                onClick={handleExportMonthlySummary}
                style={{
                  background: theme.successSoft,
                  border: `1px solid ${theme.panelBorder}`,
                  color: theme.success,
                  padding: "10px 20px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Download size={15} strokeWidth={2.2} />
                Monthly Summary
              </button>
              <button
                onClick={() => session && exportAttendanceCSV(session.session_id)}
                style={{
                  background: theme.accentSoft,
                  border: `1px solid ${theme.panelBorder}`,
                  color: theme.primary,
                  padding: "10px 20px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Download size={15} strokeWidth={2.2} />
                Export CSV
              </button>
              <button
                onClick={endSession}
                style={{
                  background: theme.dangerSoft,
                  border: `1px solid ${theme.dangerSoft}`,
                  color: theme.danger,
                  padding: "10px 20px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Square size={13} fill="currentColor" strokeWidth={2.2} />
                End Session
              </button>
            </div>
          </div>

          {/* Main Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.4fr",
            gap: "24px",
            alignItems: "start",
          }}>
            <QRDisplay sessionId={session.session_id} />
            <AttendeeList attendees={attendees} />
          </div>
        </div>
      )}
    </div>
  );
}
