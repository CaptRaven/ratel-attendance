import { useState, useEffect, useCallback, useRef } from "react";
import {
  Newspaper,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  Calendar,
  User,
  Clock,
  Upload,
  X,
} from "lucide-react";
import {
  getMediaPosts,
  createMediaPost,
  updateMediaPost,
  toggleMediaPostPublish,
  deleteMediaPost,
  uploadMediaImage,
} from "@/lib/api";
import type { MediaPost } from "@/lib/api";
import { theme } from "@/lib/theme";

type ViewMode = "list" | "create" | "edit";

const CATEGORIES = [
  { key: "all", label: "All Categories" },
  { key: "News", label: "Company News" },
  { key: "Press Release", label: "Press Release" },
  { key: "Infrastructure & Fiber", label: "Infrastructure & Fiber" },
  { key: "Product Launch", label: "Product Launch" },
  { key: "Wireless & LTE", label: "Wireless & LTE" },
  { key: "Academy & Training", label: "Academy & Training" },
  { key: "Community", label: "Community & Events" },
];

export const getMediaImageUrl = (url?: string | null) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/static/")) {
    return `https://attendance.ratelplus.net.ng${url}`;
  }
  return url;
};

function PostThumbnail({ src, title }: { src?: string | null; title: string }) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = getMediaImageUrl(src);

  if (!imageUrl || hasError) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, rgba(15, 79, 157, 0.1) 0%, rgba(37, 99, 235, 0.15) 100%)",
        }}
      >
        <Newspaper size={28} style={{ color: theme.primary, opacity: 0.8 }} />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={title}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
      onError={() => setHasError(true)}
    />
  );
}

