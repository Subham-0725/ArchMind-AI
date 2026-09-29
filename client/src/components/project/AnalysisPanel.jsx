// client/src/components/project/AnalysisPanel.jsx
//
// Sidebar card showing analysis module status and generation controls.
// Reads capabilities + analysis from the project data (backend is source of truth).
// Does NOT detect capabilities — only renders what the API provides.

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { runFullAnalysis, runModuleAnalysis } from "../../services/projectService";
import { WORKSPACE_TABS, isTabEnabled } from "../../constants/workspaceTabs";

// Maps analysis module name to display config
const MODULE_META = {
  architecture: { label: "Architecture", icon: "❖", color: "cyan" },
  erd:          { label: "ER Diagram", icon: "⬡", color: "emerald" },
  api:          { label: "API Sequences", icon: "⇄", color: "blue" },
  security:     { label: "Security Audit", icon: "🛡", color: "amber" },
  devops:       { label: "DevOps & CI/CD", icon: "⚙", color: "purple" },
};

const MODULE_ORDER = ["architecture", "erd", "api", "security", "devops"];

// Status icon and label rendering
const STATUS_CONFIG = {
  idle:       { icon: "○", label: "Not Generated", textClass: "text-slate-500", dotClass: "text-slate-600" },
  queued:     { icon: "◎", label: "Queued", textClass: "text-cyan-400", dotClass: "text-cyan-400 animate-pulse" },
  processing: { icon: "⟳", label: "Processing", textClass: "text-cyan-300", dotClass: "text-cyan-300 animate-spin" },
  completed:  { icon: "✓", label: "Completed", textClass: "text-emerald-400", dotClass: "text-emerald-400" },
  failed:     { icon: "✕", label: "Failed", textClass: "text-red-400", dotClass: "text-red-400" },
};

/**
 * Color utility classes per module color
 */
