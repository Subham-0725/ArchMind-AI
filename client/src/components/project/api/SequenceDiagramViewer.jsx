// client/src/components/project/api/SequenceDiagramViewer.jsx
//
// Visualizer for API Request Sequence Diagrams.
// Statically renders Mermaid sequence diagrams with strict security, pan/zoom controls,
// error boundaries, traversal truncation warnings, and interactive source citations.

import { useState, useEffect, useRef, useCallback } from "react";
import mermaid from "mermaid";

// Initialize Mermaid with strict sandboxed security
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "#070c16",
    primaryColor: "#06b6d4",
    primaryTextColor: "#f1f5f9",
    primaryBorderColor: "#0891b2",
    lineColor: "#38bdf8",
    secondaryColor: "#1e293b",
    tertiaryColor: "#0f172a",
    fontFamily: "monospace",
  },
  sequence: {
    useMaxWidth: false,
    showSequenceNumbers: true,
    actorMargin: 50,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
  },
});

export default function SequenceDiagramViewer({
  diagramData,
  isLoading = false,
  error = null,
  onBackToDetails,
  onRetry,
}) {
  const [svgContent, setSvgContent] = useState("");
  const [renderError, setRenderError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const mermaidSource = diagramData?.mermaid;

  // Render Mermaid SVG whenever diagram data changes
  useEffect(() => {
    let isCancelled = false;

    async function renderMermaid() {
      if (!mermaidSource) {
        setSvgContent("");
        setRenderError(null);
        return;
      }

      try {
        setRenderError(null);
        const uniqueId = `mermaid-seq-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(uniqueId, mermaidSource);
        if (!isCancelled) {
          setSvgContent(svg);
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn("[SequenceDiagramViewer] Mermaid render failed:", err.message);
          setRenderError(err.message || "Failed to render sequence diagram.");
        }
      }
    }

    renderMermaid();

    return () => {
      isCancelled = true;
    };
  }, [mermaidSource]);

  const [prevRouteId, setPrevRouteId] = useState(diagramData?.routeId);

  // Reset zoom & pan when diagram routeId changes
  if (diagramData?.routeId !== prevRouteId) {
    setPrevRouteId(diagramData?.routeId);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  // Pan interaction handlers
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest("button") || e.target.closest(".no-pan")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.4));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-xl border border-white/[0.08] bg-[#050811] min-h-[500px] text-center">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin mb-4" />
        <p className="text-xs font-mono text-cyan-300">Tracing request call graph...</p>
        <p className="text-[11px] font-mono text-slate-500 mt-1">
          Synthesizing static execution sequence & source citations
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-16 rounded-xl border border-white/[0.08] bg-[#050811] min-h-[500px] text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-lg mb-4">
          ✕
        </div>
        <h4 className="text-sm font-semibold text-slate-200">Sequence Diagram Generation Failed</h4>
        <p className="text-xs font-mono text-slate-400 max-w-md mt-1 mb-6 leading-relaxed">
          {error}
        </p>
        <div className="flex items-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-300 hover:bg-cyan-500/20 transition-colors cursor-pointer"
            >
              Retry Generation
            </button>
          )}
          {onBackToDetails && (
            <button
              type="button"
              onClick={onBackToDetails}
              className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-xs font-mono text-slate-400 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Back to Details
            </button>
          )}
        </div>
      </div>
    );
  }

  const participants = diagramData?.participants || [];
  const messages = diagramData?.messages || [];
  const warnings = diagramData?.warnings || [];
  const isTruncated = diagramData?.isTruncated;
  const disclaimer =
    diagramData?.disclaimer ||
    "This sequence diagram is a static approximation of the source code path. Actual runtime behavior may differ.";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#050811] p-4 min-h-[550px]">
      {/* ── Header Controls ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          {onBackToDetails && (
            <button
              type="button"
              onClick={onBackToDetails}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono text-slate-400 hover:text-slate-100 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors cursor-pointer"
            >
              <span>←</span>
              <span>Route Details</span>
            </button>
          )}
          <span className="text-xs font-mono font-semibold text-slate-200">
            Request Sequence Diagram
          </span>
          {diagramData?.cached && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              cached v{diagramData.analysisVersion}
            </span>
          )}
        </div>

        {/* Zoom & Pan Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleZoomIn}
            className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-mono text-slate-300 cursor-pointer"
            title="Zoom In"
          >
            +
          </button>
          <span className="px-2 py-1 text-[11px] font-mono text-slate-400">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomOut}
            className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-mono text-slate-300 cursor-pointer"
            title="Zoom Out"
          >
            −
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-mono text-slate-300 cursor-pointer"
            title="Reset Zoom & Pan"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Disclaimer Banner ──────────────────────────────────────────────── */}
      <div className="px-3 py-2 rounded-lg bg-cyan-500/[0.04] border border-cyan-500/20 flex items-start gap-2 text-[11px] font-mono text-cyan-300/90 leading-relaxed">
        <span className="text-cyan-400 text-xs shrink-0">ℹ</span>
        <span>{disclaimer}</span>
      </div>

      {/* ── Truncation / Safety Warnings Banner ────────────────────────────── */}
      {(isTruncated || warnings.length > 0) && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/[0.05] border border-amber-500/25 flex flex-col gap-1 text-[11px] font-mono text-amber-200">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <span>⚠️</span>
            <span>Call Graph Traversal Bounded</span>
          </div>
          <p className="text-amber-200/80 leading-relaxed">
            {isTruncated && "The sequence reached safety traversal limits (depth/messages) and was capped to prevent circular loop explosion."}
          </p>
          {warnings.length > 0 && (
            <ul className="list-disc list-inside space-y-0.5 text-amber-300/80">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Mermaid Diagram Canvas ─────────────────────────────────────────── */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-[#04070d] min-h-[380px] flex items-center justify-center p-4 cursor-grab select-none ${
          isDragging ? "cursor-grabbing" : ""
        }`}
      >
        {renderError ? (
          <div className="flex flex-col items-center justify-center text-center p-6 text-xs font-mono text-amber-400">
            <span className="text-xl mb-2">⚠️</span>
            <p className="font-bold">Mermaid Syntax Render Notice</p>
            <p className="text-slate-400 mt-1 max-w-md">{renderError}</p>
            <p className="text-slate-500 mt-2 text-[11px]">
              Showing structured participants & execution messages below.
            </p>
          </div>
        ) : svgContent ? (
          <div
            className="transition-transform duration-75 origin-center inline-block"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="text-xs font-mono text-slate-500">No diagram available</div>
        )}
      </div>

      {/* ── Interactive Execution Call Flow with Citations ─────────────────── */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.08]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
            Execution Flow & Source Citations ({messages.length} steps)
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            Source citations and execution flow
          </span>
        </div>

        {/* Step-by-Step Message Call Flow */}
        <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
          {messages.map((msg, idx) => {
            const stepNum = idx + 1;
            const fromP = participants.find((p) => p.id === msg.from)?.name || msg.from;
            const toP = participants.find((p) => p.id === msg.to)?.name || msg.to;
            const hasCitation = Boolean(msg.citation?.sourceFile && msg.citation?.startLine);
            const sourceFile = msg.citation?.sourceFile;
            const startLine = msg.citation?.startLine;
            const endLine = msg.citation?.endLine || startLine;

            return (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors font-mono text-xs"
              >
                {/* Step Description */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {stepNum}
                  </span>
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-slate-300 font-semibold">{fromP}</span>
                    <span className="text-cyan-400 text-[11px]">
                      {msg.kind === "return" ? "⇠" : "⇢"}
                    </span>
                    <span className="text-slate-300 font-semibold">{toP}</span>
                    <span className="text-slate-500 text-[11px] truncate">
                      ({msg.label})
                    </span>
                  </div>
                </div>

                {/* Source Citation Badge */}
                {hasCitation ? (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/[0.08] text-[11px] shrink-0 ml-auto sm:ml-0"
                    title={`${sourceFile}:${startLine}–${endLine}`}
                  >
                    <span>📄</span>
                    <span className="truncate max-w-[160px]">
                      {sourceFile.split("/").pop()}:{startLine}
                    </span>
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600 italic shrink-0">
                    runtime boundary
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Participants Source References */}
        {participants.some((p) => p.sourceFile) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.04] text-[11px] font-mono">
            <span className="text-slate-500">Participants:</span>
            {participants
              .filter((p) => p.sourceFile)
              .map((p) => (
                <span
                  key={p.id}
                  className="px-2 py-0.5 rounded bg-white/[0.03] text-slate-300 border border-white/10"
                  title={p.sourceFile}
                >
                  {p.name} ({p.sourceFile.split("/").pop()})
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
