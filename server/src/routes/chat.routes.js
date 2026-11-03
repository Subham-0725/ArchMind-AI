// server/src/routes/chat.routes.js
//
// Express router for Repository AI Chat endpoints.
// All endpoints are protected with Clerk JWT verification via requireAuth.

import { Router } from "express";
import requireAuth from "../middleware/auth.middleware.js";
import {
  createConversation,
  listConversations,
  getConversation,
  sendMessage,
  deleteConversation,
  updateConversation,
} from "../controllers/chat.controller.js";

const router = Router({ mergeParams: true });

// All chat endpoints require authentication
router.use(requireAuth);

// POST   /api/projects/:projectId/chat/conversations
router.post("/conversations", createConversation);

// GET    /api/projects/:projectId/chat/conversations
router.get("/conversations", listConversations);

// GET    /api/projects/:projectId/chat/conversations/:conversationId
router.get("/conversations/:conversationId", getConversation);

// POST   /api/projects/:projectId/chat/conversations/:conversationId/messages
router.post("/conversations/:conversationId/messages", sendMessage);

// DELETE /api/projects/:projectId/chat/conversations/:conversationId
router.delete("/conversations/:conversationId", deleteConversation);

// PATCH  /api/projects/:projectId/chat/conversations/:conversationId
router.patch("/conversations/:conversationId", updateConversation);

export default router;
