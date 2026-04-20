import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { rotateToken } from "@/lib/api";
import { useSessionStore } from "@/store/sessionStore";

const CHECK_IN_BASE_URL = "http://localhost:8000/checkin";
const ROTATE_INTERVAL_MS = 25000;
const TOKEN_TTL_MS = 25000;

interface Props { sessionId: string; }

export default function QRDisplay({ sessionId }: Props) {
  const { qrToken, setQrToken } = useSessionStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timeLeft, setTimeLeft] = useState(TOKEN_TTL_MS / 1000);

  useEffect(() => {
    // Token rotation
    intervalRef.current = setInterval(async () => {
      try {
        const data = await rotateToken(sessionId);
        setQrToken(data.qr_token);
        setTimeLeft(TOKEN_TTL_MS / 1000);
      } catch (err) {
        console.error("Token rotation failed:", err);
      }
    }, ROTATE_INTERVAL_MS);

    // Countdown timer
    const countdown = setInterval(() => {
      setTimeLeft((t) => (t <= 1 ? TOKEN_TTL_MS / 1000 : t - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(countdown);
    };
  }, [sessionId]);

  if (!qrToken) return null;

  const qrValue = `${CHECK_IN_BASE_URL}?token=${encodeURIComponent(qrToken)}`;
  const progress = (timeLeft / (TOKEN_TTL_MS / 1000)) * 100;
  const progressColor = timeLeft > 10 ? "#22c55e" : timeLeft > 5 ? "#f59e0b" : "#e94560";

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "24px",
      padding: "32px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "20px",
    }}>
      <div style={{ textAlign: "center" }}>
        <p style={{
          color: "rgba(255,255,255,0.4)",
          fontSize: "11px",
          fontWeight: "700",
          letterSpacing: "2px",
          textTransform: "uppercase",
          margin: 0,
        }}>Scan to Check In</p>
      </div>

      {/* QR Code */}
      <div style={{
        background: "white",
        padding: "16px",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}>
        <QRCodeSVG
          value={qrValue}
          size={200}
          level="H"
          includeMargin={false}
        />
      </div>

      {/* Countdown */}
      <div style={{ width: "100%", textAlign: "center" }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>
            Refreshes in
          </span>
          <span style={{ color: progressColor, fontSize: "13px", fontWeight: "700" }}>
            {timeLeft}s
          </span>
        </div>
        {/* Progress bar */}
        <div style={{
          width: "100%",
          height: "4px",
          background: "rgba(255,255,255,0.08)",
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
