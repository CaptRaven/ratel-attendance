import { useState, useEffect, useCallback, useRef } from "react";
import { AxiosError } from "axios";
import {
  Users, Building2, UserPlus, ArrowLeft, Trash2, RotateCcw, UserCheck, UserX, Edit2, Plus,
  Download, Camera, CameraOff, FileText, X, UploadCloud, Phone, Mail, MapPin, Briefcase, Calendar
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  getDepartments, createDepartment,
  getEmployees, createEmployee, updateEmployee, deactivateEmployee, activateEmployee, purgeEmployee,
  clearFaceEnrollment, getEmployeeDetail, uploadRefereePDF, getRefereePdfUrl, deleteRefereePDF,
} from "@/lib/api";
import type { Department, User } from "@/lib/api";
import { theme } from "@/lib/theme";

type View = "employees" | "add_employee" | "edit_employee" | "departments" | "add_department" | "removed_employees";

interface StaffProps {
  onViewReports?: (employeeId: string) => void;
}

export default function Staff({ onViewReports }: StaffProps = {}) {
  const [view, setView] = useState<View>("employees");
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [downloadDeptId, setDownloadDeptId] = useState("");

  // Detailed Info Modal State
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Employee form state
  const [empForm, setEmpForm] = useState({
    full_name: "",
    email: "",
    employee_id: "",
    password: "",
    department_id: "",
    location_id: "ratel-hq",
    phone_number: "",
    address: "",
    designation: "",
    expected_days_per_week: "5",
    referee_name: "",
    referee_phone: "",
    referee_email: "",
    referee_relationship: "",
    referee_notes: "",
  });

  // Department form state
  const [deptForm, setDeptForm] = useState({ name: "", description: "" });

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) {
      console.error("Failed to fetch employees", err);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (err) {
      console.error("Failed to fetch departments", err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchEmployees();
      await fetchDepartments();
    };
    load();
  }, [fetchEmployees, fetchDepartments]);

  const handleOpenDetail = async (emp: User) => {
    setSelectedEmployee(emp);
    try {
      const detail = await getEmployeeDetail(emp.employee_id);
      setSelectedEmployee(detail);
    } catch (err) {
      console.error("Failed to load employee details", err);
    }
  };

  const handlePdfFileSelectedForEdit = async (file: File) => {
    if (!editingEmployee) return;
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setError("Please upload a valid PDF document.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("PDF file size must be less than 20MB.");
      return;
    }
    setError("");
    setSuccess("");
    setUploadingPdf(true);
    try {
      const updated = await uploadRefereePDF(editingEmployee.employee_id, file);
      setEditingEmployee(updated);
      setEmpForm(prev => ({
        ...prev,
        referee_name: updated.referee_name || prev.referee_name,
        referee_phone: updated.referee_phone || prev.referee_phone,
        referee_email: updated.referee_email || prev.referee_email,
        referee_relationship: updated.referee_relationship || prev.referee_relationship,
        referee_notes: updated.referee_notes || prev.referee_notes,
      }));
      setSuccess("Referee PDF uploaded & details extracted successfully!");
      await fetchEmployees();
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail: string }>;
      if (axiosError.response?.status === 413) {
        setError("File is too large for the server limit. Please upload a PDF under 10MB or update Nginx client_max_body_size.");
      } else {
        setError(axiosError.response?.data?.detail || "Failed to process Referee PDF");
      }
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleDeleteRefereePDF = async (employeeId: string) => {
    if (!confirm("Are you sure you want to delete this referee PDF document?")) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const updated = await deleteRefereePDF(employeeId);
      if (editingEmployee && editingEmployee.employee_id === employeeId) {
        setEditingEmployee(updated);
      }
      if (selectedEmployee && selectedEmployee.employee_id === employeeId) {
        setSelectedEmployee(updated);
      }
      setSuccess("Referee PDF deleted successfully.");
      await fetchEmployees();
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail: string }>;
      setError(axiosError.response?.data?.detail || "Failed to delete Referee PDF");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      await createEmployee({
        ...empForm,
        department_id: empForm.department_id || undefined,
        expected_days_per_week: empForm.expected_days_per_week ? parseInt(empForm.expected_days_per_week, 10) : 5,
      });
      setSuccess("Employee registered successfully.");
      setEmpForm({
        full_name: "", email: "", employee_id: "",
        password: "", department_id: "", location_id: "ratel-hq",
        phone_number: "", address: "", designation: "", expected_days_per_week: "5",
        referee_name: "", referee_phone: "", referee_email: "",
        referee_relationship: "", referee_notes: "",
      });
      await fetchEmployees();
      setTimeout(() => setView("employees"), 1200);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail: string }>;
      setError(axiosError.response?.data?.detail || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmployee = (emp: User) => {
    setEditingEmployee(emp);
    setEmpForm({
      full_name: emp.full_name || "",
      email: emp.email || "",
      employee_id: emp.employee_id || "",
      password: "", // Don't show password
      department_id: emp.department_id || "",
      location_id: emp.location_id || "ratel-hq",
      phone_number: emp.phone_number || "",
      address: emp.address || "",
      designation: emp.designation || "",
      expected_days_per_week: String(emp.expected_days_per_week ?? 5),
      referee_name: emp.referee_name || "",
      referee_phone: emp.referee_phone || "",
      referee_email: emp.referee_email || "",
      referee_relationship: emp.referee_relationship || "",
      referee_notes: emp.referee_notes || "",
    });
    setView("edit_employee");
    setError("");
    setSuccess("");
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    setError(""); setSuccess(""); setLoading(true);
    try {
      const updateData: Partial<{
        email: string;
        full_name: string;
        employee_id: string;
        password?: string;
        department_id?: string;
        location_id?: string;
        phone_number?: string;
        address?: string;
        designation?: string;
        expected_days_per_week?: number;
        referee_name?: string;
        referee_phone?: string;
        referee_email?: string;
        referee_relationship?: string;
        referee_notes?: string;
      }> = {
        full_name: empForm.full_name,
        email: empForm.email,
        employee_id: empForm.employee_id,
        department_id: empForm.department_id || undefined,
        location_id: empForm.location_id,
        phone_number: empForm.phone_number || undefined,
        address: empForm.address || undefined,
        designation: empForm.designation || undefined,
        expected_days_per_week: empForm.expected_days_per_week ? parseInt(empForm.expected_days_per_week, 10) : 5,
        referee_name: empForm.referee_name || undefined,
        referee_phone: empForm.referee_phone || undefined,
        referee_email: empForm.referee_email || undefined,
        referee_relationship: empForm.referee_relationship || undefined,
        referee_notes: empForm.referee_notes || undefined,
      };
      if (empForm.password) {
        updateData.password = empForm.password;
      }

      await updateEmployee(editingEmployee.employee_id, updateData);
      setSuccess("Employee updated successfully.");
      await fetchEmployees();
      if (selectedEmployee && selectedEmployee.employee_id === editingEmployee.employee_id) {
        const detail = await getEmployeeDetail(editingEmployee.employee_id);
        setSelectedEmployee(detail);
      }
      setTimeout(() => setView("employees"), 1200);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail: string }>;
      setError(axiosError.response?.data?.detail || "Failed to update employee");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDepartment = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      await createDepartment(deptForm.name, deptForm.description || undefined);
      setSuccess("Department created.");
      setDeptForm({ name: "", description: "" });
      await fetchDepartments();
      setTimeout(() => setView("departments"), 1200);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail: string }>;
      setError(axiosError.response?.data?.detail || "Failed to create department");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (employeeId: string, name: string) => {
    if (!confirm(`Deactivate ${name}? They will no longer be able to check in.`)) return;
    try {
      await deactivateEmployee(employeeId);
      await fetchEmployees();
      if (selectedEmployee?.employee_id === employeeId) {
        setSelectedEmployee(prev => prev ? { ...prev, is_active: false } : null);
      }
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail: string }>;
      alert(axiosError.response?.data?.detail || "Failed to deactivate employee");
    }
  };

  const handleActivate = async (employeeId: string, name: string) => {
    if (!confirm(`Restore ${name}?`)) return;
    try {
      await activateEmployee(employeeId);
      await fetchEmployees();
      if (selectedEmployee?.employee_id === employeeId) {
        setSelectedEmployee(prev => prev ? { ...prev, is_active: true } : null);
      }
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail: string }>;
      alert(axiosError.response?.data?.detail || "Failed to restore employee");
    }
  };

  const handlePurge = async (employeeId: string, name: string) => {
    if (!confirm(`PERMANENTLY DELETE ${name}? This will remove all their data and attendance history forever.`)) return;
    if (!confirm(`Are you absolutely sure? This cannot be undone.`)) return;
    try {
      await purgeEmployee(employeeId);
      await fetchEmployees();
      if (selectedEmployee?.employee_id === employeeId) {
        setSelectedEmployee(null);
      }
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail: string }>;
      alert(axiosError.response?.data?.detail || "Failed to purge employee");
    }
  };

  const handleClearFaceEnrollment = async (emp: User) => {
    if (!confirm(`Clear face enrollment for ${emp.full_name}? They will need to re-enroll at the kiosk.`)) return;
    try {
      await clearFaceEnrollment(emp.id);
      await fetchEmployees();
      if (selectedEmployee?.id === emp.id) {
        setSelectedEmployee(prev => prev ? { ...prev, is_face_enrolled: false } : null);
      }
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail: string }>;
      alert(axiosError.response?.data?.detail || "Failed to clear face enrollment");
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const filteredEmployees = employees.filter(emp =>
      emp.is_active && (!downloadDeptId || emp.department_id === downloadDeptId)
    );

    const deptName = downloadDeptId
      ? departments.find(d => d.id === downloadDeptId)?.name || "Selected Department"
      : "All Departments";

    doc.setFontSize(20);
    doc.setTextColor(33, 33, 33);
    doc.text("Staff Directory", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Department: ${deptName}`, 14, 30);
    doc.text(`Total Staff: ${filteredEmployees.length}`, 14, 35);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 40);

    const tableData = filteredEmployees.map(emp => [
      emp.full_name,
      emp.email,
      emp.employee_id,
      emp.department_name || "—"
    ]);

    autoTable(doc, {
      startY: 48,
      head: [["Name", "Email", "Employee ID", "Department"]],
      body: tableData,
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { top: 48 },
    });

    doc.save(`staff_list_${deptName.toLowerCase().replace(/\s+/g, '_')}.pdf`);
  };

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
      padding: "32px",
      boxShadow: theme.shadow,
    },
    input: {
      width: "100%",
      background: theme.panelStrong,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: "12px",
      padding: "13px 16px",
      color: theme.text,
      fontSize: "14px",
      outline: "none",
      boxSizing: "border-box" as const,
      marginBottom: "14px",
    },
    label: {
      display: "block" as const,
      color: theme.textMuted,
      fontSize: "11px",
      fontWeight: "700" as const,
      letterSpacing: "0.8px",
      textTransform: "uppercase" as const,
      marginBottom: "6px",
    },
    btnPrimary: {
      background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
      color: "white", border: "none",
      borderRadius: "12px", padding: "13px 24px",
      fontSize: "14px", fontWeight: "600" as const,
      cursor: "pointer", width: "100%",
      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    },
    btnGhost: {
      background: theme.panelMuted,
      border: `1px solid ${theme.panelBorder}`,
      color: theme.textMuted,
      borderRadius: "10px", padding: "10px 18px",
      fontSize: "13px", fontWeight: "500" as const,
      cursor: "pointer",
      display: "flex", alignItems: "center", gap: "8px",
    },
  };

  const sortByEmpId = (list: User[]) =>
    [...list].sort((a, b) => {
      const na = parseInt(a.employee_id.replace(/\D/g, ""), 10);
      const nb = parseInt(b.employee_id.replace(/\D/g, ""), 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.employee_id.localeCompare(b.employee_id);
    });

  const activeEmployees = sortByEmpId(employees.filter(e => e.is_active));
  const deactivatedEmployees = sortByEmpId(employees.filter(e => !e.is_active));

  const getNextEmployeeId = () => {
    const nums = employees
      .map(e => parseInt(e.employee_id.replace(/\D/g, ""), 10))
      .filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `EMP-${String(max + 1).padStart(3, "0")}`;
  };

  const navTabs = [
    { id: "employees", label: `Active (${activeEmployees.length})` },
    { id: "removed_employees", label: `Removed (${deactivatedEmployees.length})` },
    { id: "departments", label: `Departments (${departments.length})` },
  ] as const;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 4px 0" }}>
          Staff Management
        </h1>
        <p style={{ color: theme.textMuted, fontSize: "13px", margin: 0 }}>
          Register employees, view detailed profiles, and parse referee documents
        </p>
      </div>

      {/* Nav tabs */}
      {(view === "employees" || view === "departments" || view === "removed_employees") && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id as View)}
              style={{
                ...s.btnGhost,
                background: view === tab.id
                  ? theme.accentSoft
                  : theme.panelMuted,
                borderColor: view === tab.id
                  ? theme.accent
                  : theme.panelBorder,
                color: view === tab.id ? theme.primary : theme.textMuted,
              }}
            >
              {tab.label}
            </button>
          ))}
          {(view === "employees" || view === "departments") && (
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
              {view === "employees" && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginRight: "12px" }}>
                  <select
                    value={downloadDeptId}
                    onChange={(e) => setDownloadDeptId(e.target.value)}
                    title="Filter by Department for Download"
                    style={{
                      ...s.btnGhost,
                      padding: "8px 12px",
                      fontSize: "12px",
                      appearance: "none",
                      cursor: "pointer",
                      background: theme.panelStrong,
                    }}
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleDownloadPDF}
                    title="Download Staff List PDF"
                    style={{
                      ...s.btnGhost,
                      padding: "8px 12px",
                      background: theme.accentSoft,
                      color: theme.primary,
                      borderColor: theme.accent,
                    }}
                  >
                    <Download size={16} />
                    PDF
                  </button>
                </div>
              )}
              <button
                onClick={() => {
                  if (view === "employees") {
                    setEmpForm(prev => ({ ...prev, employee_id: getNextEmployeeId() }));
                    setView("add_employee");
                  } else {
                    setView("add_department");
                  }
                }}
                style={{
                  ...s.btnPrimary,
                  width: "auto",
                  padding: "10px 20px",
                  fontSize: "13px",
                }}
              >
                <Plus size={16} />
                {view === "employees" ? "Add Employee" : "Add Department"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Employees List ── */}
      {(view === "employees" || view === "removed_employees") && (
        <div style={s.card}>
          {(view === "employees" ? activeEmployees : deactivatedEmployees).length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 0",
              color: theme.textSoft,
              display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
            }}>
              <Users size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
              <p style={{ margin: 0 }}>
                {view === "employees"
                  ? "No active employees yet. Add your first employee."
                  : "No removed employees found."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.5fr 1fr 1fr 240px",
                padding: "0 16px 12px",
                borderBottom: `1px solid ${theme.panelBorder}`,
              }}>
                {["Name", "Email", "Employee ID", "Department", "Actions"].map((h) => (
                  <span key={h} style={{
                    color: theme.textMuted,
                    fontSize: "11px", fontWeight: "700",
                    textTransform: "uppercase", letterSpacing: "0.8px",
                  }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              {(view === "employees" ? activeEmployees : deactivatedEmployees).map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => handleOpenDetail(emp)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.5fr 1fr 1fr 240px",
                    alignItems: "center",
                    background: theme.panelStrong,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: "12px",
                    padding: "14px 16px",
                    opacity: emp.is_active ? 1 : 0.7,
                    cursor: "pointer",
                    transition: "border-color 0.2s, transform 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.panelBorder;
                  }}
                >
                  {/* Name + avatar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                      display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "13px",
                      fontWeight: "700", flexShrink: 0, color: "white",
                    }}>
                      {emp.full_name ? emp.full_name.charAt(0).toUpperCase() : <Users size={16} />}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>
                        {emp.full_name || "Unknown Staff"}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                        <p style={{ margin: 0, fontSize: "11px", color: emp.is_active ? theme.success : theme.danger }}>
                          {emp.is_active ? "Active" : "Inactive"}
                        </p>
                        {emp.designation && (
                          <span style={{ fontSize: "11px", color: theme.textMuted }}>• {emp.designation}</span>
                        )}
                        {emp.is_face_enrolled && (
                          <span style={{
                            display: "flex", alignItems: "center", gap: "3px",
                            fontSize: "10px", fontWeight: "700",
                            color: theme.primary,
                            background: theme.accentSoft,
                            padding: "1px 6px", borderRadius: "999px",
                          }}>
                            <Camera size={9} />
                            Face ID
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: "13px", color: theme.textMuted,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {emp.email}
                  </span>

                  <span style={{
                    fontSize: "13px",
                    background: theme.panelMuted,
                    padding: "4px 10px", borderRadius: "8px",
                    width: "fit-content",
                  }}>
                    {emp.employee_id}
                  </span>

                  <span style={{
                    fontSize: "12px", color: theme.textMuted,
                  }}>
                    {emp.department_name || "—"}
                  </span>

                  <div
                    style={{ display: "flex", gap: "6px", alignItems: "center" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onViewReports?.(emp.employee_id)}
                      title="View Staff Reports"
                      style={{
                        background: theme.accentSoft,
                        border: `1px solid ${theme.accent}`,
                        color: theme.primary, borderRadius: "8px",
                        padding: "6px 10px", fontSize: "11px",
                        cursor: "pointer", fontWeight: "700",
                        display: "flex", alignItems: "center", gap: "4px",
                      }}
                    >
                      <FileText size={13} />
                      Reports
                    </button>

                    {emp.is_active ? (
                      <>
                        <button
                          onClick={() => handleEditEmployee(emp)}
                          title="Edit Employee"
                          style={{
                            background: theme.accentSoft,
                            border: `1px solid ${theme.accentSoft}`,
                            color: theme.primary, borderRadius: "8px",
                            padding: "6px", fontSize: "11px",
                            cursor: "pointer", fontWeight: "600",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        {emp.is_face_enrolled && (
                          <button
                            onClick={() => handleClearFaceEnrollment(emp)}
                            title="Clear Face ID"
                            style={{
                              background: theme.panelMuted,
                              border: `1px solid ${theme.panelBorder}`,
                              color: theme.textMuted, borderRadius: "8px",
                              padding: "6px", fontSize: "11px",
                              cursor: "pointer", fontWeight: "600",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <CameraOff size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeactivate(emp.employee_id, emp.full_name)}
                          title="Deactivate Employee"
                          style={{
                            background: theme.dangerSoft,
                            border: `1px solid ${theme.dangerSoft}`,
                            color: theme.danger, borderRadius: "8px",
                            padding: "6px", fontSize: "11px",
                            cursor: "pointer", fontWeight: "600",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <UserX size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleActivate(emp.employee_id, emp.full_name)}
                          title="Restore Employee"
                          style={{
                            background: theme.successSoft,
                            border: `1px solid ${theme.successSoft}`,
                            color: theme.success, borderRadius: "8px",
                            padding: "6px", fontSize: "11px",
                            cursor: "pointer", fontWeight: "600",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={() => handlePurge(emp.employee_id, emp.full_name)}
                          title="Purge Employee"
                          style={{
                            background: theme.dangerSoft,
                            border: `1px solid ${theme.dangerSoft}`,
                            color: theme.danger, borderRadius: "8px",
                            padding: "6px", fontSize: "11px",
                            cursor: "pointer", fontWeight: "600",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Detailed Employee Info Modal ── */}
      {selectedEmployee && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: "24px",
        }}
        onClick={() => setSelectedEmployee(null)}
        >
          <div
            style={{
              background: theme.panel,
              border: `1px solid ${theme.panelBorder}`,
              borderRadius: "24px",
              width: "100%", maxWidth: "750px",
              maxHeight: "90vh", overflowY: "auto",
              boxShadow: theme.shadow,
              padding: "32px",
              display: "flex", flexDirection: "column", gap: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{
                  width: "56px", height: "56px", borderRadius: "18px",
                  background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "22px", fontWeight: "700", color: "white",
                  boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
                }}>
                  {selectedEmployee.full_name ? selectedEmployee.full_name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px" }}>
                    {selectedEmployee.full_name}
                    <span style={{
                      fontSize: "11px", fontWeight: "600",
                      padding: "2px 8px", borderRadius: "6px",
                      background: selectedEmployee.is_active ? theme.successSoft : theme.dangerSoft,
                      color: selectedEmployee.is_active ? theme.success : theme.danger,
                    }}>
                      {selectedEmployee.is_active ? "Active Staff" : "Deactivated"}
                    </span>
                  </h2>
                  <p style={{ color: theme.textMuted, fontSize: "13px", margin: "4px 0 0 0" }}>
                    {selectedEmployee.designation || "Staff Member"} • ID: <strong style={{ color: theme.text }}>{selectedEmployee.employee_id}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedEmployee(null)}
                style={{
                  background: theme.panelMuted, border: `1px solid ${theme.panelBorder}`,
                  color: theme.textMuted, borderRadius: "50%", width: "36px", height: "36px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Stats Banner */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px",
              background: theme.panelStrong, border: `1px solid ${theme.panelBorder}`,
              borderRadius: "16px", padding: "16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: theme.accentSoft, padding: "10px", borderRadius: "12px", color: theme.primary }}>
                  <Calendar size={20} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "11px", color: theme.textMuted, fontWeight: "600", textTransform: "uppercase" }}>Days Present / Target</p>
                  <p style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: theme.primary }}>
                    {selectedEmployee.days_present ?? 0} <span style={{ fontSize: "12px", fontWeight: "600", color: theme.textMuted }}>/ {selectedEmployee.expected_days_per_week ?? 5} days/wk</span>
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: theme.accentSoft, padding: "10px", borderRadius: "12px", color: theme.accent }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "11px", color: theme.textMuted, fontWeight: "600", textTransform: "uppercase" }}>Department</p>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>
                    {selectedEmployee.department_name || "Unassigned"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: theme.accentSoft, padding: "10px", borderRadius: "12px", color: theme.primary }}>
                  <Camera size={20} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "11px", color: theme.textMuted, fontWeight: "600", textTransform: "uppercase" }}>Face ID Status</p>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: selectedEmployee.is_face_enrolled ? theme.success : theme.textMuted }}>
                    {selectedEmployee.is_face_enrolled ? "Enrolled" : "Not Enrolled"}
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Information Section */}
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.8px", color: theme.textMuted, marginBottom: "12px" }}>
                Contact & Profile Information
              </h3>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px",
                background: theme.panelStrong, border: `1px solid ${theme.panelBorder}`,
                borderRadius: "16px", padding: "20px",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <Mail size={16} style={{ color: theme.textMuted, marginTop: "2px" }} />
                  <div>
                    <span style={{ fontSize: "11px", color: theme.textMuted, display: "block" }}>Email Address</span>
                    <span style={{ fontSize: "14px", fontWeight: "600" }}>{selectedEmployee.email}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <Phone size={16} style={{ color: theme.textMuted, marginTop: "2px" }} />
                  <div>
                    <span style={{ fontSize: "11px", color: theme.textMuted, display: "block" }}>Phone Number</span>
                    <span style={{ fontSize: "14px", fontWeight: "600" }}>{selectedEmployee.phone_number || "Not specified"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <Briefcase size={16} style={{ color: theme.textMuted, marginTop: "2px" }} />
                  <div>
                    <span style={{ fontSize: "11px", color: theme.textMuted, display: "block" }}>Designation / Title</span>
                    <span style={{ fontSize: "14px", fontWeight: "600" }}>{selectedEmployee.designation || "Not specified"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <MapPin size={16} style={{ color: theme.textMuted, marginTop: "2px" }} />
                  <div>
                    <span style={{ fontSize: "11px", color: theme.textMuted, display: "block" }}>Residential Address</span>
                    <span style={{ fontSize: "14px", fontWeight: "600" }}>{selectedEmployee.address || "Not specified"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Referee Information & PDF Section */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.8px", color: theme.textMuted, margin: 0 }}>
                  Referee Information & Document
                </h3>
                {selectedEmployee.referee_pdf_filename && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <a
                      href={getRefereePdfUrl(selectedEmployee.referee_pdf_filename)}
                      target="_blank"
                      rel="noreferrer"
                      download
                      style={{
                        ...s.btnGhost,
                        padding: "6px 14px", fontSize: "12px",
                        background: theme.accentSoft, color: theme.primary,
                        borderColor: theme.accent, textDecoration: "none",
                        fontWeight: "700",
                      }}
                    >
                      <Download size={14} />
                      Download Referee PDF
                    </a>
                    <button
                      onClick={() => handleDeleteRefereePDF(selectedEmployee.employee_id)}
                      title="Delete Referee PDF"
                      style={{
                        ...s.btnGhost,
                        padding: "6px 14px", fontSize: "12px",
                        background: theme.dangerSoft, color: theme.danger,
                        borderColor: theme.dangerSoft, fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} />
                      Delete PDF
                    </button>
                  </div>
                )}
              </div>

              {/* Referee Details Display */}
              <div style={{
                background: theme.panelStrong, border: `1px solid ${theme.panelBorder}`,
                borderRadius: "16px", padding: "20px",
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px",
              }}>
                <div>
                  <span style={{ fontSize: "11px", color: theme.textMuted, display: "block" }}>Referee Name</span>
                  <span style={{ fontSize: "14px", fontWeight: "600" }}>{selectedEmployee.referee_name || "—"}</span>
                </div>

                <div>
                  <span style={{ fontSize: "11px", color: theme.textMuted, display: "block" }}>Referee Relationship</span>
                  <span style={{ fontSize: "14px", fontWeight: "600" }}>{selectedEmployee.referee_relationship || "—"}</span>
                </div>

                <div>
                  <span style={{ fontSize: "11px", color: theme.textMuted, display: "block" }}>Referee Phone</span>
                  <span style={{ fontSize: "14px", fontWeight: "600" }}>{selectedEmployee.referee_phone || "—"}</span>
                </div>

                <div>
                  <span style={{ fontSize: "11px", color: theme.textMuted, display: "block" }}>Referee Email</span>
                  <span style={{ fontSize: "14px", fontWeight: "600" }}>{selectedEmployee.referee_email || "—"}</span>
                </div>

                {selectedEmployee.referee_notes && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ fontSize: "11px", color: theme.textMuted, display: "block" }}>Referee Notes / Excerpt</span>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: theme.text, background: theme.panelMuted, padding: "10px 12px", borderRadius: "8px", whiteSpace: "pre-wrap" }}>
                      {selectedEmployee.referee_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: `1px solid ${theme.panelBorder}`, paddingTop: "16px" }}>
              <button
                onClick={() => {
                  const emp = selectedEmployee;
                  setSelectedEmployee(null);
                  handleEditEmployee(emp);
                }}
                style={{
                  ...s.btnGhost,
                  background: theme.accentSoft, color: theme.primary, borderColor: theme.accent,
                }}
              >
                <Edit2 size={15} />
                Edit Full Profile
              </button>
              <button
                onClick={() => setSelectedEmployee(null)}
                style={s.btnGhost}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Departments List ── */}
      {view === "departments" && (
        <div style={s.card}>
          {departments.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 0",
              color: theme.textSoft,
              display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
            }}>
              <Building2 size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
              <p style={{ margin: 0 }}>No departments yet. Create your first department.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {departments.map((dept) => (
                <div key={dept.id} style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  background: theme.panelStrong,
                  border: `1px solid ${theme.panelBorder}`,
                  borderRadius: "12px", padding: "16px 20px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "40px", height: "40px", borderRadius: "12px",
                      background: theme.panelMuted, display: "flex", alignItems: "center",
                      justifyContent: "center", color: theme.primary,
                    }}>
                      <Building2 size={20} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: "600", fontSize: "15px" }}>
                        {dept.name}
                      </p>
                      {dept.description && (
                        <p style={{
                          margin: "4px 0 0", fontSize: "13px",
                          color: theme.textMuted,
                        }}>
                          {dept.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <span style={{
                    fontSize: "11px", fontWeight: "700",
                    padding: "4px 12px", borderRadius: "999px",
                    background: theme.successSoft,
                    border: `1px solid ${theme.successSoft}`,
                    color: theme.success, textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}>Active</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Employee Form ── */}
      {view === "add_employee" && (
        <div style={{ maxWidth: "600px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <button onClick={() => { setView("employees"); setError(""); setSuccess(""); }}
              style={s.btnGhost}>
              <ArrowLeft size={16} />
              Back
            </button>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>
              Register Employee
            </h2>
          </div>

          <div style={s.card}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div>
                <label style={s.label}>Full Name</label>
                <input style={s.input} placeholder="John Doe"
                  value={empForm.full_name}
                  onChange={(e) => setEmpForm({ ...empForm, full_name: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Employee ID</label>
                <input style={s.input} placeholder="EMP-002"
                  value={empForm.employee_id}
                  onChange={(e) => setEmpForm({ ...empForm, employee_id: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div>
                <label style={s.label}>Email</label>
                <input style={s.input} type="email" placeholder="john@ratel.com"
                  value={empForm.email}
                  onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Phone Number</label>
                <input style={s.input} placeholder="+234..."
                  value={empForm.phone_number}
                  onChange={(e) => setEmpForm({ ...empForm, phone_number: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div>
                <label style={s.label}>Designation</label>
                <input style={s.input} placeholder="Software Engineer"
                  value={empForm.designation}
                  onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Department</label>
                <select
                  value={empForm.department_id}
                  onChange={(e) => setEmpForm({ ...empForm, department_id: e.target.value })}
                  title="Select Department"
                  style={{
                    ...s.input,
                    appearance: "none" as const,
                    cursor: "pointer",
                  }}
                >
                  <option value="">— Select Department —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div>
                <label style={s.label}>Address</label>
                <input style={s.input} placeholder="Residential address"
                  value={empForm.address}
                  onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Work Days / Week (Target)</label>
                <input style={s.input} type="number" min="1" max="7" placeholder="5"
                  value={empForm.expected_days_per_week}
                  onChange={(e) => setEmpForm({ ...empForm, expected_days_per_week: e.target.value })} />
              </div>
            </div>

            <label style={s.label}>Password (optional)</label>
            <input style={s.input} type="password" placeholder="Min 8 characters"
              value={empForm.password}
              onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })} />
            {empForm.password && empForm.password.length > 0 && empForm.password.length < 8 && (
              <p style={{ color: theme.danger, fontSize: "11px", marginTop: "-10px", marginBottom: "10px" }}>
                Password must be at least 8 characters if provided.
              </p>
            )}

            <label style={s.label}>Location ID</label>
            <input style={s.input} placeholder="ratel-hq"
              value={empForm.location_id}
              onChange={(e) => setEmpForm({ ...empForm, location_id: e.target.value })} />

            {error && (
              <div style={{
                background: theme.dangerSoft, border: `1px solid ${theme.dangerSoft}`,
                borderRadius: "10px", padding: "12px 16px",
                color: theme.danger, fontSize: "13px", marginBottom: "16px",
              }}>{error}</div>
            )}

            {success && (
              <div style={{
                background: theme.successSoft, border: `1px solid ${theme.successSoft}`,
                borderRadius: "10px", padding: "12px 16px",
                color: theme.success, fontSize: "13px", marginBottom: "16px",
              }}>{success}</div>
            )}

            <button
              onClick={handleCreateEmployee}
              disabled={loading || !empForm.full_name || !empForm.email ||
                !empForm.employee_id || (empForm.password !== "" && empForm.password.length < 8)}
              style={{
                ...s.btnPrimary,
                opacity: loading || !empForm.full_name || !empForm.email ||
                  !empForm.employee_id || (empForm.password !== "" && empForm.password.length < 8) ? 0.5 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              <UserPlus size={18} />
              {loading ? "Registering..." : "Register Employee"}
            </button>
          </div>
        </div>
      )}

      {/* ── Edit Employee Form ── */}
      {view === "edit_employee" && (
        <div style={{ maxWidth: "600px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <button onClick={() => { setView("employees"); setError(""); setSuccess(""); }}
              style={s.btnGhost}>
              <ArrowLeft size={16} />
              Back
            </button>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>
              Edit Employee: {editingEmployee?.full_name}
            </h2>
          </div>

          <div style={s.card}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div>
                <label style={s.label}>Full Name</label>
                <input style={s.input} placeholder="John Doe"
                  value={empForm.full_name}
                  onChange={(e) => setEmpForm({ ...empForm, full_name: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Employee ID</label>
                <input style={s.input} placeholder="EMP-002"
                  value={empForm.employee_id}
                  onChange={(e) => setEmpForm({ ...empForm, employee_id: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div>
                <label style={s.label}>Email</label>
                <input style={s.input} type="email" placeholder="john@ratel.com"
                  value={empForm.email}
                  onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Phone Number</label>
                <input style={s.input} placeholder="+234..."
                  value={empForm.phone_number}
                  onChange={(e) => setEmpForm({ ...empForm, phone_number: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div>
                <label style={s.label}>Designation</label>
                <input style={s.input} placeholder="Software Engineer"
                  value={empForm.designation}
                  onChange={(e) => setEmpForm({ ...empForm, designation: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Department</label>
                <select
                  value={empForm.department_id}
                  onChange={(e) => setEmpForm({ ...empForm, department_id: e.target.value })}
                  title="Select Department"
                  style={{
                    ...s.input,
                    appearance: "none" as const,
                    cursor: "pointer",
                  }}
                >
                  <option value="">— Select Department —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
              <div>
                <label style={s.label}>Address</label>
                <input style={s.input} placeholder="Residential address"
                  value={empForm.address}
                  onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Work Days / Week (Target)</label>
                <input style={s.input} type="number" min="1" max="7" placeholder="5"
                  value={empForm.expected_days_per_week}
                  onChange={(e) => setEmpForm({ ...empForm, expected_days_per_week: e.target.value })} />
              </div>
            </div>

            <label style={s.label}>Update Password (optional)</label>
            <input style={s.input} type="password" placeholder="Leave blank to keep current"
              value={empForm.password}
              onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })} />
            {empForm.password && empForm.password.length > 0 && empForm.password.length < 8 && (
              <p style={{ color: theme.danger, fontSize: "11px", marginTop: "-10px", marginBottom: "10px" }}>
                Password must be at least 8 characters if provided.
              </p>
            )}

            <label style={s.label}>Location ID</label>
            <input style={s.input} placeholder="ratel-hq"
              value={empForm.location_id}
              onChange={(e) => setEmpForm({ ...empForm, location_id: e.target.value })} />

            {/* Referee PDF Document Upload & Details */}
            <div style={{ borderTop: `1px solid ${theme.panelBorder}`, paddingTop: "16px", marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: theme.textMuted, textTransform: "uppercase" }}>
                  Referee Document & Details
                </h4>
                {editingEmployee?.referee_pdf_filename && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <a
                      href={getRefereePdfUrl(editingEmployee.referee_pdf_filename)}
                      target="_blank"
                      rel="noreferrer"
                      download
                      style={{
                        ...s.btnGhost,
                        padding: "4px 12px", fontSize: "11px",
                        background: theme.accentSoft, color: theme.primary,
                        borderColor: theme.accent, textDecoration: "none",
                        fontWeight: "700",
                      }}
                    >
                      <Download size={13} />
                      Download Referee PDF
                    </a>
                    <button
                      onClick={() => handleDeleteRefereePDF(editingEmployee.employee_id)}
                      title="Delete Referee PDF"
                      type="button"
                      style={{
                        ...s.btnGhost,
                        padding: "4px 10px", fontSize: "11px",
                        background: theme.dangerSoft, color: theme.danger,
                        borderColor: theme.dangerSoft, fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={13} />
                      Delete PDF
                    </button>
                  </div>
                )}
              </div>

              {/* Drag & Drop PDF Dropzone for Edit Employee */}
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handlePdfFileSelectedForEdit(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${theme.panelBorder}`,
                  borderRadius: "14px",
                  padding: "20px",
                  textAlign: "center",
                  background: uploadingPdf ? theme.accentSoft : theme.panelStrong,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  marginBottom: "16px",
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handlePdfFileSelectedForEdit(e.target.files[0]);
                    }
                  }}
                  style={{ display: "none" }}
                />
                <UploadCloud size={28} style={{ color: theme.primary, marginBottom: "6px", opacity: uploadingPdf ? 0.5 : 1 }} />
                <p style={{ margin: "0 0 4px 0", fontSize: "13px", fontWeight: "600" }}>
                  {uploadingPdf ? "Parsing & Uploading Referee PDF..." : "Drop Referee PDF here or click to browse"}
                </p>
                <p style={{ margin: 0, fontSize: "11px", color: theme.textMuted }}>
                  Uploaded PDFs automatically extract Referee Name, Contact, Email & Notes into fields below
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <label style={s.label}>Referee Name</label>
                  <input style={s.input} placeholder="Dr. Jane Smith"
                    value={empForm.referee_name}
                    onChange={(e) => setEmpForm({ ...empForm, referee_name: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Referee Relationship</label>
                  <input style={s.input} placeholder="Former Supervisor"
                    value={empForm.referee_relationship}
                    onChange={(e) => setEmpForm({ ...empForm, referee_relationship: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <label style={s.label}>Referee Phone</label>
                  <input style={s.input} placeholder="+234..."
                    value={empForm.referee_phone}
                    onChange={(e) => setEmpForm({ ...empForm, referee_phone: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Referee Email</label>
                  <input style={s.input} placeholder="referee@example.com"
                    value={empForm.referee_email}
                    onChange={(e) => setEmpForm({ ...empForm, referee_email: e.target.value })} />
                </div>
              </div>
              <label style={s.label}>Referee Notes</label>
              <textarea
                style={{ ...s.input, minHeight: "80px", resize: "none" }}
                placeholder="Additional notes about referee..."
                value={empForm.referee_notes}
                onChange={(e) => setEmpForm({ ...empForm, referee_notes: e.target.value })}
              />
            </div>

            {error && (
              <div style={{
                background: theme.dangerSoft, border: `1px solid ${theme.dangerSoft}`,
                borderRadius: "10px", padding: "12px 16px",
                color: theme.danger, fontSize: "13px", marginBottom: "16px",
              }}>{error}</div>
            )}

            {success && (
              <div style={{
                background: theme.successSoft, border: `1px solid ${theme.successSoft}`,
                borderRadius: "10px", padding: "12px 16px",
                color: theme.success, fontSize: "13px", marginBottom: "16px",
              }}>{success}</div>
            )}

            <button
              onClick={handleUpdateEmployee}
              disabled={loading || !empForm.full_name || !empForm.email ||
                !empForm.employee_id || (empForm.password !== "" && empForm.password.length < 8)}
              style={{
                ...s.btnPrimary,
                opacity: loading || !empForm.full_name || !empForm.email ||
                  !empForm.employee_id || (empForm.password !== "" && empForm.password.length < 8) ? 0.5 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              <UserCheck size={18} />
              {loading ? "Updating..." : "Update Details"}
            </button>
          </div>
        </div>
      )}

      {/* ── Add Department Form ── */}
      {view === "add_department" && (
        <div style={{ maxWidth: "480px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <button onClick={() => { setView("departments"); setError(""); setSuccess(""); }}
              style={s.btnGhost}>
              <ArrowLeft size={16} />
              Back
            </button>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>
              New Department
            </h2>
          </div>

          <div style={s.card}>
            <label style={s.label}>Department Name</label>
            <input style={s.input} placeholder="Engineering"
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />

            <label style={s.label}>Description (optional)</label>
            <textarea
              style={{ ...s.input, minHeight: "100px", resize: "none" }}
              placeholder="Brief description of the department..."
              value={deptForm.description}
              onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
            />

            {error && (
              <div style={{
                background: theme.dangerSoft, border: `1px solid ${theme.dangerSoft}`,
                borderRadius: "10px", padding: "12px 16px",
                color: theme.danger, fontSize: "13px", marginBottom: "16px",
              }}>{error}</div>
            )}

            {success && (
              <div style={{
                background: theme.successSoft, border: `1px solid ${theme.successSoft}`,
                borderRadius: "10px", padding: "12px 16px",
                color: theme.success, fontSize: "13px", marginBottom: "16px",
              }}>{success}</div>
            )}

            <button
              onClick={handleCreateDepartment}
              disabled={loading || !deptForm.name}
              style={{
                ...s.btnPrimary,
                opacity: loading || !deptForm.name ? 0.5 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              <Building2 size={18} />
              {loading ? "Creating..." : "Create Department"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
