// server/src/controllers/apiRoute.controller.js
//
// Controller for API Route Explorer and Request Sequence Diagrams.
// Enforces strict multi-tenant project ownership, caching by analysisVersion,
// query filtering, and line-level source citations.

import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import Project from "../models/Project.js";
import { extractApiRoutes } from "../rie/api/routeExtractor.js";
import { generateRouteSequence } from "../rie/api/sequenceGenerator.js";
import { validateRouteRecord } from "../rie/api/routeValidator.js";

/**
 * Helper: Safely extracts userId from Clerk auth or mock test request.
 */
function getUserId(req) {
  try {
    const auth = getAuth(req);
    return auth?.userId || req.auth?.userId || null;
  } catch {
    return req.auth?.userId || null;
  }
}

/**
 * Helper: Loads project and verifies user ownership.
 */
async function loadOwnedProject(userId, projectId) {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return { error: "Invalid project ID.", status: 400 };
  }
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) {
    return { error: "Project not found or access denied.", status: 404 };
  }
  return { project };
}

/**
 * Helper: Resolves extracted API routes from project analysis results or extracts on-demand.
 */
async function getOrExtractProjectRoutes(project) {
  // 1. Check if already stored in analysisResults.apiRoutes
  if (Array.isArray(project.analysisResults?.apiRoutes) && project.analysisResults.apiRoutes.length > 0) {
    return project.analysisResults.apiRoutes;
  }

  // 2. Check if present in blueprint.api.routes
  if (Array.isArray(project.blueprint?.api?.routes) && project.blueprint.api.routes.length > 0) {
    return project.blueprint.api.routes;
  }

  // 3. Extract from project's tree on-demand
  const extractionResult = await extractApiRoutes(project.tree || [], {
    extractionPath: project.extractionPath || null,
  });

  // Persist into analysisResults for future instant lookups
  if (!project.analysisResults) project.analysisResults = {};
  project.set("analysisResults.apiRoutes", extractionResult.routes);
  await project.save().catch((err) =>
    console.warn("[apiRoute.controller] Failed to cache extracted routes:", err.message)
  );

  return extractionResult.routes;
}

/**
 * GET /api/projects/:id/api-routes
 *
 * Route list endpoint with filtering (method, framework, search, file, auth).
 */
export async function getProjectApiRoutes(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { id } = req.params;
    const { project, error, status } = await loadOwnedProject(userId, id);
    if (error) {
      return res.status(status).json({ success: false, error });
    }

    const allRoutes = await getOrExtractProjectRoutes(project);

    // Apply query filters
    const { method, framework, search, file, auth } = req.query;

    let filtered = allRoutes;

    if (method) {
      const targetMethod = String(method).toUpperCase();
      filtered = filtered.filter((r) => r.method === targetMethod);
    }

    if (framework) {
      const targetFw = String(framework).toLowerCase();
      filtered = filtered.filter((r) => String(r.framework).toLowerCase() === targetFw);
    }

    if (file) {
      const targetFile = String(file).toLowerCase();
      filtered = filtered.filter((r) => String(r.sourceFile).toLowerCase().includes(targetFile));
    }

    if (auth !== undefined) {
      const isAuthTarget = auth === "true" || auth === "1";
      filtered = filtered.filter((r) => Boolean(r.isAuthProtected) === isAuthTarget);
    }

    if (search) {
      const query = String(search).toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.path && r.path.toLowerCase().includes(query)) ||
          (r.handlerName && r.handlerName.toLowerCase().includes(query)) ||
          (r.controllerName && r.controllerName.toLowerCase().includes(query))
      );
    }

    // Compile summary metrics
    const byMethod = {};
    const frameworks = new Set();
    let authCount = 0;

    for (const r of allRoutes) {
      byMethod[r.method] = (byMethod[r.method] || 0) + 1;
      if (r.framework) frameworks.add(r.framework);
      if (r.isAuthProtected) authCount++;
    }

    return res.status(200).json({
      success: true,
      data: {
        projectId: project._id,
        analysisVersion: project.analysisVersion || 1,
        extractedAt: project.lastAnalyzedAt || project.updatedAt,
        routeCount: filtered.length,
        totalRoutes: allRoutes.length,
        frameworks: Array.from(frameworks),
        summary: {
          total: allRoutes.length,
          byMethod,
          authProtectedCount: authCount,
        },
        routes: filtered,
      },
    });
  } catch (err) {
    console.error("[apiRoute.controller] getProjectApiRoutes error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve API routes.",
    });
  }
}

