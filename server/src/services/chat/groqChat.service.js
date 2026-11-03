// server/src/services/chat/groqChat.service.js
//
// Dedicated Groq Chat Completion Service for ArchMind AI Repository Chat.
// Manages LLM requests, real-time streaming, timeouts, rate-limiting isolation,
// and response normalization.

import Groq from "groq-sdk";

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Sanitizes any raw error message to ensure API keys are never exposed in logs or responses.
 */
function sanitizeMessage(msg) {
  if (typeof msg !== "string") return "Unknown error";
  return msg.replace(/gsk_[a-zA-Z0-9_-]+/g, "gsk_***");
}

export class GroqChatService {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GROQ_API_KEY || null;
    this.model = options.model || process.env.GROQ_MODEL || process.env.GROQ_CHAT_MODEL || DEFAULT_MODEL;
    this.temperature = options.temperature !== undefined
      ? options.temperature
      : Number(process.env.GROQ_CHAT_TEMPERATURE) || DEFAULT_TEMPERATURE;
    this.maxTokens = options.maxTokens || Number(process.env.GROQ_CHAT_MAX_TOKENS) || DEFAULT_MAX_TOKENS;
    this.timeoutMs = options.timeoutMs || Number(process.env.GROQ_CHAT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    this.client = options.client || null;
  }

  /**
   * Initializes or returns the Groq SDK client instance.
   * Validates GROQ_API_KEY presence without exposing credentials.
   */
  getClient() {
    if (this.client) return this.client;
    const key = this.apiKey || process.env.GROQ_API_KEY;
    if (!key || typeof key !== "string" || !key.trim() || key.startsWith("YOUR_")) {
      const err = new Error("Groq API key is not configured on the server. Please set GROQ_API_KEY in the server environment.");
      err.code = "GROQ_KEY_MISSING";
      err.status = 503;
      throw err;
    }
    this.client = new Groq({
      apiKey: key.trim(),
      timeout: this.timeoutMs,
    });
    return this.client;
  }

  /**
   * Standard error classifier for Groq errors.
   */
  _handleGroqError(err, model) {
    // 1. Rate Limit Error
    if (err.status === 429 || err.message?.includes("rate limit") || err.code === "rate_limit_exceeded") {
      const rateLimitErr = new Error("Groq API rate limit exceeded. Please wait a moment and try again.");
      rateLimitErr.code = "GROQ_RATE_LIMIT";
      rateLimitErr.status = 429;
      throw rateLimitErr;
    }

    // 2. Model Not Found / Decommissioned (e.g. HTTP 404 or model_not_found)
    if (
      err.status === 404 ||
      (err.message && (err.message.toLowerCase().includes("model") || err.message.toLowerCase().includes("not_found")))
    ) {
      const modelErr = new Error(
        `Groq model error (${model}): The requested AI model was not found or is unavailable. Please verify GROQ_MODEL in your server configuration.`
      );
      modelErr.code = "GROQ_MODEL_NOT_FOUND";
      modelErr.status = 502;
      throw modelErr;
    }

    // 3. Authentication / Invalid API Key Error
    if (
      err.status === 401 ||
      (err.message && (err.message.toLowerCase().includes("api key") || err.message.toLowerCase().includes("invalid_api_key")))
    ) {
      const authErr = new Error("Groq API authentication failed. The configured GROQ_API_KEY is invalid or expired.");
      authErr.code = "GROQ_AUTH_FAILED";
      authErr.status = 502;
      throw authErr;
    }

    // 4. Request Timeout
    if (err.code === "GROQ_TIMEOUT") {
      err.status = 504;
      throw err;
    }

    // 5. General Error (Mask any accidental key leakage)
    const sanitized = sanitizeMessage(err.message);
    console.error("[groqChat.service] Groq completion error:", sanitized);
    const providerErr = new Error(`Groq service error: ${sanitized}`);
    providerErr.code = err.code || "GROQ_ERROR";
    providerErr.status = err.status || 502;
    throw providerErr;
  }

