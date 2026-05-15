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

  if (!qrToken) return null;

  // We append shift info to the token if the backend expects it, 
  // or we just keep it as is if the backend handles it via session context.
  // For now, let's keep the token as is but visually show the shift.
  const qrValue = qrToken; 
  const progress = (timeLeft / (TOKEN_TTL_MS / 1000)) * 100;
  const progressColor = timeLeft > 10 ? theme.success : timeLeft > 5 ? theme.warning : theme.primary;

  return (
    <div style={{
      background: theme.panel,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: "24px",
      padding: "32px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "32px",
      boxShadow: theme.shadow,
      width: "100%",
      boxSizing: "border-box",
    }}>
      {/* Shift Selection Header */}
      <div style={{ width: "100%" }}>
        <h3 style={{ 
          margin: "0 0 16px 0", 
          fontSize: "14px", 
          fontWeight: "700", 
          color: theme.text,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "1px"
        }}>
          Select Your Shift
        </h3>
        
        {/* Grid of Shift Buttons */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 1fr", 
          gap: "12px",
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
                  padding: "16px 12px",
                  borderRadius: "16px",
                  border: `2px solid ${isActive ? theme.primary : theme.panelBorder}`,
                  background: isActive ? theme.primarySoft : "white",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                  boxShadow: isActive ? `0 4px 12px ${theme.primarySoft}` : "none",
                }}
              >
                <span style={{ 
                  fontSize: "13px", 
                  fontWeight: "700", 
                  color: isActive ? theme.primary : theme.text 
                }}>
                  {shift.label}
                </span>
                <span style={{ 
                  fontSize: "11px", 
                  color: isActive ? theme.primary : theme.textMuted 
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
        gap: "20px",
        width: "100%"
      }}>
        <div style={{
          background: "white",
          padding: "24px",
          borderRadius: "24px",
          boxShadow: "0 20px 40px rgba(12, 54, 110, 0.16)",
          border: `1px solid ${theme.panelBorder}`,
        }}>
          <QRCodeSVG
            value={qrValue}
            size={240}
            level="H"
            includeMargin={false}
          />
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: "8px",
            color: theme.primary,
            fontWeight: "800",
            fontSize: "16px",
            marginBottom: "4px"
          }}>
            <Clock size={18} />
            READY FOR {SHIFTS[activeShift].label.toUpperCase()}
          </div>
          <p style={{
            color: theme.textMuted,
            fontSize: "12px",
            margin: 0,
          }}>Scan this code to record attendance</p>
        </div>
      </div>

      {/* Security Countdown */}
      <div style={{ width: "100%" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}>
          <span style={{ 
            color: theme.textSoft, 
            fontSize: "11px", 
            fontWeight: "700", 
            textTransform: "uppercase", 
            letterSpacing: "1px" 
          }}>
            Token Security
          </span>
          <span style={{ color: progressColor, fontSize: "13px", fontWeight: "700" }}>
            {timeLeft}s
          </span>
        </div>
        <div style={{
          width: "100%",
          height: "6px",
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
