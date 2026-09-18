import { useState, useEffect, useCallback } from "react";
import {
  FileText, Calendar, User as UserIcon, Search, Download,
  Clock, CheckCircle2, AlertCircle, RefreshCw, X, Filter
} from "lucide-react";
import { getAttendanceSummary, getEmployees, exportAttendanceCSV } from "@/lib/api";
import type { AttendanceRecord, User } from "@/lib/api";
import { theme } from "@/lib/theme";

interface ReportsProps {
  initialEmployeeId?: string;
  onClearStaffFilter?: () => void;
}

export default function Reports({ initialEmployeeId, onClearStaffFilter }: ReportsProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters state
  const [selectedEmpId, setSelectedEmpId] = useState<string>(initialEmployeeId || "");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [datePreset, setDatePreset] = useState<"today" | "week" | "month" | "all">("all");

  // Sync initialEmployeeId if prop changes
  useEffect(() => {
    if (initialEmployeeId !== undefined) {
      setSelectedEmpId(initialEmployeeId);
    }
  }, [initialEmployeeId]);

  // Fetch list of all employees for dropdown
  useEffect(() => {
    getEmployees()
      .then(setEmployees)
      .catch((err) => console.error("Failed to load employees for report filter", err));
  }, []);

  // Fetch reports based on filters
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAttendanceSummary({
        employee_id: selectedEmpId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setRecords(data.records);
    } catch (err) {
      console.error("Failed to fetch reports history", err);
      setError("Failed to load reports history. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedEmpId, dateFrom, dateTo]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Preset Date Handlers
  const handlePresetChange = (preset: "today" | "week" | "month" | "all") => {
    setDatePreset(preset);
    const now = new Date();
    const format = (d: Date) => d.toISOString().slice(0, 10);

    if (preset === "today") {
      const todayStr = format(now);
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDateFrom(format(weekAgo));
      setDateTo(format(now));
    } else if (preset === "month") {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(format(firstOfMonth));
      setDateTo(format(now));
    } else {
      setDateFrom("");
      setDateTo("");
    }
  };

  const handleExport = async () => {
    try {
      await exportAttendanceCSV(undefined, dateFrom || undefined, dateTo || undefined, selectedEmpId || undefined);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to export report CSV.");
    }
  };

  // Client-side search filtering (for report content or employee name/ID search)
  const filteredRecords = records.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const empName = (r.employee || "").toLowerCase();
    const empId = (r.employee_id || "").toLowerCase();
    const reportText = (r.work_report || "").toLowerCase();
    return empName.includes(q) || empId.includes(q) || reportText.includes(q);
  });

  // Calculate metrics
  const totalReportsCount = filteredRecords.length;
  const reportsWithTextCount = filteredRecords.filter((r) => r.work_report && r.work_report.trim().length > 0).length;
  const totalHoursWorked = filteredRecords.reduce((acc, r) => acc + (r.hours_clocked || 0), 0);

  const selectedStaffObj = employees.find(
    (e) => e.employee_id === selectedEmpId || e.id === selectedEmpId
  );

  const s = {
    page: {
      minHeight: "100vh",
      background: theme.page,
      padding: "32px",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      color: theme.text,
      boxSizing: "border-box" as const,
    },
    card: {
      background: theme.panel,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: "20px",
      padding: "24px",
      boxShadow: theme.shadow,
    },
    filterBox: {
      background: theme.panelStrong,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: "16px",
      padding: "20px",
      marginBottom: "24px",
    },
    input: {
      background: theme.panelMuted,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: "10px",
      padding: "9px 14px",
      color: theme.text,
      fontSize: "13px",
      outline: "none",
    },
    btnPreset: (active: boolean) => ({
      background: active ? theme.accentSoft : theme.panelMuted,
      border: `1px solid ${active ? theme.accent : theme.panelBorder}`,
      color: active ? theme.primary : theme.textMuted,
      borderRadius: "8px",
      padding: "6px 14px",
      fontSize: "12px",
      fontWeight: "600" as const,
      cursor: "pointer",
      transition: "all 0.15s ease",
    }),
    metricCard: {
      background: theme.panelStrong,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: "16px",
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: "14px",
      flex: 1,
    },
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <FileText size={24} style={{ color: theme.primary }} />
            <h1 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>
              Daily Work Reports
            </h1>
          </div>
          <p style={{ color: theme.textMuted, fontSize: "13px", margin: "4px 0 0 34px" }}>
            History of staff clock-out reports, work logs, and task summaries
          </p>
        </div>

        <button
          onClick={handleExport}
          style={{
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
            color: "white",
            border: "none",
            borderRadius: "12px",
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)",
          }}
        >
          <Download size={16} />
          Export Reports CSV
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        <div style={s.metricCard}>
          <div style={{
            width: "42px", height: "42px", borderRadius: "12px",
            background: theme.accentSoft, display: "flex", alignItems: "center",
            justifyContent: "center", color: theme.primary,
          }}>
            <FileText size={20} />
          </div>
          <div>
            <span style={{ fontSize: "11px", color: theme.textMuted, fontWeight: "700", textTransform: "uppercase" }}>
              Total Reports Logged
            </span>
            <h3 style={{ fontSize: "20px", fontWeight: "700", margin: "2px 0 0" }}>
              {totalReportsCount}
            </h3>
          </div>
        </div>

        <div style={s.metricCard}>
          <div style={{
            width: "42px", height: "42px", borderRadius: "12px",
            background: theme.successSoft, display: "flex", alignItems: "center",
            justifyContent: "center", color: theme.success,
          }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span style={{ fontSize: "11px", color: theme.textMuted, fontWeight: "700", textTransform: "uppercase" }}>
              Detailed Work Logs
            </span>
            <h3 style={{ fontSize: "20px", fontWeight: "700", margin: "2px 0 0" }}>
              {reportsWithTextCount} <span style={{ fontSize: "12px", color: theme.textMuted, fontWeight: "400" }}>({totalReportsCount > 0 ? Math.round((reportsWithTextCount / totalReportsCount) * 100) : 0}%)</span>
            </h3>
          </div>
        </div>

        <div style={s.metricCard}>
          <div style={{
            width: "42px", height: "42px", borderRadius: "12px",
            background: "rgba(245, 158, 11, 0.12)", display: "flex", alignItems: "center",
            justifyContent: "center", color: "#f59e0b",
          }}>
            <Clock size={20} />
          </div>
          <div>
            <span style={{ fontSize: "11px", color: theme.textMuted, fontWeight: "700", textTransform: "uppercase" }}>
              Hours Logged
            </span>
            <h3 style={{ fontSize: "20px", fontWeight: "700", margin: "2px 0 0" }}>
              {totalHoursWorked.toFixed(1)} hrs
            </h3>
          </div>
        </div>
      </div>

      {/* Filter Control Box */}
      <div style={s.filterBox}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Filter size={16} style={{ color: theme.primary }} />
            <span style={{ fontSize: "13px", fontWeight: "700", color: theme.text }}>
              Filter Reports
            </span>
          </div>

          {/* Date Presets */}
          <div style={{ display: "flex", gap: "6px" }}>
            {(["today", "week", "month", "all"] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetChange(preset)}
                style={s.btnPreset(datePreset === preset)}
              >
                {preset === "today" ? "Today" : preset === "week" ? "Last 7 Days" : preset === "month" ? "This Month" : "All Time"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1.5fr", gap: "12px", alignItems: "center" }}>
          {/* Staff Member Selector */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: theme.textMuted, marginBottom: "5px", textTransform: "uppercase" }}>
              Staff Member
            </label>
            <div style={{ position: "relative" }}>
              <select
                value={selectedEmpId}
                onChange={(e) => {
                  setSelectedEmpId(e.target.value);
                  if (onClearStaffFilter && e.target.value === "") {
                    onClearStaffFilter();
                  }
                }}
                title="Filter by Staff Member"
                style={{
                  ...s.input,
                  width: "100%",
                  appearance: "none",
                  cursor: "pointer",
                  paddingRight: "30px",
                }}
              >
                <option value="">All Staff Members ({employees.length})</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.employee_id}>
                    {emp.full_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
              <UserIcon size={14} style={{ position: "absolute", right: "12px", top: "12px", color: theme.textMuted, pointerEvents: "none" }} />
            </div>
          </div>

          {/* Date From */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: theme.textMuted, marginBottom: "5px", textTransform: "uppercase" }}>
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setDatePreset("all"); }}
              style={{ ...s.input, width: "100%" }}
            />
          </div>

          {/* Date To */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: theme.textMuted, marginBottom: "5px", textTransform: "uppercase" }}>
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setDatePreset("all"); }}
              style={{ ...s.input, width: "100%" }}
            />
          </div>

          {/* Search Query */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: theme.textMuted, marginBottom: "5px", textTransform: "uppercase" }}>
              Search Keywords
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search report text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...s.input, width: "100%", paddingLeft: "32px" }}
              />
              <Search size={14} style={{ position: "absolute", left: "10px", top: "11px", color: theme.textMuted }} />
              {searchQuery && (
                <X
                  size={14}
                  onClick={() => setSearchQuery("")}
                  style={{ position: "absolute", right: "10px", top: "11px", color: theme.textMuted, cursor: "pointer" }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Selected Staff Member Banner */}
        {selectedEmpId && (
          <div style={{
            marginTop: "14px",
            background: theme.accentSoft,
            border: `1px solid ${theme.accent}`,
            borderRadius: "10px",
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "12px",
            color: theme.primary,
            fontWeight: "600",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <UserIcon size={14} />
              <span>
                Showing reports for: <strong>{selectedStaffObj?.full_name || selectedEmpId}</strong> ({selectedEmpId})
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedEmpId("");
                if (onClearStaffFilter) onClearStaffFilter();
              }}
              style={{
                background: "transparent",
                border: "none",
                color: theme.primary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                fontWeight: "700",
              }}
            >
              <X size={14} /> Clear Staff Filter
            </button>
          </div>
        )}
      </div>

      {/* Reports List */}
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>
            Work Report Entries ({filteredRecords.length})
          </h2>
          <button
            onClick={fetchReports}
            disabled={loading}
            title="Refresh Reports"
            style={{
              background: theme.panelMuted,
              border: `1px solid ${theme.panelBorder}`,
              color: theme.textMuted,
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {error && (
          <div style={{
            background: theme.dangerSoft,
            border: `1px solid ${theme.dangerSoft}`,
            borderRadius: "12px",
            padding: "14px 18px",
            color: theme.danger,
            fontSize: "13px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: theme.textMuted }}>
            <RefreshCw size={32} style={{ animation: "spin 1s linear infinite", opacity: 0.5 }} />
            <p style={{ marginTop: "12px", fontSize: "14px" }}>Loading daily work reports...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "60px 0",
            color: theme.textMuted,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}>
            <FileText size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>
              No work reports found matching the selected filters.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filteredRecords.map((r, idx) => {
              const checkedInDate = r.checked_in_at ? new Date(r.checked_in_at) : null;
              const checkedOutDate = r.checked_out_at ? new Date(r.checked_out_at) : null;
              const dateDisplay = checkedInDate
                ? checkedInDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                : "—";

              const timeInDisplay = checkedInDate
                ? checkedInDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                : "—";

              const timeOutDisplay = checkedOutDate
                ? checkedOutDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                : "Still Checked In";

              const hasReport = r.work_report && r.work_report.trim().length > 0;

              return (
                <div
                  key={`${r.employee_id}-${r.checked_in_at}-${idx}`}
                  style={{
                    background: theme.panelStrong,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: "16px",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                    transition: "border-color 0.2s ease",
                  }}
                >
                  {/* Top Bar: Employee & Session Info */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "50%",
                        background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "15px", fontWeight: "700", color: "white", flexShrink: 0,
                      }}>
                        {r.employee ? r.employee.charAt(0).toUpperCase() : <UserIcon size={18} />}
                      </div>

                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700" }}>
                            {r.employee}
                          </h3>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "600",
                            background: theme.panelMuted,
                            padding: "2px 8px",
                            borderRadius: "6px",
                            color: theme.textMuted,
                          }}>
                            {r.employee_id}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px", fontSize: "12px", color: theme.textMuted }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Calendar size={13} />
                            {dateDisplay}
                          </span>
                          <span>•</span>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={13} />
                            {timeInDisplay} — {timeOutDisplay}
                          </span>
                          {r.hours_clocked !== null && r.hours_clocked !== undefined && (
                            <>
                              <span>•</span>
                              <span style={{ fontWeight: "700", color: theme.primary }}>
                                {r.hours_clocked.toFixed(2)}h clocked
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status & Shift badges */}
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {r.shift && (
                        <span style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          background: theme.panelMuted,
                          border: `1px solid ${theme.panelBorder}`,
                          color: theme.textMuted,
                        }}>
                          {r.shift.replace("_", " ")}
                        </span>
                      )}

                      <span style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: r.check_status === "checked_out" ? theme.successSoft : theme.accentSoft,
                        color: r.check_status === "checked_out" ? theme.success : theme.primary,
                      }}>
                        {r.check_status === "checked_out" ? "Checked Out" : "In Progress"}
                      </span>
                    </div>
                  </div>

                  {/* Work Report Content Card */}
                  <div style={{
                    background: hasReport ? theme.panel : "rgba(0,0,0,0.02)",
                    border: `1px solid ${hasReport ? theme.accentSoft : theme.panelBorder}`,
                    borderRadius: "12px",
                    padding: "14px 16px",
                    borderLeft: `4px solid ${hasReport ? theme.primary : theme.panelBorder}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                      <FileText size={14} style={{ color: hasReport ? theme.primary : theme.textMuted }} />
                      <span style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        color: hasReport ? theme.primary : theme.textMuted,
                      }}>
                        Daily Work Summary
                      </span>
                    </div>

                    {hasReport ? (
                      <p style={{
                        margin: 0,
                        fontSize: "13.5px",
                        lineHeight: "1.5",
                        color: theme.text,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}>
                        {r.work_report}
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontSize: "13px", color: theme.textMuted, fontStyle: "italic" }}>
                        No daily report was submitted during clock-out for this shift.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
