// server/src/models/SecurityFinding.js
//
// Mongoose schema for persistent repository security audit findings.
// Stores evidence-grounded findings from deterministic secret scanning,
// Tree-sitter AST security rules, and AI-assisted code review.
// Raw credentials are NEVER stored in this model.

import mongoose from "mongoose";

const securityFindingSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    analysisVersion: {
      type: Number,
      required: true,
      default: 1,
      index: true,
    },
    ruleId: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ["Critical", "High", "Medium", "Low"],
      required: true,
      index: true,
    },
    confidence: {
      type: String,
      enum: ["High", "Medium", "Low"],
      required: true,
      default: "High",
    },
    status: {
      type: String,
      enum: ["open", "resolved", "ignored"],
      default: "open",
      index: true,
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    startLine: {
      type: Number,
      required: true,
      default: 1,
    },
    endLine: {
      type: Number,
      required: true,
      default: 1,
    },
    redactedEvidence: {
      type: String,
      default: "",
    },
    maskedValue: {
      type: String,
      default: null,
    },
    recommendation: {
      type: String,
      default: "",
    },
    source: {
      type: String,
      enum: ["secret_scanner", "ast_analyzer", "ai_reviewer"],
      required: true,
      index: true,
    },
    references: {
      type: [String],
      default: [],
    },
    confirmed: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound indexes for fast, filtered, versioned queries
securityFindingSchema.index({ projectId: 1, analysisVersion: 1, status: 1 });
securityFindingSchema.index({ projectId: 1, analysisVersion: 1, severity: 1 });
securityFindingSchema.index({ projectId: 1, filePath: 1 });

const SecurityFinding =
  mongoose.models.SecurityFinding ||
  mongoose.model("SecurityFinding", securityFindingSchema);

export default SecurityFinding;

