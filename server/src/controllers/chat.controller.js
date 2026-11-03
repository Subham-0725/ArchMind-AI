// server/src/controllers/chat.controller.js
//
// Controller for Repository AI Chat in ArchMind AI.
// Handles HTTP requests, Clerk auth extraction, parameter validation,
// and delegation to ChatService.

import mongoose from "mongoose";
import { getAuth } from "@clerk/express";
import { defaultChatService } from "../services/chat/chat.service.js";

/**
 * Validates MongoDB ObjectId string.
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * POST /api/projects/:projectId/chat/conversations
 * Creates a new conversation.
 */
export async function createConversation(req, res) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const projectId = req.params.projectId || req.params.id;
    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID.", code: "INVALID_PROJECT_ID" });
    }

    const { title } = req.body || {};
    const result = await defaultChatService.createConversation(userId, projectId, title);

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("[chat.controller] createConversation error:", err);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to create conversation.",
      code: err.code || "CHAT_ERROR",
    });
  }
}

/**
 * GET /api/projects/:projectId/chat/conversations
 * Lists user's conversations for the project.
 */
export async function listConversations(req, res) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const projectId = req.params.projectId || req.params.id;
    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID.", code: "INVALID_PROJECT_ID" });
    }

    const list = await defaultChatService.listConversations(userId, projectId);

    return res.status(200).json({
      success: true,
      data: list,
    });
  } catch (err) {
    console.error("[chat.controller] listConversations error:", err);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to list conversations.",
      code: err.code || "CHAT_ERROR",
    });
  }
}

/**
 * GET /api/projects/:projectId/chat/conversations/:conversationId
 * Retrieves conversation history and verified citations.
 */
export async function getConversation(req, res) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const projectId = req.params.projectId || req.params.id;
    const { conversationId } = req.params;

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID.", code: "INVALID_PROJECT_ID" });
    }
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ success: false, error: "Invalid conversation ID.", code: "INVALID_CONVERSATION_ID" });
    }

    const history = await defaultChatService.getConversationHistory(userId, projectId, conversationId);

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (err) {
    console.error("[chat.controller] getConversation error:", err);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to retrieve conversation history.",
      code: err.code || "CHAT_ERROR",
    });
  }
}

/**
 * POST /api/projects/:projectId/chat/conversations/:conversationId/messages
 * Sends a message, retrieves repository context, queries Groq, verifies citations, and persists turn.
 */
export async function sendMessage(req, res) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const projectId = req.params.projectId || req.params.id;
    const { conversationId } = req.params;

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID.", code: "INVALID_PROJECT_ID" });
    }
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ success: false, error: "Invalid conversation ID.", code: "INVALID_CONVERSATION_ID" });
    }

    const messageText = req.body?.message;
    if (!messageText || typeof messageText !== "string" || !messageText.trim()) {
      return res.status(400).json({
        success: false,
        error: "Field 'message' is required and must be a non-empty string.",
        code: "EMPTY_MESSAGE",
      });
    }

    const wantsStreaming =
      req.headers.accept?.includes("text/event-stream") ||
      req.query.stream === "true" ||
      Boolean(req.body?.stream);

    // ── Streaming Mode via Server-Sent Events (SSE) ───────────────────────────
    if (wantsStreaming) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Prevent Nginx buffering
      if (typeof res.flushHeaders === "function") res.flushHeaders();

      const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const result = await defaultChatService.streamMessage({
          userId,
          projectId,
          conversationId,
          messageText,
          onStage: (stage, label) => {
            sendEvent("stage", { stage, label });
          },
          onToken: (token) => {
            sendEvent("token", { token });
          },
        });

        sendEvent("done", {
          conversationId: result.conversationId,
          title: result.title,
          message: result.message,
        });
        return res.end();
      } catch (streamErr) {
        const sanitized = (streamErr.message || "Streaming failed").replace(/gsk_[a-zA-Z0-9_-]+/g, "gsk_***");
        sendEvent("error", {
          error: sanitized,
          code: streamErr.code || "CHAT_STREAM_ERROR",
          status: streamErr.status || 500,
        });
        return res.end();
      }
    }

    // ── Standard Buffered JSON Mode ──────────────────────────────────────────
    const result = await defaultChatService.sendMessage({
      userId,
      projectId,
      conversationId,
      messageText,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    const sanitizedError = (err.message || "Failed to process chat message.").replace(/gsk_[a-zA-Z0-9_-]+/g, "gsk_***");
    console.error("[chat.controller] sendMessage error:", sanitizedError);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: sanitizedError,
      code: err.code || "CHAT_ERROR",
    });
  }
}

/**
 * DELETE /api/projects/:projectId/chat/conversations/:conversationId
 * Deletes a conversation.
 */
export async function deleteConversation(req, res) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const projectId = req.params.projectId || req.params.id;
    const { conversationId } = req.params;

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID.", code: "INVALID_PROJECT_ID" });
    }
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ success: false, error: "Invalid conversation ID.", code: "INVALID_CONVERSATION_ID" });
    }

    await defaultChatService.deleteConversation(userId, projectId, conversationId);

    return res.status(200).json({
      success: true,
      message: "Conversation deleted successfully.",
    });
  } catch (err) {
    console.error("[chat.controller] deleteConversation error:", err);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to delete conversation.",
      code: err.code || "CHAT_ERROR",
    });
  }
}

/**
 * PATCH /api/projects/:projectId/chat/conversations/:conversationId
 * Renames a conversation.
 */
export async function updateConversation(req, res) {
  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }

    const projectId = req.params.projectId || req.params.id;
    const { conversationId } = req.params;

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID.", code: "INVALID_PROJECT_ID" });
    }
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ success: false, error: "Invalid conversation ID.", code: "INVALID_CONVERSATION_ID" });
    }

    const { title } = req.body || {};
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: "Field 'title' must be a non-empty string.",
        code: "INVALID_TITLE",
      });
    }

    const updated = await defaultChatService.updateConversationTitle(userId, projectId, conversationId, title);

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error("[chat.controller] updateConversation error:", err);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to update conversation title.",
      code: err.code || "CHAT_ERROR",
    });
  }
}
