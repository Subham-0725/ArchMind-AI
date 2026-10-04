import { extractDatabaseSchema } from "./src/rie/dbSchemaExtractor.js";

const documentCode = `
import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true },
  title: { type: String, required: true },
  format: { type: String, default: "pdf" },
  fileData: { type: Buffer },
  fileSize: { type: Number },
  templateSlug: { type: String },
}, { timestamps: true });

export default mongoose.models.Document || mongoose.model("Document", DocumentSchema);
`;

const resumeCode = `
import mongoose from "mongoose";

const ResumeSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  templateSlug: { type: String, required: true },
  title: { type: String, required: true },
  data: { type: Object, default: {} },
  isDraft: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
  lastEditedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.models.Resume || mongoose.model("Resume", ResumeSchema);
`;

const resumeContentCode = `
import mongoose from "mongoose";

const sectionSchema = new mongoose.Schema({
  id: String,
  title: String,
  items: [Object],
});

const ResumeContentSchema = new mongoose.Schema({
  resumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Resume",
    required: true,
  },
  customSections: [sectionSchema],
  personalInfo: {
    fullName: String,
    email: String,
    phone: String,
  },
  experience: Array,
  skills: [String],
}, { timestamps: true });

export default mongoose.models.ResumeContent || mongoose.model("ResumeContent", ResumeContentSchema);
`;

const templateCode = `
import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  thumbnail: { type: String },
  category: { type: String, default: "modern" },
  config: { type: Object, default: {} },
}, { timestamps: true });

export default mongoose.models.Template || mongoose.model("Template", TemplateSchema);
`;

const userCode = `
import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  clerkId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  displayName: { type: String },
  photoUrl: { type: String },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model("User", UserSchema);
`;

const files = [
  { path: "models/Document.js", type: "file", content: documentCode },
  { path: "models/Resume.js", type: "file", content: resumeCode },
  { path: "models/ResumeContent.js", type: "file", content: resumeContentCode },
  { path: "models/Template.js", type: "file", content: templateCode },
  { path: "models/User.js", type: "file", content: userCode },
];

const res = extractDatabaseSchema(files, { hasDatabase: true, details: { databases: ["MongoDB"] } }, {}, null);
console.log("Entities found:", res.entities.map(e => ({ name: e.name, fieldsCount: e.fields.length })));
console.log("Relationships:", res.relationships);
