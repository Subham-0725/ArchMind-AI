// client/src/components/project/erd/erdUtils.js
import dagre from "dagre";

/**
 * Transforms ERD backend schema ({ entities, relationships }) into Dagre auto-layouted React Flow elements.
 *
 * @param {Object} erdData - { entities: [], relationships: [] }
 * @param {string} direction - 'LR' (Left-to-Right) or 'TB' (Top-to-Bottom)
 * @returns {{ nodes: Array, edges: Array }}
 */
export const getLayoutedErdElements = (erdData, direction = "LR") => {
  const entities = Array.isArray(erdData?.entities) ? erdData.entities : [];
  const relationships = Array.isArray(erdData?.relationships) ? erdData.relationships : [];

  if (entities.length === 0) {
    return { nodes: [], edges: [] };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: isHorizontal ? 60 : 70,
    ranksep: isHorizontal ? 120 : 100,
    marginx: 40,
    marginy: 40,
  });

  const nodeWidth = 280;

  // Initial nodes creation
  const rawNodes = entities.map((entity, idx) => {
    const fieldsCount = Array.isArray(entity.fields) ? entity.fields.length : 0;
    // Calculate dynamic node height based on field count
    const nodeHeight = Math.max(110, 55 + fieldsCount * 28);
    const nodeId = String(entity.id || entity.name || `entity-${idx + 1}`);

    const entityName = entity.name || entity.id || `Model_${idx + 1}`;
    const tableName = entity.tableName || entity.name || `${entityName.toLowerCase()}s`;

    return {
      id: nodeId,
      type: "customEntity",
      data: {
        id: nodeId,
        name: entityName,
        tableName: tableName,
        fields: Array.isArray(entity.fields) ? entity.fields : [],
      },
      nodeHeight,
    };
  });

  // Set nodes in Dagre graph
  rawNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: node.nodeHeight });
  });

  // Create edges and set in Dagre graph
  const rawEdges = relationships.map((rel, idx) => {
    const sourceId = String(rel.sourceEntity);
    const targetId = String(rel.targetEntity);
    const edgeId = String(rel.id || `rel-${idx + 1}`);
    const labelText = rel.type || rel.foreignKey || "";

    return {
      id: edgeId,
      source: sourceId,
      target: targetId,
      label: labelText,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#10b981", strokeWidth: 2 },
      labelStyle: { fill: "#6ee7b7", fontWeight: 600, fontSize: 10, fontFamily: "monospace" },
      labelBgStyle: { fill: "#04070d", fillOpacity: 0.9, rx: 4, ry: 4 },
      labelBgPadding: [6, 4],
    };
  });

  rawEdges.forEach((edge) => {
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Position nodes based on layout
  const layoutedNodes = rawNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      id: node.id,
      type: node.type,
      data: node.data,
      targetPosition: isHorizontal ? "left" : "top",
      sourcePosition: isHorizontal ? "right" : "bottom",
      position: {
        x: (nodeWithPosition?.x || 0) - nodeWidth / 2,
        y: (nodeWithPosition?.y || 0) - node.nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges: rawEdges };
};
