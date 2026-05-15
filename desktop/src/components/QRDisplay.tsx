import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { rotateToken, SHIFTS, type ShiftType } from "@/lib/api";
import { useSessionStore } from "@/store/sessionStore";
import { theme } from "@/lib/theme";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

const ROTATE_INTERVAL_MS = 25000;
const TOKEN_TTL_MS = 25000;

interface Props { sessionId: string; }

export default function QRDisplay({ sessionId }: Props) {
  const { qrToken, setQrToken } = useSessionStore();
  const [activeShift, setActiveShift] = useState<ShiftType>("morning");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timeLeft, setTimeLeft] = useState(TOKEN_TTL_MS / 1000);

  const shiftIds = Object.keys(SHIFTS) as ShiftType[];
  const activeShiftIndex = shiftIds.indexOf(activeShift);

  const nextShift = () => {
    const nextIndex = (activeShiftIndex + 1) % shiftIds.length;
    setActiveShift(shiftIds[nextIndex]);
  };

  const prevShift = () => {
    const prevIndex = (activeShiftIndex - 1 + shiftIds.length) % shiftIds.length;
    setActiveShift(shiftIds[prevIndex]);
  };

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

  const currentShift = SHIFTS[activeShift];

  return (
    <div style={{
      background: theme.panel,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: "24px",
      padding: "32px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "24px",
      boxShadow: theme.shadow,
      position: "relative",
    }}>
      {/* Shift Selector Carousel */}
      <div style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: theme.panelMuted,
        padding: "12px 16px",
        borderRadius: "16px",
        border: `1px solid ${theme.panelBorder}`,
      }}>
        <button onClick={prevShift} title="Previous Shift" style={{
          background: "white", border: "none", borderRadius: "50%",
          width: "32px", height: "32px", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}>
          <ChevronLeft size={18} />
        </button>

        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ 
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            color: theme.primary, fontWeight: "700", fontSize: "15px"
          }}>
            <Clock size={16} />
            {currentShift.label}
          </div>
          <div style={{ color: theme.textMuted, fontSize: "11px", fontWeight: "600", marginTop: "2px" }}>
            {currentShift.start} — {currentShift.end}
          </div>
        </div>

        <button onClick={nextShift} title="Next Shift" style={{
          background: "white", border: "none", borderRadius: "50%",
          width: "32px", height: "32px", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* QR Code */}
      <div style={{
        background: "white",
        padding: "24px",
        borderRadius: "24px",
        boxShadow: "0 20px 40px rgba(12, 54, 110, 0.16)",
        position: "relative",
      }}>
        <QRCodeSVG
          value={qrValue}
          size={240}
          level="H"
          includeMargin={false}
        />
        
        {/* Success Overlay could go here when a scan is detected */}
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{
          color: theme.textMuted,
          fontSize: "12px",
          fontWeight: "600",
          margin: 0,
        }}>Select your shift and scan the QR</p>
      </div>

      {/* Countdown Progress */}
      <div style={{ width: "100%", textAlign: "center", marginTop: "8px" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}>
          <span style={{ color: theme.textSoft, fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>
            Security Refresh
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
