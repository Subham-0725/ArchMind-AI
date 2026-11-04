// client/src/components/project/devops/DevOpsCenterTab.jsx
//
// ArchMind AI — Phase 5 DevOps Center Workspace.
// Integrates:
// 1. Multi-artifact management (Dockerfile, GitHub Actions CI/CD, Kubernetes)
// 2. Selective generation flow with grounded repository context
// 3. Syntax-highlighted artifact preview viewer with line numbers
// 4. Deterministic validation report panel (structural checks, secrets, selectors)
// 5. Artifact regeneration with non-destructive versioning
// 6. Safe deletion dialog and multi-tenant error isolation

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  fetchDevOpsArtifacts,
  fetchDevOpsArtifact,
  generateDevOpsArtifacts,
  regenerateDevOpsArtifact,
  validateDevOpsArtifact,
  deleteDevOpsArtifact,
} from "../../../services/projectService";
import DevOpsArtifactViewer from "./DevOpsArtifactViewer";
import ValidationDrawer from "./ValidationDrawer";
import GenerateArtifactsModal from "./GenerateArtifactsModal";
import DeleteArtifactModal from "./DeleteArtifactModal";

const ARTIFACT_NAV_TABS = [
  { id: "dockerfile", label: "Dockerfile", icon: "🐳", defaultPath: "Dockerfile" },
  { id: "cicd", label: "CI/CD Pipeline", icon: "🚀", defaultPath: ".github/workflows/ci.yml" },
  { id: "kubernetes", label: "Kubernetes", icon: "☸️", defaultPath: "k8s/deployment.yaml" },
];