  /**
   * Dispatches chat completion request to Groq API (synchronous/buffered).
   *
   * @param {Array<{ role: string, content: string }>} messages
   * @param {Object} [overrideOptions]
   * @returns {Promise<{ content: string, model: string, usage: Object, groqGenerationMs: number }>}
   */
  async completeChat(messages, overrideOptions = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Messages array must contain at least one message.");
    }

    const client = this.getClient();
    const model = overrideOptions.model || this.model;
    const temperature = overrideOptions.temperature !== undefined ? overrideOptions.temperature : this.temperature;
    const maxTokens = overrideOptions.maxTokens || this.maxTokens;

    const tStart = performance.now();
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const err = new Error(`Groq API request timed out after ${this.timeoutMs}ms.`);
        err.code = "GROQ_TIMEOUT";
        err.status = 504;
        reject(err);
      }, this.timeoutMs);
    });

    try {
      const completionPromise = client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const response = await Promise.race([completionPromise, timeoutPromise]);
      clearTimeout(timeoutHandle);
      const groqGenerationMs = Number((performance.now() - tStart).toFixed(2));

      const choice = response?.choices?.[0];
      const messageContent = choice?.message?.content;

      if (typeof messageContent !== "string") {
        throw new Error("Groq API returned an empty or malformed message response.");
      }

      return {
        content: messageContent,
        model: response.model || model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        groqFirstTokenMs: groqGenerationMs,
        groqGenerationMs,
      };
    } catch (err) {
      clearTimeout(timeoutHandle);
      this._handleGroqError(err, model);
    }
  }

  /**
   * Dispatches streaming chat completion to Groq API.
   * Invokes onToken(token) for every delta chunk and measures first-token timing.
   *
   * @param {Array<{ role: string, content: string }>} messages
   * @param {Function} onToken - Callback receiving delta text string
   * @param {Object} [overrideOptions]
   * @returns {Promise<{ content: string, model: string, usage: Object, groqFirstTokenMs: number, groqGenerationMs: number }>}
   */
  async streamChat(messages, onToken, overrideOptions = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Messages array must contain at least one message.");
    }

    const client = this.getClient();
    const model = overrideOptions.model || this.model;
    const temperature = overrideOptions.temperature !== undefined ? overrideOptions.temperature : this.temperature;
    const maxTokens = overrideOptions.maxTokens || this.maxTokens;

    const tGroqStart = performance.now();
    let groqFirstTokenMs = 0;
    let firstTokenRecorded = false;
    let accumulatedContent = "";

    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const err = new Error(`Groq streaming request timed out after ${this.timeoutMs}ms.`);
        err.code = "GROQ_TIMEOUT";
        err.status = 504;
        reject(err);
      }, this.timeoutMs);
    });

    try {
      const streamPromise = client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      const stream = await Promise.race([streamPromise, timeoutPromise]);

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          if (!firstTokenRecorded) {
            groqFirstTokenMs = Number((performance.now() - tGroqStart).toFixed(2));
            firstTokenRecorded = true;
          }
          accumulatedContent += delta;
          if (typeof onToken === "function") {
            onToken(delta);
          }
        }
      }

      clearTimeout(timeoutHandle);
      const groqGenerationMs = Number((performance.now() - tGroqStart).toFixed(2));

      return {
        content: accumulatedContent,
        model,
        usage: {
          promptTokens: Math.round(messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 4),
          completionTokens: Math.round(accumulatedContent.length / 4),
          totalTokens: Math.round(
            (messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) + accumulatedContent.length) / 4
          ),
        },
        groqFirstTokenMs: groqFirstTokenMs || groqGenerationMs,
        groqGenerationMs,
      };
    } catch (err) {
      clearTimeout(timeoutHandle);
      this._handleGroqError(err, model);
    }
  }
}

// Default singleton instance using environment variables
export const defaultGroqChatService = new GroqChatService();
