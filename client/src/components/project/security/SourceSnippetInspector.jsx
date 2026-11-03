// client/src/components/project/security/SourceSnippetInspector.jsx
//
// Focused lightweight source code inspector overlay.
// Navigates directly to the line range of a security finding with high-contrast highlighting,
// without reintroducing a permanent split-screen editor into the main workspace.

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { getProjectFile } from "../../../services/projectService";

export default function SourceSnippetInspector({
  projectId,
  filePath,
  startLine = 1,
  endLine = 1,
  isOpen,
  onClose,
}) {
  const { getToken } = useAuth();
  const [fileData, setFileData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const activeLineRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !projectId || !filePath) return;

    let isMounted = true;
    const fetchFile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setFileData(null);
        const token = await getToken();
        if (!token) throw new Error("Authentication token expired.");

        const data = await getProjectFile(token, projectId, filePath);
        if (isMounted) {
          setFileData(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || err.message || "Failed to load source file.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFile();

    return () => {
      isMounted = false;
    };
  }, [isOpen, projectId, filePath, getToken]);

  // Scroll active line into view once rendered
  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [fileData, startLine]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const lines = fileData?.content ? fileData.content.split("\n") : [];
  const sLine = Number(startLine) || 1;
  const eLine = Number(endLine) || sLine;

  const handleCopySnippet = () => {
    if (!lines.length) return;
    const snippet = lines.slice(Math.max(0, sLine - 1), eLine).join("\n");
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} aria-label="Close inspector backdrop" />

      {/* Modal Card */}
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[#070c16] border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between gap-4 bg-white/[0.02]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-sm">
              📄
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-mono font-bold text-slate-100 truncate">
                {filePath}
              </span>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span>Lines {sLine}–{eLine} highlighted</span>
                {fileData?.language && <span>• {fileData.language}</span>}
                {fileData?.lineCount && <span>• {fileData.lineCount} total lines</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopySnippet}
              disabled={isLoading || !lines.length}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 transition-colors cursor-pointer disabled:opacity-40"
            >
              {copied ? "✓ Copied Snippet" : "Copy Snippet"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Close inspector (Esc)"
              aria-label="Close inspector"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Viewport */}
        <div className="flex-1 overflow-auto bg-[#04070d] p-4 font-mono text-xs custom-scrollbar">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-6 h-6 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
              <span className="text-xs font-mono">Loading source file from repository storage...</span>
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-xl mb-3">
                ✕
              </div>
              <h4 className="text-sm font-bold text-slate-200">Unable to Load Source File</h4>
              <p className="text-xs text-slate-400 max-w-md mt-1 mb-4 leading-relaxed font-mono">
                {error}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg text-xs font-mono bg-white/[0.05] border border-white/[0.1] text-slate-300 hover:bg-white/[0.1] cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          ) : lines.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 font-mono text-xs">
              File is empty.
            </div>
          ) : (
            <div className="min-w-full inline-block">
              {lines.map((lineText, idx) => {
                const lineNum = idx + 1;
                const isTargetLine = lineNum >= sLine && lineNum <= eLine;
                const isFirstTarget = lineNum === sLine;

                return (
                  <div
                    key={lineNum}
                    ref={isFirstTarget ? activeLineRef : null}
                    className={`flex items-start leading-6 font-mono transition-colors ${
                      isTargetLine
                        ? "bg-amber-500/15 border-l-4 border-amber-400 text-amber-100 font-semibold pl-2"
                        : "text-slate-300 hover:bg-white/[0.02] pl-3"
                    }`}
                  >
                    {/* Line Number */}
                    <span
                      className={`w-12 shrink-0 select-none text-right pr-4 ${
                        isTargetLine ? "text-amber-400 font-bold" : "text-slate-600"
                      }`}
                    >
                      {lineNum}
                    </span>

                    {/* Code Line */}
                    <span className="whitespace-pre flex-1 overflow-x-auto pr-4">
                      {lineText || " "}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.06] bg-white/[0.015] flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Read-Only Source Preview • Highlighting lines {sLine}–{eLine}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}

