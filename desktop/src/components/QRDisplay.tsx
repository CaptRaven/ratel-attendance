import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { rotateToken, SHIFTS, type ShiftType } from "@/lib/api";
import { useSessionStore } from "@/store/sessionStore";
import { theme } from "@/lib/theme";
import { Clock } from "lucide-react";

const ROTATE_INTERVAL_MS = 25000;
const TOKEN_TTL_MS = 25000;

interface Props { sessionId: string; }

export default function QRDisplay({ sessionId }: Props) {
  const { qrToken, setQrToken } = useSessionStore();
  
  // Smart Defaulting: Pick the shift based on current time
  const getDefaultShift = (): ShiftType => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 15) return "morning";
    if (hour >= 15 && hour < 22) return "evening";
    return "night"; // 10 PM to 6 AM
  };

  const [activeShift, setActiveShift] = useState<ShiftType>(getDefaultShift());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timeLeft, setTimeLeft] = useState(TOKEN_TTL_MS / 1000);

  const shiftIds = Object.keys(SHIFTS) as ShiftType[];

  useEffect(() => {
    const initialRotate = async () => {
      try {
        const data = await rotateToken(sessionId);
        setQrToken(data.qr_token);
        setTimeLeft(TOKEN_TTL_MS / 1000);
      } catch (err) {
        console.error("Initial token rotation failed:", err);
      }
    };

    void initialRotate();

    intervalRef.current = setInterval(async () => {
      try {
        const data = await rotateToken(sessionId);
        setQrToken(data.qr_token);
        setTimeLeft(TOKEN_TTL_MS / 1000);
      } catch (err) {
        console.error("Token rotation failed:", err);
      }
    }, ROTATE_INTERVAL_MS);

    const countdown = setInterval(() => {
      setTimeLeft((t) => (t <= 1 ? TOKEN_TTL_MS / 1000 : t - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(countdown);
    };
  }, [sessionId]);

  const qrValue = qrToken || ""; 
  const progress = (timeLeft / (TOKEN_TTL_MS / 1000)) * 100;
  const progressColor = timeLeft > 10 ? theme.success : timeLeft > 5 ? theme.warning : theme.primary;

  return (
    <div style={{
      background: theme.panel,
      border: `2px solid ${theme.panelBorder}`,
      borderRadius: "24px",
      padding: "32px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "32px",
      boxShadow: theme.shadow,
      width: "100%",
      boxSizing: "border-box",
      minHeight: "500px",
    }}>
      {/* Shift Selection Header */}
      <div style={{ width: "100%" }}>
        <h3 style={{ 
          margin: "0 0 20px 0", 
          fontSize: "16px", 
          fontWeight: "800", 
          color: theme.primary,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "1.5px"
        }}>
          1. SELECT YOUR SHIFT
        </h3>
        
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 1fr", 
          gap: "16px",
          width: "100%"
        }}>
          {shiftIds.map((id) => {
            const shift = SHIFTS[id];
            const isActive = activeShift === id;
            return (
              <button
                key={id}
                onClick={() => setActiveShift(id)}
                style={{
                  padding: "20px 12px",
                  borderRadius: "18px",
                  border: `3px solid ${isActive ? theme.primary : theme.panelBorder}`,
                  background: isActive ? theme.primary : "white",
                  color: isActive ? "white" : theme.text,
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: isActive ? `0 8px 20px ${theme.primarySoft}` : "0 2px 4px rgba(0,0,0,0.04)",
                  transform: isActive ? "scale(1.02)" : "scale(1)",
                }}
              >
                <span style={{ 
                  fontSize: "15px", 
                  fontWeight: "800", 
                }}>
                  {shift.label}
                </span>
                <span style={{ 
                  fontSize: "12px", 
                  opacity: isActive ? 0.9 : 0.6,
                  fontWeight: "600"
                }}>
                  {shift.start} - {shift.end}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* QR Code Section */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "24px",
        width: "100%",
        paddingTop: "10px",
        borderTop: `1px dashed ${theme.panelBorder}`
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: "16px", 
          fontWeight: "800", 
          color: theme.primary,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "1.5px"
        }}>
          2. SCAN QR CODE
        </h3>

        {!qrToken ? (
          <div style={{
            width: "240px",
            height: "240px",
            background: theme.panelMuted,
            borderRadius: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.textSoft,
            fontSize: "14px",
            textAlign: "center",
            padding: "20px",
            border: `2px dashed ${theme.panelBorder}`
          }}>
            Loading secure token...
          </div>
        ) : (
          <div style={{
            background: "white",
            padding: "24px",
            borderRadius: "28px",
            boxShadow: "0 25px 50px rgba(12, 54, 110, 0.18)",
            border: `1px solid ${theme.panelBorder}`,
          }}>
            <QRCodeSVG
              value={qrValue}
              size={240}
              level="H"
              includeMargin={false}
            />
          </div>
        )}

        <div style={{ textAlign: "center" }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: "8px",
            color: theme.primary,
            fontWeight: "900",
            fontSize: "18px",
            marginBottom: "6px"
          }}>
            <Clock size={22} />
            {activeShift.toUpperCase()} SHIFT READY
          </div>
          <p style={{
            color: theme.textMuted,
            fontSize: "13px",
            fontWeight: "500",
            margin: 0,
          }}>Please ensure your shift matches the selection above</p>
        </div>
      </div>

      {/* Security Countdown */}
      <div style={{ width: "100%", marginTop: "auto" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}>
          <span style={{ 
            color: theme.textSoft, 
            fontSize: "12px", 
            fontWeight: "800", 
            textTransform: "uppercase", 
            letterSpacing: "1.5px" 
          }}>
            Security Token
          </span>
          <span style={{ color: progressColor, fontSize: "14px", fontWeight: "800" }}>
            {timeLeft}s
          </span>
        </div>
        <div style={{
          width: "100%",
          height: "8px",
          background: "rgba(15, 79, 157, 0.08)",
          borderRadius: "999px",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: progressColor,
            borderRadius: "999px",
            transition: "width 1s linear, background 0.3s",
          }} />
        </div>
      </div>
    </div>
  );
}
