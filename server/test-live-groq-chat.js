// server/test-live-groq-chat.js
//
// Live API test verifying Groq Chat completion with openai/gpt-oss-120b.

import "./src/config/env.js";
import { GroqChatService } from "./src/services/chat/groqChat.service.js";

async function main() {
  console.log("==================================================");
  console.log("Testing Live Groq Chat API (openai/gpt-oss-120b)");
  console.log("==================================================");

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith("YOUR_")) {
    console.error("❌ SKIPPED: GROQ_API_KEY is not set in server/.env");
    process.exit(1);
  }

  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  console.log(`Configured Model: ${model}`);
  console.log(`API Key Detected: gsk_*** (length: ${apiKey.length})\n`);

  const chatService = new GroqChatService({
    model,
    timeoutMs: 30000,
  });

  const testMessages = [
    {
      role: "system",
      content: "You are ArchMind AI Senior Repository Intelligence Architect. Provide a brief 1-sentence confirmation that the model is active.",
    },
    {
      role: "user",
      content: "Please confirm that you are online and identify your model.",
    },
  ];

  try {
    const startTime = Date.now();
    const result = await chatService.completeChat(testMessages);
    const durationMs = Date.now() - startTime;

    console.log("✅ Live Groq Chat Response Received!");
    console.log(`Duration: ${durationMs}ms`);
    console.log(`Model Used: ${result.model}`);
    console.log(`Tokens: Prompt: ${result.usage.promptTokens}, Completion: ${result.usage.completionTokens}, Total: ${result.usage.totalTokens}`);
    console.log("\nResponse Content:");
    console.log(result.content);
    console.log("\n==================================================");
    console.log("✅ Real Groq API Request Succeeded with openai/gpt-oss-120b!");
    console.log("==================================================");
  } catch (err) {
    console.error("❌ Live Groq API Request Failed:");
    console.error(`Status: ${err.status}`);
    console.error(`Code: ${err.code}`);
    console.error(`Message: ${err.message}`);
    process.exit(1);
  }
}

main();
