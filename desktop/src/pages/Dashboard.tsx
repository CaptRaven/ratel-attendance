import { useState, useEffect, useRef } from "react";
import { createSession, closeSession, getSessionAttendance, exportAttendanceCSV } from "@/lib/api";
import { useSessionStore } from "@/store/sessionStore";
import { useAuthStore } from "@/store/authStore";
import QRDisplay from "@/components/QRDisplay";
import AttendeeList from "@/components/AttendeeList";


const WS_BASE_URL = "ws://localhost:8000";

export default function Dashboard() {
  const { token, user } = useAuthStore();
  const { session, attendees, setSession, addAttendee, clearSession } = useSessionStore();
  const [sessionName, setSessionName] = useState("");
  const [loading, setLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const startSession = async () => {
    if (!sessionName.trim()) return;
    setLoading(true);
    try {
      const newSession = await createSession(sessionName, "ratel-hq");
      setSession(newSession);
      connectWebSocket(newSession.session_id);
    } catch (err) {
      console.error("Failed to start session:", err);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (sessionId: string) => {
    const ws = new WebSocket(`${WS_BASE_URL}/ws/sessions/${sessionId}?token=${token}`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "checkin") {
        addAttendee({
          employee: data.employee,
          employee_id: data.employee_id,
          status: data.status,
          checked_in_at: data.checked_in_at,
        });
      }
    };
    wsRef.current = ws;
  };

  const endSession = async () => {
    if (!session) return;
    try {
      await closeSession(session.session_id);
      wsRef.current?.close();
      clearSession();
      setSessionName("");
    } catch (err) {
      console.error("Failed to close session:", err);
    }
  };

  useEffect(() => {
    if (session) {
      getSessionAttendance(session.session_id).then((data) => {
        data.records.forEach(addAttendee);
      });
    }
  }, []);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  const baseStyle = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
    padding: "32px",
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    color: "white",
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
          <div style={{
            width: "40px",
            height: "40px",
            background: "linear-gradient(135deg, #e94560, #c23152)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "800",
            fontSize: "18px",
          }}>R</div>
          <div>
            <h1 style={{
              color: "white",
              fontSize: "20px",
              fontWeight: "700",
              margin: 0,
              letterSpacing: "-0.3px",
            }}>Ratel Attendance</h1>
            <p style={{
              color: "rgba(255,255,255,0.35)",
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
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "24px",
            padding: "48px",
          }}>
            <h2 style={{
              color: "white",
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 8px 0",
              textAlign: "center",
            }}>Start Attendance Session</h2>
            <p style={{
              color: "rgba(255,255,255,0.35)",
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
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "14px 16px",
                color: "white",
                fontSize: "15px",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: "16px",
              }}
            />
            <button
              onClick={startSession}
              disabled={loading || !sessionName.trim()}
              style={{
                width: "100%",
                background: loading || !sessionName.trim()
                  ? "rgba(233,69,96,0.4)"
                  : "linear-gradient(135deg, #e94560, #c23152)",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "15px",
                fontSize: "15px",
                fontWeight: "600",
                cursor: loading || !sessionName.trim() ? "not-allowed" : "pointer",
                letterSpacing: "0.3px",
              }}
            >
              {loading ? "Starting..." : "▶ Start Session"}
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
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "16px 24px",
            marginBottom: "24px",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 8px #22c55e",
                }} />
                <h2 style={{
                  color: "white",
                  fontSize: "18px",
                  fontWeight: "700",
                  margin: 0,
                }}>{session.name}</h2>
              </div>
              <p style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: "13px",
                margin: "4px 0 0 0",
              }}>
                Session active · {attendees.length} checked in
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => session && exportAttendanceCSV(session.session_id)}
                style={{
                  background: "rgba(99,102,241,0.15)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  color: "#818cf8",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                ↓ Export CSV
              </button>
              <button
                onClick={endSession}
                style={{
                  background: "rgba(233,69,96,0.15)",
                  border: "1px solid rgba(233,69,96,0.3)",
                  color: "#e94560",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                ■ End Session
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
