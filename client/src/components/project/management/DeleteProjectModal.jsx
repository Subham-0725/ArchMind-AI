// client/src/components/project/management/DeleteProjectModal.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { deleteProject, normalizeApiError } from "../../../services/projectService";

export default function DeleteProjectModal({
  isOpen,
  onClose,
  project,
  token,
  onProjectDeleted,
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !project) return null;

  const projectId = project.id || project._id;
  const projectName = project.name || "Untitled Project";

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      await deleteProject(token, projectId);

      if (onProjectDeleted) {
        onProjectDeleted(projectId);
      }
      onClose();
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized.message);
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isDeleting ? onClose : undefined}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md rounded-2xl border border-red-500/20 bg-[#0a0709] p-6 shadow-2xl shadow-red-950/40 z-10"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
          aria-describedby="delete-project-desc"
        >
          {/* Header */}
          <div className="flex items-start gap-3.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 id="delete-project-title" className="text-sm font-semibold text-slate-100">
                Delete Repository Analysis
              </h3>
              <p className="text-xs text-red-300 font-medium mt-0.5 truncate">
                {projectName}
              </p>
            </div>
          </div>

          {/* Description & Impact Warning */}
          <div id="delete-project-desc" className="mt-4 p-3.5 rounded-xl bg-red-950/20 border border-red-500/15 text-xs text-slate-300 space-y-2">
            <p className="leading-relaxed">
              Are you sure you want to permanently delete this repository from ArchMind AI?
            </p>
            <div className="text-[11px] text-slate-400 pl-2 border-l border-red-500/30 space-y-1">
              <p>• Scanned source trees & blueprints will be purged</p>
              <p>• Security findings, audits & DevOps manifests will be deleted</p>
              <p>• Associated AI chat conversations will be removed</p>
            </div>
            <p className="text-[11px] text-red-400 font-medium">
              This action is immediate and cannot be undone.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-red-600/25"
            >
              {isDeleting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Project</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

