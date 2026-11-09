// client/src/components/project/erd/ErdCanvas.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import EntityNode from "./EntityNode";
import { getLayoutedErdElements } from "./erdUtils";
import { exportErdAsPng, exportErdAsSvg } from "./erdExportUtils";
import EntityDetailDrawer from "./EntityDetailDrawer";
import RelationshipDetailModal from "./RelationshipDetailModal";

// ── Inner canvas component (lives inside ReactFlowProvider) ───────────────────
function ErdCanvasInner({
  activeErdData,
  activeSource,
  onSwitchSource,
  hasRepositoryErd,
  onRegenerate,
  isRegenerating,
}) {
  const [direction, setDirection] = useState("LR");
  const [showEmbedded, setShowEmbedded] = useState(false);
  const [entityFilter, setEntityFilter] = useState("all"); // 'all' | 'root' | 'embedded'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedRelationship, setSelectedRelationship] = useState(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView, zoomTo, setCenter } = useReactFlow();
  const fitScheduled = useRef(false);

  const nodeTypes = useMemo(() => ({ customEntity: EntityNode }), []);

  // Compute layouted graph elements whenever inputs change
  const layoutGraph = useCallback(
    (dir = direction) => {
      const { nodes: layoutedNodes, edges: layoutedEdges, allEntities } = getLayoutedErdElements(activeErdData, {
        direction: dir,
        showEmbedded,
        entityFilter,
        searchQuery,
        selectedEntityId,
      });

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setDirection(dir);
      fitScheduled.current = true;
    },
    [activeErdData, direction, showEmbedded, entityFilter, searchQuery, selectedEntityId, setNodes, setEdges]
  );

  // Re-layout on data or option change
  useEffect(() => {
    const timer = setTimeout(() => {
      layoutGraph(direction);
    }, 10);
    return () => clearTimeout(timer);
  }, [layoutGraph, direction]);

  // Fit view after layout paint
  useEffect(() => {
    if (fitScheduled.current && nodes.length > 0) {
      fitScheduled.current = false;
      const timer = setTimeout(() => {
        fitView({ padding: 0.2, duration: 400, maxZoom: 1.0 });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [nodes, fitView]);

  // Node Click: select entity, highlight connections, open drawer
  const handleNodeClick = useCallback(
    (_event, node) => {
      setSelectedRelationship(null);
      setSelectedEntityId(node.id);
      setSelectedEntity(node.data);
    },
    []
  );

  // Edge Click: open relationship details modal
  const handleEdgeClick = useCallback(
    (_event, edge) => {
      setSelectedRelationship(edge);
    },
    []
  );

  // Pane Click: deselect and close drawers
  const handlePaneClick = useCallback(() => {
    setSelectedEntityId(null);
    setSelectedEntity(null);
    setSelectedRelationship(null);
    setIsExportMenuOpen(false);
  }, []);

  // Search input handler: if enter pressed or search matches, focus first matching node
  const handleSearchKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && searchQuery.trim()) {
        const match = nodes.find((n) => n.data?.isMatch);
        if (match) {
          setSelectedEntityId(match.id);
          setSelectedEntity(match.data);
          setCenter(match.position.x + 150, match.position.y + 70, { duration: 500, zoom: 0.95 });
        }
      }
    },
    [nodes, searchQuery, setCenter]
  );

  // Select entity from drawer / link click
  const handleSelectEntityByName = useCallback(
    (entityName) => {
      if (!entityName) return;
      const target = nodes.find(
        (n) =>
          n.id.toLowerCase() === entityName.toLowerCase() ||
          n.data?.name?.toLowerCase() === entityName.toLowerCase()
      );
      if (target) {
        setSelectedEntityId(target.id);
        setSelectedEntity(target.data);
        setCenter(target.position.x + 150, target.position.y + 70, { duration: 500, zoom: 0.95 });
      }
    },
    [nodes, setCenter]
  );

  const handleResetFit = useCallback(() => {
    fitView({ padding: 0.2, duration: 400, maxZoom: 1.0 });
  }, [fitView]);

  // Export handlers
  const handleExportPng = useCallback(() => {
    setIsExportMenuOpen(false);
    const title = activeErdData?.database || "ArchMind AI Database ERD";
    exportErdAsPng(nodes, edges, title);
  }, [nodes, edges, activeErdData]);

  const handleExportSvg = useCallback(() => {
    setIsExportMenuOpen(false);
    const title = activeErdData?.database || "ArchMind AI Database ERD";
    exportErdAsSvg(nodes, edges, title);
  }, [nodes, edges, activeErdData]);

  const entitiesCount = nodes.length;
  const relationshipsCount = edges.length;
  const dbName = activeErdData?.database || "Database Schema";
  const isPlatform = activeSource === "platform" || Boolean(activeErdData?.isPlatformSchema);

  return (
    <div className="w-full h-full relative flex-1" onClick={() => isExportMenuOpen && setIsExportMenuOpen(false)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        minZoom={0.25}
        maxZoom={1.6}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.0, duration: 400 }}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color={isPlatform ? "#064e3b" : "#0e7490"} />

        <Controls
          className="!bg-[#070c16] !border-white/10 !rounded-lg"
          showInteractive={false}
        />

        <MiniMap
          nodeColor={(n) => (n.data?.isEmbedded ? "#a855f7" : isPlatform ? "#10b981" : "#06b6d4")}
          maskColor="rgba(4, 7, 13, 0.8)"
          className="!bg-[#070c16] !border-white/10 !rounded-lg !hidden md:!block"
          zoomable
          pannable
        />

        {/* ── Top Left: Data Source Switcher & Stats ────────────────────────────── */}
        <Panel position="top-left" className="flex flex-col gap-2 pointer-events-auto">
          {/* Main Info Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#070c16]/95 backdrop-blur-md shadow-lg">
            <span
              className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${
                isPlatform ? "bg-emerald-400" : "bg-cyan-400"
              }`}
            />
            <span className="text-xs font-mono font-bold text-slate-100 max-w-[200px] truncate" title={dbName}>
              {dbName}
            </span>
            <span className="text-slate-600 text-xs">•</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              {entitiesCount} {entitiesCount === 1 ? "Entity" : "Entities"}
            </span>
            <span className="text-slate-600 text-xs">•</span>
            <span className="text-xs font-mono text-slate-400">
              {relationshipsCount} {relationshipsCount === 1 ? "Relation" : "Relations"}
            </span>
          </div>

          {/* Explicit Data Source Switcher Buttons */}
          <div className="flex items-center gap-1 p-1 rounded-lg border border-white/[0.08] bg-[#070c16]/90 backdrop-blur-md shadow-lg">
            <span className="text-[10px] font-mono text-slate-500 uppercase px-1.5">Source:</span>
            <button
              type="button"
              onClick={() => onSwitchSource && onSwitchSource("repository")}
              disabled={!hasRepositoryErd}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                activeSource === "repository"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={hasRepositoryErd ? "View analyzed repository database" : "No database detected in repository"}
            >
              Repository DB
            </button>
            <button
              type="button"
              onClick={() => onSwitchSource && onSwitchSource("platform")}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                activeSource === "platform"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
              }`}
              title="View ArchMind AI's actual MongoDB Mongoose architecture"
            >
              ArchMind AI Platform DB
            </button>
          </div>
        </Panel>

        {/* ── Top Right: Search, Filter, Layout & Export Controls ───────────────── */}
        <Panel position="top-right" className="flex flex-wrap items-center gap-2 p-1.5 rounded-lg border border-white/[0.08] bg-[#070c16]/95 backdrop-blur-md shadow-lg pointer-events-auto">
          {/* Entity Search Input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search entity..."
              className="w-32 sm:w-40 px-2.5 py-1 rounded text-[11px] font-mono bg-black/50 border border-white/10 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Toggle Embedded Subdocuments (if platform schema) */}
          {activeErdData?.embeddedEntities?.length > 0 && (
            <button
              type="button"
              onClick={() => setShowEmbedded((prev) => !prev)}
              className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                showEmbedded
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "text-slate-400 hover:bg-white/[0.06]"
              }`}
              title="Toggle visibility of embedded subdocument schemas"
            >
              ◈ {showEmbedded ? "Embedded: On" : "Embedded: Off"}
            </button>
          )}

          <div className="w-[1px] h-3.5 bg-white/10" />

          {/* Direction Switchers */}
          <button
            type="button"
            onClick={() => layoutGraph("LR")}
            className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
              direction === "LR"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:bg-white/[0.06]"
            }`}
            title="Horizontal layout"
          >
            ↔ LR
          </button>
          <button
            type="button"
            onClick={() => layoutGraph("TB")}
            className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
              direction === "TB"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:bg-white/[0.06]"
            }`}
            title="Vertical layout"
          >
            ↕ TB
          </button>

          {/* Fit View */}
          <button
            type="button"
            onClick={handleResetFit}
            className="px-2 py-1 rounded text-[11px] font-mono font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Fit diagram to canvas"
          >
            🎯 Fit
          </button>

          <div className="w-[1px] h-3.5 bg-white/10" />

          {/* Export Dropdown Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExportMenuOpen((prev) => !prev);
              }}
              className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>⬇ Export</span>
              <span className="text-[9px]">▾</span>
            </button>

            {isExportMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-36 rounded-lg border border-white/10 bg-[#070c16]/98 backdrop-blur-xl shadow-2xl p-1 z-50 text-xs font-mono"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={handleExportPng}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/[0.08] text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>Export PNG</span>
                  <span className="text-[10px] text-slate-500">.png</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportSvg}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-white/[0.08] text-slate-200 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>Export SVG</span>
                  <span className="text-[10px] text-emerald-400">.svg</span>
                </button>
              </div>
            )}
          </div>

          {/* Re-run LLM Analysis (for repository DB) */}
          {onRegenerate && activeSource === "repository" && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="px-2 py-1 rounded text-[11px] font-mono font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isRegenerating ? "↻..." : "↻ Regenerate"}
            </button>
          )}
        </Panel>

        {/* ── Bottom Banner: Data Source Clarification ─────────────────────────── */}
        <Panel position="bottom-center" className="pointer-events-none mb-2">
          <div className="px-3.5 py-1 rounded-full border border-white/[0.06] bg-[#070c16]/85 backdrop-blur-md text-[10px] font-mono text-slate-400 flex items-center gap-2 shadow-lg">
            <span className={`w-1.5 h-1.5 rounded-full ${isPlatform ? "bg-emerald-400" : "bg-cyan-400"}`} />
            <span>
              {isPlatform
                ? "Live Platform Architecture: 7 Mongoose collections, indexes, and relationships"
                : "Analyzed Repository Architecture: Detected from repository source files"}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-500">Click any entity or line to inspect attributes</span>
          </div>
        </Panel>
      </ReactFlow>

      {/* Entity Details Slide-over Drawer */}
      {selectedEntity && (
        <EntityDetailDrawer
          entity={selectedEntity}
          onClose={() => {
            setSelectedEntityId(null);
            setSelectedEntity(null);
          }}
          onSelectEntity={handleSelectEntityByName}
          relationships={activeErdData?.relationships || []}
        />
      )}

      {/* Relationship Connector Modal */}
      {selectedRelationship && (
        <RelationshipDetailModal
          relationship={selectedRelationship}
          onClose={() => setSelectedRelationship(null)}
          onSelectEntity={handleSelectEntityByName}
        />
      )}
    </div>
  );
}

