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

// ── Inner canvas component (must live inside ReactFlowProvider to use useReactFlow) ───
function ErdCanvasInner({ erdData, onRegenerate, isRegenerating }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [direction, setDirection] = useState("LR");
  const { fitView } = useReactFlow();
  const fitScheduled = useRef(false);

  const nodeTypes = useMemo(() => ({ customEntity: EntityNode }), []);

  const layoutGraph = useCallback(
    (dir = "LR") => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedErdElements(erdData, dir);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setDirection(dir);
      fitScheduled.current = true;
    },
    [erdData, setNodes, setEdges]
  );

  // Initial layout when erdData changes
  useEffect(() => {
    layoutGraph("LR");
  }, [layoutGraph]);

  // Fit view after nodes are painted — runs whenever nodes array length changes
  useEffect(() => {
    if (fitScheduled.current && nodes.length > 0) {
      fitScheduled.current = false;
      const timer = setTimeout(() => {
        fitView({ padding: 0.22, duration: 400, maxZoom: 1.0 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes, fitView]);

  const handleResetFit = useCallback(() => {
    fitView({ padding: 0.22, duration: 400, maxZoom: 1.0 });
  }, [fitView]);

  const entitiesCount = erdData?.entities?.length || 0;
  const relationshipsCount = erdData?.relationships?.length || 0;
  const dbName = erdData?.database || "Database Schema";

  return (
    <div className="w-full h-full relative flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        minZoom={0.35}
        maxZoom={1.4}
        translateExtent={[[-600, -500], [2200, 1600]]}
        fitView
        fitViewOptions={{ padding: 0.22, maxZoom: 1.0, duration: 400 }}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#064e3b" />
        <Controls
          className="!bg-[#070c16] !border-white/10 !rounded-lg"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={() => "#10b981"}
          maskColor="rgba(4, 7, 13, 0.75)"
          className="!bg-[#070c16] !border-white/10 !rounded-lg !hidden sm:!block"
          zoomable
          pannable
        />

        {/* Top Left Info Panel */}
        <Panel position="top-left" className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#070c16]/90 backdrop-blur-md shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-xs font-mono font-bold text-slate-200">
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
        </Panel>

        {/* Top Right Layout & Action Panel */}
        <Panel position="top-right" className="flex items-center gap-2 p-1.5 rounded-lg border border-white/[0.08] bg-[#070c16]/90 backdrop-blur-md shadow-lg">
          <button
            type="button"
            onClick={handleResetFit}
            className="px-2.5 py-1 rounded text-[11px] font-mono font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
            title="Fit diagram to canvas"
          >
            🎯 Fit View
          </button>
          <div className="w-[1px] h-3.5 bg-white/10" />
          <button
            type="button"
            onClick={() => layoutGraph("LR")}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
              direction === "LR"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:bg-white/[0.06]"
            }`}
          >
            ↔ Horizontal
          </button>
          <button
            type="button"
            onClick={() => layoutGraph("TB")}
            className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
              direction === "TB"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-slate-400 hover:bg-white/[0.06]"
            }`}
          >
            ↕ Vertical
          </button>

          {onRegenerate && (
            <>
              <div className="w-[1px] h-3.5 bg-white/10" />
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                {isRegenerating ? "Regenerating..." : "↻ Regenerate"}
              </button>
            </>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}

// ── Public export: wraps in ReactFlowProvider + handles empty state ────────────
export default function ErdCanvas({ erdData, onRegenerate, isRegenerating }) {
  const entitiesCount = erdData?.entities?.length || 0;

  if (!erdData || !Array.isArray(erdData.entities) || entitiesCount === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 rounded-xl border border-white/[0.08] bg-[#050810]/60 text-center min-h-[520px]">
        <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-slate-500 mb-3 text-xl">
          ⬡
        </div>
        <p className="text-sm font-medium text-slate-300">No Database Entities Found</p>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Analysis completed but no explicit entity schemas or ORM models were discovered.
        </p>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {isRegenerating ? "Regenerating..." : "Re-run ERD Analysis"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex-1 h-[650px] lg:h-[calc(100vh-160px)] min-h-[520px] max-h-[850px] rounded-xl border border-emerald-500/20 bg-[#04070d] relative overflow-hidden shadow-2xl flex flex-col">
      <ReactFlowProvider>
        <ErdCanvasInner
          erdData={erdData}
          onRegenerate={onRegenerate}
          isRegenerating={isRegenerating}
        />
      </ReactFlowProvider>
    </div>
  );
}
