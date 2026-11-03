// server/src/models/Conversation.js
//
// Mongoose schema for Repository AI Chat conversations in ArchMind AI.
//
// Multi-tenant isolation: Every conversation belongs to exactly one user (userId)
// and one project (projectId). Messages are preserved in chronological order with
// validated line-level repository citations.

import mongoose from "mongoose";

const citationSchema = new mongoose.Schema(
  {
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    startLine: {
      type: Number,
      default: null,
    },
    endLine: {
      type: Number,
      default: null,
    },
    sourceType: {
      type: String,
      enum: [
        "source_file",
        "blueprint",
        "architecture",
        "api_route",
        "database_model",
        "security_finding",
      ],
      default: "source_file",
    },
    snippet: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    citations: {
      type: [citationSchema],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "User ID is required"],
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project ID is required"],
      index: true,
    },
    title: {
      type: String,
      required: true,
      default: "New Conversation",
      trim: true,
      maxlength: 120,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index for querying user's conversations in a project, ordered by activity
conversationSchema.index({ userId: 1, projectId: 1, updatedAt: -1 });

const Conversation =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

export default Conversation;
