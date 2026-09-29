// client/src/components/project/ProjectHeader.jsx
import { Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { WORKSPACE_TABS, isTabEnabled, getTabDetails } from "../../constants/workspaceTabs";

export default function ProjectHeader({ project, activeTab, onTabChange }) {
  const isGithub = project?.source === "github";
  const name = project?.name || "Untitled Project";
  const status = project?.status || "uploaded";
  const branch = project?.github?.defaultBranch || "main";
  const fullName = project?.github?.fullName || name;
  const capabilities = project?.capabilities || {};

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-white/[0.08] archmind-glass bg-[#060a12]/90 backdrop-blur-md">
      {/* Top Navigation Row */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3">
        {/* Left: Brand & Back to Dashboard */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
            aria-label="Back to Dashboard"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <div className="w-px h-4 bg-white/10 hidden sm:block" />

          {/* Project Title & Badges */}
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-semibold text-slate-100 truncate max-w-[200px] sm:max-w-[320px]">
              {fullName}
            </h1>

            {/* Source Pill */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border bg-white/[0.04] text-slate-400 border-white/[0.08] shrink-0">
              {isGithub ? (
                <>
                  <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.63-5.373-12-12-12z" />
                  </svg>
                  <span>GitHub ({branch})</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>ZIP Upload</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Right: Status & User */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {status}
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Workspace Feature Tabs Bar - Responsive Horizontal Scroll */}
      <div className="flex items-center gap-1 px-4 sm:px-6 border-t border-white/[0.05] overflow-x-auto no-scrollbar">
        {WORKSPACE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const enabled = isTabEnabled(tab, capabilities);
          const details = getTabDetails(tab, capabilities);
          const primaryTech = details.length > 0 ? details[0] : null;

          // Analysis status for this module
          const analysis = project?.analysis || {};
          const moduleName = tab.analysisModule;
          const moduleStatus = moduleName && analysis[moduleName]?.status;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={[
                "flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0",
                enabled
                  ? isActive
                    ? "border-cyan-400 text-cyan-300 bg-cyan-500/[0.05]"
                    : "border-transparent text-slate-300 hover:text-slate-100 hover:border-slate-700"
                  : isActive
                  ? "border-slate-600 text-slate-400 bg-white/[0.02]"
                  : "border-transparent text-slate-500 hover:text-slate-400",
              ].join(" ")}
            >
              <span className={enabled ? "text-slate-400" : "text-slate-600"}>{tab.icon}</span>
              <span>{tab.label}</span>

              {/* Dynamic Badge Based on Capability & Analysis Status */}
              {enabled ? (
                moduleStatus === "completed" ? (
                  <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ✓ Done
                  </span>
                ) : moduleStatus === "queued" || moduleStatus === "processing" ? (
                  <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
                    {moduleStatus === "queued" ? "Queued" : "Running"}
                  </span>
                ) : moduleStatus === "failed" ? (
                  <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-red-500/20 text-red-300 border border-red-500/30">
                    Failed
                  </span>
                ) : primaryTech ? (
                  <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {primaryTech}
                  </span>
                ) : tab.id === "security" ? (
                  <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Relevant
                  </span>
                ) : null
              ) : (
                <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-slate-800/60 text-slate-500 border border-slate-700/50">
                  Not Available
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}

