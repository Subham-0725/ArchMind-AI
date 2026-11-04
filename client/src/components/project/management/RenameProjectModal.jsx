// client/src/components/project/management/RenameProjectModal.jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { updateProjectMetadata, normalizeApiError } from "../../../services/projectService";

export default function RenameProjectModal({
  isOpen,
  onClose,
  project,
  token,
  onProjectUpdated,
}) {
  if (!isOpen || !project) return null;

  return (
    <RenameProjectModalInner
      key={project.id || project._id}
      onClose={onClose}
      project={project}
      token={token}
      onProjectUpdated={onProjectUpdated}
    />
  );
}

function RenameProjectModalInner({
  onClose,
  project,
  token,
  onProjectUpdated,
}) {
  const originalName = project.name || "";
  const originalDescription = project.description || "";

  const [name, setName] = useState(originalName);
  const [description, setDescription] = useState(originalDescription);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const isNameEmpty = !name.trim();
  const hasChanges =
    name.trim() !== originalName.trim() ||
    description.trim() !== originalDescription.trim();
  const canSave = !isNameEmpty && hasChanges && !isSaving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

    try {
      setIsSaving(true);
      setError(null);

      const updatedProject = await updateProjectMetadata(token, project.id || project._id, {
        name: name.trim(),
        description: description.trim(),
      });

      if (onProjectUpdated) {
        onProjectUpdated(updatedProject);
      }
      onClose();
    } catch (err) {
      const normalized = normalizeApiError(err);
      setError(normalized.message);
    } finally {
      setIsSaving(false);
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
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#070c16] p-6 shadow-2xl shadow-cyan-950/50 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-project-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h3 id="rename-project-title" className="text-sm font-semibold text-slate-100">
                  Edit Project Details
                </h3>
                <p className="text-[11px] text-slate-500">
                  Update display metadata for this repository
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-2">
                <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="project-name-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                Project Name <span className="text-cyan-400">*</span>
              </label>
              <input
                id="project-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Production API"
                className="w-full px-3.5 py-2 rounded-xl bg-[#03060c] border border-white/[0.08] focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 text-xs text-slate-200 placeholder-slate-600 transition-all outline-none"
                disabled={isSaving}
                autoFocus
              />
              {isNameEmpty && (
                <p className="text-[11px] text-amber-400/80 mt-1">Project name cannot be empty.</p>
              )}
            </div>

            <div>
              <label htmlFor="project-desc-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                Description <span className="text-slate-500 text-[10px]">(Optional)</span>
              </label>
              <textarea
                id="project-desc-input"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of repository purpose, architecture, or services..."
                className="w-full px-3.5 py-2 rounded-xl bg-[#03060c] border border-white/[0.08] focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 text-xs text-slate-200 placeholder-slate-600 transition-all outline-none resize-none"
                disabled={isSaving}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-950 transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
