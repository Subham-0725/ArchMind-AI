// client/src/components/project/api/RouteDetailCard.jsx
//
// Detail view for a selected API route.
// Displays route specs, parameters, middleware chain, auth status,
// and line-level source citation with jump-to-editor functionality.

import { useState } from "react";

const METHOD_THEMES = {
  GET: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  POST: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  PUT: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PATCH: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function RouteDetailCard({
  route,
  citation,
  isValid = true,
  isLoading = false,
  error = null,
  onViewSequence,
  hasSequence = true,
}) {
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-xl border border-white/[0.08] bg-[#050811] min-h-[420px] text-center">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin mb-3" />
        <p className="text-xs font-mono text-cyan-300">Loading endpoint specifications...</p>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-xl border border-white/[0.08] bg-[#050811] min-h-[420px] text-center">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-base mb-3">
          ✕
        </div>
        <h4 className="text-sm font-semibold text-slate-200">Unable to Load Route Details</h4>
        <p className="text-xs font-mono text-slate-400 max-w-xs mt-1">
          {error || "Selected route could not be found or has expired."}
        </p>
      </div>
    );
  }

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(`${route.method} ${route.path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy route path:", err);
    }
  };

  const startLine = citation?.startLine || route.lineRange?.startLine || 1;
  const endLine = citation?.endLine || route.lineRange?.endLine || startLine;
  const sourceFile = citation?.sourceFile || route.sourceFile || "";
  const methodTheme = METHOD_THEMES[route.method] || "bg-slate-500/15 text-slate-400 border-slate-500/30";

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl border border-white/[0.08] bg-[#050811]">
      {/* ── Header: Method, Path, and Actions ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold border shrink-0 ${methodTheme}`}>
            {route.method}
          </span>
          <span className="text-sm font-mono font-bold text-slate-100 truncate" title={route.path}>
            {route.path}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopyPath}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer"
            title="Copy method and path"
          >
            {copied ? (
              <span className="text-emerald-400 text-[11px]">✓ Copied</span>
            ) : (
              <span className="text-[11px]">Copy Route</span>
            )}
          </button>

          {/* Sequence Diagram Button */}
          {hasSequence && onViewSequence && (
            <button
              type="button"
              onClick={onViewSequence}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all cursor-pointer shadow-sm"
              title="View request call sequence diagram"
            >
              <span>⇄</span>
              <span>Sequence View</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Key Metadata Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Handler & Controller */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Handler / Controller
          </span>
          <div className="mt-1 font-mono text-xs">
            <span className="text-cyan-300 font-semibold">{route.handlerName || "inline function"}</span>
            {route.controllerName && (
              <span className="text-slate-400 block text-[11px]">in {route.controllerName}</span>
            )}
          </div>
        </div>

        {/* Auth Protection */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Security & Auth Status
          </span>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-xs">
            {route.isAuthProtected ? (
              <span className="inline-flex items-center gap-1 text-cyan-300 font-semibold">
                <span>🔒</span> Protected Endpoint
              </span>
            ) : (
              <span className="text-slate-400">Public (No Auth Guard)</span>
            )}
          </div>
        </div>

        {/* Framework & Confidence */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Framework & Validation
          </span>
          <div className="mt-1 flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-200 uppercase font-semibold">{route.framework || "generic"}</span>
            {isValid && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ✓ Valid Schema
              </span>
            )}
            {route.confidence && (
              <span className="px-1.5 py-0.2 rounded text-[10px] text-slate-400 bg-white/[0.04]">
                {route.confidence} conf
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Middleware Stack ──────────────────────────────────────────────── */}
      {route.middleware && route.middleware.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2">
            Middleware Chain ({route.middleware.length})
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {route.middleware.map((mw, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/[0.04] text-slate-300 border border-white/10">
                  {mw}
                </span>
                {idx < route.middleware.length - 1 && (
                  <span className="text-slate-600 text-xs">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Dynamic Route Parameters ──────────────────────────────────────── */}
      {route.params && route.params.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2">
            Path Parameters ({route.params.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {route.params.map((p, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
              >
                :{p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Extraction Notes / Warnings ───────────────────────────────────── */}
      {route.extractionNotes && route.extractionNotes.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3">
          <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block mb-1">
            Analysis Notes
          </span>
          <ul className="list-disc list-inside text-xs font-mono text-amber-200/80 space-y-0.5">
            {route.extractionNotes.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Line-Level Source Citation Card ───────────────────────────────── */}
      <div className="mt-2 rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.04] to-blue-500/[0.04] p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-sm shrink-0">
            📄
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">
              Source Citation
            </span>
            <span className="text-xs font-mono font-semibold text-slate-200 truncate block">
              {sourceFile || "unknown"}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Lines {startLine}–{endLine}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

