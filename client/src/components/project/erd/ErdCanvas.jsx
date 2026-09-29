// client/src/components/project/erd/ErdCanvas.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import EntityNode from "./EntityNode";
import { getLayoutedErdElements } from "./erdUtils";

export default function ErdCanvas({ erdData, onRegenerate, isRegenerating }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [direction, setDirection] = useState("LR");

  const nodeTypes = useMemo(() => ({ customEntity: EntityNode }), []);

  const layoutGraph = useCallback(
    (dir = "LR") => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedErdElements(erdData, dir);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setDirection(dir);
    },
    [erdData, setNodes, setEdges]
  );

  useEffect(() => {
    layoutGraph(direction);
  }, [layoutGraph, direction]);

  const entitiesCount = erdData?.entities?.length || 0;
  const relationshipsCount = erdData?.relationships?.length || 0;

  if (!erdData || !Array.isArray(erdData.entities) || erdData.entities.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 rounded-xl border border-white/[0.08] bg-[#050810]/60 text-center min-h-[480px]">
        <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-slate-500 mb-3 text-xl">
          ⬡
        </div>
        <p className="text-sm font-medium text-slate-300">No Database Entities Found</p>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Analysis was performed but no explicit entity schemas or ORM models were discovered.
        </p>
        {onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
          >
            {isRegenerating ? "Regenerating..." : "Re-run ERD Analysis"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[550px] rounded-xl border border-emerald-500/20 bg-[#04070d] relative overflow-hidden flex flex-col">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={1.5}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#064e3b" />
        <Controls className="!bg-[#070c16] !border-white/10 !rounded-lg" />
        <MiniMap
          nodeColor={() => "#10b981"}
          maskColor="rgba(4, 7, 13, 0.75)"
          className="!bg-[#070c16] !border-white/10 !rounded-lg"
        />

        {/* Top Left Info Panel */}
        <Panel position="top-left" className="flex items-center gap-2 p-2 rounded-lg border border-white/[0.08] bg-[#070c16]/90 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono font-semibold text-slate-200">
            {entitiesCount} {entitiesCount === 1 ? "Entity" : "Entities"}
          </span>
          <span className="text-slate-600 text-xs">•</span>
          <span className="text-xs font-mono text-slate-400">
            {relationshipsCount} {relationshipsCount === 1 ? "Relationship" : "Relationships"}
          </span>
        </Panel>

        {/* Top Right Layout & Action Panel */}
        <Panel position="top-right" className="flex items-center gap-2 p-1.5 rounded-lg border border-white/[0.08] bg-[#070c16]/90 backdrop-blur-md">
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
              <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-white/[0.05] border border-white/10 text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
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