const colorClasses = {
  cyan:    { bg: "bg-cyan-500/10", border: "border-cyan-500/25", text: "text-cyan-400" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400" },
  blue:    { bg: "bg-blue-500/10", border: "border-blue-500/25", text: "text-blue-400" },
  amber:   { bg: "bg-amber-500/10", border: "border-amber-500/25", text: "text-amber-400" },
  purple:  { bg: "bg-purple-500/10", border: "border-purple-500/25", text: "text-purple-400" },
};

export default function AnalysisPanel({ project, onAnalysisUpdate }) {
  const { getToken } = useAuth();
  const [loadingModules, setLoadingModules] = useState(new Set());
  const [runningFull, setRunningFull] = useState(false);
  const [moduleErrors, setModuleErrors] = useState({});

  const projectId = project?.id || project?._id;

  /**
   * Get the relevance status of a module from the tab config.
   * Architecture is always relevant.
   */
  const isModuleRelevant = (moduleName) => {
    const tab = WORKSPACE_TABS.find((t) => t.analysisModule === moduleName);
    if (!tab) return false;
    return isTabEnabled(tab, project?.capabilities);
  };

  /**
   * Get the analysis status for a module.
   */
  const getModuleStatus = (moduleName) => {
    const mod = project?.analysis?.[moduleName];
    if (!mod || !mod.status) return "idle";
    return mod.status;
  };

  /**
   * Trigger analysis for a single module.
   */
  const handleModuleAnalysis = useCallback(async (moduleName) => {
    if (!projectId) return;
    try {
      setLoadingModules((prev) => new Set(prev).add(moduleName));
      setModuleErrors((prev) => ({ ...prev, [moduleName]: null }));

      const token = await getToken();
      if (!token) throw new Error("Authentication expired");

      const result = await runModuleAnalysis(token, projectId, moduleName);

      // Notify parent to refresh project data
      if (onAnalysisUpdate) onAnalysisUpdate(result);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || "Analysis failed";
      setModuleErrors((prev) => ({ ...prev, [moduleName]: errorMsg }));
    } finally {
      setLoadingModules((prev) => {
        const next = new Set(prev);
        next.delete(moduleName);
        return next;
      });
    }
  }, [projectId, getToken, onAnalysisUpdate]);

  /**
   * Run Full Analysis — queues all relevant modules at once.
   */
  const handleFullAnalysis = useCallback(async () => {
    if (!projectId) return;
    try {
      setRunningFull(true);
      setModuleErrors({});

      const token = await getToken();
      if (!token) throw new Error("Authentication expired");

      const result = await runFullAnalysis(token, projectId);

      if (onAnalysisUpdate) onAnalysisUpdate(result);
    } catch (err) {
      console.error("[AnalysisPanel] Full analysis error:", err);
    } finally {
      setRunningFull(false);
    }
  }, [projectId, getToken, onAnalysisUpdate]);

  // Check if all relevant implemented modules are completed
  const allRelevantCompleted = MODULE_ORDER.every((mod) => {
    if (!isModuleRelevant(mod)) return true;
    if (mod === "api" || mod === "security" || mod === "devops") return true; // future modules
    return getModuleStatus(mod) === "completed";
  });

  // Check if any modules are actively processing
  const anyProcessing = MODULE_ORDER.some((mod) => {
    if (!isModuleRelevant(mod)) return false;
    const st = getModuleStatus(mod);
    return st === "processing" || (st === "queued" && (mod === "architecture" || mod === "erd"));
  });

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070c16]/80 p-4 backdrop-blur-md flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Analysis Modules
        </h3>
        {anyProcessing && (
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Processing
          </span>
        )}
      </div>

      {/* Module List */}
      <div className="flex flex-col gap-2">
        {MODULE_ORDER.map((moduleName) => {
          const meta = MODULE_META[moduleName];
          const relevant = isModuleRelevant(moduleName);
          const status = getModuleStatus(moduleName);
          const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
          const colors = colorClasses[meta.color] || colorClasses.cyan;
          const isLoading = loadingModules.has(moduleName);
          const error = moduleErrors[moduleName];

          const tab = WORKSPACE_TABS.find((t) => t.analysisModule === moduleName);
          const detailKey = tab?.detailKey;
          const detailList = detailKey && project?.capabilities?.details?.[detailKey];
          const primaryDetail = Array.isArray(detailList) && detailList.length > 0 ? detailList[0] : null;

          return (
            <div
              key={moduleName}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
                relevant
                  ? `border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]`
                  : "border-white/[0.04] bg-white/[0.01] opacity-50",
              ].join(" ")}
            >
              {/* Module Icon */}
              <span className={`text-base shrink-0 ${relevant ? colors.text : "text-slate-600"}`}>
                {meta.icon}
              </span>

              {/* Module Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${relevant ? "text-slate-200" : "text-slate-500"}`}>
                    {meta.label}
                  </span>

                  {/* Detection detail badge */}
                  {relevant && primaryDetail && (
                    <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded ${colors.bg} ${colors.text} border ${colors.border}`}>
                      {primaryDetail}
                    </span>
                  )}
                </div>

                {/* Status Line */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] ${statusConfig.dotClass}`}>
                    {statusConfig.icon}
                  </span>
                  <span className={`text-[10px] font-mono ${statusConfig.textClass}`}>
                    {!relevant ? "Not Available" : statusConfig.label}
                  </span>
                  {error && (
                    <span className="text-[9px] font-mono text-red-400 truncate max-w-[120px]" title={error}>
                      — {error}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0">
                {!relevant ? (
                  <span className="px-2 py-1 rounded text-[10px] font-mono text-slate-600 bg-white/[0.02] border border-white/[0.04] cursor-not-allowed">
                    N/A
                  </span>
                ) : status === "completed" ? (
                  <span className="px-2 py-1 rounded text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                    Done
                  </span>
                ) : status === "queued" || status === "processing" || isLoading ? (
                  <span className="px-2 py-1 rounded text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                    {isLoading ? "..." : status === "queued" ? "Queued" : "Running"}
                  </span>
                ) : status === "failed" ? (
                  <button
                    type="button"
                    onClick={() => handleModuleAnalysis(moduleName)}
                    disabled={isLoading}
                    className="px-2 py-1 rounded text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleModuleAnalysis(moduleName)}
                    disabled={isLoading}
                    className="px-2 py-1 rounded text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors cursor-pointer"
                  >
                    Generate
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Run Full Analysis Button */}
      <button
        type="button"
        onClick={handleFullAnalysis}
        disabled={runningFull || allRelevantCompleted || anyProcessing}
        className={[
          "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all mt-1",
          runningFull || anyProcessing
            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 cursor-wait"
            : allRelevantCompleted
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default"
            : "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 hover:from-cyan-500/30 hover:to-blue-500/30 cursor-pointer shadow-lg shadow-cyan-500/5",
        ].join(" ")}
      >
        {runningFull || anyProcessing ? (
          <>
            <span className="w-3 h-3 border border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
            Running Analysis...
          </>
        ) : allRelevantCompleted ? (
          <>
            <span className="text-emerald-400">✓</span>
            All Analyses Complete
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run Full Analysis
          </>
        )}
      </button>
    </div>
  );
}
