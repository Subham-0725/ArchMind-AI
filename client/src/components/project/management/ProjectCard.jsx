// client/src/components/project/management/ProjectCard.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { downloadProjectPdfReport } from "../../../services/projectService";

const LANGUAGE_COLORS = {
  JavaScript: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  TypeScript: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Python: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Go: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Rust: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Java: "bg-red-500/10 text-red-400 border-red-500/20",
  Kotlin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "C++": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Ruby: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  PHP: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
};

function formatTimeAgo(dateString) {
  if (!dateString) return "recently";
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ProjectCard({
  project,
  token,
  onSelectProject,
  onEdit,
  onDelete,
  onReanalyze,
  onNotification,
}) {
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const projectId = project.id || project._id;
  const isGithub = project.source === "github";
  const primary = project.primaryLanguage || project.github?.language || "Unknown";
  const langClass =
    LANGUAGE_COLORS[primary] ||
    "bg-white/[0.04] text-slate-400 border-white/10";

  const secondaryLangs = project.secondaryLanguages || [];
  const frameworks = Array.isArray(project.techStack?.frameworks)
    ? project.techStack.frameworks
    : Array.isArray(project.techStack)
    ? project.techStack.slice(0, 3)
    : [];

  const status = project.status || "uploaded";
  const isCompleted = status === "completed";
  const isProcessing = status === "processing" || status === "queued";
  const isFailed = status === "failed";

  const version = project.analysisVersion || 1;
  const fileCount = project.stats?.totalFiles ?? 0;

  const handleExportPdf = async (e) => {
    e.stopPropagation();
    if (isExportingPdf) return;

    if (!isCompleted) {
      if (onNotification) {
        onNotification(
          "error",
          "Analysis is still incomplete. Please wait for the repository analysis to finish before exporting a PDF report."
        );
      }
      return;
    }

    try {
      setIsExportingPdf(true);
      await downloadProjectPdfReport(token, projectId, project.name);
      if (onNotification) {
        onNotification("success", `PDF report downloaded for ${project.name}`);
      }
    } catch (err) {
      if (onNotification) {
        onNotification("error", err.message || "Failed to download PDF report.");
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border border-white/[0.07] bg-[#070c16]/80 hover:bg-[#091122]/90 hover:border-cyan-500/30 transition-all duration-200 shadow-lg shadow-black/20"
    >
      {/* Top Section */}
      <div>
        <div className="flex items-start justify-between gap-3">
          {/* Source Icon & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.08] group-hover:border-cyan-500/30 group-hover:bg-cyan-500/[0.05] transition-colors shrink-0">
              {isGithub ? (
                <svg className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.63-5.373-12-12-12z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="12" x2="12" y2="18" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <Link
                to={`/project/${projectId}`}
                className="text-sm font-semibold text-slate-100 hover:text-cyan-300 transition-colors truncate block"
                title={project.name}
              >
                {project.name}
              </Link>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-mono">
                <span>{isGithub ? project.github?.fullName || "GitHub" : "ZIP Archive"}</span>
                <span>•</span>
                <span className="text-cyan-400/80">v{version}</span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="shrink-0">
            {isCompleted && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Ready
              </span>
            )}
            {isProcessing && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Processing
              </span>
            )}
            {isFailed && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border bg-red-500/10 text-red-400 border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Failed
              </span>
            )}
            {!isCompleted && !isProcessing && !isFailed && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border bg-white/[0.04] text-slate-400 border-white/[0.08]">
                {status}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 mt-2.5 line-clamp-2 leading-relaxed min-h-[2.5rem]">
          {project.description ||
            (isGithub
              ? `Imported from ${project.github?.url || "GitHub"}`
              : "Repository workspace with full architecture topology & security scan.")}
        </p>

        {/* Tech Stack Pills */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {primary && primary !== "Unknown" && (
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${langClass}`}>
              {primary}
            </span>
          )}

          {secondaryLangs.slice(0, 2).map((sec) => (
            <span
              key={sec}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-normal border bg-white/[0.02] text-slate-400 border-white/[0.08]"
            >
              {sec}
            </span>
          ))}

          {frameworks.slice(0, 2).map((fw) => (
            <span
              key={fw}
              className="px-1.5 py-0.5 rounded-md text-[10px] font-medium border bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
            >
              {fw}
            </span>
          ))}

          {fileCount > 0 && (
            <span className="text-[10px] text-slate-500 font-mono ml-auto">
              {fileCount} files
            </span>
          )}
        </div>
      </div>

      {/* Footer / Actions Bar */}
      <div className="flex items-center justify-between gap-2 mt-4 pt-3.5 border-t border-white/[0.06]">
        <span className="text-[11px] text-slate-500 font-mono">
          Updated {formatTimeAgo(project.updatedAt)}
        </span>

        {/* Buttons Group */}
        <div className="flex items-center gap-1.5">
          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/[0.05] border border-transparent hover:border-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
            title="Download Architecture PDF Report"
            aria-label="Export PDF Report"
          >
            {isExportingPdf ? (
              <span className="w-3.5 h-3.5 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin inline-block" />
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </button>

          {/* Reanalyze Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReanalyze(project);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/[0.05] border border-transparent hover:border-cyan-500/20 transition-all cursor-pointer"
            title="Reanalyze Repository"
            aria-label="Reanalyze Project"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Edit/Rename Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(project);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] border border-transparent hover:border-white/10 transition-all cursor-pointer"
            title="Edit Details"
            aria-label="Rename or edit project"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
            title="Delete Project"
            aria-label="Delete project"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          {/* Open Workspace Link */}
          <Link
            to={`/project/${projectId}`}
            onClick={() => onSelectProject && onSelectProject(projectId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-all cursor-pointer"
          >
            <span>Open</span>
            <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
