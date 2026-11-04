// client/src/components/project/devops/DeleteArtifactModal.jsx
//
// Confirmation dialog for deleting a generated DevOps artifact from ArchMind AI.
// Clarifies that the operation removes saved artifacts in ArchMind AI without altering
// the user's remote GitHub repository or local codebase.

export default function DeleteArtifactModal({
  isOpen,
  artifact,
  onClose,
  onConfirm,
  isDeleting = false,
}) {
  if (!isOpen || !artifact) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={isDeleting ? undefined : onClose}
        aria-label="Close dialog backdrop"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-[#070c16] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden text-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center gap-3 bg-red-500/[0.04]">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-lg">
            🗑️
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 font-mono">
              Delete DevOps Artifact?
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {artifact.filePath || artifact.artifactType} (v{artifact.version || 1})
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-3 text-xs font-mono">
          <p className="text-slate-300 leading-relaxed">
            Are you sure you want to delete this generated <span className="text-cyan-400 font-bold uppercase">{artifact.artifactType}</span> artifact?
          </p>

          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[11px] text-slate-400 flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">ℹ️</span>
            <span>
              This action deletes the generated artifact and its validation reports from ArchMind AI. It will <strong className="text-slate-200">not</strong> delete or modify any files in your GitHub repository or local filesystem.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(artifact.id)}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition-all shadow-lg shadow-red-500/20 cursor-pointer disabled:opacity-40 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Confirm Delete</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

