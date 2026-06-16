import axios from "axios";

const getBaseURL = () => {
  // 1. Try Environment Variable
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  // 2. Try to derive from current origin if we are on the web
  if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    if (window.location.origin.includes("ratelplus.net.ng")) {
      return `${window.location.origin}/api/v1`;
    }
  }

  // 3. Absolute Fallback to Production
  return "https://attendance.ratelplus.net.ng/api/v1";
};

const BASE_URL = getBaseURL();

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ratel_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (expired tokens) by logging out
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("ratel_token");
      localStorage.removeItem("ratel_user");
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// Types
export interface User {
  id: string;
  email: string;
  full_name: string;
  employee_id: string;
  role: string;
  is_active: boolean;
  location_id: string;
  department_id?: string | null;
  department_name?: string | null;
  created_at: string;
}

export interface Session {
  session_id: string;
  name: string;
  location_id: string;
  is_active: boolean;
  created_at: string;
  qr_token: string;
}

// Shifts
export type ShiftType = "morning" | "evening" | "night" | "all_rounder";

export const SHIFTS: Record<ShiftType, { label: string; start: string; end: string }> = {
  morning: { label: "Morning", start: "08:00", end: "15:00" },
  evening: { label: "Evening", start: "15:00", end: "22:00" },
  night: { label: "Night", start: "22:00", end: "06:00" },
  all_rounder: { label: "All Rounder", start: "08:00", end: "17:00" },
};

export interface AttendanceRecord {
  employee: string;
  employee_id: string;
  status: "present" | "late";
  check_status: "checked_in" | "checked_out";
  checked_in_at: string;
  checked_out_at?: string | null;
  shift?: ShiftType;
}

// Auth
export const login = async (email: string, password: string) => {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
};

// Sessions
export const createSession = async (name: string, location_id: string) => {
  const res = await api.post("/sessions/", { name, location_id });
  return res.data as Session;
};

export const getActiveSession = async (): Promise<Session> => {
  const res = await api.get("/sessions/active");
  return res.data as Session;
};

export const rotateToken = async (session_id: string, shift?: string) => {
  const res = await api.post("/sessions/rotate-token", { session_id, shift });
  return res.data as { session_id: string; qr_token: string };
};

export const closeSession = async (session_id: string) => {
  const res = await api.post(`/sessions/${session_id}/close`);
  return res.data;
};

export const recoverSession = async (): Promise<Session> => {
  const res = await api.post("/sessions/recover");
  return res.data as Session;
};

export interface ManualCheckinResult {
  action: "checked_in" | "checked_out";
  employee: string;
  employee_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  hours_clocked: number | null;
}

export const manualCheckin = async (
  employee_id: string,
  session_id: string
): Promise<ManualCheckinResult> => {
  const res = await api.post("/checkin/manual", { employee_id, session_id });
  return res.data as ManualCheckinResult;
};

export const getEmployeeStatus = async (
  employee_id: string,
  session_id: string
): Promise<{ check_status: string; employee: string | null; found: boolean }> => {
  const res = await api.get(
    `/checkin/status?employee_id=${encodeURIComponent(employee_id)}&session_id=${encodeURIComponent(session_id)}`
  );
  return res.data;
};

export const getSessionAttendance = async (session_id: string) => {
  const res = await api.get(`/checkin/session/${session_id}`);
  return res.data as { total: number; records: AttendanceRecord[] };
};

export const getAttendanceSummary = async (session_id?: string) => {
  const params = session_id ? `?session_id=${session_id}` : "";
  const res = await api.get(`/reports/summary${params}`);
  return res.data as { total_employees: number; records: AttendanceRecord[] };
};

export const exportAttendanceCSV = async (
  session_id?: string,
  date_from?: string,
  date_to?: string,
) => {
  const p = new URLSearchParams();
  if (session_id) p.set("session_id", session_id);
  if (date_from)  p.set("date_from", date_from);
  if (date_to)    p.set("date_to", date_to);
  const query = p.toString() ? `?${p.toString()}` : "";
  const res = await api.get(`/reports/export${query}`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  const label = date_from && date_to
    ? `${date_from}_to_${date_to}`
    : new Date().toISOString().slice(0, 10);
  link.setAttribute("download", `ratel_attendance_${label}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// Departments
export interface Department {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export const getDepartments = async (): Promise<Department[]> => {
  const res = await api.get("/departments/");
  return res.data;
};

export const createDepartment = async (
  name: string,
  description?: string
): Promise<Department> => {
  const res = await api.post("/departments/", { name, description });
  return res.data;
};

// Employees
export const getEmployees = async (): Promise<User[]> => {
  const res = await api.get("/employees/");
  return res.data;
};

export const createEmployee = async (data: {
  email: string;
  full_name: string;
  employee_id: string;
  password: string;
  department_id?: string;
  location_id?: string;
}): Promise<User> => {
  const res = await api.post("/employees/", data);
  return res.data;
};

export const updateEmployee = async (
  employee_id: string,
  data: Partial<{
    email: string;
    full_name: string;
    employee_id: string;
    password?: string;
    department_id?: string;
    location_id?: string;
  }>
): Promise<User> => {
  const res = await api.patch(`/employees/${employee_id}`, data);
  return res.data;
};

export const deactivateEmployee = async (employee_id: string): Promise<User> => {
  const res = await api.patch(`/employees/${employee_id}/deactivate`);
  return res.data;
};

export const activateEmployee = async (employee_id: string): Promise<User> => {
  const res = await api.patch(`/employees/${employee_id}/activate`);
  return res.data;
};

export const purgeEmployee = async (employee_id: string): Promise<{ message: string }> => {
  const res = await api.delete(`/employees/${employee_id}/purge`);
  return res.data;
};

export const clearAllAttendance = async (): Promise<{ message: string }> => {
  const res = await api.delete("/reports/clear");
  return res.data;
};

export interface UnclosedRecord {
  employee: string;
  employee_id: string;
  session_id: string;
  checked_in_at: string;
}

export const getUnclosedCheckins = async (
  olderThanHours = 24
): Promise<{ count: number; older_than_hours: number; records: UnclosedRecord[] }> => {
  const res = await api.get(`/reports/unclosed?older_than_hours=${olderThanHours}`);
  return res.data;
};

export const bulkAutoCheckout = async (
  olderThanHours = 24,
  defaultHoursClocked = 8.0
): Promise<{ message: string; count: number; hours_assigned: number }> => {
  const res = await api.post(
    `/reports/bulk-checkout?older_than_hours=${olderThanHours}&default_hours_clocked=${defaultHoursClocked}`
  );
  return res.data;
};

export interface OverviewStats {
  total_employees: number;
  present_today: number;
  present_on_time: number;
  late_today: number;
  checked_out: number;
  avg_hours_today: number;
  attendance_rate: number;
}

export interface DailyTrend {
  days: {
    date: string;
    full_date: string;
    present: number;
    late: number;
    total: number;
  }[];
}

export interface TopPerformer {
  name: string;
  employee_id: string;
  total_hours: number;
  days_present: number;
}

export const getOverview = async (): Promise<OverviewStats> => {
  const res = await api.get("/analytics/overview");
  return res.data;
};

export const getDailyTrend = async (): Promise<DailyTrend> => {
  const res = await api.get("/analytics/daily-trend");
  return res.data;
};

export const getTopPerformers = async (): Promise<{ performers: TopPerformer[] }> => {
  const res = await api.get("/analytics/top-performers");
  return res.data;
};

export const getStatusBreakdown = async () => {
  const res = await api.get("/analytics/status-breakdown");
  return res.data;
};
