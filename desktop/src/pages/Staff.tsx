import { useState, useEffect, useEffectEvent } from "react";
import {
  getDepartments, createDepartment,
  getEmployees, createEmployee, updateEmployee, deactivateEmployee, activateEmployee, purgeEmployee
} from "@/lib/api";
import type { Department, User } from "@/lib/api";
import { theme } from "@/lib/theme";

type View = "employees" | "add_employee" | "edit_employee" | "departments" | "add_department" | "removed_employees";

export default function Staff() {
  const [view, setView] = useState<View>("employees");
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);

  // Employee form state
  const [empForm, setEmpForm] = useState({
    full_name: "",
    email: "",
    employee_id: "",
    password: "",
    department_id: "",
    location_id: "ratel-hq",
  });

  // Department form state
  const [deptForm, setDeptForm] = useState({ name: "", description: "" });

  const fetchEmployees = useEffectEvent(async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) {
      console.error("Failed to fetch employees", err);
    }
  });

  const fetchDepartments = useEffectEvent(async () => {
    try {
      const data = await getDepartments();
      setDepartments(data);
    } catch (err) {
      console.error("Failed to fetch departments", err);
    }
  });

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  const handleCreateEmployee = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      await createEmployee({
        ...empForm,
        department_id: empForm.department_id || undefined,
      });
      setSuccess("Employee registered successfully.");
      setEmpForm({
        full_name: "", email: "", employee_id: "",
        password: "", department_id: "", location_id: "ratel-hq",
      });
      await fetchEmployees();
      setTimeout(() => setView("employees"), 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmployee = (emp: User) => {
    setEditingEmployee(emp);
    setEmpForm({
      full_name: emp.full_name,
      email: emp.email,
      employee_id: emp.employee_id,
      password: "", // Don't show password
      department_id: emp.department_id || "",
      location_id: emp.location_id,
    });
    setView("edit_employee");
    setError("");
    setSuccess("");
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    setError(""); setSuccess(""); setLoading(true);
    try {
      const updateData: any = {
        full_name: empForm.full_name,
        email: empForm.email,
        employee_id: empForm.employee_id,
        department_id: empForm.department_id || null,
        location_id: empForm.location_id,
      };
      if (empForm.password) {
        updateData.password = empForm.password;
      }

      await updateEmployee(editingEmployee.employee_id, updateData);
      setSuccess("Employee updated successfully.");
      await fetchEmployees();
      setTimeout(() => setView("employees"), 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update employee");
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
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create department");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (employeeId: string, name: string) => {
    if (!confirm(`Deactivate ${name}? They will no longer be able to check in.`)) return;
    try {
      await deactivateEmployee(employeeId);
      await fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to deactivate employee");
    }
  };

  const handleActivate = async (employeeId: string, name: string) => {
    if (!confirm(`Restore ${name}?`)) return;
    try {
      await activateEmployee(employeeId);
      await fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to restore employee");
    }
  };

  const handlePurge = async (employeeId: string, name: string) => {
    if (!confirm(`PERMANENTLY DELETE ${name}? This will remove all their data and attendance history forever.`)) return;
    if (!confirm(`Are you absolutely sure? This cannot be undone.`)) return;
    try {
      await purgeEmployee(employeeId);
      await fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to purge employee");
    }
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
    },
    btnGhost: {
      background: theme.panelMuted,
      border: `1px solid ${theme.panelBorder}`,
      color: theme.textMuted,
      borderRadius: "10px", padding: "10px 18px",
      fontSize: "13px", fontWeight: "500" as const,
      cursor: "pointer",
    },
  };

  const activeEmployees = employees.filter(e => e.is_active);
  const deactivatedEmployees = employees.filter(e => !e.is_active);

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
          Register employees and manage departments
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
            <button
              onClick={() => setView(
                view === "employees" ? "add_employee" : "add_department"
              )}
              style={{
                ...s.btnPrimary,
                width: "auto",
                marginLeft: "auto",
                padding: "10px 20px",
                fontSize: "13px",
              }}
            >
              + {view === "employees" ? "Add Employee" : "Add Department"}
            </button>
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
            }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}></div>
              <p>
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
                gridTemplateColumns: "2fr 1.5fr 1fr 1fr 150px",
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
                <div key={emp.id} style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.5fr 1fr 1fr 150px",
                  alignItems: "center",
                  background: theme.panelStrong,
                  border: `1px solid ${theme.panelBorder}`,
                  borderRadius: "12px",
                  padding: "14px 16px",
                  opacity: emp.is_active ? 1 : 0.7,
                }}>
                  {/* Name + avatar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      background: `linear-gradient(135deg, ${theme.primary}, ${theme.accent})`,
                      display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "13px",
                      fontWeight: "700", flexShrink: 0,
                    }}>
                      {emp.full_name ? emp.full_name.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>
                        {emp.full_name || "Unknown Staff"}
                      </p>
                      <p style={{
                        margin: 0, fontSize: "11px",
                        color: emp.is_active ? theme.success : theme.danger,
                      }}>
                        {emp.is_active ? "Active" : "Inactive"}
                      </p>
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

                  <div style={{ display: "flex", gap: "8px" }}>
                    {emp.is_active ? (
                      <>
                        <button
                          onClick={() => handleEditEmployee(emp)}
                          style={{
                            background: theme.accentSoft,
                            border: `1px solid ${theme.accentSoft}`,
                            color: theme.primary, borderRadius: "8px",
                            padding: "6px 10px", fontSize: "11px",
                            cursor: "pointer", fontWeight: "600",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeactivate(emp.employee_id, emp.full_name)}
                          style={{
                            background: theme.dangerSoft,
                            border: `1px solid ${theme.dangerSoft}`,
                            color: theme.danger, borderRadius: "8px",
                            padding: "6px 10px", fontSize: "11px",
                            cursor: "pointer", fontWeight: "600",
                          }}
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleActivate(emp.employee_id, emp.full_name)}
                          style={{
                            background: theme.successSoft,
                            border: `1px solid ${theme.successSoft}`,
                            color: theme.success, borderRadius: "8px",
                            padding: "6px 10px", fontSize: "11px",
                            cursor: "pointer", fontWeight: "600",
                          }}
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => handlePurge(emp.employee_id, emp.full_name)}
                          style={{
                            background: theme.dangerSoft,
                            border: `1px solid ${theme.dangerSoft}`,
                            color: theme.danger, borderRadius: "8px",
                            padding: "6px 10px", fontSize: "11px",
                            cursor: "pointer", fontWeight: "600",
                          }}
                        >
                          Purge
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

      {/* ── Departments List ── */}
      {view === "departments" && (
        <div style={s.card}>
          {departments.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 0",
              color: theme.textSoft,
            }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}></div>
              <p>No departments yet. Create your first department.</p>
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
        <div style={{ maxWidth: "560px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <button onClick={() => { setView("employees"); setError(""); setSuccess(""); }}
              style={s.btnGhost}>
              ← Back
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

            <label style={s.label}>Email</label>
            <input style={s.input} type="email" placeholder="john@ratel.com"
              value={empForm.email}
              onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} />

            <label style={s.label}>Password (optional)</label>
            <input style={s.input} type="password" placeholder="Min 8 characters"
              value={empForm.password}
              onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })} />
            {empForm.password && empForm.password.length > 0 && empForm.password.length < 8 && (
              <p style={{ color: theme.danger, fontSize: "11px", marginTop: "-10px", marginBottom: "10px" }}>
                Password must be at least 8 characters if provided.
              </p>
            )}

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
              {loading ? "Registering..." : "Register Employee"}
            </button>
          </div>
        </div>
      )}

      {/* ── Edit Employee Form ── */}
      {view === "edit_employee" && (
        <div style={{ maxWidth: "560px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <button onClick={() => { setView("employees"); setError(""); setSuccess(""); }}
              style={s.btnGhost}>
              ← Back
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

            <label style={s.label}>Email</label>
            <input style={s.input} type="email" placeholder="john@ratel.com"
              value={empForm.email}
              onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} />

            <label style={s.label}>Update Password (optional)</label>
            <input style={s.input} type="password" placeholder="Leave blank to keep current"
              value={empForm.password}
              onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })} />
            {empForm.password && empForm.password.length > 0 && empForm.password.length < 8 && (
              <p style={{ color: theme.danger, fontSize: "11px", marginTop: "-10px", marginBottom: "10px" }}>
                Password must be at least 8 characters if provided.
              </p>
            )}

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
              ← Back
            </button>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>
              Create Department
            </h2>
          </div>

          <div style={s.card}>
            <label style={s.label}>Department Name</label>
            <input style={s.input} placeholder="e.g. Engineering"
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />

            <label style={s.label}>Description (optional)</label>
            <input style={s.input} placeholder="Brief description"
              value={deptForm.description}
              onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} />

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
              {loading ? "Creating..." : "Create Department"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
