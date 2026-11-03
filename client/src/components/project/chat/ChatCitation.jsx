// client/src/components/project/chat/ChatCitation.jsx
//
// Structured citation display for Repository AI Chat.
// Shows verified repository file references with line ranges.
// Allows copying citation reference without opening or loading code viewer.

import { useState } from "react";

export default function ChatCitation({ citation }) {
  const [copied, setCopied] = useState(false);

  if (!citation || !citation.filePath) return null;

  const { filePath, lineStart, lineEnd, verified = true } = citation;
  const lineLabel =
    lineStart && lineEnd
      ? lineStart === lineEnd
        ? `Line ${lineStart}`
        : `Lines ${lineStart}–${lineEnd}`
      : "Full file";

  const citationRef = `${filePath}${lineStart ? `:L${lineStart}${lineEnd && lineEnd !== lineStart ? `-L${lineEnd}` : ""}` : ""}`;

  const handleCopyCitation = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(citationRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy citation:", err);
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-white/[0.08] bg-[#070d18]/80 hover:bg-[#0a1222] transition-colors group"
      title={`Repository Citation: ${citationRef} (Click copy to copy reference)`}
    >
      {/* File & Line Info */}
      <div className="flex items-center gap-2 min-w-0">
        <svg
          className="w-3.5 h-3.5 text-cyan-400 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>

        <div className="flex flex-col min-w-0">
          <span className="text-xs font-mono font-medium text-slate-200 truncate" title={filePath}>
            {filePath}
          </span>
          <span className="text-[11px] font-mono text-cyan-400/80">
            {lineLabel}
          </span>
        </div>
      </div>

      {/* Verification Pill & Copy Action */}
      <div className="flex items-center gap-2 shrink-0">
        {verified ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Unverified
          </span>
        )}

        <button
          type="button"
          onClick={handleCopyCitation}
          className="px-2 py-1 rounded text-[11px] font-mono text-slate-400 hover:text-slate-100 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer"
          title="Copy file path and line reference to clipboard"
          aria-label={`Copy citation ${citationRef}`}
        >
          {copied ? (
            <span className="text-emerald-400 font-semibold">✓ Copied</span>
          ) : (
            <span>Copy</span>
          )}
        </button>
      </div>
    </div>
  );
}

