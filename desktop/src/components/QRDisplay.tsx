import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { rotateToken } from "@/lib/api";
import { useSessionStore } from "@/store/sessionStore";
import { theme } from "@/lib/theme";

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

  // The QR value is now JUST the encrypted token.
  // This prevents generic QR scanners from "opening" it as a URL.
  // The official mobile app will scan this, decrypt it, and handle the flow.
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
      gap: "20px",
      boxShadow: theme.shadow,
    }}>
      <div style={{ textAlign: "center" }}>
        <p style={{
          color: theme.textMuted,
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
        boxShadow: "0 16px 32px rgba(12, 54, 110, 0.14)",
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
          <span style={{ color: theme.textMuted, fontSize: "12px" }}>
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
