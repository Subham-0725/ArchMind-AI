// client/src/components/project/security/SecurityAuditTab.jsx
//
// ArchMind AI — Phase 4 Security & Code Quality Workspace.
// Integrates:
// 1. Holistic Security Audit Posture & Metrics
// 2. Deterministic Secret Scanner (strictly masked evidence, zero-leak guarantee)
// 3. Tree-sitter AST Security Scanner (injection, traversal, eval, crypto)
// 4. AI Code Review (Groq-assisted file analysis with actionable fixes)
// 5. Unit Test Generation (framework detection, runnable preview with safety disclaimer)
// 6. Non-intrusive Source Snippet Inspector and Finding Detail Drawer.

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  getSecuritySummary,
  getSecurityFindings,
  triggerSecurityScan,
  updateSecurityFindingStatus,
} from "../../../services/projectService";
import FindingDetailDrawer from "./FindingDetailDrawer";
import SourceSnippetInspector from "./SourceSnippetInspector";
import CodeReviewPanel from "./CodeReviewPanel";
import TestGeneratorPanel from "./TestGeneratorPanel";

const SEVERITY_CONFIG = {
  Critical: {
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
    text: "text-red-400",
    border: "border-red-500/25",
    icon: "🛑",
  },
  High: {
    badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    text: "text-orange-400",
    border: "border-orange-500/25",
    icon: "⚠️",
  },
  Medium: {
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    text: "text-amber-400",
    border: "border-amber-500/25",
    icon: "⚡",
  },
  Low: {
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    text: "text-blue-400",
    border: "border-blue-500/25",
    icon: "ℹ️",
  },
};

const VIEW_TABS = [
  { id: "overview", label: "Security Audit", icon: "🛡️" },
  { id: "secrets", label: "Secret Scanner", icon: "🔑" },
  { id: "ast", label: "AST Vulnerabilities", icon: "⚡" },
  { id: "codereview", label: "AI Code Review", icon: "🧠" },
  { id: "testgen", label: "Test Generation", icon: "🧪" },
];

