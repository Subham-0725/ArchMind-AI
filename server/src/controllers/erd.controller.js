// server/src/controllers/erd.controller.js
//
// Controller for Entity Relationship Diagram (ERD) endpoints.
// Supports both:
//   1. ArchMind AI Platform Database ERD (Mongoose models and schemas)
//   2. Analyzed Repository ERD (Extracted from uploaded/imported codebases)

import mongoose from "mongoose";
import Project from "../models/Project.js";
import { extractPlatformErd } from "../services/erd/schemaExtraction.service.js";

/**
 * GET /api/projects/platform-erd
 * or GET /api/projects/platform/erd
 *
 * Returns the dynamically extracted ERD representing ArchMind AI's own
 * MongoDB architecture (7 collections, fields, indexes, physical refs, and embedded subdocuments).
 */
export async function getPlatformDatabaseErd(req, res) {
  try {
    const erd = extractPlatformErd();
    return res.status(200).json({
      success: true,
      data: erd,
    });
  } catch (err) {
    console.error("[ErdController] Failed to extract platform ERD:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to generate platform database ERD.",
      details: err.message,
    });
  }
}

/**
 * GET /api/projects/:id/erd
 *
 * Returns the database ERD for an analyzed project/repository.
 * Distinguishes between LLM-generated ERD and RIE static schema extraction.
 */
export async function getProjectDatabaseErd(req, res) {
  try {
    const { id, projectId } = req.params;
    const targetId = id || projectId;
    const userId = req.auth?.userId;

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID." });
    }

    const project = await Project.findOne({ _id: targetId, userId }).select(
      "name database capabilities analysisResults analysis"
    );

    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found or access denied." });
    }

    // Check LLM ERD analysis result
    const llmErd = project.analysisResults?.erd;
    const hasLlmEntities = Array.isArray(llmErd?.entities) && llmErd.entities.length > 0;

    // Check static RIE database schema
    const dbSchema = project.database;
    const hasStaticEntities = Array.isArray(dbSchema?.entities) && dbSchema.entities.length > 0;

    if (hasLlmEntities) {
      return res.status(200).json({
        success: true,
        source: "llm_analysis",
        isPlatformSchema: false,
        projectName: project.name,
        data: {
          database: llmErd.database || `${project.name} Database`,
          databaseType: dbSchema?.type || "Unknown",
          isPlatformSchema: false,
          stats: {
            totalEntities: llmErd.entities.length,
            totalRelationships: llmErd.relationships?.length || 0,
          },
          entities: llmErd.entities,
          relationships: llmErd.relationships || [],
        },
      });
    }

    if (hasStaticEntities) {
      return res.status(200).json({
        success: true,
        source: "static_extraction",
        isPlatformSchema: false,
        projectName: project.name,
        data: {
          database: `${project.name} Database (${dbSchema.type || "Detected"})`,
          databaseType: dbSchema.type || "Unknown",
          isPlatformSchema: false,
          stats: {
            totalEntities: dbSchema.entities.length,
            totalRelationships: dbSchema.relationships?.length || 0,
          },
          entities: dbSchema.entities,
          relationships: dbSchema.relationships || [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      source: "empty",
      isPlatformSchema: false,
      projectName: project.name,
      data: {
        database: `${project.name} Database`,
        databaseType: "None",
        isPlatformSchema: false,
        stats: { totalEntities: 0, totalRelationships: 0 },
        entities: [],
        relationships: [],
      },
    });
  } catch (err) {
    console.error("[ErdController] Failed to get project ERD:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve project database ERD.",
      details: err.message,
    });
  }
}

