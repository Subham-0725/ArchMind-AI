// server/test-groq-chat.js
//
// Test suite for GroqChatService:
// Verifies message formatting, model config (openai/gpt-oss-120b),
// missing API key validation, 404 model error handling, timeout handling,
// rate-limit error mapping, and key sanitization in logs/errors.

import assert from "node:assert";
import { GroqChatService } from "./src/services/chat/groqChat.service.js";

console.log("==================================================");
console.log("Running Groq Chat Service Test Suite");
console.log("==================================================");

let testsPassed = 0;

// Test 1: Instantiation with default model (openai/gpt-oss-120b) and custom options
{
  const service = new GroqChatService();
  assert.strictEqual(service.model, process.env.GROQ_MODEL || "openai/gpt-oss-120b");

  const customService = new GroqChatService({
    model: "openai/gpt-oss-120b",
    temperature: 0.1,
    maxTokens: 1024,
    timeoutMs: 15000,
  });

  assert.strictEqual(customService.model, "openai/gpt-oss-120b");
  assert.strictEqual(customService.temperature, 0.1);
  assert.strictEqual(customService.maxTokens, 1024);
  assert.strictEqual(customService.timeoutMs, 15000);

  console.log("✅ PASS 1: GroqChatService defaults to openai/gpt-oss-120b and accepts custom options");
  testsPassed++;
}

// Test 2: Validation on missing API key throws 503 GROQ_KEY_MISSING
{
  const serviceWithoutKey = new GroqChatService({ apiKey: "" });
  const oldEnvKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;

  let keyErrorCaught = false;
  try {
    serviceWithoutKey.getClient();
  } catch (err) {
    keyErrorCaught = true;
    assert.strictEqual(err.code, "GROQ_KEY_MISSING");
    assert.strictEqual(err.status, 503);
    assert.strictEqual(err.message.includes("GROQ_API_KEY"), true);
  } finally {
    if (oldEnvKey) process.env.GROQ_API_KEY = oldEnvKey;
  }

  assert.strictEqual(keyErrorCaught, true, "Missing API key must throw 503 GROQ_KEY_MISSING");
  console.log("✅ PASS 2: Missing or unconfigured API key rejected with 503 GROQ_KEY_MISSING");
  testsPassed++;
}

// Test 3: Validation on missing or empty messages array
{
  const service = new GroqChatService({ apiKey: "test-key" });
  let errorCaught = false;

  try {
    await service.completeChat([]);
  } catch (err) {
    errorCaught = true;
    assert.ok(err.message.includes("at least one message"));
  }

  assert.strictEqual(errorCaught, true, "Empty messages must throw validation error");
  console.log("✅ PASS 3: Empty messages array rejected with validation error");
  testsPassed++;
}

// Test 4: Successful chat completion with mock client passing openai/gpt-oss-120b
{
  const mockClient = {
    chat: {
      completions: {
        create: async ({ model, messages, temperature }) => {
          assert.strictEqual(model, "openai/gpt-oss-120b");
          assert.ok(messages.length >= 1);
          return {
            id: "chatcmpl-test-123",
            model: "openai/gpt-oss-120b",
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "Authentication is handled in server/src/middleware/auth.middleware.js:L12-L38.",
                },
              },
            ],
            usage: {
              prompt_tokens: 120,
              completion_tokens: 25,
              total_tokens: 145,
            },
          };
        },
      },
    },
  };

  const service = new GroqChatService({ client: mockClient, model: "openai/gpt-oss-120b" });
  const result = await service.completeChat([
    { role: "system", content: "You are ArchMind assistant." },
    { role: "user", content: "Where is authentication handled?" },
  ]);

  assert.ok(result.content.includes("auth.middleware.js"));
  assert.strictEqual(result.model, "openai/gpt-oss-120b");
  assert.strictEqual(result.usage.totalTokens, 145);

  console.log("✅ PASS 4: Successful chat completion normalized with openai/gpt-oss-120b");
  testsPassed++;
}

