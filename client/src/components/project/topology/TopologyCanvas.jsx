// client/src/components/project/topology/TopologyCanvas.jsx
import { useCallback, useEffect, useMemo } from "react";
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
import ServiceNode from "./ServiceNode";
import { getLayoutedElements } from "./topologyUtils";

export default function TopologyCanvas({ topology }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodeTypes = useMemo(() => ({ customService: ServiceNode }), []);

  const layoutGraph = useCallback((direction = "LR") => {
    const rawNodes = (topology?.nodes || []).map((n) => ({
      ...n,
      type: n.type || "customService",
    }));
    const rawEdges = topology?.edges || [];

    if (rawNodes.length === 0) return;

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      rawNodes,
      rawEdges,
      direction
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [topology, setNodes, setEdges]);

  useEffect(() => {
    layoutGraph("LR");
  }, [layoutGraph]);

  if (!topology || !topology.nodes || topology.nodes.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 rounded-xl border border-white/[0.08] bg-[#050810]/60 text-center">
        <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-slate-500 mb-3">
          ❖
        </div>
        <p className="text-sm font-medium text-slate-300">No Topology Graph Available</p>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          No active service nodes or structural framework files were detected in this repository.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] rounded-xl border border-white/[0.08] bg-[#04070d] relative overflow-hidden">
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
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#1e293b" />
        <Controls className="!bg-[#070c16] !border-white/10 !rounded-lg" />
        <MiniMap
          nodeColor={(n) => {
            const tier = n.data?.tier;
            if (tier === "Frontend") return "#06b6d4";
            if (tier === "Backend") return "#6366f1";
            if (tier === "Database") return "#10b981";
            if (tier === "DevOps") return "#f59e0b";
            return "#64748b";
          }}
          maskColor="rgba(4, 7, 13, 0.75)"
          className="!bg-[#070c16] !border-white/10 !rounded-lg"
        />

        <Panel position="top-right" className="flex gap-1.5 p-1 rounded-lg border border-white/[0.08] bg-[#070c16]/90 backdrop-blur-md">
          <button
            type="button"
            onClick={() => layoutGraph("LR")}
            className="px-2.5 py-1 rounded text-[11px] font-mono font-medium text-slate-300 hover:bg-white/[0.06] transition-colors"
          >
            ↔ Horizontal
          </button>
          <button
            type="button"
            onClick={() => layoutGraph("TB")}
            className="px-2.5 py-1 rounded text-[11px] font-mono font-medium text-slate-300 hover:bg-white/[0.06] transition-colors"
          >
            ↕ Vertical
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
