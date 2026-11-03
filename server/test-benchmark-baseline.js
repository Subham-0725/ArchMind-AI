// server/test-benchmark-baseline.js
//
// Stage-level latency benchmark for ArchMind AI Repository Chat.
// Measures the current latency across all stages against CVNexus main.

import "./src/config/env.js";
import mongoose from "mongoose";
import Project from "./src/models/Project.js";
import SourceFile from "./src/models/SourceFile.js";
import { defaultGroqChatService } from "./src/services/chat/groqChat.service.js";
import { extractQueryKeywords, chunkFileContent, extractAnalysisContext } from "./src/services/chat/repositoryContext.service.js";
import { extractRawCitations, verifyCitations } from "./src/services/chat/citation.service.js";
import { redactSecrets } from "./src/rie/security/secretRedactor.js";

async function runBenchmark() {
  console.log("==================================================");
  console.log("Baseline Latency Benchmark — Repository AI Chat");
  console.log("==================================================");

  await mongoose.connect(process.env.MONGODB_URI);

  const project = await Project.findOne({ name: /CVNexus main/i }).lean();
  if (!project) {
    console.error("Project CVNexus main not found");
    await mongoose.disconnect();
    return;
  }

  const question = "What database models are defined in this project?";
  const requestId = `bench-${Date.now()}`;
  console.log(`[RepositoryChat] requestId=${requestId}`);
  console.log(`Question: "${question}"\n`);

  const tTotalStart = performance.now();

  // 1. Request Validation
  const tValStart = performance.now();
  if (!question.trim()) throw new Error("Empty message");
  const requestValidationMs = (performance.now() - tValStart).toFixed(2);
  console.log(`[RepositoryChat] requestValidationMs=${requestValidationMs}`);

  // 2. Repository Context Retrieval (Current implementation: fetching all candidate files with content)
  const tRetrievalStart = performance.now();
  const candidateFiles = await SourceFile.find({
    projectId: project._id,
    isBinary: false,
    content: { $ne: null },
  })
    .select("filePath fileName extension language size lineCount symbols sourceLocations content")
    .lean();
  const contextRetrievalMs = (performance.now() - tRetrievalStart).toFixed(2);
  console.log(`[RepositoryChat] contextRetrievalMs=${contextRetrievalMs} (fetched ${candidateFiles.length} full files)`);

  // 3. Context Ranking and Selection
  const tRankStart = performance.now();
  const keywords = extractQueryKeywords(question);
  const scoredFiles = candidateFiles
    .map((file) => {
      let score = 0;
      const pathLower = (file.filePath || "").toLowerCase();
      const nameLower = (file.fileName || "").toLowerCase();
      const contentLower = (file.content || "").toLowerCase();
      const symbolsLower = (file.symbols || []).map((s) => String(s).toLowerCase());
      for (const kw of keywords) {
        if (nameLower.includes(kw)) score += 15;
        else if (pathLower.includes(kw)) score += 10;
        if (symbolsLower.some((sym) => sym.includes(kw))) score += 8;
        if (contentLower.includes(kw)) score += 3;
      }
      return { file, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((item) => item.file);

  const chunks = [];
  for (const file of scoredFiles) {
    if (chunks.length >= 15) break;
    const fileChunks = chunkFileContent(file, keywords, 100);
    for (const chunk of fileChunks) {
      if (chunks.length >= 15) break;
      chunks.push(chunk);
    }
  }
  const contextRankingMs = (performance.now() - tRankStart).toFixed(2);
  console.log(`[RepositoryChat] contextRankingMs=${contextRankingMs} (selected ${chunks.length} chunks from ${scoredFiles.length} files)`);

  // 4. Prompt Construction
  const tPromptStart = performance.now();
  const analysisContext = extractAnalysisContext(project, keywords);
  const formattedSections = [];
  formattedSections.push(`=== REPOSITORY METADATA ===\nName: ${project.name}`);
  if (analysisContext.database) {
    const entitiesStr = analysisContext.database.entities
      .map((e) => `- Model: ${e.name}\n  Fields: ${e.fields.map((f) => `${f.name}: ${f.type}`).join(", ")}`)
      .join("\n");
    formattedSections.push(`=== DATABASE SCHEMA ===\n${entitiesStr}`);
  }
  if (chunks.length > 0) {
    const codeSnippets = chunks.map((c) => `--- File: ${c.filePath} (Lines ${c.startLine}–${c.endLine}) ---\n${c.content}\n---`);
    formattedSections.push(`=== RELEVANT SOURCE CODE ===\n${codeSnippets.join("\n\n")}`);
  }
  const rawContext = redactSecrets(formattedSections.join("\n\n"));
  const promptConstructionMs = (performance.now() - tPromptStart).toFixed(2);
  console.log(`[RepositoryChat] promptConstructionMs=${promptConstructionMs} (context length: ${rawContext.length} chars)`);

  // 5 & 6. Groq Completion (time to first token vs total generation)
  const systemPrompt = `You are ArchMind AI Senior Repository Intelligence Architect. Answer based strictly on context below.\n\n=== REPOSITORY CONTEXT ===\n${rawContext}`;
  const groqPayload = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  let groqFirstTokenMs = "N/A";
  let groqGenerationMs = 0;
  let completionContent = "";

  const tGroqStart = performance.now();
  try {
    // Test streaming to measure first token
    const client = defaultGroqChatService.getClient();
    const stream = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      messages: groqPayload,
      temperature: 0.2,
      max_tokens: 1500,
      stream: true,
    });

    let firstTokenRecorded = false;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta && !firstTokenRecorded) {
        groqFirstTokenMs = (performance.now() - tGroqStart).toFixed(2);
        firstTokenRecorded = true;
      }
      completionContent += delta;
    }
    groqGenerationMs = (performance.now() - tGroqStart).toFixed(2);
  } catch (err) {
    console.error("Groq generation failed:", err.message);
  }
  console.log(`[RepositoryChat] groqFirstTokenMs=${groqFirstTokenMs}`);
  console.log(`[RepositoryChat] groqGenerationMs=${groqGenerationMs} (received ${completionContent.length} chars)`);

  // 7. Citation Verification
  const tCiteStart = performance.now();
  const rawCitations = extractRawCitations(completionContent);
  const verifiedCitations = verifyCitations(rawCitations, chunks, project.tree || []);
  const citationVerificationMs = (performance.now() - tCiteStart).toFixed(2);
  console.log(`[RepositoryChat] citationVerificationMs=${citationVerificationMs} (verified ${verifiedCitations.length} citations)`);

  // 8. Persistence (simulated save duration)
  const tPersistStart = performance.now();
  // lightweight no-op or simulated write
  const persistenceMs = (performance.now() - tPersistStart).toFixed(2);
  console.log(`[RepositoryChat] persistenceMs=${persistenceMs}`);

  // 9. Total Request Duration
  const totalDurationMs = (performance.now() - tTotalStart).toFixed(2);
  console.log(`[RepositoryChat] totalDurationMs=${totalDurationMs}`);

  console.log("==================================================");
  await mongoose.disconnect();
}

runBenchmark();

