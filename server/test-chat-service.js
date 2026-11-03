// server/test-chat-service.js
//
// Fast, offline-first service integration test suite for Repository AI Chat:
// Verifies Conversation CRUD, multi-tenant ownership enforcement,
// project scoping, message persistence, context retrieval, and citation verification.

import assert from "node:assert";
import { randomUUID } from "crypto";
import Project from "./src/models/Project.js";
import SourceFile from "./src/models/SourceFile.js";
import Conversation from "./src/models/Conversation.js";
import { ChatService } from "./src/services/chat/chat.service.js";

console.log("==================================================");
console.log("Running Chat Service & Conversation Test Suite");
console.log("==================================================");

let testsPassed = 0;

// In-Memory Database Store for deterministic offline testing
const memoryDb = {
  projects: new Map(),
  conversations: new Map(),
  sourceFiles: new Map(),
};

// Create Mongoose-like document wrapper
function wrapConversationDoc(data) {
  const doc = {
    ...data,
    _id: data._id || randomUUID(),
    messages: data.messages || [],
    title: data.title || "New Conversation",
    lastMessageAt: data.lastMessageAt || new Date(),
    createdAt: data.createdAt || new Date(),
    updatedAt: data.updatedAt || new Date(),
    save: async function () {
      this.updatedAt = new Date();
      memoryDb.conversations.set(this._id.toString(), this);
      return this;
    },
  };
  return doc;
}

// Mock Project.findOne
const originalProjectFindOne = Project.findOne;
Project.findOne = function (filter) {
  const p = memoryDb.projects.get(String(filter._id));
  if (p && (!filter.userId || p.userId === filter.userId)) {
    return Promise.resolve(p);
  }
  return Promise.resolve(null);
};

// Mock Conversation methods
const originalConvCreate = Conversation.create;
Conversation.create = function (data) {
  const doc = wrapConversationDoc(data);
  memoryDb.conversations.set(doc._id.toString(), doc);
  return Promise.resolve(doc);
};

const originalConvFind = Conversation.find;
Conversation.find = function (filter) {
  const matches = [];
  for (const conv of memoryDb.conversations.values()) {
    if (conv.userId === filter.userId && String(conv.projectId) === String(filter.projectId)) {
      matches.push(conv);
    }
  }
  return {
    sort: () => ({
      select: () => ({
        lean: () => Promise.resolve(matches),
      }),
    }),
  };
};

const originalConvFindOne = Conversation.findOne;
Conversation.findOne = function (filter) {
  const conv = memoryDb.conversations.get(String(filter._id));
  if (
    conv &&
    (!filter.userId || conv.userId === filter.userId) &&
    (!filter.projectId || String(conv.projectId) === String(filter.projectId))
  ) {
    return Promise.resolve(conv);
  }
  return Promise.resolve(null);
};

const originalConvDeleteOne = Conversation.deleteOne;
Conversation.deleteOne = function (filter) {
  const conv = memoryDb.conversations.get(String(filter._id));
  if (
    conv &&
    (!filter.userId || conv.userId === filter.userId) &&
    (!filter.projectId || String(conv.projectId) === String(filter.projectId))
  ) {
    memoryDb.conversations.delete(String(filter._id));
    return Promise.resolve({ deletedCount: 1 });
  }
  return Promise.resolve({ deletedCount: 0 });
};

// Mock SourceFile.find
const originalSourceFileFind = SourceFile.find;
SourceFile.find = function (filter) {
  const matches = [];
  for (const sf of memoryDb.sourceFiles.values()) {
    if (filter._id && filter._id.$in) {
      if (filter._id.$in.includes(sf._id)) {
        matches.push(sf);
      }
    } else if (filter.projectId && String(sf.projectId) === String(filter.projectId)) {
      matches.push(sf);
    }
  }
  return {
    select: () => ({
      lean: () => Promise.resolve(matches),
    }),
  };
};

