import type { AttendanceRecord } from "@/lib/api";
import { theme } from "@/lib/theme";

interface Props { attendees: AttendanceRecord[]; }

export default function AttendeeList({ attendees }: Props) {
  return (
    <div style={{
      background: theme.panel,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: "24px",
      padding: "32px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      height: "100%",
      boxShadow: theme.shadow,
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <h2 style={{
          color: theme.text,
          fontSize: "16px",
          fontWeight: "700",
          margin: 0,
          letterSpacing: "-0.3px",
        }}>Live Attendance</h2>
        <span style={{
          background: theme.successSoft,
          color: theme.success,
          border: `1px solid ${theme.successSoft}`,
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
            color: theme.textSoft,
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
              background: theme.panelStrong,
              border: `1px solid ${theme.panelBorder}`,
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
                  background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "white",
                  flexShrink: 0,
                }}>
                  {a.employee ? a.employee.charAt(0).toUpperCase() : "?"}
                </div>
                <div>
                  <p style={{
                    color: theme.text,
                    fontSize: "14px",
                    fontWeight: "600",
                    margin: "0 0 2px 0",
                  }}>{a.employee || "Unknown Staff"}</p>
                  <p style={{
                    color: theme.textMuted,
                    fontSize: "12px",
                    margin: 0,
                  }}>{a.employee_id || "N/A"}</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: a.check_status === "checked_out"
                    ? theme.dangerSoft
                    : a.status === "present"
                      ? theme.successSoft
                      : theme.warningSoft,
                  color: a.check_status === "checked_out"
                    ? theme.danger
                    : a.status === "present"
                      ? theme.success
                      : theme.warning,
                  border: `1px solid ${a.check_status === "checked_out"
                    ? theme.dangerSoft
                    : a.status === "present"
                      ? theme.successSoft
                      : theme.warningSoft}`,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}>
                  {a.check_status === "checked_out" ? "Out" : a.status}
                </span>
                <p style={{
                  color: theme.textSoft,
                  fontSize: "11px",
                  margin: "4px 0 0 0",
                }}>
                  {a.check_status === "checked_out" && a.checked_out_at
                    ? `Out: ${new Date(a.checked_out_at).toLocaleTimeString()}`
                    : `In: ${new Date(a.checked_in_at).toLocaleTimeString()}`}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
