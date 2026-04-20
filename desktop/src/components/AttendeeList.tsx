import type { AttendanceRecord } from "@/lib/api";

interface Props { attendees: AttendanceRecord[]; }

export default function AttendeeList({ attendees }: Props) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "24px",
      padding: "32px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      height: "100%",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <h2 style={{
          color: "white",
          fontSize: "16px",
          fontWeight: "700",
          margin: 0,
          letterSpacing: "-0.3px",
        }}>Live Attendance</h2>
        <span style={{
          background: "rgba(34,197,94,0.15)",
          color: "#22c55e",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: "999px",
          padding: "4px 12px",
          fontSize: "13px",
          fontWeight: "600",
        }}>
          {attendees.length} checked in
        </span>
      </div>

      {/* List */}
      <div style={{
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        flex: 1,
      }}>
        {attendees.length === 0 ? (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.2)",
            fontSize: "14px",
            gap: "8px",
            padding: "40px 0",
          }}>
            <span style={{ fontSize: "32px" }}></span>
            <span>Waiting for check-ins...</span>
          </div>
        ) : (
          attendees.map((a, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "14px",
              padding: "14px 16px",
              animation: "fadeIn 0.3s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* Avatar */}
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #e94560, #302b63)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "white",
                  flexShrink: 0,
                }}>
                  {a.employee.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "600",
                    margin: "0 0 2px 0",
                  }}>{a.employee}</p>
                  <p style={{
                    color: "rgba(255,255,255,0.35)",
                    fontSize: "12px",
                    margin: 0,
                  }}>{a.employee_id}</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: a.status === "present"
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(245,158,11,0.15)",
                  color: a.status === "present" ? "#22c55e" : "#f59e0b",
                  border: `1px solid ${a.status === "present"
                    ? "rgba(34,197,94,0.3)"
                    : "rgba(245,158,11,0.3)"}`,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}>
                  {a.status}
                </span>
                <p style={{
                  color: "rgba(255,255,255,0.25)",
                  fontSize: "11px",
                  margin: "4px 0 0 0",
                }}>
                  {new Date(a.checked_in_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