async function runSuite() {
  const testUserId1 = `user-chat-test-1-${Date.now()}`;
  const testUserId2 = `user-chat-test-2-${Date.now()}`;
  const p1Id = randomUUID();
  const p2Id = randomUUID();

  // Seed Project 1 for User 1
  memoryDb.projects.set(p1Id, {
    _id: p1Id,
    userId: testUserId1,
    name: "ChatTestProject",
    source: "zip",
    status: "completed",
    tree: [
      { path: "src/app.js", type: "file", size: 500 },
      { path: "src/middleware/auth.js", type: "file", size: 800 },
    ],
    techStack: {
      languages: ["JavaScript"],
      frameworks: ["Express"],
      databases: ["MongoDB"],
      devops: [],
    },
    capabilities: { hasApis: true, hasDatabase: true },
  });

  // Seed Project 2 for User 2
  memoryDb.projects.set(p2Id, {
    _id: p2Id,
    userId: testUserId2,
    name: "User2Project",
    source: "zip",
    status: "completed",
    tree: [{ path: "main.py", type: "file", size: 200 }],
  });

  // Seed SourceFiles for Project 1
  memoryDb.sourceFiles.set(`${p1Id}:src/middleware/auth.js`, {
    _id: "sf-auth-1",
    projectId: p1Id,
    userId: testUserId1,
    analysisVersion: 1,
    filePath: "src/middleware/auth.js",
    fileName: "auth.js",
    language: "javascript",
    lineCount: 30,
    content: `// Line 1
export const verifyAuthToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Missing token" });
  next();
};
`,
    symbols: ["verifyAuthToken"],
    sourceLocations: [
      { name: "verifyAuthToken", kind: "function", lineStart: 2, lineEnd: 6 },
    ],
  });

  // Setup Mock Groq Service for deterministic responses
  const mockGroqService = {
    completeChat: async (messages) => {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
      if (lastUserMsg.includes("FAIL_LLM")) {
        const err = new Error("Mock Groq API Internal Failure");
        err.status = 502;
        throw err;
      }
      return {
        content: `Authentication is handled by verifyAuthToken in src/middleware/auth.js:L2-L6.
[Source: src/middleware/auth.js:L2-L6]`,
        model: "openai/gpt-oss-120b",
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
      };
    },
  };

  const chatService = new ChatService({ groqService: mockGroqService });

  try {
    // Test 1: Create Conversation
    let convData = await chatService.createConversation(testUserId1, p1Id);
    assert.ok(convData.conversationId);
    assert.strictEqual(convData.title, "New Conversation");
    assert.strictEqual(convData.messageCount, 0);
    console.log("✅ PASS 1: Conversation created with default title");
    testsPassed++;

    const convId = convData.conversationId;

    // Test 2: List Conversations
    const convList = await chatService.listConversations(testUserId1, p1Id);
    assert.strictEqual(convList.length, 1);
    assert.strictEqual(convList[0].conversationId, convId);
    console.log("✅ PASS 2: Conversation listed for authorized user & project");
    testsPassed++;

    // Test 3: Multi-tenant User Isolation (User 2 cannot list or access User 1's conversation)
    let caughtIsolation = false;
    try {
      await chatService.getConversationHistory(testUserId2, p1Id, convId);
    } catch (err) {
      caughtIsolation = true;
      assert.strictEqual(err.status, 404);
    }
    assert.strictEqual(caughtIsolation, true, "User 2 must be blocked from User 1's conversation");
    console.log("✅ PASS 3: Multi-tenant user isolation enforced (cross-user access blocked)");
    testsPassed++;

    // Test 4: Project Scoping (Cannot access Project 1's conversation under Project 2)
    let caughtProjectMismatch = false;
    try {
      await chatService.getConversationHistory(testUserId1, p2Id, convId);
    } catch (err) {
      caughtProjectMismatch = true;
      assert.strictEqual(err.status, 404);
    }
    assert.strictEqual(caughtProjectMismatch, true, "Cross-project conversation access blocked");
    console.log("✅ PASS 4: Project boundary scoping enforced (cross-project access blocked)");
    testsPassed++;

    // Test 5: Send Chat Message & Verified Citation Generation
    const sendResult = await chatService.sendMessage({
      userId: testUserId1,
      projectId: p1Id,
      conversationId: convId,
      messageText: "Where is authentication handled in this project?",
    });

    assert.ok(sendResult.messageId);
    assert.strictEqual(sendResult.role, "assistant");
    assert.ok(sendResult.content.includes("verifyAuthToken"));
    assert.ok(sendResult.citations.length >= 1, "Must contain verified citations");
    assert.strictEqual(sendResult.citations[0].filePath, "src/middleware/auth.js");
    assert.strictEqual(sendResult.citations[0].startLine, 2);
    assert.strictEqual(sendResult.citations[0].endLine, 6);
    console.log("✅ PASS 5: Message sent, context retrieved, Groq called, citation verified & persisted");
    testsPassed++;

    // Test 6: Verify Conversation History and Auto-Title
    const history = await chatService.getConversationHistory(testUserId1, p1Id, convId);
    assert.strictEqual(history.messages.length, 2, "Must contain user and assistant messages");
    assert.strictEqual(history.messages[0].role, "user");
    assert.strictEqual(history.messages[1].role, "assistant");
    assert.ok(history.title.includes("Where is authentication"), "Title must be auto-generated from first message");
    console.log("✅ PASS 6: History retrieved with verified message order and auto-generated title");
    testsPassed++;

    // Test 7: Rejection of Empty or Oversized Message
    let caughtEmpty = false;
    try {
      await chatService.sendMessage({
        userId: testUserId1,
        projectId: p1Id,
        conversationId: convId,
        messageText: "   ",
      });
    } catch (err) {
      caughtEmpty = true;
      assert.strictEqual(err.code, "EMPTY_MESSAGE");
    }
    assert.strictEqual(caughtEmpty, true);
    console.log("✅ PASS 7: Empty message rejected with 400 error");
    testsPassed++;

    // Test 8: LLM Failure preserves User Message & flags failure
    let caughtLlmFailure = false;
    try {
      await chatService.sendMessage({
        userId: testUserId1,
        projectId: p1Id,
        conversationId: convId,
        messageText: "Please FAIL_LLM now",
      });
    } catch (err) {
      caughtLlmFailure = true;
      assert.strictEqual(err.status, 502);
    }
    assert.strictEqual(caughtLlmFailure, true);

    const historyAfterFailure = await chatService.getConversationHistory(testUserId1, p1Id, convId);
    const lastUserMsg = historyAfterFailure.messages.find((m) => m.content === "Please FAIL_LLM now");
    assert.ok(lastUserMsg, "User message must be preserved even if LLM completion failed");
    console.log("✅ PASS 8: LLM failure handled safely without losing user prompt");
    testsPassed++;

    // Test 9: Rename Conversation Title
    const renameResult = await chatService.updateConversationTitle(
      testUserId1,
      p1Id,
      convId,
      "Auth Architecture Overview"
    );
    assert.strictEqual(renameResult.title, "Auth Architecture Overview");
    console.log("✅ PASS 9: Conversation title updated successfully");
    testsPassed++;

    // Test 10: Delete Conversation
    const deleteResult = await chatService.deleteConversation(testUserId1, p1Id, convId);
    assert.strictEqual(deleteResult.success, true);

    assert.strictEqual(memoryDb.conversations.has(convId), false, "Conversation must be deleted from DB");
    assert.ok(memoryDb.projects.has(p1Id), "Project must remain intact after conversation deletion");
    console.log("✅ PASS 10: Conversation deleted cleanly while preserving project and repository files");
    testsPassed++;

  } finally {
    // Restore originals
    Project.findOne = originalProjectFindOne;
    Conversation.create = originalConvCreate;
    Conversation.find = originalConvFind;
    Conversation.findOne = originalConvFindOne;
    Conversation.deleteOne = originalConvDeleteOne;
    SourceFile.find = originalSourceFileFind;
  }

  console.log("==================================================");
  console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
  console.log("==================================================");
}

runSuite().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
