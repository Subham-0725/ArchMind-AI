// server/src/models/DevOpsArtifact.js
//
// Mongoose schema for persistent DevOps artifacts in ArchMind AI (Phase 5).
// Tracks Dockerfiles, CI/CD workflows, and Kubernetes manifests generated
// from repository-grounded analysis.

import mongoose from "mongoose";

const validationCheckSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    passed: { type: Boolean, required: true },
    message: { type: String, default: "" },
  },
  { _id: false }
);

const validationSchema = new mongoose.Schema(
  {
    valid: { type: Boolean, required: true, default: true },
    errors: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    checks: [validationCheckSchema],
    validationLevel: {
      type: String,
      enum: ["syntax", "structural", "schema", "tool"],
      default: "structural",
    },
  },
  { _id: false, suppressReservedKeysWarning: true }
);

const devOpsArtifactSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project ID is required"],
      index: true,
    },
    userId: {
      type: String,
      required: [true, "User ID is required"],
      index: true,
    },
    artifactType: {
      type: String,
      enum: ["dockerfile", "cicd", "kubernetes"],
      required: [true, "Artifact type is required"],
      index: true,
    },
    filePath: {
      type: String,
      required: [true, "Suggested file path is required"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Artifact content is required"],
    },
    validation: {
      type: validationSchema,
      default: () => ({
        valid: true,
        errors: [],
        warnings: [],
        checks: [],
        validationLevel: "structural",
      }),
    },
    generationStatus: {
      type: String,
      enum: ["pending", "generating", "completed", "failed"],
      default: "completed",
      index: true,
    },
    sourceAnalysisVersion: {
      type: Number,
      default: 1,
    },
    version: {
      type: Number,
      default: 1,
    },
    superseded: {
      type: Boolean,
      default: false,
    },
    metadata: {
      runtime: { type: String, default: null },
      runtimeVersion: { type: String, default: null },
      packageManager: { type: String, default: null },
      framework: { type: String, default: null },
      port: { type: Number, default: null },
      hasExistingArtifact: { type: Boolean, default: false },
      existingFilePath: { type: String, default: null },
      targetPlatform: { type: String, default: null },
      provider: { type: String, default: "groq" }, // "groq" | "deterministic"
      options: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index for querying active artifacts per project and type
devOpsArtifactSchema.index({ projectId: 1, artifactType: 1, version: -1 });
devOpsArtifactSchema.index({ projectId: 1, userId: 1 });

// Helper to convert document to safe JSON response
devOpsArtifactSchema.methods.toSafeObject = function () {
  return {
    id: this._id ? this._id.toString() : null,
    projectId: this.projectId ? this.projectId.toString() : null,
    userId: this.userId,
    artifactType: this.artifactType,
    filePath: this.filePath,
    content: this.content,
    validation: this.validation || {
      valid: true,
      errors: [],
      warnings: [],
      checks: [],
      validationLevel: "structural",
    },
    generationStatus: this.generationStatus,
    sourceAnalysisVersion: this.sourceAnalysisVersion,
    version: this.version,
    superseded: Boolean(this.superseded),
    metadata: this.metadata || {},
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const DevOpsArtifact =
  mongoose.models.DevOpsArtifact ||
  mongoose.model("DevOpsArtifact", devOpsArtifactSchema);

export default DevOpsArtifact;
