// client/src/components/project/topology/topologyUtils.js
import dagre from "dagre";

/**
 * Positions React Flow nodes and edges using Dagre graph layout algorithm.
 *
 * @param {Array}  nodes     - Array of React Flow node objects
 * @param {Array}  edges     - Array of React Flow edge objects
 * @param {string} direction - Layout direction: 'LR' (Left to Right) or 'TB' (Top to Bottom)
 * @returns {{ nodes: Array, edges: Array }}
 */
export const getLayoutedElements = (nodes = [], edges = [], direction = "LR") => {
  if (nodes.length === 0) return { nodes: [], edges: [] };

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: isHorizontal ? 60 : 50,
    ranksep: isHorizontal ? 100 : 80,
  });

  const nodeWidth = 240;
  const nodeHeight = 100;

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? "left" : "top",
      sourcePosition: isHorizontal ? "right" : "bottom",
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
