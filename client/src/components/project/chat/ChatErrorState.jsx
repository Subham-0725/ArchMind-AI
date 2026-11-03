// client/src/components/project/chat/ChatErrorState.jsx
//
// User-friendly error alert with retry and dismiss controls.

export default function ChatErrorState({ error, onRetry, onDismiss }) {
  if (!error) return null;

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-200 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-red-400 font-bold shrink-0">✕</span>
        <span className="truncate" title={error}>
          {error}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-[11px] font-semibold text-red-100 transition-colors cursor-pointer"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-200 text-sm px-1 cursor-pointer"
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

