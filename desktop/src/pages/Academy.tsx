import { useState, useEffect, useCallback } from "react";
import {
  GraduationCap,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Users,
  Calendar,
  BookOpen,
  DollarSign,
  UserCheck,
  X,
  Radio,
  PlayCircle,
  Check,
} from "lucide-react";
import {
  getAcademyCourses,
  createAcademyCourse,
  updateAcademyCourse,
  toggleAcademyCourseStatus,
  deleteAcademyCourse,
  getAcademyEnrollments,
  updateAcademyEnrollmentStatus,
  deleteAcademyEnrollment,
} from "@/lib/api";
import type { AcademyCourse, AcademyEnrollment } from "@/lib/api";
import { theme } from "@/lib/theme";

type MainTab = "courses" | "enrollments";
type ViewMode = "list" | "create" | "edit";

const CATEGORIES = [
  { key: "all", label: "All Categories" },
  { key: "fiber", label: "Fiber Optics & FTTH" },
  { key: "networking", label: "Enterprise Routing & BGP" },
  { key: "wireless", label: "Wireless & 4G/LTE Radio" },
  { key: "telecoms", label: "VoIP & PBX Telephony" },
  { key: "software", label: "Linux & NOC Infrastructure" },
];

export default function Academy() {
  const [mainTab, setMainTab] = useState<MainTab>("courses");

  // Courses State
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingCourse, setEditingCourse] = useState<AcademyCourse | null>(null);

  // Filters for Courses
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form State for Courses
  const [formState, setFormState] = useState({
    title: "",
    code: "",
    category: "fiber",
    description: "",
    syllabusText: "",
    prerequisitesText: "",
    instructor: "",
    location: "Ratel Tech Campus, Kano",
    format: "Onsite",
    duration: "6 Weeks",
    schedule: "Mon, Wed & Fri (10:00 AM - 1:00 PM)",
    fee: "Free",
    status: "upcoming",
    start_date: "",
    end_date: "",
    capacity: 30,
  });

  // Enrollments State
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [enrollmentSearchQuery, setEnrollmentSearchQuery] = useState("");
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState<string>("all");
  const [selectedEnrollmentModal, setSelectedEnrollmentModal] = useState<AcademyEnrollment | null>(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAcademyCourses(undefined, undefined, undefined, false);
      setCourses(data);
    } catch (err) {
      console.error("Failed to load academy courses", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEnrollments = useCallback(async () => {
    setEnrollmentsLoading(true);
    try {
      const data = await getAcademyEnrollments();
      setEnrollments(data);
    } catch (err) {
      console.error("Failed to load student enrollments", err);
    } finally {
      setEnrollmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
    fetchEnrollments();
  }, [fetchCourses, fetchEnrollments]);

  // Handle Form open for Add
  const handleOpenCreate = () => {
    setEditingCourse(null);
    setFormState({
      title: "",
      code: "",
      category: "fiber",
      description: "",
      syllabusText: "",
      prerequisitesText: "",
      instructor: "",
      location: "Ratel Tech Campus, Kano",
      format: "Onsite",
      duration: "6 Weeks",
      schedule: "Mon, Wed & Fri (10:00 AM - 1:00 PM)",
      fee: "₦45,000",
      status: "upcoming",
      start_date: "",
      end_date: "",
      capacity: 25,
    });
    setError("");
    setSuccess("");
    setViewMode("create");
  };

  // Handle Form open for Edit
  const handleOpenEdit = (course: AcademyCourse) => {
    setEditingCourse(course);
    setFormState({
      title: course.title,
      code: course.code || "",
      category: course.category,
      description: course.description,
      syllabusText: (course.syllabus || []).join("\n"),
      prerequisitesText: (course.prerequisites || []).join("\n"),
      instructor: course.instructor || "",
      location: course.location,
      format: course.format || "Onsite",
      duration: course.duration,
      schedule: course.schedule || "",
      fee: course.fee || "Free",
      status: course.status,
      start_date: course.start_date || "",
      end_date: course.end_date || "",
      capacity: course.capacity || 30,
    });
    setError("");
    setSuccess("");
    setViewMode("edit");
  };

  // Submit Course Form (Create / Update)
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const syllabusArray = formState.syllabusText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const prerequisitesArray = formState.prerequisitesText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      if (viewMode === "edit" && editingCourse) {
        await updateAcademyCourse(editingCourse.id, {
          title: formState.title,
          code: formState.code || null,
          category: formState.category,
          description: formState.description,
          syllabus: syllabusArray,
          prerequisites: prerequisitesArray,
          instructor: formState.instructor || null,
          location: formState.location,
          format: formState.format,
          duration: formState.duration,
          schedule: formState.schedule || null,
          fee: formState.fee,
          status: formState.status,
          start_date: formState.start_date || null,
          end_date: formState.end_date || null,
          capacity: Number(formState.capacity) || 30,
        });
        setSuccess("Course updated successfully!");
      } else {
        await createAcademyCourse({
          title: formState.title,
          code: formState.code || null,
          category: formState.category,
          description: formState.description,
          syllabus: syllabusArray,
          prerequisites: prerequisitesArray,
          instructor: formState.instructor || null,
          location: formState.location,
          format: formState.format,
          duration: formState.duration,
          schedule: formState.schedule || null,
          fee: formState.fee,
          status: formState.status,
          start_date: formState.start_date || null,
          end_date: formState.end_date || null,
          capacity: Number(formState.capacity) || 30,
        });
        setSuccess("New course published to website Academy page!");
      }

      await fetchCourses();
      setViewMode("list");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || "Failed to save course. Check fields and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle active status (publish/unpublish)
  const handleToggleActive = async (id: string) => {
    try {
      await toggleAcademyCourseStatus(id);
      await fetchCourses();
    } catch (err) {
      console.error("Failed to toggle course visibility", err);
    }
  };

  // Quick switch status (e.g. from upcoming to ongoing)
  const handleQuickStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateAcademyCourse(id, { status: newStatus });
      await fetchCourses();
    } catch (err) {
      console.error("Failed to update course status", err);
    }
  };

  // Delete Course
  const handleDeleteCourse = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete course "${title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteAcademyCourse(id);
      await fetchCourses();
    } catch (err) {
      console.error("Failed to delete course", err);
    }
  };

  // Update Enrollment Status
  const handleUpdateEnrollmentStatus = async (id: string, newStatus: string) => {
    try {
      await updateAcademyEnrollmentStatus(id, newStatus);
      if (selectedEnrollmentModal && selectedEnrollmentModal.id === id) {
        setSelectedEnrollmentModal({ ...selectedEnrollmentModal, status: newStatus });
      }
      await fetchEnrollments();
    } catch (err) {
      console.error("Failed to update student enrollment status", err);
    }
  };

  // Delete Enrollment
  const handleDeleteEnrollment = async (id: string) => {
    if (!window.confirm("Delete this student application record?")) return;
    try {
      await deleteAcademyEnrollment(id);
      if (selectedEnrollmentModal && selectedEnrollmentModal.id === id) {
        setSelectedEnrollmentModal(null);
      }
      await fetchEnrollments();
    } catch (err) {
      console.error("Failed to delete enrollment", err);
    }
  };

  // Stats calculation
  const totalCourses = courses.length;
  const ongoingCourses = courses.filter((c) => c.status === "ongoing").length;
  const upcomingCourses = courses.filter((c) => c.status === "upcoming" || c.status === "registration_open").length;
  const totalEnrollments = enrollments.length;

  // Filtered Courses
  const filteredCourses = courses.filter((c) => {
    const matchesCategory = selectedCategory === "all" || c.category === selectedCategory;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && c.is_active) ||
      (statusFilter === "inactive" && !c.is_active) ||
      c.status === statusFilter;
    const matchesQuery =
      searchQuery.trim() === "" ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.instructor && c.instructor.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesStatus && matchesQuery;
  });

  // Filtered Enrollments
  const filteredEnrollments = enrollments.filter((e) => {
    const matchesStatus = enrollmentStatusFilter === "all" || e.status === enrollmentStatusFilter;
    const matchesQuery =
      enrollmentSearchQuery.trim() === "" ||
      e.full_name.toLowerCase().includes(enrollmentSearchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(enrollmentSearchQuery.toLowerCase()) ||
      e.phone.includes(enrollmentSearchQuery.trim()) ||
      e.course_title.toLowerCase().includes(enrollmentSearchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ongoing":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              background: "#fef3c7",
              color: "#92400e",
              border: "1px solid #fde68a",
            }}
          >
            <Radio size={12} className="animate-pulse" />
            Ongoing Course
          </span>
        );
      case "registration_open":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              background: "#dcfce7",
              color: "#166534",
              border: "1px solid #bbf7d0",
            }}
          >
            <Check size={12} />
            Registration Open
          </span>
        );
      case "upcoming":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              background: "#e0f2fe",
              color: "#0369a1",
              border: "1px solid #bae6fd",
            }}
          >
            <Calendar size={12} />
            Starting Soon
          </span>
        );
      case "completed":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              background: "#f1f5f9",
              color: "#475569",
              border: "1px solid #e2e8f0",
            }}
          >
            <CheckCircle2 size={12} />
            Completed
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 700,
              background: "#f3f4f6",
              color: "#374151",
            }}
          >
            {status}
          </span>
        );
    }
  };

  return (
    <div
      style={{
        flex: 1,
        height: "100vh",
        overflowY: "auto",
        padding: "24px 32px",
        background: theme.page,
        fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #0f4f9d 0%, #2f7de1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                boxShadow: "0 6px 16px rgba(15, 79, 157, 0.25)",
              }}
            >
              <GraduationCap size={22} />
            </div>
            <h1 style={{ fontSize: "26px", fontWeight: "800", color: theme.text, margin: 0 }}>
              Ratel Academy Management
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: "14px", color: theme.textMuted }}>
            Create and manage telecom & IT courses that publish directly to the Ratel Plus website.
          </p>
        </div>

        {viewMode === "list" && (
          <button
            onClick={handleOpenCreate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              background: "linear-gradient(135deg, #0f4f9d 0%, #2f7de1 100%)",
              color: "white",
              borderRadius: "12px",
              border: "none",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(15, 79, 157, 0.25)",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <Plus size={18} />
            Add New Course
          </button>
        )}
      </div>

      {/* Notifications */}
      {success && (
        <div
          style={{
            padding: "12px 16px",
            background: "#ecfdf5",
            border: "1px solid #10b981",
            color: "#065f46",
            borderRadius: "10px",
            marginBottom: "20px",
            fontSize: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{success}</span>
          <button onClick={() => setSuccess("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#065f46" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fef2f2",
            border: "1px solid #ef4444",
            color: "#991b1b",
            borderRadius: "10px",
            marginBottom: "20px",
            fontSize: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: theme.panel,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: "14px",
            padding: "18px 20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: theme.textMuted }}>Total Courses</span>
            <BookOpen size={18} color={theme.primary} />
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: theme.text, marginTop: "8px" }}>
            {totalCourses}
          </div>
        </div>

        <div
          style={{
            background: theme.panel,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: "14px",
            padding: "18px 20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#b45309" }}>Ongoing Batches</span>
            <PlayCircle size={18} color="#b45309" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "#b45309", marginTop: "8px" }}>
            {ongoingCourses}
          </div>
        </div>

        <div
          style={{
            background: theme.panel,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: "14px",
            padding: "18px 20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#0369a1" }}>Upcoming / Open</span>
            <Calendar size={18} color="#0369a1" />
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "#0369a1", marginTop: "8px" }}>
            {upcomingCourses}
          </div>
        </div>

        <div
          style={{
            background: theme.panel,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: "14px",
            padding: "18px 20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: theme.textMuted }}>Student Applications</span>
            <UserCheck size={18} color={theme.accent} />
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: theme.text, marginTop: "8px" }}>
            {totalEnrollments}
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: `1px solid ${theme.panelBorder}`,
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => {
            setMainTab("courses");
            setViewMode("list");
          }}
          style={{
            padding: "10px 20px",
            border: "none",
            borderBottom: mainTab === "courses" ? `3px solid ${theme.primary}` : "3px solid transparent",
            background: "none",
            fontSize: "14px",
            fontWeight: mainTab === "courses" ? "700" : "500",
            color: mainTab === "courses" ? theme.primary : theme.textMuted,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <BookOpen size={16} />
          Courses & Programs ({courses.length})
        </button>

        <button
          onClick={() => {
            setMainTab("enrollments");
            setViewMode("list");
          }}
          style={{
            padding: "10px 20px",
            border: "none",
            borderBottom: mainTab === "enrollments" ? `3px solid ${theme.primary}` : "3px solid transparent",
            background: "none",
            fontSize: "14px",
            fontWeight: mainTab === "enrollments" ? "700" : "500",
            color: mainTab === "enrollments" ? theme.primary : theme.textMuted,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Users size={16} />
          Student Applications ({enrollments.length})
        </button>
      </div>

      {/* ============================================================== */}
      {/* COURSES TAB */}
      {/* ============================================================== */}
      {mainTab === "courses" && viewMode === "list" && (
        <>
          {/* Filters Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
              background: theme.panel,
              padding: "12px 16px",
              borderRadius: "12px",
              border: `1px solid ${theme.panelBorder}`,
            }}
          >
            {/* Search */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flex: 1,
                maxWidth: "340px",
                background: "#ffffff",
                padding: "8px 12px",
                borderRadius: "8px",
                border: `1px solid ${theme.panelBorder}`,
              }}
            >
              <Search size={16} color={theme.textMuted} />
              <input
                type="text"
                placeholder="Search courses, instructors, codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  width: "100%",
                  fontSize: "13px",
                  color: theme.text,
                }}
              />
            </div>

            {/* Category Filter */}
            <div style={{ display: "flex", gap: "10px" }}>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: `1px solid ${theme.panelBorder}`,
                  background: "#ffffff",
                  fontSize: "13px",
                  color: theme.text,
                  outline: "none",
                  fontWeight: "500",
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.label}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: `1px solid ${theme.panelBorder}`,
                  background: "#ffffff",
                  fontSize: "13px",
                  color: theme.text,
                  outline: "none",
                  fontWeight: "500",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="ongoing">Ongoing Classes</option>
                <option value="registration_open">Registration Open</option>
                <option value="upcoming">Starting Soon / Upcoming</option>
                <option value="completed">Completed</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive / Hidden</option>
              </select>
            </div>
          </div>

          {/* Courses List */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: theme.textMuted }}>
              Loading academy courses...
            </div>
          ) : filteredCourses.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: theme.panel,
                borderRadius: "14px",
                border: `1px solid ${theme.panelBorder}`,
              }}
            >
              <BookOpen size={40} color={theme.textMuted} style={{ marginBottom: "12px", opacity: 0.5 }} />
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: theme.text, margin: "0 0 6px 0" }}>
                No courses found
              </h3>
              <p style={{ fontSize: "13px", color: theme.textMuted, margin: "0 0 16px 0" }}>
                Try adjusting your search filters or click "Add New Course" to create one.
              </p>
              <button
                onClick={handleOpenCreate}
                style={{
                  padding: "8px 16px",
                  background: theme.primary,
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Add New Course
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "16px" }}>
              {filteredCourses.map((course) => (
                <div
                  key={course.id}
                  style={{
                    background: theme.panelStrong,
                    border: `1px solid ${course.is_active ? theme.panelBorder : "#e5e7eb"}`,
                    borderRadius: "14px",
                    padding: "20px",
                    boxShadow: "0 4px 14px rgba(12, 54, 110, 0.05)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    opacity: course.is_active ? 1 : 0.65,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div>
                    {/* Top Badges */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {getStatusBadge(course.status)}
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 600,
                            background: "#f1f5f9",
                            color: "#475569",
                          }}
                        >
                          {course.format}
                        </span>
                      </div>
                      {course.code && (
                        <span style={{ fontSize: "11px", fontWeight: "700", color: theme.textMuted, background: "#e2e8f0", padding: "2px 8px", borderRadius: "6px" }}>
                          {course.code}
                        </span>
                      )}
                    </div>

                    {/* Course Title */}
                    <h3 style={{ fontSize: "16px", fontWeight: "800", color: theme.text, margin: "0 0 8px 0", lineHeight: "1.3" }}>
                      {course.title}
                    </h3>

                    {/* Description */}
                    <p
                      style={{
                        fontSize: "13px",
                        color: theme.textMuted,
                        margin: "0 0 14px 0",
                        lineHeight: "1.5",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {course.description}
                    </p>

                    {/* Info Grid */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "8px",
                        background: "#f8fafc",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        marginBottom: "14px",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: theme.textMuted }}>
                        <Clock size={14} color={theme.primary} />
                        <span>{course.duration}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: theme.textMuted }}>
                        <DollarSign size={14} color="#16a34a" />
                        <span style={{ fontWeight: 700, color: "#16a34a" }}>{course.fee}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: theme.textMuted }}>
                        <MapPin size={14} color="#dc2626" />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {course.location}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: theme.textMuted }}>
                        <Users size={14} color={theme.accent} />
                        <span>
                          <strong>{course.enrolled_count}</strong> / {course.capacity || 30} Enrolled
                        </span>
                      </div>
                    </div>

                    {/* Instructor */}
                    {course.instructor && (
                      <div style={{ fontSize: "12px", color: theme.textMuted, marginBottom: "12px" }}>
                        <span style={{ fontWeight: "600", color: theme.text }}>Trainer:</span> {course.instructor}
                      </div>
                    )}

                    {/* Quick Status Pill Bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
                      <span style={{ fontSize: "11px", color: theme.textMuted, fontWeight: "600" }}>Set Status:</span>
                      {(["upcoming", "ongoing", "registration_open", "completed"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => handleQuickStatusChange(course.id, st)}
                          style={{
                            padding: "3px 8px",
                            fontSize: "10px",
                            borderRadius: "6px",
                            border: course.status === st ? `1px solid ${theme.primary}` : "1px solid #e2e8f0",
                            background: course.status === st ? theme.primarySoft : "#ffffff",
                            color: course.status === st ? theme.primary : "#64748b",
                            cursor: "pointer",
                            fontWeight: course.status === st ? "700" : "500",
                          }}
                        >
                          {st === "upcoming"
                            ? "Upcoming"
                            : st === "ongoing"
                            ? "Ongoing"
                            : st === "registration_open"
                            ? "Open"
                            : "Done"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderTop: "1px solid #f1f5f9",
                      paddingTop: "12px",
                      marginTop: "8px",
                    }}
                  >
                    {/* Toggle Active / Website Visible */}
                    <button
                      onClick={() => handleToggleActive(course.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "none",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: "600",
                        color: course.is_active ? "#15803d" : "#94a3b8",
                        cursor: "pointer",
                      }}
                      title="Toggle visibility on website"
                    >
                      {course.is_active ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      {course.is_active ? "Live on Website" : "Hidden"}
                    </button>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleOpenEdit(course)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: `1px solid ${theme.panelBorder}`,
                          background: "#ffffff",
                          color: theme.primary,
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        <Edit2 size={13} />
                        Edit
                      </button>

                      <button
                        onClick={() => handleDeleteCourse(course.id, course.title)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid #fee2e2",
                          background: "#fff5f5",
                          color: "#dc2626",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ============================================================== */}
      {/* CREATE / EDIT COURSE FORM */}
      {/* ============================================================== */}
      {mainTab === "courses" && (viewMode === "create" || viewMode === "edit") && (
        <div
          style={{
            background: theme.panelStrong,
            borderRadius: "16px",
            border: `1px solid ${theme.panelBorder}`,
            padding: "24px 32px",
            maxWidth: "800px",
            margin: "0 auto",
            boxShadow: theme.shadow,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: theme.text, margin: 0 }}>
              {viewMode === "edit" ? "Edit Academy Course" : "Publish New Course to Website"}
            </h2>
            <button
              onClick={() => setViewMode("list")}
              style={{
                background: "none",
                border: "none",
                fontSize: "13px",
                fontWeight: "600",
                color: theme.textMuted,
                cursor: "pointer",
              }}
            >
              Cancel & Return
            </button>
          </div>

          <form onSubmit={handleSaveCourse}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fiber Optic Fusion Splicing & FTTH Engineering"
                  value={formState.title}
                  onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Course Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. RATEL-FBE-101"
                  value={formState.code}
                  onChange={(e) => setFormState({ ...formState, code: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Category *
                </label>
                <select
                  value={formState.category}
                  onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    background: "white",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="fiber">Fiber Optics & FTTH</option>
                  <option value="networking">Enterprise Routing & BGP</option>
                  <option value="wireless">Wireless & 4G/LTE Radio</option>
                  <option value="telecoms">VoIP & PBX Telephony</option>
                  <option value="software">Linux & NOC Infrastructure</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Current Status *
                </label>
                <select
                  value={formState.status}
                  onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    background: "white",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="upcoming">Upcoming (Starting Soon)</option>
                  <option value="ongoing">Ongoing Course</option>
                  <option value="registration_open">Registration Open</option>
                  <option value="completed">Completed Batch</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Class Format *
                </label>
                <select
                  value={formState.format}
                  onChange={(e) => setFormState({ ...formState, format: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    background: "white",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="Onsite">Onsite (Hands-on Lab)</option>
                  <option value="Online">Online (Live Virtual)</option>
                  <option value="Hybrid">Hybrid (Virtual + Lab)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Duration *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 6 Weeks or 3 Months"
                  value={formState.duration}
                  onChange={(e) => setFormState({ ...formState, duration: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Tuition Fee *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ₦45,000 or Free"
                  value={formState.fee}
                  onChange={(e) => setFormState({ ...formState, fee: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Max Student Capacity
                </label>
                <input
                  type="number"
                  placeholder="e.g. 25"
                  value={formState.capacity}
                  onChange={(e) => setFormState({ ...formState, capacity: Number(e.target.value) })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Start Date / Schedule
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nov 15, 2026 or Starting Immediately"
                  value={formState.start_date}
                  onChange={(e) => setFormState({ ...formState, start_date: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Schedule Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mon, Wed & Fri (10:00 AM - 1:00 PM)"
                  value={formState.schedule}
                  onChange={(e) => setFormState({ ...formState, schedule: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Instructor / Trainer
                </label>
                <input
                  type="text"
                  placeholder="e.g. Engr. Ahmed Bello (Senior Field Lead)"
                  value={formState.instructor}
                  onChange={(e) => setFormState({ ...formState, instructor: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Venue / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ratel Tech Campus, Kano"
                  value={formState.location}
                  onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                Course Description *
              </label>
              <textarea
                required
                rows={4}
                placeholder="Detailed overview of what students will learn, practical hands-on labs, equipment utilized, and career outcomes..."
                value={formState.description}
                onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: `1px solid ${theme.panelBorder}`,
                  fontSize: "14px",
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", marginBottom: "24px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Syllabus / Modules (One item per line)
                </label>
                <textarea
                  rows={5}
                  placeholder={"Module 1: Principles & Standards\nModule 2: Practical Fusion Splicing Lab\nModule 3: OTDR Testing & Power Meters"}
                  value={formState.syllabusText}
                  onChange={(e) => setFormState({ ...formState, syllabusText: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "13px",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", marginBottom: "6px", color: theme.text }}>
                  Prerequisites / Requirements (One item per line)
                </label>
                <textarea
                  rows={5}
                  placeholder={"Basic technical understanding\nSecondary school or tertiary certificate\nPersonal laptop for simulations"}
                  value={formState.prerequisitesText}
                  onChange={(e) => setFormState({ ...formState, prerequisitesText: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    fontSize: "13px",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: `1px solid ${theme.panelBorder}`,
                  background: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: theme.textMuted,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "10px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: theme.primary,
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "white",
                  cursor: submitting ? "not-allowed" : "pointer",
                  boxShadow: "0 6px 16px rgba(15, 79, 157, 0.25)",
                }}
              >
                {submitting ? "Saving..." : viewMode === "edit" ? "Save Changes" : "Publish Course to Website"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============================================================== */}
      {/* STUDENT ENROLLMENTS TAB */}
      {/* ============================================================== */}
      {mainTab === "enrollments" && (
        <div>
          {/* Filters Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              marginBottom: "20px",
              background: theme.panel,
              padding: "12px 16px",
              borderRadius: "12px",
              border: `1px solid ${theme.panelBorder}`,
            }}
          >
            {/* Search */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flex: 1,
                maxWidth: "340px",
                background: "#ffffff",
                padding: "8px 12px",
                borderRadius: "8px",
                border: `1px solid ${theme.panelBorder}`,
              }}
            >
              <Search size={16} color={theme.textMuted} />
              <input
                type="text"
                placeholder="Search students, emails, courses..."
                value={enrollmentSearchQuery}
                onChange={(e) => setEnrollmentSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  width: "100%",
                  fontSize: "13px",
                  color: theme.text,
                }}
              />
            </div>

            {/* Status Filter */}
            <select
              value={enrollmentStatusFilter}
              onChange={(e) => setEnrollmentStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: `1px solid ${theme.panelBorder}`,
                background: "#ffffff",
                fontSize: "13px",
                color: theme.text,
                outline: "none",
                fontWeight: "500",
              }}
            >
              <option value="all">All Application Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="confirmed">Confirmed / Enrolled</option>
              <option value="waitlist">Waitlist</option>
              <option value="cancelled">Cancelled / Rejected</option>
            </select>
          </div>

          {/* Table */}
          {enrollmentsLoading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: theme.textMuted }}>
              Loading student applications...
            </div>
          ) : filteredEnrollments.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: theme.panel,
                borderRadius: "14px",
                border: `1px solid ${theme.panelBorder}`,
              }}
            >
              <Users size={40} color={theme.textMuted} style={{ marginBottom: "12px", opacity: 0.5 }} />
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: theme.text, margin: "0 0 6px 0" }}>
                No student applications found
              </h3>
              <p style={{ fontSize: "13px", color: theme.textMuted, margin: 0 }}>
                When students apply for courses on the Ratel Plus Academy website, their details appear here.
              </p>
            </div>
          ) : (
            <div
              style={{
                background: theme.panelStrong,
                borderRadius: "14px",
                border: `1px solid ${theme.panelBorder}`,
                overflow: "hidden",
                boxShadow: "0 4px 14px rgba(12, 54, 110, 0.04)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "12px 16px", fontWeight: "700", color: theme.textMuted }}>Student Name</th>
                    <th style={{ padding: "12px 16px", fontWeight: "700", color: theme.textMuted }}>Course Applied</th>
                    <th style={{ padding: "12px 16px", fontWeight: "700", color: theme.textMuted }}>Contact Details</th>
                    <th style={{ padding: "12px 16px", fontWeight: "700", color: theme.textMuted }}>Status</th>
                    <th style={{ padding: "12px 16px", fontWeight: "700", color: theme.textMuted }}>Date Applied</th>
                    <th style={{ padding: "12px 16px", fontWeight: "700", color: theme.textMuted, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnrollments.map((enr) => (
                    <tr key={enr.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: "700", color: theme.text }}>{enr.full_name}</div>
                        {enr.education_level && (
                          <div style={{ fontSize: "11px", color: theme.textMuted }}>{enr.education_level}</div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: "600", color: theme.primary }}>{enr.course_title}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div>{enr.email}</div>
                        <div style={{ fontSize: "12px", color: theme.textMuted }}>{enr.phone}</div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "16px",
                            fontSize: "11px",
                            fontWeight: "700",
                            background:
                              enr.status === "confirmed"
                                ? "#dcfce7"
                                : enr.status === "pending"
                                ? "#fef3c7"
                                : enr.status === "waitlist"
                                ? "#e0f2fe"
                                : "#fee2e2",
                            color:
                              enr.status === "confirmed"
                                ? "#166534"
                                : enr.status === "pending"
                                ? "#92400e"
                                : enr.status === "waitlist"
                                ? "#0369a1"
                                : "#991b1b",
                          }}
                        >
                          {enr.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", color: theme.textMuted, fontSize: "12px" }}>
                        {new Date(enr.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            onClick={() => setSelectedEnrollmentModal(enr)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              border: `1px solid ${theme.panelBorder}`,
                              background: "#ffffff",
                              color: theme.primary,
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            Details
                          </button>

                          {enr.status !== "confirmed" && (
                            <button
                              onClick={() => handleUpdateEnrollmentStatus(enr.id, "confirmed")}
                              style={{
                                padding: "5px 10px",
                                borderRadius: "6px",
                                border: "none",
                                background: "#15803d",
                                color: "white",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                              title="Approve / Confirm Enrollment"
                            >
                              Confirm
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteEnrollment(enr.id)}
                            style={{
                              padding: "5px 8px",
                              borderRadius: "6px",
                              border: "1px solid #fee2e2",
                              background: "#fff5f5",
                              color: "#dc2626",
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Enrollment Detail Modal */}
      {selectedEnrollmentModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(10, 25, 47, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSelectedEnrollmentModal(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px 30px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "800", color: theme.text, margin: 0 }}>
                Student Application Details
              </h3>
              <button
                onClick={() => setSelectedEnrollmentModal(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
              <div>
                <span style={{ fontWeight: "700", color: theme.textMuted, display: "block" }}>Full Name</span>
                <span style={{ fontSize: "15px", fontWeight: "700", color: theme.text }}>
                  {selectedEnrollmentModal.full_name}
                </span>
              </div>

              <div>
                <span style={{ fontWeight: "700", color: theme.textMuted, display: "block" }}>Course</span>
                <span style={{ fontSize: "14px", fontWeight: "600", color: theme.primary }}>
                  {selectedEnrollmentModal.course_title}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <span style={{ fontWeight: "700", color: theme.textMuted, display: "block" }}>Email</span>
                  <a href={`mailto:${selectedEnrollmentModal.email}`} style={{ color: theme.accent, textDecoration: "none" }}>
                    {selectedEnrollmentModal.email}
                  </a>
                </div>
                <div>
                  <span style={{ fontWeight: "700", color: theme.textMuted, display: "block" }}>Phone Number</span>
                  <a href={`tel:${selectedEnrollmentModal.phone}`} style={{ color: theme.accent, textDecoration: "none" }}>
                    {selectedEnrollmentModal.phone}
                  </a>
                </div>
              </div>

              {selectedEnrollmentModal.education_level && (
                <div>
                  <span style={{ fontWeight: "700", color: theme.textMuted, display: "block" }}>Educational Background</span>
                  <span>{selectedEnrollmentModal.education_level}</span>
                </div>
              )}

              {selectedEnrollmentModal.notes && (
                <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                  <span style={{ fontWeight: "700", color: theme.textMuted, display: "block", marginBottom: "4px" }}>
                    Applicant Statement / Notes:
                  </span>
                  <p style={{ margin: 0, color: theme.text, lineHeight: "1.4" }}>{selectedEnrollmentModal.notes}</p>
                </div>
              )}

              {/* Status Update Actions */}
              <div style={{ marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
                <span style={{ fontWeight: "700", color: theme.text, display: "block", marginBottom: "8px" }}>
                  Update Application Status:
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["pending", "confirmed", "waitlist", "cancelled"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleUpdateEnrollmentStatus(selectedEnrollmentModal.id, s)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: "600",
                        borderRadius: "8px",
                        border: selectedEnrollmentModal.status === s ? `2px solid ${theme.primary}` : "1px solid #e2e8f0",
                        background: selectedEnrollmentModal.status === s ? theme.primarySoft : "#ffffff",
                        color: selectedEnrollmentModal.status === s ? theme.primary : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