export default function DevOpsCenterTab({ project, onAnalysisUpdate }) {
  const { getToken } = useAuth();
  const projectId = project?._id || project?.id;

  const [activeTab, setActiveTab] = useState("dockerfile");
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Notifications & Modals
  const [notification, setNotification] = useState(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [artifactToDelete, setArtifactToDelete] = useState(null);

  const showNotification = useCallback((type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  }, []);

  // 1. Fetch active artifacts list for the project
  const loadArtifacts = useCallback(async () => {
    if (!projectId) return;
    try {
      setIsLoadingList(true);
      const token = await getToken();
      if (!token) throw new Error("Authentication token expired.");

      const list = await fetchDevOpsArtifacts(token, projectId);
      setArtifacts(list || []);

      // If an artifact of the current activeTab exists, load it
      const matching = (list || []).find((a) => a.artifactType === activeTab && !a.superseded);
      if (matching) {
        const full = await fetchDevOpsArtifact(token, projectId, matching.id);
        setSelectedArtifact(full);
      } else {
        setSelectedArtifact(null);
      }
    } catch (err) {
      console.error("[DevOpsCenterTab] Failed to load artifacts:", err);
      showNotification("error", err.response?.data?.error || err.message || "Failed to load DevOps artifacts.");
    } finally {
      setIsLoadingList(false);
    }
  }, [projectId, activeTab, getToken, showNotification]);

  useEffect(() => {
    let isMounted = true;
    async function initArtifacts() {
      if (!projectId) return;
      try {
        setIsLoadingList(true);
        const token = await getToken();
        if (!token || !isMounted) return;

        const list = await fetchDevOpsArtifacts(token, projectId);
        if (!isMounted) return;
        setArtifacts(list || []);

        const matching = (list || []).find((a) => a.artifactType === activeTab && !a.superseded);
        if (matching) {
          const full = await fetchDevOpsArtifact(token, projectId, matching.id);
          if (isMounted) setSelectedArtifact(full);
        } else {
          if (isMounted) setSelectedArtifact(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("[DevOpsCenterTab] Failed to load artifacts:", err);
          showNotification("error", err.response?.data?.error || err.message || "Failed to load DevOps artifacts.");
        }
      } finally {
        if (isMounted) setIsLoadingList(false);
      }
    }

    initArtifacts();
    return () => {
      isMounted = false;
    };
  }, [projectId, activeTab, getToken, showNotification]);

  // Map active artifacts by type for rapid tab status lookup
  const artifactsByType = useMemo(() => {
    const map = {
      dockerfile: null,
      cicd: null,
      kubernetes: null,
    };
    for (const a of artifacts) {
      if (!a.superseded && map[a.artifactType] === null) {
        map[a.artifactType] = a;
      }
    }
    return map;
  }, [artifacts]);

  // 2. Handle switching tabs (e.g. from Dockerfile to CI/CD)
  const handleTabChange = async (tabId) => {
    setActiveTab(tabId);
    const existing = artifactsByType[tabId];
    if (existing) {
      try {
        setIsLoadingDetail(true);
        const token = await getToken();
        if (token) {
          const detail = await fetchDevOpsArtifact(token, projectId, existing.id);
          setSelectedArtifact(detail);
        }
      } catch {
        setSelectedArtifact(existing);
      } finally {
        setIsLoadingDetail(false);
      }
    } else {
      setSelectedArtifact(null);
    }
  };

  // 3. Generate Artifacts Flow
  const handleGenerate = async ({ artifactTypes, options }) => {
    try {
      setIsGenerating(true);
      const token = await getToken();
      if (!token) throw new Error("Authentication token expired.");

      const generated = await generateDevOpsArtifacts(token, projectId, artifactTypes, options);

      setIsGenerateModalOpen(false);
      showNotification("success", `Generated ${generated.length} DevOps artifact(s) successfully.`);

      // Refresh list
      const freshList = await fetchDevOpsArtifacts(token, projectId);
      setArtifacts(freshList || []);

      // Select active tab's artifact
      const currentActive = (freshList || []).find((a) => a.artifactType === activeTab && !a.superseded);
      if (currentActive) {
        const full = await fetchDevOpsArtifact(token, projectId, currentActive.id);
        setSelectedArtifact(full);
      } else if (generated.length > 0) {
        const firstType = generated[0].artifactType;
        setActiveTab(firstType);
        setSelectedArtifact(generated[0]);
      }

      if (onAnalysisUpdate) {
        onAnalysisUpdate();
      }
    } catch (err) {
      console.error("[DevOpsCenterTab] Generation failed:", err);
      showNotification("error", err.response?.data?.error || err.message || "DevOps generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 4. Re-validate Artifact
  const handleRevalidate = async () => {
    if (!selectedArtifact?.id) return;
    try {
      setIsValidating(true);
      const token = await getToken();
      if (!token) throw new Error("Authentication token expired.");

      const updated = await validateDevOpsArtifact(token, projectId, selectedArtifact.id);
      setSelectedArtifact(updated);

      // Update in list
      setArtifacts((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, validation: updated.validation } : a))
      );

      showNotification(
        updated.validation?.valid ? "success" : "warning",
        `Validation completed: ${updated.validation?.valid ? "All checks passed" : "Validation issues detected"}`
      );
    } catch (err) {
      console.error("[DevOpsCenterTab] Validation error:", err);
      showNotification("error", err.response?.data?.error || err.message || "Failed to validate artifact.");
    } finally {
      setIsValidating(false);
    }
  };

  // 5. Regenerate Artifact Flow
  const handleRegenerate = async () => {
    if (!selectedArtifact?.id) return;
    try {
      setIsRegenerating(true);
      const token = await getToken();
      if (!token) throw new Error("Authentication token expired.");

      const newVersion = await regenerateDevOpsArtifact(token, projectId, selectedArtifact.id);
      setSelectedArtifact(newVersion);

      // Refresh active list
      const freshList = await fetchDevOpsArtifacts(token, projectId);
      setArtifacts(freshList || []);

      showNotification("success", `Artifact regenerated as v${newVersion.version || 2}. Previous version preserved.`);
    } catch (err) {
      console.error("[DevOpsCenterTab] Regeneration error:", err);
      showNotification("error", err.response?.data?.error || err.message || "Regeneration failed.");
    } finally {
      setIsRegenerating(false);
    }
  };

  // 6. Delete Artifact Flow
  const handleDeleteConfirm = async (artifactId) => {
    try {
      setIsDeleting(true);
      const token = await getToken();
      if (!token) throw new Error("Authentication token expired.");

      await deleteDevOpsArtifact(token, projectId, artifactId);

      setArtifactToDelete(null);
      setSelectedArtifact(null);

      // Refresh list
      const freshList = await fetchDevOpsArtifacts(token, projectId);
      setArtifacts(freshList || []);

      showNotification("success", "DevOps artifact deleted from ArchMind AI.");
    } catch (err) {
      console.error("[DevOpsCenterTab] Deletion error:", err);
      showNotification("error", err.response?.data?.error || err.message || "Failed to delete artifact.");
    } finally {
      setIsDeleting(false);
    }
  };

  const isProjectAnalyzed = project?.status === "completed" || Boolean(project?.blueprint);

  return (
    <div className="flex-1 flex flex-col gap-5 text-slate-100 font-sans pb-10">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-white/[0.08] bg-[#070c16]/90 backdrop-blur-md shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-2xl shadow-inner">
            ⚙️
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-slate-100 tracking-tight font-mono">
                DevOps Center
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                Phase 5
              </span>
              {project?.primaryLanguage && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.05] border border-white/10 text-slate-400">
                  {project.primaryLanguage}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1 leading-relaxed">
              Generate, inspect, and validate deployment artifacts for this repository.
            </p>
          </div>
        </div>

        {/* Primary Header Actions */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={loadArtifacts}
            disabled={isLoadingList}
            className="px-3 py-2 rounded-xl text-xs font-mono font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
            title="Refresh DevOps artifacts"
          >
            <span className={isLoadingList ? "animate-spin" : ""}>⟳</span>
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsGenerateModalOpen(true)}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-40 flex items-center gap-2 font-mono"
          >
            <span>+</span>
            <span>Generate Artifacts</span>
          </button>
        </div>
      </div>

      {/* ── Notification Banner ────────────────────────────────────────────── */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            notification.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              : notification.type === "warning"
              ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
              : "bg-red-500/10 border-red-500/25 text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{notification.type === "success" ? "✓" : notification.type === "warning" ? "⚠️" : "✕"}</span>
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Analysis Status Warning (If repo is not yet analyzed) ─────────── */}
      {!isProjectAnalyzed && (
        <div className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] text-amber-200 text-xs font-mono flex items-start gap-3">
          <span className="text-base mt-0.5">⚠️</span>
          <div>
            <h4 className="font-bold text-amber-300">Repository Analysis Recommended</h4>
            <p className="mt-0.5 text-[11px] text-amber-200/80 leading-relaxed">
              This repository has not finished full static analysis. Generating DevOps artifacts now will use available file tree manifests, but deep API routing and database probes are best determined after full analysis.
            </p>
          </div>
        </div>
      )}

      {/* ── Artifact Navigation Tabs ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-1">
        {ARTIFACT_NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const art = artifactsByType[tab.id];

          // Compute separate generation vs validation status badges
          let badge = { text: "Not Generated", style: "bg-white/[0.04] text-slate-400 border-white/[0.06]" };
          if (art) {
            const isValid = art.validation?.valid;
            const hasErrors = art.validation?.errors?.length > 0;
            const hasWarnings = art.validation?.warnings?.length > 0;

            if (hasErrors || isValid === false) {
              badge = { text: "Validation Failed", style: "bg-red-500/15 text-red-400 border-red-500/30" };
            } else if (hasWarnings) {
              badge = { text: "Warnings", style: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
            } else if (isValid) {
              badge = { text: "Validation Passed", style: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
            } else {
              badge = { text: "Generated", style: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" };
            }
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2.5 rounded-xl font-mono text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                isActive
                  ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shadow-lg shadow-cyan-500/10"
                  : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${badge.style}`}>
                {badge.text}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Main Content Grid (Viewer & Validation Panel) ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Artifact Viewer (8 cols on lg) */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Action Toolbar when artifact exists */}
          {selectedArtifact && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-white/[0.08] bg-[#070c16]/80 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Actions:</span>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 text-cyan-300 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Regenerate with current analysis (preserves history)"
                >
                  <span className={isRegenerating ? "animate-spin" : ""}>⟳</span>
                  <span>{isRegenerating ? "Regenerating..." : "Regenerate"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setArtifactToDelete(selectedArtifact)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Delete artifact from ArchMind AI"
                >
                  <span>🗑️</span>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}

          <DevOpsArtifactViewer
            artifact={selectedArtifact}
            isLoading={isLoadingDetail}
            onGenerateClick={() => setIsGenerateModalOpen(true)}
            activeType={activeTab}
          />
        </div>

        {/* Right Column: Validation Drawer & Metadata Panel (4 cols on lg) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <ValidationDrawer
            validation={selectedArtifact?.validation}
            isValidating={isValidating}
            onRevalidate={selectedArtifact ? handleRevalidate : null}
          />

          {/* Artifact Intelligence Card */}
          {selectedArtifact?.metadata && (
            <div className="p-4 rounded-xl border border-white/[0.08] bg-[#070c16] text-xs font-mono flex flex-col gap-2.5">
              <h5 className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <span>📊</span> Artifact Metadata
              </h5>
              <div className="flex flex-col gap-1.5 text-slate-400 text-[11px]">
                {selectedArtifact.metadata.packageManager && (
                  <div className="flex justify-between border-b border-white/[0.04] pb-1">
                    <span>Package Manager:</span>
                    <span className="text-slate-200 font-semibold">{selectedArtifact.metadata.packageManager}</span>
                  </div>
                )}
                {selectedArtifact.metadata.port && (
                  <div className="flex justify-between border-b border-white/[0.04] pb-1">
                    <span>Application Port:</span>
                    <span className="text-cyan-300 font-semibold">{selectedArtifact.metadata.port}</span>
                  </div>
                )}
                {selectedArtifact.metadata.targetPlatform && (
                  <div className="flex justify-between border-b border-white/[0.04] pb-1">
                    <span>Target Engine:</span>
                    <span className="text-slate-200 capitalize">{selectedArtifact.metadata.targetPlatform}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-white/[0.04] pb-1">
                  <span>Version:</span>
                  <span className="text-cyan-400 font-bold">v{selectedArtifact.version || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span>Provider:</span>
                  <span className="text-slate-200 capitalize">{selectedArtifact.metadata.provider || "Deterministic"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <GenerateArtifactsModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />

      <DeleteArtifactModal
        isOpen={Boolean(artifactToDelete)}
        artifact={artifactToDelete}
        onClose={() => setArtifactToDelete(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  );
}
