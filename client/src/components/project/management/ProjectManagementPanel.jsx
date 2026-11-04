// client/src/components/project/management/ProjectManagementPanel.jsx
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProjectCard from "./ProjectCard";
import RenameProjectModal from "./RenameProjectModal";
import DeleteProjectModal from "./DeleteProjectModal";
import ReanalyzeConfirmModal from "./ReanalyzeConfirmModal";
import { fetchProjects, normalizeApiError } from "../../../services/projectService";

export default function ProjectManagementPanel({
  token,
  onSelectProject,
  refreshTrigger = 0,
}) {
  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 6,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Manual refetch trigger
  const [fetchIndex, setFetchIndex] = useState(0);

  // Notifications State
  const [notification, setNotification] = useState(null);

  // Active Modals State
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [projectToReanalyze, setProjectToReanalyze] = useState(null);

  // Debounce search input (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 350);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const showNotification = useCallback((type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  }, []);

  // Fetch Projects inside Effect using AbortController and cancellation flag
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    async function executeFetch() {
      if (!token) return;
      try {
        setIsLoading(true);
        setError(null);

        const result = await fetchProjects(
          token,
          {
            page: pagination.page,
            limit: pagination.limit,
            sortBy,
            order: sortOrder,
            search: debouncedSearch,
          },
          controller.signal
        );

        if (!ignore) {
          setProjects(result.projects || []);
          setPagination((prev) => ({
            ...prev,
            total: result.pagination.total,
            totalPages: result.pagination.totalPages,
          }));
        }
      } catch (err) {
        if (!ignore && err.name !== "CanceledError" && err.message !== "canceled") {
          const normalized = normalizeApiError(err);
          setError(normalized.message);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    executeFetch();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [
    token,
    pagination.page,
    pagination.limit,
    sortBy,
    sortOrder,
    debouncedSearch,
    refreshTrigger,
    fetchIndex,
  ]);

  // Handle Project Updates
  const handleProjectUpdated = (updatedProject) => {
    setProjects((prev) =>
      prev.map((p) =>
        (p.id || p._id) === (updatedProject.id || updatedProject._id)
          ? { ...p, ...updatedProject }
          : p
      )
    );
    showNotification("success", `Project '${updatedProject.name}' updated successfully.`);
  };

  // Handle Project Deletion
  const handleProjectDeleted = (deletedProjectId) => {
    setProjects((prev) => prev.filter((p) => (p.id || p._id) !== deletedProjectId));
    showNotification("success", "Project and associated analysis artifacts deleted successfully.");

    if (projects.length === 1 && pagination.page > 1) {
      setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
    } else {
      setFetchIndex((prev) => prev + 1);
    }
  };

  // Handle Reanalyze Success
  const handleReanalyzeSuccess = (refreshedData) => {
    const pid = refreshedData.id || refreshedData._id;
    setProjects((prev) =>
      prev.map((p) => ((p.id || p._id) === pid ? { ...p, ...refreshedData } : p))
    );
    showNotification(
      "success",
      `Reanalysis completed successfully (v${refreshedData.analysisVersion || 1}).`
    );
    setFetchIndex((prev) => prev + 1);
  };

  // Pagination Change
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages || newPage === pagination.page) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="w-full max-w-4xl mx-auto mt-10 flex flex-col gap-5">
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 shadow-lg ${
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300 shadow-emerald-950/20"
                : "bg-red-500/10 border-red-500/25 text-red-300 shadow-red-950/20"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0">{notification.type === "success" ? "✓" : "⚠"}</span>
              <span className="truncate">{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white shrink-0 p-1 cursor-pointer"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Bar: Title & Search & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-white/[0.06] bg-[#060a12]/70 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
              Repository Intelligence Center
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              {pagination.total} {pagination.total === 1 ? "project" : "projects"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Manage, export architecture blueprints, or reanalyze your repositories
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <svg
              className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search repositories..."
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-[#03060c] border border-white/[0.08] focus:border-cyan-500/50 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs p-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-[#03060c] border border-white/[0.08] text-xs text-slate-300 outline-none focus:border-cyan-500/50 transition-colors cursor-pointer"
            aria-label="Sort projects by"
          >
            <option value="updatedAt">Recently Updated</option>
            <option value="createdAt">Creation Date</option>
            <option value="name">Project Name</option>
            <option value="status">Status</option>
          </select>

          {/* Order Toggle (Desc / Asc) */}
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
            className="p-1.5 rounded-xl bg-[#03060c] border border-white/[0.08] hover:border-cyan-500/40 text-slate-400 hover:text-cyan-300 text-xs transition-colors cursor-pointer"
            title={`Sort order: ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
            aria-label="Toggle sort order"
          >
            {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        /* Loading Skeletons */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-white/[0.06] bg-[#070c16]/50 flex flex-col gap-3 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.05]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-white/[0.08] rounded w-3/4" />
                  <div className="h-2.5 bg-white/[0.04] rounded w-1/2" />
                </div>
              </div>
              <div className="h-8 bg-white/[0.03] rounded mt-2" />
              <div className="flex justify-between items-center pt-3 border-t border-white/[0.04] mt-2">
                <div className="h-2.5 bg-white/[0.05] rounded w-1/4" />
                <div className="h-6 bg-white/[0.06] rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error State with Retry */
        <div className="p-8 rounded-2xl border border-red-500/20 bg-red-950/10 text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-lg">
            ✕
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Unable to load repositories</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setFetchIndex((prev) => prev + 1)}
            className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      ) : projects.length === 0 ? (
        /* Empty State */
        <div className="p-10 rounded-2xl border border-white/[0.06] bg-[#060a12]/50 text-center flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-500">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-300">
              {debouncedSearch ? "No matching repositories found" : "No repositories analyzed yet"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {debouncedSearch
                ? `No projects matched "${debouncedSearch}". Try a different keyword.`
                : "Upload a ZIP repository archive or import a GitHub repository above to start."}
            </p>
          </div>
          {debouncedSearch && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-medium hover:bg-cyan-500/20 transition-colors cursor-pointer"
            >
              Clear Search Query
            </button>
          )}
        </div>
      ) : (
        /* Project Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id || project._id}
              project={project}
              token={token}
              onSelectProject={onSelectProject}
              onEdit={(p) => setProjectToEdit(p)}
              onDelete={(p) => setProjectToDelete(p)}
              onReanalyze={(p) => setProjectToReanalyze(p)}
              onNotification={showNotification}
            />
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {!isLoading && !error && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-white/[0.06] bg-[#060a12]/50 text-xs">
          <span className="text-slate-500 font-mono text-[11px]">
            Showing <strong className="text-slate-300">{startItem}</strong> to{" "}
            <strong className="text-slate-300">{endItem}</strong> of{" "}
            <strong className="text-slate-300">{pagination.total}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-slate-300 hover:text-cyan-300 hover:border-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer font-medium"
            >
              Previous
            </button>
            <span className="text-[11px] font-mono text-slate-400 px-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-slate-300 hover:text-cyan-300 hover:border-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <RenameProjectModal
        isOpen={Boolean(projectToEdit)}
        onClose={() => setProjectToEdit(null)}
        project={projectToEdit}
        token={token}
        onProjectUpdated={handleProjectUpdated}
      />

      <DeleteProjectModal
        isOpen={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        project={projectToDelete}
        token={token}
        onProjectDeleted={handleProjectDeleted}
      />

      <ReanalyzeConfirmModal
        isOpen={Boolean(projectToReanalyze)}
        onClose={() => setProjectToReanalyze(null)}
        project={projectToReanalyze}
        token={token}
        onReanalyzeSuccess={handleReanalyzeSuccess}
      />
    </div>
  );
}
