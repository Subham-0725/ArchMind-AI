// server/src/models/SecurityAudit.js
//
// Mongoose schema for persistent Security Audit run metadata.
// Records scan coverage, completion timestamps, unsupported files, and severity tallies.

import mongoose from "mongoose";

const securityAuditSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    totalFindings: {
      type: Number,
      default: 0,
    },
    severityCounts: {
      Critical: { type: Number, default: 0 },
      High: { type: Number, default: 0 },
      Medium: { type: Number, default: 0 },
      Low: { type: Number, default: 0 },
    },
    filesScanned: {
      type: Number,
      default: 0,
    },
    filesSkipped: {
      type: Number,
      default: 0,
    },
    unsupportedFilesCount: {
      type: Number,
      default: 0,
    },
    unsupportedFiles: {
      type: Array,
      default: [],
    },
    scanErrors: {
      type: Array,
      default: [],
    },
    errors: {
      type: Array,
      default: [],
    },
    scannerVersion: {
      type: String,
      default: "1.0.0",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    suppressReservedKeysWarning: true,
  }
);

securityAuditSchema.index({ projectId: 1, analysisVersion: 1 }, { unique: true });

const SecurityAudit =
  mongoose.models.SecurityAudit ||
  mongoose.model("SecurityAudit", securityAuditSchema);

export default SecurityAudit;
