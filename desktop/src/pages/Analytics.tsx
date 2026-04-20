import { useState, useEffect } from "react";
import {
  getOverview, getDailyTrend, getTopPerformers, getStatusBreakdown,
} from "@/lib/api";
import type { OverviewStats, DailyTrend, TopPerformer } from "@/lib/api";

type StatusBreakdown = {
  present: number;
  late: number;
  total: number;
};

export default function Analytics() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [trend, setTrend] = useState<DailyTrend | null>(null);
  const [performers, setPerformers] = useState<TopPerformer[]>([]);
  const [breakdown, setBreakdown] = useState<StatusBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getOverview(),
      getDailyTrend(),
      getTopPerformers(),
      getStatusBreakdown(),
    ]).then(([ov, tr, pf, bd]) => {
      setOverview(ov);
      setTrend(tr);
      setPerformers(pf.performers);
      setBreakdown(bd);
    }).finally(() => setLoading(false));
  }, []);

  const s = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      padding: "32px",
      fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      color: "white",
      boxSizing: "border-box" as const,
    },
    card: {
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "20px",
      padding: "24px",
    },
  };

  if (loading) {
    return (
      <div style={{
        ...s.page, display: "flex",
        alignItems: "center", justifyContent: "center",
        color: "rgba(255,255,255,0.3)", fontSize: "14px",
      }}>
        Loading analytics...
      </div>
    );
  }

  // Bar chart max value
  const maxBarValue = Math.max(
    ...(trend?.days.map((d) => d.total) || [1]), 1
  );

  // Donut chart
  const total = (breakdown?.present || 0) + (breakdown?.late || 0);
  const presentCount = breakdown?.present ?? 0;
  const lateCount = breakdown?.late ?? 0;
  const presentPct = total > 0
    ? Math.round((presentCount / total) * 100) : 0;
  const latePct = total > 0
    ? Math.round((lateCount / total) * 100) : 0;
  const circumference = 2 * Math.PI * 54;
  const presentDash = (presentPct / 100) * circumference;
  const lateDash = (latePct / 100) * circumference;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{
          fontSize: "22px", fontWeight: "700", margin: "0 0 4px 0",
        }}>Analytics</h1>
        <p style={{
          color: "rgba(255,255,255,0.35)", fontSize: "13px", margin: 0,
        }}>
          Attendance overview and trends
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px",
        marginBottom: "24px",
      }}>
        {[
          {
            label: "Total Employees",
            value: overview?.total_employees ?? 0,
            sub: "Active staff",
            color: "#818cf8",
            bg: "rgba(129,140,248,0.1)",
            icon: "👥",
          },
          {
            label: "Present Today",
            value: overview?.present_today ?? 0,
            sub: `${overview?.attendance_rate ?? 0}% attendance rate`,
            color: "#22c55e",
            bg: "rgba(34,197,94,0.1)",
            icon: "✓",
          },
          {
            label: "Late Today",
            value: overview?.late_today ?? 0,
            sub: "After 15min grace",
            color: "#f59e0b",
            bg: "rgba(245,158,11,0.1)",
            icon: "⏱",
          },
          {
            label: "Avg Hours",
            value: `${overview?.avg_hours_today ?? 0}h`,
            sub: "Clocked today",
            color: "#e94560",
            bg: "rgba(233,69,96,0.1)",
            icon: "📊",
          },
        ].map((card) => (
          <div key={card.label} style={{
            ...s.card,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}>
              <div>
                <p style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "11px", fontWeight: "700",
                  letterSpacing: "0.8px",
                  textTransform: "uppercase", margin: "0 0 8px 0",
                }}>{card.label}</p>
                <p style={{
                  fontSize: "32px", fontWeight: "800",
                  margin: 0, color: card.color, lineHeight: 1,
                }}>{card.value}</p>
              </div>
              <div style={{
                width: "40px", height: "40px",
                background: card.bg, borderRadius: "12px",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "18px",
              }}>{card.icon}</div>
            </div>
            <p style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: "12px", margin: 0,
            }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.6fr 1fr",
        gap: "16px",
        marginBottom: "24px",
      }}>
        {/* Bar Chart — 7 day trend */}
        <div style={s.card}>
          <h3 style={{
            fontSize: "14px", fontWeight: "700",
            margin: "0 0 24px 0", color: "white",
          }}>7-Day Attendance Trend</h3>

          <div style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "12px",
            height: "160px",
          }}>
            {trend?.days.map((day) => {
              const totalH = maxBarValue > 0
                ? (day.total / maxBarValue) * 140 : 0;
              const presentH = day.total > 0
                ? (day.present / day.total) * totalH : 0;
              const lateH = totalH - presentH;

              return (
                <div key={day.date} style={{
                  flex: 1, display: "flex",
                  flexDirection: "column",
                  alignItems: "center", gap: "8px",
                }}>
                  {/* Bar */}
                  <div style={{
                    flex: 1, width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    gap: "2px",
                  }}>
                    {day.total === 0 ? (
                      <div style={{
                        width: "100%", height: "4px",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "4px",
                      }} />
                    ) : (
                      <>
                        {lateH > 0 && (
                          <div style={{
                            width: "100%",
                            height: `${lateH}px`,
                            background: "rgba(245,158,11,0.7)",
                            borderRadius: "4px 4px 0 0",
                            transition: "height 0.5s ease",
                          }} />
                        )}
                        <div style={{
                          width: "100%",
                          height: `${presentH}px`,
                          background: "linear-gradient(180deg, #22c55e, #16a34a)",
                          borderRadius: lateH > 0
                            ? "0 0 4px 4px" : "4px",
                          transition: "height 0.5s ease",
                        }} />
                      </>
                    )}
                  </div>
                  {/* Label */}
                  <span style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.3)",
                    fontWeight: "600",
                  }}>{day.date}</span>
                  {day.total > 0 && (
                    <span style={{
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: "700",
                    }}>{day.total}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{
            display: "flex", gap: "16px",
            marginTop: "16px", paddingTop: "16px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}>
            {[
              { color: "#22c55e", label: "On time" },
              { color: "#f59e0b", label: "Late" },
            ].map((l) => (
              <div key={l.label} style={{
                display: "flex", alignItems: "center", gap: "6px",
              }}>
                <div style={{
                  width: "10px", height: "10px",
                  borderRadius: "3px", background: l.color,
                }} />
                <span style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.4)",
                }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Donut Chart — status breakdown */}
        <div style={{ ...s.card, display: "flex", flexDirection: "column" }}>
          <h3 style={{
            fontSize: "14px", fontWeight: "700",
            margin: "0 0 24px 0",
          }}>This Week's Breakdown</h3>

          <div style={{
            flex: 1, display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center", gap: "20px",
          }}>
            {total === 0 ? (
              <p style={{
                color: "rgba(255,255,255,0.2)",
                fontSize: "13px", textAlign: "center",
              }}>No data this week</p>
            ) : (
              <>
                {/* SVG Donut */}
                <div style={{ position: "relative" }}>
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    {/* Background circle */}
                    <circle cx="70" cy="70" r="54"
                      fill="none" stroke="rgba(255,255,255,0.05)"
                      strokeWidth="16" />
                    {/* Present arc */}
                    <circle cx="70" cy="70" r="54"
                      fill="none" stroke="#22c55e" strokeWidth="16"
                      strokeDasharray={`${presentDash} ${circumference}`}
                      strokeDashoffset={circumference * 0.25}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 0.8s ease" }}
                    />
                    {/* Late arc */}
                    <circle cx="70" cy="70" r="54"
                      fill="none" stroke="#f59e0b" strokeWidth="16"
                      strokeDasharray={`${lateDash} ${circumference}`}
                      strokeDashoffset={
                        circumference * 0.25 - presentDash
                      }
                      strokeLinecap="round"
                      style={{ transition: "stroke-dasharray 0.8s ease" }}
                    />
                  </svg>
                  {/* Center text */}
                  <div style={{
                    position: "absolute",
                    top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                  }}>
                    <p style={{
                      fontSize: "22px", fontWeight: "800",
                      margin: 0, color: "white",
                    }}>{total}</p>
                    <p style={{
                      fontSize: "10px", margin: 0,
                      color: "rgba(255,255,255,0.3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}>Total</p>
                  </div>
                </div>

                {/* Stats */}
                <div style={{
                  display: "flex", gap: "20px",
                  width: "100%", justifyContent: "center",
                }}>
                  {[
                    {
                      color: "#22c55e",
                      label: "On Time",
                      value: presentCount,
                      pct: presentPct,
                    },
                    {
                      color: "#f59e0b",
                      label: "Late",
                      value: lateCount,
                      pct: latePct,
                    },
                  ].map((item) => (
                    <div key={item.label} style={{ textAlign: "center" }}>
                      <p style={{
                        fontSize: "20px", fontWeight: "800",
                        color: item.color, margin: "0 0 2px 0",
                      }}>{item.value}</p>
                      <p style={{
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.3)", margin: 0,
                      }}>{item.label} ({item.pct}%)</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div style={s.card}>
        <h3 style={{
          fontSize: "14px", fontWeight: "700",
          margin: "0 0 20px 0",
        }}>Top Performers This Week</h3>

        {performers.length === 0 ? (
          <p style={{
            color: "rgba(255,255,255,0.2)",
            fontSize: "13px", textAlign: "center",
            padding: "32px 0",
          }}>No completed shifts this week yet.</p>
        ) : (
          <div style={{
            display: "flex", flexDirection: "column", gap: "10px",
          }}>
            {performers.map((p, i) => (
              <div key={p.employee_id} style={{
                display: "flex", alignItems: "center", gap: "16px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "14px", padding: "14px 18px",
              }}>
                {/* Rank */}
                <div style={{
                  width: "28px", height: "28px",
                  borderRadius: "50%", flexShrink: 0,
                  background: i === 0
                    ? "linear-gradient(135deg, #f59e0b, #d97706)"
                    : i === 1
                    ? "rgba(156,163,175,0.2)"
                    : "rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px", fontWeight: "800",
                  color: i === 0 ? "white" : "rgba(255,255,255,0.5)",
                }}>
                  {i + 1}
                </div>

                {/* Avatar */}
                <div style={{
                  width: "36px", height: "36px",
                  borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #e94560, #302b63)",
                  display: "flex", alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px", fontWeight: "700",
                }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <p style={{
                    margin: 0, fontSize: "14px", fontWeight: "600",
                  }}>{p.name}</p>
                  <p style={{
                    margin: 0, fontSize: "12px",
                    color: "rgba(255,255,255,0.35)",
                  }}>
                    {p.employee_id} · {p.days_present} day
                    {p.days_present !== 1 ? "s" : ""} present
                  </p>
                </div>

                {/* Hours */}
                <div style={{ textAlign: "right" }}>
                  <p style={{
                    margin: 0, fontSize: "18px",
                    fontWeight: "800", color: "#22c55e",
                  }}>{p.total_hours.toFixed(1)}h</p>
                  <p style={{
                    margin: 0, fontSize: "11px",
                    color: "rgba(255,255,255,0.3)",
                  }}>this week</p>
                </div>

                {/* Progress bar */}
                <div style={{ width: "80px" }}>
                  <div style={{
                    height: "4px",
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: "999px", overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(
                        (p.total_hours / (performers[0]?.total_hours || 1)) * 100,
                        100
                      )}%`,
                      background: i === 0
                        ? "linear-gradient(90deg, #f59e0b, #22c55e)"
                        : "#22c55e",
                      borderRadius: "999px",
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