// ── Public Export Component (manages state and source switching) ──────────────
export default function ErdCanvas({
  erdData,
  platformErdData = null,
  onRegenerate,
  isRegenerating,
}) {
  const hasRepositoryErd = Boolean(
    erdData && Array.isArray(erdData.entities) && erdData.entities.length > 0
  );

  // Active data source state: default to repository if available, else platform
  const [activeSource, setActiveSource] = useState(
    hasRepositoryErd ? "repository" : "platform"
  );

  // Synchronize source when repository erdData becomes available
  useEffect(() => {
    if (hasRepositoryErd && activeSource === "platform" && !platformErdData) {
      setActiveSource("repository");
    }
  }, [hasRepositoryErd]);

  const activeErdData =
    activeSource === "platform" ? platformErdData : erdData;

  // Handle completely empty state when neither repository DB nor platform data is available
  if (!activeErdData || !Array.isArray(activeErdData.entities) || activeErdData.entities.length === 0) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-8 rounded-xl border border-white/[0.08] bg-[#050810]/60 text-center min-h-[520px]">
        <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-slate-500 mb-3 text-xl">
          ⬡
        </div>
        <p className="text-sm font-medium text-slate-300">No Database Entities Detected in Repository</p>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          ArchMind scanned the repository files but no explicit Prisma, Mongoose, or SQL models were found.
        </p>

        {platformErdData && (
          <button
            type="button"
            onClick={() => setActiveSource("platform")}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
          >
            View ArchMind AI Platform Database Architecture →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex-1 h-[680px] lg:h-[calc(100vh-160px)] min-h-[540px] max-h-[880px] rounded-xl border border-emerald-500/20 bg-[#04070d] relative overflow-hidden shadow-2xl flex flex-col">
      <ReactFlowProvider>
        <ErdCanvasInner
          activeErdData={activeErdData}
          activeSource={activeSource}
          onSwitchSource={setActiveSource}
          hasRepositoryErd={hasRepositoryErd}
          onRegenerate={onRegenerate}
          isRegenerating={isRegenerating}
        />
      </ReactFlowProvider>
    </div>
  );
}
