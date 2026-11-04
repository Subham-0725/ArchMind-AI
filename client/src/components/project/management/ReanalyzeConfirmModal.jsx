// client/src/components/project/management/ReanalyzeConfirmModal.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { reanalyzeProject, normalizeApiError } from "../../../services/projectService";

export default function ReanalyzeConfirmModal({
  isOpen,
  onClose,
  project,
  token,
  onReanalyzeSuccess,
}) {
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !project) return null;

  const projectId = project.id || project._id;
  const projectName = project.name || "Untitled Project";
  const currentVersion = project.analysisVersion || 1;
  const isGithub = project.source === "github";

  const handleStartReanalysis = async () => {
    try {
      setIsReanalyzing(true);
      setError(null);

      const result = await reanalyzeProject(token, projectId);

      if (onReanalyzeSuccess) {
        onReanalyzeSuccess(result.data || result);
      }
      onClose();
    } catch (err) {
      const normalized = normalizeApiError(err);
      if (normalized.code === "ANALYSIS_IN_PROGRESS" || normalized.status === 409) {
        setError("An analysis job is already running for this repository.");
      } else {
        setError(normalized.message || "Failed to trigger reanalysis.");
      }
    } finally {
      setIsReanalyzing(false);
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
          onClick={!isReanalyzing ? onClose : undefined}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md rounded-2xl border border-cyan-500/20 bg-[#060c16] p-6 shadow-2xl shadow-cyan-950/50 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reanalyze-project-title"
        >
          {/* Header */}
          <div className="flex items-start gap-3.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 id="reanalyze-project-title" className="text-sm font-semibold text-slate-100">
                Reanalyze Repository
              </h3>
              <p className="text-xs text-cyan-300 font-medium mt-0.5 truncate">
                {projectName} (Current: v{currentVersion})
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="mt-4 p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/15 text-xs text-slate-300 space-y-2">
            <p className="leading-relaxed">
              Triggering reanalysis will invalidate current analysis caches and advance this project to{" "}
              <strong className="text-cyan-300">version {currentVersion + 1}</strong>.
            </p>
            <div className="text-[11px] text-slate-400 pl-2 border-l border-cyan-500/30 space-y-1">
              {isGithub ? (
                <p>• Pulls fresh repository commits and tree from GitHub</p>
              ) : (
                <p>• Recomputes checksum fingerprint and re-indexes source files</p>
              )}
              <p>• Re-extracts topology, AST models, database schemas & API routes</p>
              <p>• Updates security risk scores & downstream capability modules</p>
            </div>
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
              disabled={isReanalyzing}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartReanalysis}
              disabled={isReanalyzing}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-xs font-semibold text-slate-950 transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
            >
              {isReanalyzing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                  <span>Analyzing Repository...</span>
                </>
              ) : (
                <span>Confirm & Reanalyze</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

