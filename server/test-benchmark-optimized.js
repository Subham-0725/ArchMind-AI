// server/test-benchmark-optimized.js
//
// Optimized Latency Benchmark for Repository AI Chat.
// Measures the optimized performance of two-phase retrieval, intent-aware ranking,
// streaming time-to-first-token, and full response generation.

import "./src/config/env.js";
import mongoose from "mongoose";
import Project from "./src/models/Project.js";
import { defaultChatService } from "./src/services/chat/chat.service.js";

async function runOptimizedBenchmark() {
  console.log("==================================================");
  console.log("Optimized Latency Benchmark — Repository AI Chat");
  console.log("==================================================");

  await mongoose.connect(process.env.MONGODB_URI);

  const project = await Project.findOne({ name: /CVNexus main/i }).lean();
  if (!project) {
    console.error("Project CVNexus main not found");
    await mongoose.disconnect();
    return;
  }

  const question = "What database models are defined in this project?";
  console.log(`Question: "${question}"\n`);

  const stagesReported = [];
  let tokenCount = 0;
  let firstTokenMs = null;
  const tBenchStart = performance.now();

  let conv;
  try {
    conv = await defaultChatService.createConversation(project.userId, project._id, "Latency Benchmark");

    const result = await defaultChatService.streamMessage({
      userId: project.userId,
      projectId: project._id,
      conversationId: conv.conversationId,
      messageText: question,
      onStage: (stage, label) => {
        const timeFromStart = (performance.now() - tBenchStart).toFixed(2);
        stagesReported.push({ stage, label, ms: timeFromStart });
        console.log(`[Stage Transition @ ${timeFromStart}ms] ${stage} -> "${label}"`);
      },
      onToken: (token) => {
        if (tokenCount === 0) {
          firstTokenMs = (performance.now() - tBenchStart).toFixed(2);
          console.log(`\n⚡ First Token Arrived at: ${firstTokenMs}ms!\n`);
        }
        tokenCount++;
      },
    });

    const totalBenchMs = (performance.now() - tBenchStart).toFixed(2);
    console.log(`\n==================================================`);
    console.log(`Optimized Benchmark Results:`);
    console.log(`- Time to First Token (TTFT): ${firstTokenMs}ms (vs ~2300ms without streaming!)`);
    console.log(`- Total Generation Time: ${totalBenchMs}ms`);
    console.log(`- Total Tokens Streamed: ${tokenCount}`);
    console.log(`- Verified Citations: ${result.message.citations.length}`);
    console.log(`- Recorded Timings:`, JSON.stringify(result.message.metadata.timings, null, 2));
    console.log(`==================================================`);
  } catch (err) {
    console.error("Optimized benchmark failed:", err.message);
  } finally {
    if (conv) {
      await defaultChatService.deleteConversation(project.userId, project._id, conv.conversationId).catch(() => {});
    }
    await mongoose.disconnect();
  }
}

runOptimizedBenchmark();
