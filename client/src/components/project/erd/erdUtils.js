// client/src/components/project/erd/erdUtils.js
//
// Graph layout and element transformation utilities for the ERD Canvas.
// Uses Dagre for hierarchical auto-layout (LR and TB) with dynamic node sizing.

import dagre from "dagre";
import { MarkerType } from "@xyflow/react";

/**
 * Transforms ERD backend schema ({ entities, embeddedEntities, relationships })
 * into Dagre auto-layouted React Flow nodes and edges.
 *
 * @param {Object} erdData - Normalized ERD data
 * @param {Object} [options]
 * @param {string} [options.direction="LR"] - 'LR' (Left-to-Right) or 'TB' (Top-to-Bottom)
 * @param {boolean} [options.showEmbedded=false] - Whether to include embedded subdocument entities
 * @param {string} [options.entityFilter="all"] - Filter by entity type ('all', 'root', 'embedded')
 * @param {string} [options.searchQuery=""] - Entity search string for highlighting
 * @param {string|null} [options.selectedEntityId=null] - Currently selected entity for connection highlighting
 * @param {string|null} [options.selectedEdgeId=null] - Currently selected edge
 * @returns {{ nodes: Array, edges: Array, allEntities: Array }}
 */
export const getLayoutedErdElements = (erdData, options = {}) => {
  const {
    direction = "LR",
    showEmbedded = false,
    entityFilter = "all",
    searchQuery = "",
    selectedEntityId = null,
    selectedEdgeId = null,
  } = options;

  const rawRootEntities = Array.isArray(erdData?.entities) ? erdData.entities : [];
  const rawEmbeddedEntities = Array.isArray(erdData?.embeddedEntities) ? erdData.embeddedEntities : [];
  const rawRelationships = Array.isArray(erdData?.relationships) ? erdData.relationships : [];

  // Filter entities based on showEmbedded and entityFilter
  let activeEntities = [...rawRootEntities];
  if (showEmbedded) {
    activeEntities = [...activeEntities, ...rawEmbeddedEntities];
  }

  if (entityFilter === "root") {
    activeEntities = activeEntities.filter((e) => !e.isEmbedded);
  } else if (entityFilter === "embedded") {
    activeEntities = activeEntities.filter((e) => e.isEmbedded);
  }

  if (activeEntities.length === 0) {
    return { nodes: [], edges: [], allEntities: [] };
  }

  const activeEntityIds = new Set(activeEntities.map((e) => String(e.id || e.name)));
  const activeEntityNames = new Set(activeEntities.map((e) => String(e.name || e.id).toLowerCase()));

  // Determine connected neighbors and edges if an entity is selected
  const connectedEdgeIds = new Set();
  const connectedNodeIds = new Set();
  if (selectedEntityId) {
    connectedNodeIds.add(String(selectedEntityId).toLowerCase());
    for (const rel of rawRelationships) {
      const src = String(rel.sourceEntity || rel.source || "").toLowerCase();
      const tgt = String(rel.targetEntity || rel.target || "").toLowerCase();
      const sel = String(selectedEntityId).toLowerCase();
      if (src === sel || tgt === sel) {
        connectedEdgeIds.add(String(rel.id));
        connectedNodeIds.add(src);
        connectedNodeIds.add(tgt);
      }
    }
  }

  const isHorizontal = direction === "LR";
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: isHorizontal ? 60 : 70,
    ranksep: isHorizontal ? 140 : 110,
    marginx: 50,
    marginy: 50,
  });

  const nodeWidth = 310;
  const searchLower = searchQuery.trim().toLowerCase();

  // Create raw nodes
  const rawNodes = activeEntities.map((entity, idx) => {
    const fieldsCount = Array.isArray(entity.fields) ? entity.fields.length : 0;
    // Cap visual field preview height in node card (up to 8 fields visible directly, rest in drawer)
    const previewFieldCount = Math.min(fieldsCount, 8);
    const nodeHeight = Math.max(140, 75 + previewFieldCount * 28 + (fieldsCount > 8 ? 28 : 0));

    const nodeId = String(entity.id || entity.name || `entity-${idx + 1}`);
    const entityName = entity.name || entity.id || `Model_${idx + 1}`;
    const collectionName = entity.collectionName || entity.tableName || `${entityName.toLowerCase()}s`;

    const isMatch = Boolean(
      searchLower &&
      (entityName.toLowerCase().includes(searchLower) || collectionName.toLowerCase().includes(searchLower))
    );

    const isSelected = selectedEntityId && String(selectedEntityId).toLowerCase() === nodeId.toLowerCase();
    const isConnected = selectedEntityId ? connectedNodeIds.has(nodeId.toLowerCase()) : true;
    const isDimmed = Boolean(selectedEntityId && !isConnected);

    return {
      id: nodeId,
      type: "customEntity",
      data: {
        id: nodeId,
        name: entityName,
        collectionName,
        tableName: collectionName,
        description: entity.description || "",
        category: entity.category || (entity.isEmbedded ? "Embedded Subdocument" : "Database Collection"),
        isEmbedded: Boolean(entity.isEmbedded),
        fields: Array.isArray(entity.fields) ? entity.fields : [],
        indexes: Array.isArray(entity.indexes) ? entity.indexes : [],
        foreignKeys: Array.isArray(entity.foreignKeys) ? entity.foreignKeys : [],
        uniqueFields: Array.isArray(entity.uniqueFields) ? entity.uniqueFields : [],
        isMatch,
        isSelected,
        isDimmed,
      },
      nodeHeight,
    };
  });

  rawNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: node.nodeHeight });
  });

  // Filter and build edges
  const validEdges = [];
  rawRelationships.forEach((rel, idx) => {
    const srcRaw = String(rel.sourceEntity || rel.source || "");
    const tgtRaw = String(rel.targetEntity || rel.target || "");

    // Resolve matching active entity ID
    const srcNode = rawNodes.find((n) => n.id.toLowerCase() === srcRaw.toLowerCase() || n.data.name.toLowerCase() === srcRaw.toLowerCase());
    const tgtNode = rawNodes.find((n) => n.id.toLowerCase() === tgtRaw.toLowerCase() || n.data.name.toLowerCase() === tgtRaw.toLowerCase());

    if (!srcNode || !tgtNode) return;

    const edgeId = String(rel.id || `rel-${idx + 1}`);
    const isRelSelected = selectedEdgeId === edgeId || (selectedEntityId && connectedEdgeIds.has(edgeId));
    const isRelDimmed = Boolean(selectedEntityId && !connectedEdgeIds.has(edgeId));

    // Choose edge color and stroke style based on relationship nature
    let strokeColor = "#10b981"; // emerald for physical Mongoose ObjectId ref
    let strokeDash = undefined;
    let badgeText = rel.crowNotation || rel.type || "";

    if (rel.type === "embedded") {
      strokeColor = "#a855f7"; // purple for embedded subdocument
      strokeDash = "4,4";
      badgeText = rel.crowNotation || "1:N (embed)";
    } else if (!rel.isPhysical) {
      strokeColor = "#06b6d4"; // cyan for logical multi-tenant reference
      strokeDash = "6,4";
      badgeText = rel.crowNotation || "N:1 (logical)";
    }

    if (isRelSelected) {
      strokeColor = "#38bdf8"; // bright sky highlight when selected
    }

    validEdges.push({
      id: edgeId,
      source: srcNode.id,
      target: tgtNode.id,
      type: "smoothstep",
      animated: isRelSelected || rel.type === "embedded",
      label: badgeText,
      data: {
        id: edgeId,
        sourceEntity: srcNode.data.name,
        targetEntity: tgtNode.data.name,
        sourceField: rel.sourceField || rel.foreignKey || "",
        targetField: rel.targetField || "_id",
        type: rel.type || "many-to-one",
        cardinality: rel.cardinality || { source: "many", target: "one" },
        crowNotation: rel.crowNotation || badgeText,
        isPhysical: rel.isPhysical !== false,
        required: Boolean(rel.required),
        description: rel.description || `Relationship from ${srcNode.data.name} to ${tgtNode.data.name}`,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: strokeColor,
      },
      style: {
        stroke: strokeColor,
        strokeWidth: isRelSelected ? 3 : 2,
        strokeDasharray: strokeDash,
        opacity: isRelDimmed ? 0.2 : 1,
        transition: "opacity 0.2s, stroke 0.2s, stroke-width 0.2s",
        cursor: "pointer",
      },
      labelStyle: {
        fill: isRelSelected ? "#bae6fd" : strokeColor,
        fontWeight: 700,
        fontSize: 9,
        fontFamily: "ui-monospace, monospace",
      },
      labelBgStyle: {
        fill: "#04070d",
        fillOpacity: 0.95,
        stroke: strokeColor,
        strokeWidth: 1,
        rx: 4,
        ry: 4,
      },
      labelBgPadding: [6, 3],
    });

    dagreGraph.setEdge(srcNode.id, tgtNode.id);
  });

  // Calculate Dagre positions
  dagre.layout(dagreGraph);

  const layoutedNodes = rawNodes.map((node) => {
    const nodePos = dagreGraph.node(node.id);
    return {
      id: node.id,
      type: node.type,
      data: node.data,
      targetPosition: isHorizontal ? "left" : "top",
      sourcePosition: isHorizontal ? "right" : "bottom",
      position: {
        x: (nodePos?.x || 0) - nodeWidth / 2,
        y: (nodePos?.y || 0) - node.nodeHeight / 2,
      },
    };
  });

  return {
    nodes: layoutedNodes,
    edges: validEdges,
    allEntities: activeEntities,
  };
};

/**
 * Downloads a data URL as a file in the browser.
 */
export const downloadFile = (dataUrl, filename) => {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
