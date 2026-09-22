import { useState, useEffect, useCallback } from "react";
import { AxiosError } from "axios";
import {
  Briefcase,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  MapPin,
  Clock,
  Building2,
  FileText,
  ListChecks,
  Users,
  Download,
  ExternalLink,
  Mail,
  Phone,
  Eye,
  X,
} from "lucide-react";
import {
  getJobOpenings,
  createJobOpening,
  updateJobOpening,
  toggleJobOpeningStatus,
  deleteJobOpening,
  getJobApplications,
  updateJobApplicationStatus,
  deleteJobApplication,
  getResumeUrl,
} from "@/lib/api";
import type { JobOpening, JobApplication } from "@/lib/api";
import { theme } from "@/lib/theme";

type MainTab = "openings" | "applications";
type ViewMode = "list" | "create" | "edit";

const CATEGORIES = [
  { key: "all", label: "All Categories" },
  { key: "engineering", label: "Fiber & Wireless Engineering" },
  { key: "noc", label: "NOC & Infrastructure" },
  { key: "sales", label: "Sales & Business Dev" },
  { key: "support", label: "Customer Experience" },
  { key: "corporate", label: "Corporate & IT" },
];

export default function Careers() {
  const [mainTab, setMainTab] = useState<MainTab>("openings");

  // Job Openings State
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null);

  // Filters for Openings
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Form State for Openings
  const [formState, setFormState] = useState({
    title: "",
    department: "",
    category: "engineering",
    location: "Kano, Nigeria",
    type: "Full-time",
    experience: "2+ Years",
    description: "",
    requirementsText: "",
  });

  // Applications State
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState<string>("all");
  const [selectedAppModal, setSelectedAppModal] = useState<JobApplication | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getJobOpenings(undefined, undefined, false);
      setJobs(data);
    } catch (err) {
      console.error("Failed to load job openings", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchApplications = useCallback(async () => {
    setAppsLoading(true);
    try {
      const data = await getJobApplications();
      setApplications(data);
    } catch (err) {
      console.error("Failed to load job applications", err);
    } finally {
      setAppsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchApplications();
  }, [fetchJobs, fetchApplications]);

  const handleOpenCreate = () => {
    setEditingJob(null);
    setFormState({
      title: "",
      department: "",
      category: "engineering",
      location: "Kano, Nigeria",
      type: "Full-time",
      experience: "2+ Years",
      description: "",
      requirementsText: "",
    });
    setError("");
    setSuccess("");
    setViewMode("create");
  };

  const handleOpenEdit = (job: JobOpening) => {
    setEditingJob(job);
    setFormState({
      title: job.title,
      department: job.department,
      category: job.category,
      location: job.location,
      type: job.type,
      experience: job.experience,
      description: job.description,
      requirementsText: job.requirements ? job.requirements.join("\n") : "",
    });
    setError("");
    setSuccess("");
    setViewMode("edit");
  };

  const handleFormSubmit = async () => {
    setError("");
    setSuccess("");
    setSubmitting(true);

    const requirementsArray = formState.requirementsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    try {
      if (viewMode === "create") {
        await createJobOpening({
          title: formState.title,
          department: formState.department,
          category: formState.category,
          location: formState.location,
          type: formState.type,
          experience: formState.experience,
          description: formState.description,
          requirements: requirementsArray,
        });
        setSuccess("Job opening published successfully!");
      } else if (viewMode === "edit" && editingJob) {
        await updateJobOpening(editingJob.id, {
          title: formState.title,
          department: formState.department,
          category: formState.category,
          location: formState.location,
          type: formState.type,
          experience: formState.experience,
          description: formState.description,
          requirements: requirementsArray,
        });
        setSuccess("Job opening updated successfully!");
      }

      await fetchJobs();
      setTimeout(() => setViewMode("list"), 1000);
    } catch (err: unknown) {
      const axiosError = err as AxiosError<{ detail: string }>;
      setError(axiosError.response?.data?.detail || "Failed to save job opening");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (job: JobOpening) => {
    try {
      await toggleJobOpeningStatus(job.id);
      await fetchJobs();
    } catch (err) {
      console.error("Failed to toggle status", err);
    }
  };

  const handleDeleteJob = async (job: JobOpening) => {
    if (!confirm(`Are you sure you want to delete "${job.title}"?`)) return;
    try {
      await deleteJobOpening(job.id);
      await fetchJobs();
    } catch (err) {
      console.error("Failed to delete job", err);
    }
  };

  const handleUpdateAppStatus = async (id: string, newStatus: string) => {
    try {
      await updateJobApplicationStatus(id, newStatus);
      await fetchApplications();
      if (selectedAppModal && selectedAppModal.id === id) {
        setSelectedAppModal({ ...selectedAppModal, status: newStatus as any });
      }
    } catch (err) {
      console.error("Failed to update application status", err);
    }
  };

  const handleDeleteApp = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete application from "${name}"?`)) return;
    try {
      await deleteJobApplication(id);
      await fetchApplications();
      if (selectedAppModal?.id === id) {
        setSelectedAppModal(null);
      }
    } catch (err) {
      console.error("Failed to delete application", err);
    }
  };

  // Filtered jobs
  const filteredJobs = jobs.filter((job) => {
    const matchesCategory = selectedCategory === "all" || job.category === selectedCategory;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && job.is_active) ||
      (statusFilter === "inactive" && !job.is_active);
    const matchesQuery =
      searchQuery.trim() === "" ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStatus && matchesQuery;
  });

  // Filtered Applications
  const filteredApps = applications.filter((app) => {
    const matchesStatus =
      appStatusFilter === "all" || app.status.toLowerCase() === appStatusFilter.toLowerCase();
    const matchesQuery =
      appSearchQuery.trim() === "" ||
      app.full_name.toLowerCase().includes(appSearchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(appSearchQuery.toLowerCase()) ||
      app.phone.toLowerCase().includes(appSearchQuery.toLowerCase()) ||
      app.job_title.toLowerCase().includes(appSearchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const pendingAppsCount = applications.filter((a) => a.status === "pending").length;

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
    input: {
      width: "100%",
      background: theme.panelStrong,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: "12px",
      padding: "12px 16px",
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
      color: "white",
      border: "none",
      borderRadius: "12px",
      padding: "12px 20px",
      fontSize: "13px",
      fontWeight: "600" as const,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    },
    btnGhost: {
      background: theme.panelMuted,
      border: `1px solid ${theme.panelBorder}`,
      color: theme.textMuted,
      borderRadius: "10px",
      padding: "9px 16px",
      fontSize: "13px",
      fontWeight: "500" as const,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
  };

  const getStatusBadgeStyle = (statusStr: string) => {
    switch (statusStr.toLowerCase()) {
      case "pending":
        return { color: "#f59e0b", background: "rgba(245, 158, 11, 0.15)", label: "Pending Review" };
      case "reviewed":
        return { color: "#3b82f6", background: "rgba(59, 130, 246, 0.15)", label: "Reviewed" };
      case "shortlisted":
        return { color: "#10b981", background: "rgba(16, 185, 129, 0.15)", label: "Shortlisted" };
      case "rejected":
        return { color: "#ef4444", background: "rgba(239, 68, 68, 0.15)", label: "Rejected" };
      default:
        return { color: theme.textMuted, background: theme.panelMuted, label: statusStr };
    }
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 4px 0" }}>
            Careers & Recruitment Portal
          </h1>
          <p style={{ color: theme.textMuted, fontSize: "13px", margin: 0 }}>
            Manage career opportunities and candidate applications received from the Ratel website
          </p>
        </div>
        {mainTab === "openings" && viewMode === "list" && (
          <button onClick={handleOpenCreate} style={s.btnPrimary}>
            <Plus size={16} />
            Post Job Opening
          </button>
        )}
      </div>

      {/* Main Tab Navigation */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          borderBottom: `1px solid ${theme.panelBorder}`,
          paddingBottom: "12px",
        }}
      >
        <button
          onClick={() => {
            setMainTab("openings");
            setViewMode("list");
          }}
          style={{
            background: mainTab === "openings" ? theme.panelStrong : "transparent",
            color: mainTab === "openings" ? theme.text : theme.textMuted,
            border: `1px solid ${mainTab === "openings" ? theme.panelBorder : "transparent"}`,
            borderRadius: "12px",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Briefcase size={16} color={mainTab === "openings" ? theme.primary : theme.textMuted} />
          Job Openings ({jobs.length})
        </button>

        <button
          onClick={() => setMainTab("applications")}
          style={{
            background: mainTab === "applications" ? theme.panelStrong : "transparent",
            color: mainTab === "applications" ? theme.text : theme.textMuted,
            border: `1px solid ${mainTab === "applications" ? theme.panelBorder : "transparent"}`,
            borderRadius: "12px",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Users size={16} color={mainTab === "applications" ? theme.primary : theme.textMuted} />
          Received Applications ({applications.length})
          {pendingAppsCount > 0 && (
            <span
              style={{
                background: "#f59e0b",
                color: "#000",
                fontSize: "11px",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "999px",
              }}
            >
              {pendingAppsCount} new
            </span>
          )}
        </button>
      </div>

      {mainTab === "openings" ? (
        viewMode === "list" ? (
          <>
            {/* Controls Bar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              {/* Search */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: theme.panelStrong,
                  border: `1px solid ${theme.panelBorder}`,
                  borderRadius: "12px",
                  padding: "0 14px",
                  flex: "1 1 240px",
                }}
              >
                <Search size={16} color={theme.textMuted} style={{ marginRight: "10px" }} />
                <input
                  type="text"
                  placeholder="Search openings by title, department, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: theme.text,
                    padding: "10px 0",
                    fontSize: "13px",
                    outline: "none",
                    width: "100%",
                  }}
                />
              </div>

              {/* Category Select */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                title="Filter by Category"
                style={{
                  ...s.btnGhost,
                  background: theme.panelStrong,
                  padding: "9px 14px",
                  fontSize: "13px",
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <div
                style={{
                  display: "flex",
                  background: theme.panelMuted,
                  border: `1px solid ${theme.panelBorder}`,
                  borderRadius: "10px",
                  padding: "3px",
                }}
              >
                {(["all", "active", "inactive"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      background: statusFilter === st ? theme.panelStrong : "transparent",
                      border: "none",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      color: statusFilter === st ? theme.text : theme.textMuted,
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Job Openings List */}
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: theme.textMuted }}>
                Loading job openings...
              </div>
            ) : filteredJobs.length === 0 ? (
              <div
                style={{
                  ...s.card,
                  textAlign: "center",
                  padding: "60px 20px",
                  color: theme.textMuted,
                }}
              >
                <Briefcase size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: "12px" }} />
                <h3 style={{ margin: "0 0 6px 0", color: theme.text }}>No Job Openings Found</h3>
                <p style={{ margin: 0, fontSize: "13px" }}>
                  {searchQuery || selectedCategory !== "all" || statusFilter !== "all"
                    ? "Try clearing your filters or search query."
                    : "Click 'Post Job Opening' to add your first career opportunity."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      ...s.card,
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                      opacity: job.is_active ? 1 : 0.65,
                      transition: "opacity 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "16px",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "6px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              color: theme.primary,
                              background: theme.accentSoft,
                              padding: "3px 10px",
                              borderRadius: "999px",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {job.department}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              color: job.is_active ? theme.success : theme.danger,
                              background: job.is_active ? theme.successSoft : theme.dangerSoft,
                              padding: "3px 10px",
                              borderRadius: "999px",
                            }}
                          >
                            {job.is_active ? "Live on Website" : "Draft / Hidden"}
                          </span>
                        </div>
                        <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>{job.title}</h3>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                          onClick={() => handleToggleStatus(job)}
                          title={job.is_active ? "Unpublish from website" : "Publish to website"}
                          style={{
                            ...s.btnGhost,
                            padding: "6px 12px",
                            fontSize: "12px",
                            color: job.is_active ? theme.danger : theme.success,
                            borderColor: job.is_active ? theme.dangerSoft : theme.successSoft,
                          }}
                        >
                          {job.is_active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                          {job.is_active ? "Unpublish" : "Publish"}
                        </button>

                        <button
                          onClick={() => handleOpenEdit(job)}
                          title="Edit Job Opening"
                          style={{ ...s.btnGhost, padding: "6px 10px" }}
                        >
                          <Edit2 size={14} />
                        </button>

                        <button
                          onClick={() => handleDeleteJob(job)}
                          title="Delete Job Opening"
                          style={{
                            ...s.btnGhost,
                            padding: "6px 10px",
                            color: theme.danger,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: theme.textMuted,
                        lineHeight: "1.5",
                      }}
                    >
                      {job.description}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "16px",
                        fontSize: "12px",
                        color: theme.textMuted,
                        paddingTop: "8px",
                        borderTop: `1px solid ${theme.panelBorder}`,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <MapPin size={14} color={theme.primary} />
                        {job.location}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Clock size={14} color={theme.primary} />
                        {job.type}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Building2 size={14} color={theme.primary} />
                        {job.experience}
                      </span>
                      {job.requirements && job.requirements.length > 0 && (
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <ListChecks size={14} color={theme.primary} />
                          {job.requirements.length} Requirements listed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Create / Edit Form */
          <div style={{ maxWidth: "680px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
              <button onClick={() => setViewMode("list")} style={s.btnGhost}>
                <ArrowLeft size={16} />
                Back to Openings
              </button>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>
                {viewMode === "create" ? "Post New Job Opening" : `Edit Opening: ${editingJob?.title}`}
              </h2>
            </div>

            <div style={s.card}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <label style={s.label}>Job Title *</label>
                  <input
                    style={s.input}
                    placeholder="e.g. Senior Fiber Network Engineer"
                    value={formState.title}
                    onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                  />
                </div>

                <div>
                  <label style={s.label}>Department Name *</label>
                  <input
                    style={s.input}
                    placeholder="e.g. Telecom Engineering"
                    value={formState.department}
                    onChange={(e) => setFormState({ ...formState, department: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <label style={s.label}>Category Filter *</label>
                  <select
                    style={{ ...s.input, appearance: "none", cursor: "pointer" }}
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                  >
                    {CATEGORIES.filter((c) => c.key !== "all").map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={s.label}>Location *</label>
                  <input
                    style={s.input}
                    placeholder="e.g. Kano, Nigeria / Remote"
                    value={formState.location}
                    onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <label style={s.label}>Employment Type *</label>
                  <select
                    style={{ ...s.input, appearance: "none", cursor: "pointer" }}
                    value={formState.type}
                    onChange={(e) => setFormState({ ...formState, type: e.target.value })}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Remote / Hybrid">Remote / Hybrid</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>

                <div>
                  <label style={s.label}>Experience Required *</label>
                  <input
                    style={s.input}
                    placeholder="e.g. 3+ Years"
                    value={formState.experience}
                    onChange={(e) => setFormState({ ...formState, experience: e.target.value })}
                  />
                </div>
              </div>

              <label style={s.label}>Job Summary / Overview *</label>
              <textarea
                rows={4}
                style={{ ...s.input, resize: "vertical" }}
                placeholder="Describe the main responsibilities, goals, and role overview..."
                value={formState.description}
                onChange={(e) => setFormState({ ...formState, description: e.target.value })}
              />

              <label style={s.label}>Key Requirements (One per line)</label>
              <textarea
                rows={5}
                style={{ ...s.input, resize: "vertical" }}
                placeholder="Degree in Computer Science or Telecom Engineering&#10;3+ years hands-on experience with GPON/BGP&#10;Strong communication skills"
                value={formState.requirementsText}
                onChange={(e) => setFormState({ ...formState, requirementsText: e.target.value })}
              />

              {error && (
                <div
                  style={{
                    background: theme.dangerSoft,
                    borderRadius: "10px",
                    padding: "12px 16px",
                    color: theme.danger,
                    fontSize: "13px",
                    marginBottom: "16px",
                  }}
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  style={{
                    background: theme.successSoft,
                    borderRadius: "10px",
                    padding: "12px 16px",
                    color: theme.success,
                    fontSize: "13px",
                    marginBottom: "16px",
                  }}
                >
                  {success}
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button
                  onClick={handleFormSubmit}
                  disabled={submitting || !formState.title || !formState.department || !formState.description}
                  style={{
                    ...s.btnPrimary,
                    flex: 1,
                    opacity: submitting || !formState.title || !formState.department || !formState.description ? 0.5 : 1,
                  }}
                >
                  <FileText size={18} />
                  {submitting ? "Saving..." : viewMode === "create" ? "Publish Job Opening" : "Update Job Opening"}
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        /* Applications Tab View */
        <>
          {/* Applications Controls Bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            {/* Search */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: theme.panelStrong,
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: "12px",
                padding: "0 14px",
                flex: "1 1 240px",
              }}
            >
              <Search size={16} color={theme.textMuted} style={{ marginRight: "10px" }} />
              <input
                type="text"
                placeholder="Search candidates by name, email, phone, or job..."
                value={appSearchQuery}
                onChange={(e) => setAppSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: theme.text,
                  padding: "10px 0",
                  fontSize: "13px",
                  outline: "none",
                  width: "100%",
                }}
              />
            </div>

            {/* Status Filter Pills */}
            <div
              style={{
                display: "flex",
                background: theme.panelMuted,
                border: `1px solid ${theme.panelBorder}`,
                borderRadius: "10px",
                padding: "3px",
              }}
            >
              {(["all", "pending", "reviewed", "shortlisted", "rejected"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setAppStatusFilter(st)}
                  style={{
                    background: appStatusFilter === st ? theme.panelStrong : "transparent",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    color: appStatusFilter === st ? theme.text : theme.textMuted,
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Applications List */}
          {appsLoading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: theme.textMuted }}>
              Loading applications...
            </div>
          ) : filteredApps.length === 0 ? (
            <div
              style={{
                ...s.card,
                textAlign: "center",
                padding: "60px 20px",
                color: theme.textMuted,
              }}
            >
              <Users size={48} strokeWidth={1} style={{ opacity: 0.3, marginBottom: "12px" }} />
              <h3 style={{ margin: "0 0 6px 0", color: theme.text }}>No Applications Received</h3>
              <p style={{ margin: 0, fontSize: "13px" }}>
                {appSearchQuery || appStatusFilter !== "all"
                  ? "Try adjusting your search or status filter."
                  : "Candidate applications submitted from the website will appear here in real-time."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {filteredApps.map((app) => {
                const badge = getStatusBadgeStyle(app.status);
                return (
                  <div
                    key={app.id}
                    style={{
                      ...s.card,
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "16px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                          <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>{app.full_name}</h3>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              color: badge.color,
                              background: badge.background,
                              padding: "3px 10px",
                              borderRadius: "999px",
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>

                        <div style={{ fontSize: "13px", color: theme.primary, fontWeight: "600" }}>
                          Applied for: {app.job_title}
                        </div>
                      </div>

                      {/* Status Selector & Actions */}
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <select
                          value={app.status}
                          onChange={(e) => handleUpdateAppStatus(app.id, e.target.value)}
                          title="Update Candidate Status"
                          style={{
                            ...s.btnGhost,
                            background: theme.panelStrong,
                            padding: "6px 10px",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          <option value="pending">Pending</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="shortlisted">Shortlisted</option>
                          <option value="rejected">Rejected</option>
                        </select>

                        <button
                          onClick={() => setSelectedAppModal(app)}
                          style={{ ...s.btnGhost, padding: "6px 12px", fontSize: "12px" }}
                        >
                          <Eye size={14} />
                          Details
                        </button>

                        {app.resume_filename && (
                          <a
                            href={getResumeUrl(app.resume_filename)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              ...s.btnPrimary,
                              padding: "6px 12px",
                              fontSize: "12px",
                              textDecoration: "none",
                            }}
                          >
                            <Download size={14} />
                            CV File
                          </a>
                        )}

                        <button
                          onClick={() => handleDeleteApp(app.id, app.full_name)}
                          title="Delete Application"
                          style={{ ...s.btnGhost, padding: "6px 10px", color: theme.danger }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Contacts */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "18px",
                        fontSize: "13px",
                        color: theme.textMuted,
                        paddingTop: "10px",
                        borderTop: `1px solid ${theme.panelBorder}`,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Mail size={14} color={theme.primary} />
                        <a href={`mailto:${app.email}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {app.email}
                        </a>
                      </span>

                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Phone size={14} color={theme.primary} />
                        <a href={`tel:${app.phone}`} style={{ color: "inherit", textDecoration: "none" }}>
                          {app.phone}
                        </a>
                      </span>

                      {app.portfolio_url && (
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <ExternalLink size={14} color={theme.primary} />
                          <a
                            href={app.portfolio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: theme.primary, textDecoration: "underline" }}
                          >
                            Portfolio / LinkedIn
                          </a>
                        </span>
                      )}

                      <span style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
                        <Clock size={14} color={theme.textMuted} />
                        {new Date(app.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedAppModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setSelectedAppModal(null)}
        >
          <div
            style={{
              ...s.card,
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
              background: theme.panel,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "19px", fontWeight: "700" }}>Application Details</h2>
              <button
                onClick={() => setSelectedAppModal(null)}
                style={{ ...s.btnGhost, padding: "6px 8px", border: "none" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "20px", fontWeight: "700", marginBottom: "2px" }}>
                {selectedAppModal.full_name}
              </div>
              <div style={{ color: theme.primary, fontWeight: "600", fontSize: "14px" }}>
                {selectedAppModal.job_title}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
              <div style={{ background: theme.panelStrong, padding: "10px 14px", borderRadius: "10px" }}>
                <span style={s.label}>Email Address</span>
                <div style={{ fontSize: "13px" }}>{selectedAppModal.email}</div>
              </div>
              <div style={{ background: theme.panelStrong, padding: "10px 14px", borderRadius: "10px" }}>
                <span style={s.label}>Phone Number</span>
                <div style={{ fontSize: "13px" }}>{selectedAppModal.phone}</div>
              </div>
            </div>

            {selectedAppModal.portfolio_url && (
              <div style={{ marginBottom: "18px" }}>
                <span style={s.label}>Portfolio / LinkedIn</span>
                <a
                  href={selectedAppModal.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: theme.primary, fontSize: "13px", wordBreak: "break-all" }}
                >
                  {selectedAppModal.portfolio_url}
                </a>
              </div>
            )}

            <div style={{ marginBottom: "18px" }}>
              <span style={s.label}>Cover Note / Summary</span>
              <div
                style={{
                  background: theme.panelStrong,
                  padding: "14px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  lineHeight: "1.6",
                  color: theme.text,
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedAppModal.cover_note || "No cover note provided by applicant."}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
              <div>
                <span style={s.label}>Status</span>
                <select
                  value={selectedAppModal.status}
                  onChange={(e) => handleUpdateAppStatus(selectedAppModal.id, e.target.value)}
                  style={{
                    ...s.input,
                    marginBottom: 0,
                    padding: "8px 12px",
                    width: "auto",
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {selectedAppModal.resume_filename ? (
                <a
                  href={getResumeUrl(selectedAppModal.resume_filename)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.btnPrimary}
                >
                  <Download size={16} />
                  Download Resume File
                </a>
              ) : (
                <div style={{ fontSize: "12px", color: theme.textMuted }}>No Resume file attached</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
