import axios from "axios";

const BASE_URL = "http://localhost:8000/api/v1";

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

export interface AttendanceRecord {
  employee: string;
  employee_id: string;
  status: "present" | "late";
  checked_in_at: string;
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

export const rotateToken = async (session_id: string) => {
  const res = await api.post("/sessions/rotate-token", { session_id });
  return res.data as { session_id: string; qr_token: string };
};

export const closeSession = async (session_id: string) => {
  const res = await api.post(`/sessions/${session_id}/close`);
  return res.data;
};

export const getSessionAttendance = async (session_id: string) => {
  const res = await api.get(`/checkin/session/${session_id}`);
  return res.data as { total: number; records: AttendanceRecord[] };
};

export const exportAttendanceCSV = async (session_id?: string) => {
  const params = session_id ? `?session_id=${session_id}` : "";
  const res = await api.get(`/reports/export${params}`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `ratel_attendance_${new Date().toISOString().slice(0, 10)}.csv`
  );
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

export const deactivateEmployee = async (employee_id: string): Promise<User> => {
  const res = await api.patch(`/employees/${employee_id}/deactivate`);
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