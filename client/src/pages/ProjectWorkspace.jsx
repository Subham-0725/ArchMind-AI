import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { fetchProjectById, runFullAnalysis } from "../services/projectService";
import ProjectHeader from "../components/project/ProjectHeader";
import ProjectOverviewCard from "../components/project/ProjectOverviewCard";
import TechStackCard from "../components/project/TechStackCard";
import FileTreeExplorer from "../components/project/FileTreeExplorer";
import TopologyCanvas from "../components/project/topology/TopologyCanvas";
import CapabilityTabPanel from "../components/project/CapabilityTabPanel";
import AnalysisPanel from "../components/project/AnalysisPanel";
import RepositoryChatDrawer from "../components/project/chat/RepositoryChatDrawer";
import { WORKSPACE_TABS } from "../constants/workspaceTabs";

export default function ProjectWorkspace() {
  const { id } = useParams();
  const { getToken, isLoaded } = useAuth();

  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("topology");
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Repository AI Chat Drawer State
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Selected file path in File Tree Explorer
  const [selectedFilePath, setSelectedFilePath] = useState(null);

  // Load project workspace data
  const loadProject = useCallback(async () => {
    if (!isLoaded || !id) return;
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication session expired. Please sign in.");
      }

      const data = await fetchProjectById(token, id);
      setProject(data);
    } catch (err) {
      console.error("[ProjectWorkspace] Failed to load project:", err);
      const msg = err.response?.data?.error || err.message || "Failed to load project.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [id, isLoaded, getToken]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      if (!isLoaded || !id) return;
      try {
        setIsLoading(true);
        setError(null);
        const token = await getToken();
        if (!token) {
          throw new Error("Authentication session expired. Please sign in.");
        }
        const data = await fetchProjectById(token, id);
        if (!ignore) setProject(data);
      } catch (err) {
        if (!ignore) {
          console.error("[ProjectWorkspace] Failed to load project:", err);
          const msg = err.response?.data?.error || err.message || "Failed to load project.";
          setError(msg);
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [id, isLoaded, getToken]);

  /**
   * Called after any analysis action (full or per-module).
   * Re-fetches the project to get fresh analysis state from the backend.
   */
  const handleAnalysisUpdate = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await fetchProjectById(token, id);
      setProject(data);
    } catch (err) {
      console.error("[ProjectWorkspace] Failed to refresh after analysis:", err);
    }
  }, [id, getToken]);

  /**
   * Selects a file in the File Tree Explorer.
   * Updates selection highlight only without fetching or opening a code viewer.
   */
  const handleSelectFile = useCallback((filePath) => {
    setSelectedFilePath(filePath);
  }, []);

  /**
   * Explicitly force re-analysis on demand (?force=true)
   */
  const handleForceReanalyze = useCallback(async () => {
    if (!id) return;
    try {
      setIsReanalyzing(true);
      const token = await getToken();
      if (!token) throw new Error("Authentication session expired.");
      await runFullAnalysis(token, id, { force: true });
      await handleAnalysisUpdate();
    } catch (err) {
      console.error("[ProjectWorkspace] Force re-analyze error:", err);
    } finally {
      setIsReanalyzing(false);
    }
  }, [id, getToken, handleAnalysisUpdate]);

  // Auto-poll project state every 2.5 seconds while any module is queued or processing
  useEffect(() => {
    if (!project?.analysis) return;

    const hasActiveJob = Object.values(project.analysis).some(
      (mod) => mod?.status === "queued" || mod?.status === "processing"
    );

    if (!hasActiveJob) return;

    const interval = setInterval(() => {
      handleAnalysisUpdate();
    }, 2500);

    return () => clearInterval(interval);
  }, [project?.analysis, handleAnalysisUpdate]);

  // Global Keyboard Shortcut: Ctrl+K or Ctrl+/ to toggle Repository AI Chat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.key === "/")) {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Loading State - Keep loading state explicit until capabilities & project are fetched
  if (isLoading || !isLoaded) {
    return (
      <div className="min-h-screen bg-[#04070d] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="relative flex items-center justify-center w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xs font-bold">
            AM
          </div>
        </div>
        <p className="text-sm font-mono text-cyan-300">Loading project capabilities...</p>
        <p className="text-xs text-slate-600 mt-1 font-mono">
          Fetching repository blueprint & capability matrix
        </p>
      </div>
    );
  }

  // Error State
  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#04070d] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4 text-xl">
          ✕
        </div>
        <h2 className="text-lg font-bold text-slate-200">Unable to Load Project</h2>
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-6">
          {error || "Project not found or access denied."}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadProject}
            className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Retry
          </button>
          <Link
            to="/dashboard"
            className="px-4 py-2 rounded-lg bg-cyan-500 text-xs font-semibold text-white hover:bg-cyan-400 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const selectedTabObj =
    WORKSPACE_TABS.find((t) => t.id === activeTab) || WORKSPACE_TABS[0];

  return (
    <div className="min-h-screen bg-[#04070d] text-slate-100 flex flex-col selection:bg-cyan-500/30 relative">
      {/* Workspace Header */}
      <ProjectHeader
        project={project}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onForceReanalyze={handleForceReanalyze}
        isReanalyzing={isReanalyzing}
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
      />

      {/* Main Workspace Grid (30% Sidebar, 70% Canvas) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 sm:p-6 max-w-[1920px] mx-auto w-full">
        {/* Left Sidebar (Overview, Tech Stack, Analysis, File Tree Explorer) */}
        <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
          <ProjectOverviewCard project={project} />
          <TechStackCard project={project} />
          <AnalysisPanel project={project} onAnalysisUpdate={handleAnalysisUpdate} />
          <FileTreeExplorer
            tree={project.tree || []}
            selectedFilePath={selectedFilePath}
            onSelectFile={handleSelectFile}
          />
        </aside>

        {/* Right Canvas Area */}
        <section className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-[600px] relative">
          {activeTab === "topology" ? (
            <div className="flex-1 flex flex-col">
              <TopologyCanvas
                topology={project.analysisResults?.architecture || project.topology}
              />
            </div>
          ) : (
            <CapabilityTabPanel
              tab={selectedTabObj}
              project={project}
              onAnalysisUpdate={handleAnalysisUpdate}
            />
          )}
        </section>
      </main>

      {/* Floating "Ask AI" Trigger Button (Quick access when scrolled) */}
      {!isChatOpen && (
        <button
          type="button"
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 font-bold text-xs shadow-xl shadow-cyan-500/25 hover:shadow-cyan-400/35 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-cyan-300/40 group"
          title="Open Repository AI Chat (Ctrl+K or Ctrl+/)"
          aria-label="Open Repository AI Chat"
        >
          <svg
            className="w-4 h-4 text-slate-950 group-hover:scale-110 transition-transform"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <span>Ask AI</span>
          <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-slate-950/20 text-[10px] font-mono font-medium">
            Ctrl+K
          </span>
        </button>
      )}

      {/* Repository AI Chat Drawer */}
      <RepositoryChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        projectId={id}
        project={project}
      />
    </div>
  );
}