export default function Media() {
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingPost, setEditingPost] = useState<MediaPost | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form State
  const [formState, setFormState] = useState({
    title: "",
    slug: "",
    category: "News",
    summary: "",
    content: "",
    featured_image: "",
    author: "Ratel Media Team",
    read_time: "3 min read",
    tagsText: "",
    is_published: true,
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMediaPosts(undefined, undefined, false, 100);
      setPosts(data);
    } catch (err) {
      console.error("Failed to load media posts", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Handle Form open for Add
  const handleOpenCreate = () => {
    setEditingPost(null);
    setFormState({
      title: "",
      slug: "",
      category: "News",
      summary: "",
      content: "",
      featured_image: "",
      author: "Ratel Media Team",
      read_time: "3 min read",
      tagsText: "",
      is_published: true,
    });
    setError("");
    setSuccess("");
    setViewMode("create");
  };

  // Handle Form open for Edit
  const handleOpenEdit = (post: MediaPost) => {
    setEditingPost(post);
    setFormState({
      title: post.title,
      slug: post.slug,
      category: post.category,
      summary: post.summary,
      content: post.content,
      featured_image: post.featured_image || "",
      author: post.author,
      read_time: post.read_time,
      tagsText: (post.tags || []).join(", "),
      is_published: post.is_published,
    });
    setError("");
    setSuccess("");
    setViewMode("edit");
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError("");
    try {
      const res = await uploadMediaImage(file);
      setFormState((prev) => ({ ...prev, featured_image: res.url }));
      setSuccess("Image uploaded successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Upload error", err);
      setError(err?.response?.data?.detail || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title.trim()) {
      setError("Article title is required");
      return;
    }
    if (!formState.summary.trim()) {
      setError("Summary excerpt is required");
      return;
    }
    if (!formState.content.trim()) {
      setError("Article body content is required");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    const tags = formState.tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (viewMode === "create") {
        await createMediaPost({
          title: formState.title.trim(),
          slug: formState.slug.trim() || undefined,
          category: formState.category,
          summary: formState.summary.trim(),
          content: formState.content.trim(),
          featured_image: formState.featured_image.trim() || null,
          author: formState.author.trim() || "Ratel Media Team",
          read_time: formState.read_time.trim() || "3 min read",
          tags,
          is_published: formState.is_published,
        });
        setSuccess("Article created and published successfully!");
      } else if (viewMode === "edit" && editingPost) {
        await updateMediaPost(editingPost.id, {
          title: formState.title.trim(),
          slug: formState.slug.trim() || undefined,
          category: formState.category,
          summary: formState.summary.trim(),
          content: formState.content.trim(),
          featured_image: formState.featured_image.trim() || null,
          author: formState.author.trim() || "Ratel Media Team",
          read_time: formState.read_time.trim() || "3 min read",
          tags,
          is_published: formState.is_published,
        });
        setSuccess("Article updated successfully!");
      }

      await fetchPosts();
      setTimeout(() => {
        setViewMode("list");
        setSuccess("");
      }, 1000);
    } catch (err: any) {
      console.error("Submit error", err);
      setError(err?.response?.data?.detail || "Failed to save article");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (id: string) => {
    try {
      await toggleMediaPostPublish(id);
      await fetchPosts();
    } catch (err) {
      console.error("Toggle publish failed", err);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deleteMediaPost(id);
      await fetchPosts();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  // Filtered posts
  const filteredPosts = posts.filter((p) => {
    const matchesSearch =
      !searchQuery.trim() ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.author.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || p.category.toLowerCase() === categoryFilter.toLowerCase();

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" && p.is_published) ||
      (statusFilter === "draft" && !p.is_published);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Calculate Metrics
  const totalArticles = posts.length;
  const publishedCount = posts.filter((p) => p.is_published).length;
  const draftCount = posts.filter((p) => !p.is_published).length;
  const totalViews = posts.reduce((sum, p) => sum + (p.views_count || 0), 0);

  return (
    <div
      style={{
        padding: "32px",
        overflowY: "auto",
        height: "100%",
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "26px",
              fontWeight: "700",
              color: theme.text,
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Newspaper style={{ color: theme.primary }} size={28} />
            Ratel Media & News Management
          </h1>
          <p style={{ margin: "4px 0 0", color: theme.textMuted, fontSize: "14px" }}>
            Publish news, press releases, company stories, and blog updates directly to the website.
          </p>
        </div>

        {viewMode === "list" ? (
          <button
            onClick={handleOpenCreate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: theme.primary,
              color: "white",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(15, 79, 157, 0.25)",
            }}
          >
            <Plus size={18} />
            Publish New Article
          </button>
        ) : (
          <button
            onClick={() => setViewMode("list")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "transparent",
              color: theme.textMuted,
              border: `1px solid ${theme.panelBorder}`,
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            <X size={16} />
            Back to Articles
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            background: theme.panel,
            padding: "20px",
            borderRadius: "12px",
            border: `1px solid ${theme.panelBorder}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: theme.textMuted, fontSize: "13px" }}>
            <span>Total Publications</span>
            <Newspaper size={18} style={{ color: theme.primary }} />
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: theme.text, marginTop: "8px" }}>
            {totalArticles}
          </div>
        </div>

        <div
          style={{
            background: theme.panel,
            padding: "20px",
            borderRadius: "12px",
            border: `1px solid ${theme.panelBorder}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: theme.textMuted, fontSize: "13px" }}>
            <span>Published (Live)</span>
            <CheckCircle2 size={18} style={{ color: theme.success }} />
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: theme.success, marginTop: "8px" }}>
            {publishedCount}
          </div>
        </div>

        <div
          style={{
            background: theme.panel,
            padding: "20px",
            borderRadius: "12px",
            border: `1px solid ${theme.panelBorder}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: theme.textMuted, fontSize: "13px" }}>
            <span>Drafts / Unpublished</span>
            <XCircle size={18} style={{ color: theme.warning }} />
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: theme.warning, marginTop: "8px" }}>
            {draftCount}
          </div>
        </div>

        <div
          style={{
            background: theme.panel,
            padding: "20px",
            borderRadius: "12px",
            border: `1px solid ${theme.panelBorder}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: theme.textMuted, fontSize: "13px" }}>
            <span>Total Page Views</span>
            <Eye size={18} style={{ color: theme.accent }} />
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: theme.accent, marginTop: "8px" }}>
            {totalViews.toLocaleString()}
          </div>
        </div>
      </div>

      {/* VIEW MODE: CREATE OR EDIT FORM */}
      {viewMode !== "list" ? (
        <div
          style={{
            background: theme.panel,
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: "12px",
            padding: "28px",
            maxWidth: "900px",
            margin: "0 auto 40px",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: "700", color: theme.text, marginTop: 0, marginBottom: "20px" }}>
            {viewMode === "create" ? "Create New Media & Blog Post" : `Edit Article: ${editingPost?.title}`}
          </h2>

          {error && (
            <div
              style={{
                background: theme.dangerSoft,
                border: `1px solid ${theme.danger}`,
                color: theme.danger,
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background: theme.successSoft,
                border: `1px solid ${theme.success}`,
                color: theme.success,
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "14px",
              }}
            >
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: theme.text, marginBottom: "6px" }}>
                  Article Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ratel Plus Expands Gigabit Fiber Network in Kano"
                  value={formState.title}
                  onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    background: theme.panelStrong,
                    color: theme.text,
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: theme.text, marginBottom: "6px" }}>
                  Category *
                </label>
                <select
                  value={formState.category}
                  onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    background: theme.panelStrong,
                    color: theme.text,
                    fontSize: "14px",
                  }}
                >
                  <option value="News">Company News</option>
                  <option value="Press Release">Press Release</option>
                  <option value="Infrastructure & Fiber">Infrastructure & Fiber</option>
                  <option value="Product Launch">Product Launch</option>
                  <option value="Wireless & LTE">Wireless & LTE</option>
                  <option value="Academy & Training">Academy & Training</option>
                  <option value="Community">Community & Events</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: theme.text, marginBottom: "6px" }}>
                  Custom URL Slug (optional)
                </label>
                <input
                  type="text"
                  placeholder="leave empty to auto-generate"
                  value={formState.slug}
                  onChange={(e) => setFormState({ ...formState, slug: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    background: theme.panelStrong,
                    color: theme.text,
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: theme.text, marginBottom: "6px" }}>
                  Author / Byline
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ratel Media Team"
                  value={formState.author}
                  onChange={(e) => setFormState({ ...formState, author: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    background: theme.panelStrong,
                    color: theme.text,
                    fontSize: "14px",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: theme.text, marginBottom: "6px" }}>
                  Read Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3 min read"
                  value={formState.read_time}
                  onChange={(e) => setFormState({ ...formState, read_time: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    background: theme.panelStrong,
                    color: theme.text,
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>

            {/* Featured Image & Upload */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: theme.text, marginBottom: "6px" }}>
                Featured Banner Image
              </label>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Image URL or upload a file"
                  value={formState.featured_image}
                  onChange={(e) => setFormState({ ...formState, featured_image: e.target.value })}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: `1px solid ${theme.panelBorder}`,
                    background: theme.panelStrong,
                    color: theme.text,
                    fontSize: "14px",
                  }}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileChange}
                  accept="image/*"
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: theme.panelStrong,
                    border: `1px solid ${theme.panelBorder}`,
                    color: theme.text,
                    padding: "10px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  <Upload size={16} />
                  {uploadingImage ? "Uploading..." : "Upload Image"}
                </button>
              </div>

              {formState.featured_image && (
                <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <img
                    src={getMediaImageUrl(formState.featured_image)}
                    alt="Preview"
                    style={{ height: "60px", borderRadius: "6px", objectFit: "cover", border: `1px solid ${theme.panelBorder}` }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <span style={{ fontSize: "12px", color: theme.textMuted }}>Thumbnail preview</span>
                </div>
              )}
            </div>

            {/* Summary */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: theme.text, marginBottom: "6px" }}>
                Summary Excerpt * (Displayed on article cards and search snippets)
              </label>
              <textarea
                required
                rows={2}
                placeholder="Brief summary of the news story or press release..."
                value={formState.summary}
                onChange={(e) => setFormState({ ...formState, summary: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${theme.panelBorder}`,
                  background: theme.panelStrong,
                  color: theme.text,
                  fontSize: "14px",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Full Body Content */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: theme.text, marginBottom: "6px" }}>
                Full Article Content * (Supports paragraphs, quotes, and markdown headings)
              </label>
              <textarea
                required
                rows={10}
                placeholder="Write the full news story or press release here..."
                value={formState.content}
                onChange={(e) => setFormState({ ...formState, content: e.target.value })}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${theme.panelBorder}`,
                  background: theme.panelStrong,
                  color: theme.text,
                  fontSize: "14px",
                  fontFamily: "inherit",
                  lineHeight: "1.6",
                }}
              />
            </div>

            {/* Tags */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: theme.text, marginBottom: "6px" }}>
                Tags (comma separated)
              </label>
              <input
                type="text"
                placeholder="e.g. Fiber, 4G LTE, Press Release, Kano"
                value={formState.tagsText}
                onChange={(e) => setFormState({ ...formState, tagsText: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${theme.panelBorder}`,
                  background: theme.panelStrong,
                  color: theme.text,
                  fontSize: "14px",
                }}
              />
            </div>

            {/* Published Checkbox */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
              <input
                type="checkbox"
                id="is_published"
                checked={formState.is_published}
                onChange={(e) => setFormState({ ...formState, is_published: e.target.checked })}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <label htmlFor="is_published" style={{ fontSize: "14px", fontWeight: "600", color: theme.text, cursor: "pointer" }}>
                Publish immediately (live on public website)
              </label>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: "transparent",
                  color: theme.textMuted,
                  border: `1px solid ${theme.panelBorder}`,
                  fontSize: "14px",
                  fontWeight: "600",
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
                  background: theme.primary,
                  color: "white",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(15, 79, 157, 0.25)",
                }}
              >
                {submitting ? "Saving..." : viewMode === "create" ? "Publish Article" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* VIEW MODE: ARTICLES LIST */}
      {viewMode === "list" && (
        <div>
          {/* Search & Filter Toolbar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "20px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: "12px", flex: 1, minWidth: "280px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: theme.panel,
                  border: `1px solid ${theme.panelBorder}`,
                  borderRadius: "8px",
                  padding: "0 12px",
                  flex: 1,
                }}
              >
                <Search size={16} style={{ color: theme.textMuted, marginRight: "8px" }} />
                <input
                  type="text"
                  placeholder="Search articles, author, or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: theme.text,
                    fontSize: "14px",
                    padding: "10px 0",
                    width: "100%",
                    outline: "none",
                  }}
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${theme.panelBorder}`,
                  background: theme.panel,
                  color: theme.text,
                  fontSize: "14px",
                  outline: "none",
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: `1px solid ${theme.panelBorder}`,
                  background: theme.panel,
                  color: theme.text,
                  fontSize: "14px",
                  outline: "none",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Drafts Only</option>
              </select>
            </div>
          </div>

          {/* Articles Table / Cards */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px", color: theme.textMuted }}>
              Loading media publications...
            </div>
          ) : filteredPosts.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                background: theme.panel,
                borderRadius: "12px",
                border: `1px solid ${theme.panelBorder}`,
              }}
            >
              <Newspaper size={48} style={{ color: theme.textMuted, margin: "0 auto 16px" }} />
              <h3 style={{ fontSize: "18px", color: theme.text, margin: "0 0 8px" }}>No articles found</h3>
              <p style={{ color: theme.textMuted, fontSize: "14px", margin: "0 0 20px" }}>
                {searchQuery || categoryFilter !== "all"
                  ? "Try clearing filters to find articles."
                  : "Start publishing company news, stories, and press releases."}
              </p>
              <button
                onClick={handleOpenCreate}
                style={{
                  background: theme.primary,
                  color: "white",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Publish First Article
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  style={{
                    background: theme.panel,
                    border: `1px solid ${theme.panelBorder}`,
                    borderRadius: "12px",
                    padding: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "20px",
                    transition: "box-shadow 0.2s ease",
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "8px",
                      overflow: "hidden",
                      flexShrink: 0,
                      border: `1px solid ${theme.panelBorder}`,
                    }}
                  >
                    <PostThumbnail src={post.featured_image} title={post.title} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <span
                        style={{
                          background: "rgba(15, 79, 157, 0.1)",
                          color: theme.primary,
                          fontSize: "11px",
                          fontWeight: "700",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          padding: "2px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        {post.category}
                      </span>

                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: "600",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: post.is_published ? theme.successSoft : theme.warningSoft,
                          color: post.is_published ? theme.success : theme.warning,
                        }}
                      >
                        {post.is_published ? "Live on Website" : "Draft"}
                      </span>

                      <span style={{ fontSize: "12px", color: theme.textMuted, display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} />
                        {post.read_time}
                      </span>
                    </div>

                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: "700",
                        color: theme.text,
                        margin: "0 0 6px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {post.title}
                    </h3>

                    <p
                      style={{
                        fontSize: "13px",
                        color: theme.textMuted,
                        margin: "0 0 10px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {post.summary}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", color: theme.textMuted }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <User size={13} />
                        {post.author}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Calendar size={13} />
                        {new Date(post.published_at || post.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Eye size={13} />
                        {post.views_count || 0} views
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {/* Toggle Status Button */}
                    <button
                      onClick={() => handleTogglePublish(post.id)}
                      title={post.is_published ? "Unpublish to draft" : "Publish to live website"}
                      style={{
                        background: "transparent",
                        border: `1px solid ${theme.panelBorder}`,
                        color: post.is_published ? theme.success : theme.warning,
                        padding: "8px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      {post.is_published ? "Unpublish" : "Publish"}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => handleOpenEdit(post)}
                      title="Edit article"
                      style={{
                        background: "transparent",
                        border: `1px solid ${theme.panelBorder}`,
                        color: theme.text,
                        padding: "8px",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <Edit2 size={16} />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(post.id, post.title)}
                      title="Delete article"
                      style={{
                        background: "transparent",
                        border: `1px solid ${theme.panelBorder}`,
                        color: theme.danger,
                        padding: "8px",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
