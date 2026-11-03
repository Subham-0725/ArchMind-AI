// client/src/components/project/security/CodeReviewPanel.jsx
//
// AI-assisted Code Review panel powered by Groq.
// Select a source file to analyze code quality, security patterns, maintainability, and correctness.

import { useState, useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import { triggerCodeReview } from "../../../services/projectService";

const SEVERITY_BADGES = {
  Critical: "bg-red-500/15 text-red-400 border-red-500/30",
  High: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const CATEGORY_TABS = [
  { id: "ALL", label: "All Issues" },
  { id: "security", label: "Security" },
  { id: "correctness", label: "Correctness" },
  { id: "maintainability", label: "Maintainability" },
  { id: "performance", label: "Performance" },
];

export default function CodeReviewPanel({
  projectId,
  tree = [],
  onInspectSource,
}) {
  const { getToken } = useAuth();

  // Extract eligible source files from repository tree
  const eligibleFiles = useMemo(() => {
    const list = [];
    const traverse = (nodes) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node.type === "file" && node.path) {
          const p = node.path;
          // Filter out minified, node_modules, and lockfiles
          if (
            !p.includes("node_modules/") &&
            !p.includes(".git/") &&
            !p.endsWith(".lock") &&
            !p.endsWith(".min.js") &&
            !p.endsWith(".min.css") &&
            !p.endsWith(".map")
          ) {
            list.push(p);
          }
        }
        if (node.children) traverse(node.children);
      }
    };
    traverse(tree);
    return list.sort();
  }, [tree]);

  const [selectedFile, setSelectedFile] = useState(eligibleFiles[0] || "");
  const [customFocus, setCustomFocus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reviewResult, setReviewResult] = useState(null);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleStartReview = async (e) => {
    e?.preventDefault();
    if (!selectedFile || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) throw new Error("Authentication token unavailable.");

      const result = await triggerCodeReview(token, projectId, selectedFile, customFocus);
      setReviewResult(result);
    } catch (err) {
      console.error("[CodeReviewPanel] Code review error:", err);
      setError(err.response?.data?.error || err.message || "Failed to complete AI code review.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const filteredFindings = useMemo(() => {
    if (!reviewResult?.findings) return [];
    if (activeCategory === "ALL") return reviewResult.findings;
    return reviewResult.findings.filter(
      (f) => f.category?.toLowerCase() === activeCategory.toLowerCase()
    );
  }, [reviewResult, activeCategory]);

  return (
    <div className="flex-1 flex flex-col gap-4 text-slate-200">
      {/* ── File Selection & Focus Control Form ────────────────────────────── */}
      <form
        onSubmit={handleStartReview}
        className="rounded-xl border border-white/[0.08] bg-[#070c16]/80 p-4 sm:p-5 flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>🧠</span>
              <span>AI Code Review Engine</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a repository source file to perform deep static AST inspection and Groq-powered code review.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !selectedFile}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-cyan-500/10"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Analyzing File...</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>Run Code Review</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/[0.06]">
          {/* File Picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Target Source File ({eligibleFiles.length} files available)
            </label>
            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-lg bg-[#04070d] border border-white/[0.08] text-xs font-mono text-cyan-300 outline-none focus:border-cyan-500/40 cursor-pointer disabled:opacity-50"
            >
              {eligibleFiles.length === 0 ? (
                <option value="">No source files found in tree</option>
              ) : (
                eligibleFiles.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Optional Review Focus */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Custom Review Focus (Optional)
            </label>
            <input
              type="text"
              value={customFocus}
              onChange={(e) => setCustomFocus(e.target.value)}
              disabled={isLoading}
              placeholder="e.g. security vulnerabilities, memory leaks, TypeScript typing..."
              className="w-full px-3 py-2 rounded-lg bg-[#04070d] border border-white/[0.08] text-xs font-mono text-slate-200 outline-none focus:border-cyan-500/40 placeholder:text-slate-600 disabled:opacity-50"
            />
          </div>
        </div>
      </form>

      {/* ── Error Notification ─────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/[0.05] flex items-center justify-between gap-3 text-xs font-mono text-red-300">
          <div className="flex items-center gap-2">
            <span className="text-base">✕</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleStartReview}
            disabled={isLoading}
            className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Results Viewport ───────────────────────────────────────────────── */}
      {reviewResult && (
        <div className="flex flex-col gap-4">
          {/* Overview Score Card */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Score */}
            <div className="rounded-xl border border-white/[0.08] bg-[#070c16]/80 p-4 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Overall Quality Score
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span
                  className={`text-3xl font-bold font-mono ${
                    reviewResult.overallScore >= 80
                      ? "text-emerald-400"
                      : reviewResult.overallScore >= 60
                      ? "text-amber-400"
                      : "text-red-400"
                  }`}
                >
                  {reviewResult.overallScore}
                </span>
                <span className="text-xs font-mono text-slate-500">/ 100</span>
              </div>
            </div>

            {/* Target File */}
            <div className="sm:col-span-3 rounded-xl border border-white/[0.08] bg-[#070c16]/80 p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                  Analyzed File
                </span>
                <span className="text-xs font-mono text-cyan-400">
                  {reviewResult.language || "code"} • {reviewResult.totalLines || 0} lines
                </span>
              </div>
              <code className="text-xs font-mono text-slate-200 mt-2 truncate">
                {reviewResult.filePath}
              </code>
            </div>
          </div>

          {/* Executive Summary */}
          {reviewResult.summary && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.02] p-4 flex flex-col gap-1.5">
              <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>📋</span>
                <span>Executive Summary</span>
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {reviewResult.summary}
              </p>
            </div>
          )}

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/[0.06] pb-2">
            {CATEGORY_TABS.map((tab) => {
              const count =
                tab.id === "ALL"
                  ? reviewResult.findings?.length || 0
                  : reviewResult.findings?.filter(
                      (f) => f.category?.toLowerCase() === tab.id.toLowerCase()
                    ).length || 0;

              const isSelected = activeCategory === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                      : "bg-white/[0.02] text-slate-400 hover:text-slate-200 border border-white/[0.06]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Findings List */}
          <div className="flex flex-col gap-3">
            {filteredFindings.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-white/[0.04] bg-white/[0.01]">
                <p className="text-xs font-mono text-slate-400">
                  No issues reported under the &quot;{activeCategory}&quot; category.
                </p>
              </div>
            ) : (
              filteredFindings.map((finding, idx) => {
                const sevBadge =
                  SEVERITY_BADGES[finding.severity] || SEVERITY_BADGES.Medium;

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-white/[0.08] bg-[#070c16]/90 p-4 flex flex-col gap-3 hover:border-white/[0.15] transition-colors"
                  >
                    {/* Top Row: Severity, Title, Lines */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${sevBadge}`}
                        >
                          {finding.severity || "Medium"}
                        </span>
                        <span className="text-xs font-bold text-slate-100">
                          {finding.title || finding.category}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          ({finding.category})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {finding.startLine && (
                          <span className="text-xs font-mono text-amber-400">
                            Lines {finding.startLine}
                            {finding.endLine && finding.endLine !== finding.startLine
                              ? `–${finding.endLine}`
                              : ""}
                          </span>
                        )}
                        {onInspectSource && (
                          <button
                            type="button"
                            onClick={() =>
                              onInspectSource(
                                reviewResult.filePath,
                                finding.startLine || 1,
                                finding.endLine || finding.startLine || 1
                              )
                            }
                            className="px-2.5 py-1 rounded text-[11px] font-mono bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 cursor-pointer"
                          >
                            Inspect
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {finding.description}
                    </p>

                    {/* Problematic Code Snippet */}
                    {finding.codeSnippet && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                          Problematic Code:
                        </span>
                        <pre className="text-xs font-mono text-red-300 bg-red-950/20 border border-red-500/20 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">
                          {finding.codeSnippet}
                        </pre>
                      </div>
                    )}

                    {/* Suggested Fix */}
                    {finding.fixSnippet && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                            <span>✓</span>
                            <span>Suggested Fix:</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(finding.fixSnippet, idx)}
                            className="text-[11px] font-mono text-slate-400 hover:text-white cursor-pointer"
                          >
                            {copiedIndex === idx ? "✓ Copied" : "Copy Fix"}
                          </button>
                        </div>
                        <pre className="text-xs font-mono text-emerald-300 bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">
                          {finding.fixSnippet}
                        </pre>
                      </div>
                    )}

                    {/* Recommendation note */}
                    {finding.suggestion && !finding.fixSnippet && (
                      <div className="text-xs text-emerald-300 font-mono bg-emerald-500/[0.04] border border-emerald-500/20 rounded-lg p-2.5">
                        💡 {finding.suggestion}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Empty State when no review run yet ──────────────────────────────── */}
      {!reviewResult && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-xl border border-white/[0.04] bg-white/[0.01]">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-2xl mb-4 shadow-lg shadow-cyan-500/5">
            🔍
          </div>
          <h4 className="text-base font-bold text-slate-200">
            No File Review Selected
          </h4>
          <p className="text-xs text-slate-400 max-w-md mt-1 mb-4 leading-relaxed">
            Select any source file from the dropdown above and click &quot;Run Code Review&quot; to inspect code quality, find hidden logic bugs, and receive actionable fixes.
          </p>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
            <span>Powered by Groq</span>
            <span>•</span>
            <span>Deterministic AST Pre-filtering</span>
            <span>•</span>
            <span>Targeted Snippet Extraction</span>
          </div>
        </div>
      )}
    </div>
  );
}