/**
 * GET /api/projects/:id/api-routes/:routeId
 *
 * Route detail endpoint with line-level source locations and parameters.
 */
export async function getProjectApiRouteDetail(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { id, routeId } = req.params;
    const { project, error, status } = await loadOwnedProject(userId, id);
    if (error) {
      return res.status(status).json({ success: false, error });
    }

    const allRoutes = await getOrExtractProjectRoutes(project);
    const route = allRoutes.find((r) => r.routeId === routeId);

    if (!route) {
      return res.status(404).json({
        success: false,
        error: `Route '${routeId}' not found in project analysis.`,
        code: "ROUTE_NOT_FOUND",
      });
    }

    // Validate route record integrity
    const validation = validateRouteRecord(route);

    return res.status(200).json({
      success: true,
      data: {
        projectId: project._id,
        analysisVersion: project.analysisVersion || 1,
        route,
        citation: {
          sourceFile: route.sourceFile,
          startLine: route.lineRange?.startLine || 1,
          endLine: route.lineRange?.endLine || 1,
          fileRetrievalUrl: `/api/projects/${project._id}/file?path=${encodeURIComponent(route.sourceFile)}`,
        },
        isValid: validation.isValid,
      },
    });
  } catch (err) {
    console.error("[apiRoute.controller] getProjectApiRouteDetail error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve API route detail.",
    });
  }
}

/**
 * GET /api/projects/:id/api-routes/:routeId/sequence
 *
 * Generates or retrieves cached request sequence diagram for a specific route.
 */
export async function getRouteSequenceDiagram(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const { id, routeId } = req.params;
    const { project, error, status } = await loadOwnedProject(userId, id);
    if (error) {
      return res.status(status).json({ success: false, error });
    }

    const allRoutes = await getOrExtractProjectRoutes(project);
    const route = allRoutes.find((r) => r.routeId === routeId);

    if (!route) {
      return res.status(404).json({
        success: false,
        error: `Route '${routeId}' not found in project analysis.`,
        code: "ROUTE_NOT_FOUND",
      });
    }

    const currentVersion = project.analysisVersion || 1;
    const cachedSequence = project.analysisResults?.apiSequences?.[routeId];

    // Reuse cache if analysis version matches
    if (cachedSequence && cachedSequence.analysisVersion === currentVersion) {
      return res.status(200).json({
        success: true,
        data: {
          ...cachedSequence,
          cached: true,
        },
      });
    }

    // Generate static sequence diagram
    const sequenceDiagram = generateRouteSequence(route, project, {
      tree: project.tree,
      ast: project.ast,
    });

    // Cache the sequence diagram in MongoDB
    if (!project.analysisResults) project.analysisResults = {};
    if (!project.analysisResults.apiSequences) {
      project.set("analysisResults.apiSequences", {});
    }
    project.set(`analysisResults.apiSequences.${routeId}`, sequenceDiagram);
    await project.save().catch((err) =>
      console.warn("[apiRoute.controller] Failed to cache sequence diagram:", err.message)
    );

    return res.status(200).json({
      success: true,
      data: {
        ...sequenceDiagram,
        cached: false,
      },
    });
  } catch (err) {
    console.error("[apiRoute.controller] getRouteSequenceDiagram error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to generate sequence diagram.",
    });
  }
}
