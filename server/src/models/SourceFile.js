// server/src/models/SourceFile.js
//
// Mongoose schema for indexed source files in ArchMind AI.
//
// Separates source code storage from the main Project document (avoiding MongoDB's 16MB document limit).
// Supports line-level traceability, on-demand source file retrieval, citations, and future repository chat.

import mongoose from "mongoose";

const sourceLocationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    kind: { type: String, enum: ["function", "class", "route", "model", "variable", "entrypoint"], required: true },
    lineStart: { type: Number, required: true },
    lineEnd: { type: Number, required: true },
  },
  { _id: false }
);

const sourceFileSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    analysisVersion: {
      type: Number,
      required: true,
      default: 1,
      index: true,
    },
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    extension: {
      type: String,
      default: "",
    },
    language: {
      type: String,
      default: "text",
    },
    size: {
      type: Number,
      default: 0,
    },
    lineCount: {
      type: Number,
      default: 0,
    },
    contentHash: {
      type: String, // sha256 of the content
      default: "",
    },
    content: {
      type: String, // Sanitized & secret-redacted text content (null for binary or oversized files)
      default: null,
    },
    isBinary: {
      type: Boolean,
      default: false,
    },
    symbols: {
      type: [String],
      default: [],
    },
    sourceLocations: [sourceLocationSchema],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index to ensure uniqueness per project, file, and analysis version
sourceFileSchema.index({ projectId: 1, filePath: 1, analysisVersion: 1 }, { unique: true });

const SourceFile = mongoose.models.SourceFile || mongoose.model("SourceFile", sourceFileSchema);

export default SourceFile;