export default function SecurityAuditTab({
  project,
  findings: propFindings = [],
  summary: propSummary = {},
  onRegenerate,
  isRegenerating = false,
  onAnalysisUpdate,
}) {
  const { getToken } = useAuth();
  const projectId = project?._id || project?.id;

  // Primary navigation view tab
  const [activeView, setActiveView] = useState("overview");

  // Findings & summary state (backed by live API with prop fallback)
  const [liveFindings, setLiveFindings] = useState([]);
  const [liveSummary, setLiveSummary] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  // Derive effective findings & summary without cascading effect renders
  const effectiveFindings = liveFindings.length > 0 ? liveFindings : propFindings;
  const effectiveSummary = (liveSummary && Object.keys(liveSummary).length > 0) ? liveSummary : propSummary;

  // Filters & Search
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedSource, setSelectedSource] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("severity"); // "severity" | "location" | "date"

  // Drawers and Modals
  const [activeFinding, setActiveFinding] = useState(null);
  const [inspectorConfig, setInspectorConfig] = useState({
    isOpen: false,
    filePath: "",
    startLine: 1,
    endLine: 1,
  });

  // Re-fetch helper
  const refreshSecurityData = useCallback(async () => {
    if (!projectId) return;
    try {
      const token = await getToken();
      if (!token) return;

      const [summaryRes, findingsRes] = await Promise.all([
        getSecuritySummary(token, projectId).catch(() => null),
        getSecurityFindings(token, projectId, { limit: 100 }).catch(() => null),
      ]);

      if (summaryRes) setLiveSummary(summaryRes);
      if (findingsRes?.findings) setLiveFindings(findingsRes.findings);
    } catch (err) {
      console.warn("[SecurityAuditTab] Re-fetch error:", err.message);
    }
  }, [projectId, getToken]);

  // Initial load on mount or projectId change
  useEffect(() => {
    if (!projectId) return;
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const token = await getToken();
        if (!token || !isMounted) return;

        setIsLoadingData(true);
        const [summaryRes, findingsRes] = await Promise.all([
          getSecuritySummary(token, projectId).catch(() => null),
          getSecurityFindings(token, projectId, { limit: 100 }).catch(() => null),
        ]);

        if (isMounted) {
          if (summaryRes) setLiveSummary(summaryRes);
          if (findingsRes?.findings) setLiveFindings(findingsRes.findings);
        }
      } catch (err) {
        console.warn("[SecurityAuditTab] Falling back to project props:", err.message);
      } finally {
        if (isMounted) {
          setIsLoadingData(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [projectId, getToken]);

  // Handle on-demand Security Scan
  const handleTriggerScan = async () => {
    if (isScanning || isRegenerating || !projectId) return;
    try {
      setIsScanning(true);
      setScanError(null);

      if (onRegenerate) {
        await onRegenerate();
      } else {
        const token = await getToken();
        if (!token) throw new Error("Authentication token expired.");
        const result = await triggerSecurityScan(token, projectId);
        if (result) {
          setLiveSummary(result);
        }
      }
      await refreshSecurityData();
      if (onAnalysisUpdate) onAnalysisUpdate();
    } catch (err) {
      console.error("[SecurityAuditTab] Scan failed:", err);
      setScanError(err.response?.data?.error || err.message || "Security scan failed.");
    } finally {
      setIsScanning(false);
    }
  };

  // Status mutation callback from drawer or row
  const handleStatusUpdate = async (findingId, newStatus) => {
    // Optimistically update local findings
    setLiveFindings((prev) => {
      const base = prev.length > 0 ? prev : propFindings;
      return base.map((f) => (f._id === findingId ? { ...f, status: newStatus } : f));
    });
    try {
      const token = await getToken();
      if (token && projectId) {
        await updateSecurityFindingStatus(token, projectId, findingId, newStatus);
      }
    } catch (err) {
      console.error("[SecurityAuditTab] Status persist failed:", err);
    }
  };

  // Inspect source helper
  const handleOpenSourceInspector = (filePath, startLine = 1, endLine = 1) => {
    setInspectorConfig({
      isOpen: true,
      filePath,
      startLine: Number(startLine) || 1,
      endLine: Number(endLine) || Number(startLine) || 1,
    });
  };

  // Derived counts
  const severityCounts = useMemo(() => {
    return {
      Critical: effectiveSummary?.severityCounts?.Critical || 0,
      High: effectiveSummary?.severityCounts?.High || 0,
      Medium: effectiveSummary?.severityCounts?.Medium || 0,
      Low: effectiveSummary?.severityCounts?.Low || 0,
    };
  }, [effectiveSummary]);

  const totalFindingsCount = effectiveSummary?.totalFindings ?? effectiveFindings.length;
  const filesScannedCount = effectiveSummary?.filesScanned || effectiveSummary?.scannedFilesCount || 0;

  // Filtered findings depending on activeView and filter selections
  const filteredFindings = useMemo(() => {
    return (effectiveFindings || []).filter((item) => {
      // 1. View Tab Isolation
      if (activeView === "secrets") {
        const isSecret = item.source === "secret_scanner" || Boolean(item.maskedValue);
        if (!isSecret) return false;
      } else if (activeView === "ast") {
        const isAst = item.source === "ast_analyzer" || item.category?.includes("AST") || item.category?.includes("Injection") || item.category?.includes("Execution");
        if (!isAst) return false;
      }

      // 2. Severity Filter
      if (selectedSeverity !== "ALL" && item.severity !== selectedSeverity) {
        return false;
      }

      // 3. Status Filter
      if (selectedStatus !== "ALL" && (item.status || "open") !== selectedStatus) {
        return false;
      }

      // 4. Source Engine Filter
      if (selectedSource !== "ALL" && item.source !== selectedSource) {
        return false;
      }

      // 5. Search Text Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesCategory = item.category?.toLowerCase().includes(q);
        const matchesPath = item.filePath?.toLowerCase().includes(q);
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesRule = item.ruleId?.toLowerCase().includes(q);
        if (!matchesCategory && !matchesPath && !matchesTitle && !matchesRule) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "severity") {
        const weight = { Critical: 4, High: 3, Medium: 2, Low: 1 };
        return (weight[b.severity] || 0) - (weight[a.severity] || 0);
      }
      if (sortBy === "location") {
        const pathCmp = (a.filePath || "").localeCompare(b.filePath || "");
        if (pathCmp !== 0) return pathCmp;
        return (a.startLine || a.lineNumber || 0) - (b.startLine || b.lineNumber || 0);
      }
      return 0;
    });
  }, [effectiveFindings, activeView, selectedSeverity, selectedStatus, selectedSource, searchTerm, sortBy]);

  // Secret scanner view stats
  const secretFindings = useMemo(() => {
    return (effectiveFindings || []).filter(
      (f) => f.source === "secret_scanner" || Boolean(f.maskedValue)
    );
  }, [effectiveFindings]);

  // AST scanner view stats
  const astFindings = useMemo(() => {
    return (effectiveFindings || []).filter(
      (f) =>
        f.source === "ast_analyzer" ||
        f.category?.includes("AST") ||
        f.category?.includes("Injection") ||
        f.category?.includes("Execution")
    );
  }, [effectiveFindings]);

  const isScanningActive = isScanning || isRegenerating;

  return (
    <div className="flex-1 flex flex-col gap-4 p-4 sm:p-6 rounded-xl border border-white/[0.08] bg-[#070c16]/80 backdrop-blur-md min-h-[600px] text-slate-200">
      {/* ── Top Header Bar ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h2 className="text-base font-bold text-slate-100">
              Security & Code Quality Center
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                liveSummary?.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : liveSummary?.status === "failed"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
              }`}
            >
              {liveSummary?.status || "Ready"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic credential redaction, Tree-sitter AST vulnerability analysis, and Groq-powered code review.
          </p>
        </div>

        {/* Scan Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTriggerScan}
            disabled={isScanningActive}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isScanningActive ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span>Scanning Repository...</span>
              </>
            ) : (
              <>
                <span>⟳</span>
                <span>Re-scan Security</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Error Banner ───────────────────────────────────────────────────── */}
      {scanError && (
        <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/[0.05] flex items-center justify-between gap-3 text-xs font-mono text-red-300">
          <div className="flex items-center gap-2">
            <span>✕</span>
            <span>{scanError}</span>
          </div>
          <button
            type="button"
            onClick={() => setScanError(null)}
            className="text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── View Mode Navigation Tabs ─────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/[0.06] pb-2">
        {VIEW_TABS.map((tab) => {
          const isSelected = activeView === tab.id;
          let count = null;
          if (tab.id === "overview") count = totalFindingsCount;
          if (tab.id === "secrets") count = secretFindings.length;
          if (tab.id === "ast") count = astFindings.length;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                isSelected
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "bg-white/[0.02] text-slate-400 hover:text-slate-200 border border-white/[0.06]"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {count !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded ${
                    count > 0 ? "bg-amber-500/20 text-amber-300" : "bg-white/[0.05] text-slate-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Conditional Views ──────────────────────────────────────────────── */}

      {/* 1. AI Code Review Panel */}
      {activeView === "codereview" && (
        <CodeReviewPanel
          projectId={projectId}
          tree={project?.tree || []}
          onInspectSource={handleOpenSourceInspector}
        />
      )}

      {/* 2. Unit Test Generator Panel */}
      {activeView === "testgen" && (
        <TestGeneratorPanel
          projectId={projectId}
          tree={project?.tree || []}
        />
      )}

      {/* 3. Security Audit Posture & Findings (Overview, Secrets, or AST) */}
      {(activeView === "overview" || activeView === "secrets" || activeView === "ast") && (
        <div className="flex-1 flex flex-col gap-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {/* Total / Scoped Count */}
            <div className="col-span-2 sm:col-span-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex flex-col justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                {activeView === "secrets"
                  ? "Secrets Found"
                  : activeView === "ast"
                  ? "AST Issues"
                  : "Total Findings"}
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span
                  className={`text-2xl font-bold font-mono ${
                    totalFindingsCount > 0 ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {activeView === "secrets"
                    ? secretFindings.length
                    : activeView === "ast"
                    ? astFindings.length
                    : totalFindingsCount}
                </span>
                <span className="text-[10px] font-mono text-slate-500">items</span>
              </div>
            </div>

            {/* Critical */}
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider">
                  Critical
                </span>
                <span className="text-xs">🛑</span>
              </div>
              <span className="text-2xl font-bold font-mono text-red-400 mt-2">
                {severityCounts.Critical}
              </span>
            </div>

            {/* High */}
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.03] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-orange-400 uppercase tracking-wider">
                  High
                </span>
                <span className="text-xs">⚠️</span>
              </div>
              <span className="text-2xl font-bold font-mono text-orange-400 mt-2">
                {severityCounts.High}
              </span>
            </div>

            {/* Medium */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                  Medium
                </span>
                <span className="text-xs">⚡</span>
              </div>
              <span className="text-2xl font-bold font-mono text-amber-400 mt-2">
                {severityCounts.Medium}
              </span>
            </div>

            {/* Low */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.03] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">
                  Low
                </span>
                <span className="text-xs">ℹ️</span>
              </div>
              <span className="text-2xl font-bold font-mono text-blue-400 mt-2">
                {severityCounts.Low}
              </span>
            </div>

            {/* Files Scanned */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 flex flex-col justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Files Scanned
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-bold font-mono text-cyan-400">
                  {filesScannedCount}
                </span>
                <span className="text-[10px] font-mono text-slate-500">files</span>
              </div>
            </div>
          </div>

          {/* Dedicated Secret Scanner Callout */}
          {activeView === "secrets" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3.5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-sm">
                  🔑
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-100">
                    Deterministic Secret Redaction Active
                  </span>
                  <p className="text-[11px] text-slate-400">
                    ArchMind tests 20+ credential signatures (AWS, GitHub, Slack, OpenAI, MongoDB URIs). Real secrets are never rendered or logged.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                🛡️ Zero-Leak Guarantee
              </span>
            </div>
          )}

          {/* Dedicated AST Callout */}
          {activeView === "ast" && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/[0.04] p-3.5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-sm">
                  ⚡
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-100">
                    Tree-sitter AST Structural Security Analysis
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Inspects JavaScript/TypeScript abstract syntax trees for command execution, code injection (eval), path traversal, and weak cryptography.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 shrink-0">
                Tree-sitter Parser
              </span>
            </div>
          )}

          {/* ── Filter & Search Control Bar ───────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
            {/* Severity Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {["ALL", "Critical", "High", "Medium", "Low"].map((sev) => {
                const isSelected = selectedSeverity === sev;
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSelectedSeverity(sev)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      isSelected
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-white/[0.02] text-slate-400 hover:text-slate-200 border border-white/[0.06]"
                    }`}
                  >
                    <span>{sev}</span>
                    <span className="text-[10px] opacity-75">
                      ({sev === "ALL" ? totalFindingsCount : severityCounts[sev] || 0})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Status & Search Inputs */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#04070d] border border-white/[0.08] text-xs font-mono text-slate-300 outline-none focus:border-cyan-500/40 cursor-pointer"
              >
                <option value="ALL">Status: All</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="ignored">Ignored</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#04070d] border border-white/[0.08] text-xs font-mono text-slate-300 outline-none focus:border-cyan-500/40 cursor-pointer"
              >
                <option value="severity">Sort: Severity</option>
                <option value="location">Sort: File & Line</option>
              </select>

              {/* Search Query */}
              <div className="relative min-w-[200px]">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter category, rule, path..."
                  className="w-full px-3 py-1.5 rounded-lg bg-[#04070d] border border-white/[0.08] text-xs font-mono text-slate-200 outline-none focus:border-cyan-500/40 placeholder:text-slate-600"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1.5 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Findings List Viewport ────────────────────────────────────── */}
          <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto custom-scrollbar">
            {isLoadingData && liveFindings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                <div className="w-6 h-6 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-3" />
                <span className="text-xs font-mono">Loading security findings...</span>
              </div>
            ) : liveSummary?.status === "incomplete" ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center rounded-xl border border-amber-500/20 bg-amber-500/[0.02]">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-2xl mb-4">
                  ⚠️
                </div>
                <h4 className="text-base font-bold text-slate-200">Security Scan Incomplete</h4>
                <p className="text-xs text-slate-400 max-w-md mt-1 mb-4 leading-relaxed font-mono">
                  Source files could not be read during repository scan. Trigger a re-scan once repository files are extracted.
                </p>
                <button
                  type="button"
                  onClick={handleTriggerScan}
                  disabled={isScanningActive}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 cursor-pointer"
                >
                  {isScanningActive ? "Scanning..." : "Retry Security Scan"}
                </button>
              </div>
            ) : totalFindingsCount === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-xl border border-white/[0.04] bg-white/[0.01]">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl mb-4 shadow-lg shadow-emerald-500/5">
                  🛡️
                </div>
                <h4 className="text-base font-bold text-slate-200">
                  Clean Security Audit — Zero Findings
                </h4>
                <p className="text-xs text-slate-400 max-w-md mt-1 mb-3 leading-relaxed">
                  ArchMind inspected {filesScannedCount ? `${filesScannedCount} repository source files` : "repository source files"} and found no hardcoded secrets, injection vectors, or command execution vulnerabilities.
                </p>
                <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
                  ✓ Verified against secret signatures and AST security rules
                </div>
              </div>
            ) : filteredFindings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                <p className="text-xs font-mono text-slate-500">
                  No findings matching current filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSeverity("ALL");
                    setSelectedStatus("ALL");
                    setSelectedSource("ALL");
                    setSearchTerm("");
                  }}
                  className="mt-2 text-xs font-mono text-cyan-400 hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              filteredFindings.map((finding, idx) => {
                const sevConfig =
                  SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.Medium;
                const isSecret =
                  finding.source === "secret_scanner" || Boolean(finding.maskedValue);
                const sLine = finding.startLine || finding.lineNumber || 1;
                const eLine = finding.endLine || sLine;

                return (
                  <div
                    key={finding._id || `${finding.filePath}-${sLine}-${idx}`}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all hover:bg-white/[0.025] ${
                      finding.status === "resolved"
                        ? "border-emerald-500/20 bg-emerald-950/[0.05] opacity-75"
                        : finding.status === "ignored"
                        ? "border-slate-500/20 bg-slate-900/[0.2] opacity-60"
                        : `${sevConfig.border} bg-white/[0.015]`
                    }`}
                  >
                    {/* Left: Badges, Title, Path, and Masked Evidence */}
                    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Severity Badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${sevConfig.badge}`}
                        >
                          {finding.severity}
                        </span>

                        {/* Title or Category */}
                        <span className="text-xs font-bold text-slate-100">
                          {finding.title || finding.category}
                        </span>

                        {/* Engine Pill */}
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-white/[0.03] border border-white/[0.06]">
                          {finding.source === "secret_scanner"
                            ? "Secret"
                            : finding.source === "ast_analyzer"
                            ? "AST"
                            : "AI"}
                        </span>

                        {/* Status Pill */}
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold uppercase ${
                            finding.status === "resolved"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : finding.status === "ignored"
                              ? "bg-slate-500/20 text-slate-400"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {finding.status || "open"}
                        </span>
                      </div>

                      {/* File Path & Line Citation */}
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <span className="text-slate-300 truncate max-w-sm">
                          {finding.filePath}
                        </span>
                        <span className="text-amber-400 font-semibold shrink-0">
                          :line {sLine}{eLine !== sLine ? `–${eLine}` : ""}
                        </span>
                      </div>

                      {/* Masked Secret Evidence or Redacted Snippet */}
                      {isSecret && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-500">
                            Masked Value:
                          </span>
                          <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#04070d] border border-amber-500/30 text-amber-300 font-bold tracking-wider">
                            {finding.maskedValue || "••••••••••••••••"}
                          </code>
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                            Safe Redaction
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {/* Inspect Code Snippet Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenSourceInspector(finding.filePath, sLine, eLine)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                        title="Inspect referenced lines in code viewer"
                      >
                        <span>👁</span>
                        <span>Inspect</span>
                      </button>

                      {/* View Details Drawer Button */}
                      <button
                        type="button"
                        onClick={() => setActiveFinding(finding)}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-all cursor-pointer"
                        title="Open remediation & security details"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Slide-Over Finding Detail Drawer ───────────────────────────────── */}
      <FindingDetailDrawer
        key={activeFinding?._id || "none"}
        finding={activeFinding}
        projectId={projectId}
        isOpen={Boolean(activeFinding)}
        onClose={() => setActiveFinding(null)}
        onInspectSource={handleOpenSourceInspector}
        onStatusChange={handleStatusUpdate}
      />

      {/* ── Focused Source Snippet Inspector ──────────────────────────────── */}
      <SourceSnippetInspector
        projectId={projectId}
        filePath={inspectorConfig.filePath}
        startLine={inspectorConfig.startLine}
        endLine={inspectorConfig.endLine}
        isOpen={inspectorConfig.isOpen}
        onClose={() => setInspectorConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* ── Footer Status ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-[11px] font-mono text-slate-500">
        <span>Deterministic RIE Security Engine • Tree-sitter AST • Groq LLM Review</span>
        <span>
          {liveSummary?.completedAt
            ? `Scanned: ${new Date(liveSummary.completedAt).toLocaleTimeString()}`
            : "Live Protection Active"}
        </span>
      </div>
    </div>
  );
}
