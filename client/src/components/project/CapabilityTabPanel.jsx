// client/src/components/project/CapabilityTabPanel.jsx
//
// Renders the main canvas content for capability module tabs.
// Shows module status, detection details, and generate/retry actions.
// Backend is the source of truth for all capability and analysis state.

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { isTabEnabled, getTabDetails } from "../../constants/workspaceTabs";
import { runModuleAnalysis } from "../../services/projectService";
import ErdCanvas from "./erd/ErdCanvas";

/**
 * Status configuration for visual rendering
 */
const STATUS_DISPLAY = {
  idle:        { icon: "○", label: "Not Generated", color: "slate",   animate: false },
  queued:      { icon: "◎", label: "Queued",        color: "cyan",    animate: true },
  processing:  { icon: "⟳", label: "Processing",   color: "cyan",    animate: true },
  completed:   { icon: "✓", label: "Completed",     color: "emerald", animate: false },
  failed:      { icon: "✕", label: "Failed",        color: "red",     animate: false },
};

export default function CapabilityTabPanel({ tab, project, onAnalysisUpdate }) {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const projectId = project?.id || project?._id;
  const capabilities = project?.capabilities || {};
  const analysis = project?.analysis || {};
  const analysisResults = project?.analysisResults || {};

  // Get analysis module status
  const moduleName = tab?.analysisModule;
  const moduleStatus = moduleName ? (analysis[moduleName]?.status || "idle") : "idle";
  const statusDisplay = STATUS_DISPLAY[moduleStatus] || STATUS_DISPLAY.idle;

  /**
   * Trigger analysis generation for this module.
   */
  const handleGenerate = useCallback(async () => {
    if (!projectId || !moduleName) return;
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) throw new Error("Authentication expired");
      const result = await runModuleAnalysis(token, projectId, moduleName);
      if (onAnalysisUpdate) onAnalysisUpdate(result);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, moduleName, getToken, onAnalysisUpdate]);

  if (!tab) return null;

  const enabled = isTabEnabled(tab, capabilities);
  const details = getTabDetails(tab, capabilities);

  // If tab is ERD and analysis is completed, render interactive ErdCanvas
  if (tab?.id === "erd" && moduleStatus === "completed") {
    const erdData = analysisResults?.erd || null;
    return (
      <ErdCanvas
        erdData={erdData}
        onRegenerate={handleGenerate}
        isRegenerating={isLoading}
      />
    );
  }

  // ── Disabled State: Module Not Available ──────────────────────────────────
  if (!enabled) {
    const { emptyState } = tab;
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 rounded-xl border border-white/[0.08] bg-[#070c16]/80 text-center backdrop-blur-sm min-h-[480px]">
        <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-500 mb-4 text-2xl">
          {tab.icon}
        </div>

        <h3 className="text-base font-bold text-slate-300">{emptyState?.title || tab.label}</h3>

        <p className="text-xs font-semibold text-slate-400 max-w-md mt-2">
          {emptyState?.subtitle}
        </p>

        <p className="text-xs text-slate-500 max-w-md mt-2 mb-6 leading-relaxed font-normal">
          {emptyState?.description}
        </p>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border bg-slate-800/60 text-slate-400 border-slate-700/60">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          [{emptyState?.badge || "Not Available"}]
        </span>
      </div>
    );
  }

  // ── Enabled State: Module Active Panel ────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 rounded-xl border border-cyan-500/20 bg-[#070c16]/90 text-center backdrop-blur-sm relative overflow-hidden min-h-[480px]">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Module Icon */}
      <div className={[
        "w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-2xl shadow-lg transition-all",
        moduleStatus === "completed"
          ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-emerald-500/10"
          : moduleStatus === "failed"
          ? "bg-red-500/10 border border-red-500/30 text-red-400 shadow-red-500/10"
          : "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-cyan-500/10",
      ].join(" ")}>
        {tab.icon}
      </div>

      {/* Analysis Status Badge */}
      <div className={[
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium border mb-3",
        moduleStatus === "completed"
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : moduleStatus === "failed"
          ? "bg-red-500/10 text-red-400 border-red-500/20"
          : moduleStatus === "queued" || moduleStatus === "processing"
          ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
          : "bg-white/[0.04] text-slate-400 border-white/[0.08]",
      ].join(" ")}>
        <span className={[
          "w-1.5 h-1.5 rounded-full",
          moduleStatus === "completed" ? "bg-emerald-400"
            : moduleStatus === "failed" ? "bg-red-400"
            : statusDisplay.animate ? "bg-cyan-400 animate-pulse"
            : "bg-slate-500",
        ].join(" ")} />
        {statusDisplay.label}
      </div>

      {/* Module Title */}
      <h3 className="text-lg font-bold text-slate-100">{tab.label}</h3>

      {/* Context Description */}
      <p className="text-xs font-medium text-slate-300 max-w-md mt-1.5">
        {tab.id === "security"
          ? "Security-sensitive code detected"
          : `${tab.label} capability active for this repository`}
      </p>

      {/* Technology Details Badges */}
      {details.length > 0 ? (
        <div className="flex flex-wrap gap-2 justify-center mt-5 mb-4">
          {details.map((tech) => (
            <span
              key={tech}
              className="px-3 py-1 rounded-lg text-xs font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm"
            >
              {tech}
            </span>
          ))}
        </div>
      ) : tab.id === "security" ? (
        <div className="flex flex-wrap gap-2 justify-center mt-5 mb-4">
          <span className="px-3 py-1 rounded-lg text-xs font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
            Auth & Sensitive Signals Detected
          </span>
        </div>
      ) : null}

      {/* Description */}
      <p className="text-xs text-slate-400 max-w-md mt-2 leading-relaxed">
        {tab.id === "erd" && "Entity Relationship Diagram (ERD) generation is ready for this codebase."}
        {tab.id === "apis" && "API sequence modeling & endpoint route mapping are ready for this codebase."}
        {tab.id === "devops" && "Container configurations & deployment manifests detected for infrastructure modeling."}
        {tab.id === "security" && "Security analysis & pattern auditing are relevant based on repository code signals."}
      </p>

      {/* Error Display */}
      {(error || analysis[moduleName]?.errorMessage) && (
        <div className="mt-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-mono text-red-400 max-w-md">
          {error || analysis[moduleName]?.errorMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex items-center gap-3">
        {moduleStatus === "completed" ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-white/[0.05] border border-white/10 text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Regenerate
          </button>
        ) : moduleStatus === "queued" || moduleStatus === "processing" ? (
          <div className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <span className="w-3.5 h-3.5 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
            <span className="text-xs font-semibold">
              {moduleStatus === "queued" ? "Queued for processing..." : "Generating analysis..."}
            </span>
          </div>
        ) : moduleStatus === "failed" ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className={[
              "px-5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              isLoading
                ? "bg-red-500/10 border border-red-500/20 text-red-400 cursor-wait"
                : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20",
            ].join(" ")}
          >
            {isLoading ? "Retrying..." : "Retry Analysis"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className={[
              "px-5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              isLoading
                ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 cursor-wait"
                : "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-300 hover:from-cyan-500/30 hover:to-blue-500/30 shadow-lg shadow-cyan-500/5",
            ].join(" ")}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              `Generate ${tab.label}`
            )}
          </button>
        )}
      </div>
    </div>
  );
}