// Test 5: Groq 404 Model Not Found mapped to GROQ_MODEL_NOT_FOUND (502)
{
  const mockModelNotFoundClient = {
    chat: {
      completions: {
        create: async () => {
          const err = new Error("The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.");
          err.status = 404;
          throw err;
        },
      },
    },
  };

  const service = new GroqChatService({ client: mockModelNotFoundClient, model: "openai/gpt-oss-120b" });
  let modelErrCaught = false;

  try {
    await service.completeChat([{ role: "user", content: "Test prompt" }]);
  } catch (err) {
    modelErrCaught = true;
    assert.strictEqual(err.code, "GROQ_MODEL_NOT_FOUND");
    assert.strictEqual(err.status, 502);
    assert.ok(err.message.includes("openai/gpt-oss-120b"));
    assert.ok(err.message.includes("AI model was not found or is unavailable"));
  }

  assert.strictEqual(modelErrCaught, true, "Model 404 error must be mapped to GROQ_MODEL_NOT_FOUND");
  console.log("✅ PASS 5: Groq model 404 error correctly mapped to informative GROQ_MODEL_NOT_FOUND");
  testsPassed++;
}

// Test 6: Groq 401 Auth Failure mapped to GROQ_AUTH_FAILED (502)
{
  const mockAuthFailedClient = {
    chat: {
      completions: {
        create: async () => {
          const err = new Error("Invalid API Key provided: gsk_testSecretKey12345");
          err.status = 401;
          throw err;
        },
      },
    },
  };

  const service = new GroqChatService({ client: mockAuthFailedClient });
  let authErrCaught = false;

  try {
    await service.completeChat([{ role: "user", content: "Test prompt" }]);
  } catch (err) {
    authErrCaught = true;
    assert.strictEqual(err.code, "GROQ_AUTH_FAILED");
    assert.strictEqual(err.status, 502);
    assert.strictEqual(err.message.includes("gsk_testSecretKey12345"), false, "Secret must NOT leak in error message");
  }

  assert.strictEqual(authErrCaught, true, "Auth error must be mapped to GROQ_AUTH_FAILED");
  console.log("✅ PASS 6: Groq 401 Auth error mapped to user-safe GROQ_AUTH_FAILED without leaking key");
  testsPassed++;
}

// Test 7: Rate limit error mapping (HTTP 429)
{
  const mockRateLimitedClient = {
    chat: {
      completions: {
        create: async () => {
          const err = new Error("Rate limit reached for model openai/gpt-oss-120b");
          err.status = 429;
          throw err;
        },
      },
    },
  };

  const service = new GroqChatService({ client: mockRateLimitedClient });
  let caught = false;

  try {
    await service.completeChat([{ role: "user", content: "Hello" }]);
  } catch (err) {
    caught = true;
    assert.strictEqual(err.code, "GROQ_RATE_LIMIT");
    assert.strictEqual(err.status, 429);
    assert.ok(err.message.includes("rate limit"));
  }

  assert.strictEqual(caught, true, "Rate limit error must be mapped to code GROQ_RATE_LIMIT");
  console.log("✅ PASS 7: Rate limit 429 error mapped to user-safe message");
  testsPassed++;
}

// Test 8: Timeout handling (504 GROQ_TIMEOUT)
{
  const mockHangingClient = {
    chat: {
      completions: {
        create: () => new Promise((resolve) => setTimeout(resolve, 500)),
      },
    },
  };

  const service = new GroqChatService({
    client: mockHangingClient,
    timeoutMs: 50, // Short timeout for testing
  });

  let timeoutCaught = false;
  try {
    await service.completeChat([{ role: "user", content: "Timeout test" }]);
  } catch (err) {
    timeoutCaught = true;
    assert.strictEqual(err.code, "GROQ_TIMEOUT");
    assert.strictEqual(err.status, 504);
  }

  assert.strictEqual(timeoutCaught, true, "Hanging request must throw GROQ_TIMEOUT");
  console.log("✅ PASS 8: Request timeout properly triggers 504 GROQ_TIMEOUT");
  testsPassed++;
}

// Test 9: Malformed response handling
{
  const mockMalformedClient = {
    chat: {
      completions: {
        create: async () => ({ choices: [] }), // No message content
      },
    },
  };

  const service = new GroqChatService({ client: mockMalformedClient });
  let malformedCaught = false;

  try {
    await service.completeChat([{ role: "user", content: "Test" }]);
  } catch (err) {
    malformedCaught = true;
    assert.ok(err.message.includes("empty or malformed"));
  }

  assert.strictEqual(malformedCaught, true, "Empty choices must throw malformed error");
  console.log("✅ PASS 9: Malformed provider response detected and rejected safely");
  testsPassed++;
}

console.log("==================================================");
console.log(`Test Results: ${testsPassed} PASSED, 0 FAILED`);
console.log("==================================================");
