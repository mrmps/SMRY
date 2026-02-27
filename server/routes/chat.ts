/**
 * Chat Route - POST /api/chat
 *
 * Uses Vercel AI SDK with OpenRouter for streaming chat responses.
 */

import { Elysia, t } from "elysia";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../../lib/redis";
import {
  createRequestContext,
  extractClientIp,
} from "../../lib/request-context";
import { getAuthInfo } from "../middleware/auth";
import {
  createSummaryError,
  formatSummaryErrorResponse,
} from "../../lib/errors/summary";
import { getLanguagePrompt } from "../../types/api";
import { env } from "../env";
import { trackLLMGeneration } from "../../lib/posthog";

// Rate limits - same as summary route
const DAILY_LIMIT = env.NODE_ENV === "development" ? 100 : 20;
const MINUTE_LIMIT = env.NODE_ENV === "development" ? 60 : 12;

const dailyRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(DAILY_LIMIT, "24h"),
  analytics: true,
  prefix: "ratelimit:chat:daily",
});

const minuteRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MINUTE_LIMIT, "1m"),
  analytics: true,
  prefix: "ratelimit:chat:minute",
});

// Initialize OpenRouter provider
const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

/**
 * Model selection based on premium status
 * DO NOT CHANGE THESE MODELS WITHOUT EXPLICIT USER DIRECTION
 */
const FREE_MODEL = "nvidia/nemotron-3-nano-30b-a3b:free";
const PREMIUM_MODEL = "google/gemini-2.0-flash-001";

export const chatRoutes = new Elysia({ prefix: "/api" }).post(
  "/chat",
  async ({ body, request, set }) => {
    const ctx = createRequestContext({
      method: "POST",
      path: "/api/chat",
      url: request.url,
      ip: extractClientIp(request),
    });
    ctx.set("endpoint", "/api/chat");

    try {
      const { messages, articleContent, articleTitle, language = "en" } = body;

      if (!articleContent || articleContent.length < 50) {
        ctx.error("Article content too short", {
          error_type: "VALIDATION_ERROR",
          status_code: 422,
        });
        set.status = 422;
        return formatSummaryErrorResponse(
          createSummaryError("CONTENT_TOO_SHORT"),
        );
      }

      ctx.merge({ content_length: articleContent.length, language });

      const { isPremium, userId } = await getAuthInfo(request);
      ctx.set("is_premium", isPremium);

      const clientIp = extractClientIp(request);
      const rateLimitKey = userId || clientIp;

      // Track usage for headers - premium users get -1 (unlimited)
      let usageRemaining = isPremium ? -1 : DAILY_LIMIT;

      // Select model based on premium status
      const model = isPremium ? PREMIUM_MODEL : FREE_MODEL;
      const modelName = model.split("/")[1]?.replace(/:free$/, "") || model;

      ctx.set("model_tier", isPremium ? "premium" : "free");
      ctx.set("model", model);

      // Build system prompt with article context
      const languageInstruction =
        language && language !== "auto"
          ? `Always respond in ${getLanguagePrompt(language) || language}.`
          : "Respond in the same language as the user's question.";

      const systemPrompt = `You are a helpful assistant that answers questions about the article below.

ARTICLE TITLE: ${articleTitle || "Untitled"}

ARTICLE CONTENT:
${articleContent.slice(0, 12000)}

---

Rules:
- Answer questions based on the article content above
- Be concise and direct
- If the answer isn't in the article, say so honestly
- ${languageInstruction}`;

      if (!isPremium) {
        // Run both rate limit checks + message conversion in parallel
        const [dailyResult, minuteResult, modelMessages] = await Promise.all([
          dailyRateLimit.limit(rateLimitKey),
          minuteRateLimit.limit(rateLimitKey),
          convertToModelMessages(messages as UIMessage[]),
        ]);
        usageRemaining = dailyResult.remaining;

        if (!dailyResult.success) {
          const retryAfter = Math.ceil((dailyResult.reset - Date.now()) / 1000);
          ctx.error("Daily rate limit exceeded", {
            error_type: "RATE_LIMIT",
            status_code: 429,
          });
          set.status = 429;
          set.headers["Retry-After"] = String(retryAfter);
          set.headers["X-Usage-Remaining"] = "0";
          set.headers["X-Usage-Limit"] = String(DAILY_LIMIT);
          set.headers["X-Is-Premium"] = "false";
          return formatSummaryErrorResponse(
            createSummaryError("DAILY_LIMIT_REACHED", {
              retryAfter,
              usage: DAILY_LIMIT - dailyResult.remaining,
              limit: DAILY_LIMIT,
            }),
          );
        }

        if (!minuteResult.success) {
          const retryAfter = Math.ceil(
            (minuteResult.reset - Date.now()) / 1000,
          );
          ctx.error("Minute rate limit exceeded", {
            error_type: "RATE_LIMIT",
            status_code: 429,
          });
          set.status = 429;
          set.headers["Retry-After"] = String(retryAfter);
          set.headers["X-Usage-Remaining"] = String(usageRemaining);
          set.headers["X-Usage-Limit"] = String(DAILY_LIMIT);
          set.headers["X-Is-Premium"] = "false";
          return formatSummaryErrorResponse(
            createSummaryError("RATE_LIMITED", { retryAfter }),
          );
        }

        // Use AI SDK streamText for streaming response
        const traceId = crypto.randomUUID();
        const startTime = Date.now();
        const result = streamText({
          model: openrouter(model),
          system: systemPrompt,
          messages: modelMessages,
          onFinish: ({ text, usage }) => {
            trackLLMGeneration({
              distinctId: rateLimitKey,
              traceId,
              model,
              provider: "openrouter",
              inputTokens: usage?.inputTokens,
              outputTokens: usage?.outputTokens,
              latencyMs: Date.now() - startTime,
              outputContent: text,
              isPremium: false,
              language,
              messageCount: messages.length,
            });
          },
        });

        ctx.merge({ message_count: messages.length, status_code: 200 });
        ctx.success();

        const response = result.toUIMessageStreamResponse();
        const headers = new Headers(response.headers);
        headers.set("X-Is-Premium", "false");
        headers.set("X-Usage-Remaining", String(usageRemaining));
        headers.set("X-Usage-Limit", String(DAILY_LIMIT));
        headers.set("X-Model", modelName);
        return new Response(response.body, { status: response.status, headers });
      }

      // Premium: no rate limiting, just convert messages
      const modelMessages = await convertToModelMessages(messages as UIMessage[]);

      // Use AI SDK streamText for streaming response
      const traceId = crypto.randomUUID();
      const startTime = Date.now();
      const result = streamText({
        model: openrouter(model),
        system: systemPrompt,
        messages: modelMessages,
        onFinish: ({ text, usage }) => {
          trackLLMGeneration({
            distinctId: userId || clientIp,
            traceId,
            model,
            provider: "openrouter",
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            latencyMs: Date.now() - startTime,
            outputContent: text,
            isPremium: true,
            language,
            messageCount: messages.length,
          });
        },
      });

      ctx.merge({
        message_count: messages.length,
        status_code: 200,
      });
      ctx.success();

      // Return the streaming response with usage headers
      const response = result.toUIMessageStreamResponse();

      // Add custom headers to the response
      const headers = new Headers(response.headers);
      headers.set("X-Is-Premium", String(isPremium));
      headers.set("X-Usage-Remaining", String(usageRemaining));
      headers.set("X-Usage-Limit", String(isPremium ? -1 : DAILY_LIMIT));
      headers.set("X-Model", modelName);

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (error) {
      ctx.error(error instanceof Error ? error : String(error), {
        error_type: "UNKNOWN_ERROR",
        status_code: 500,
      });
      set.status = 500;
      return formatSummaryErrorResponse(
        createSummaryError("GENERATION_FAILED"),
      );
    }
  },
  {
    body: t.Object({
      messages: t.Array(
        t.Object({
          id: t.Optional(t.String()),
          role: t.String(),
          parts: t.Array(t.Any()),
          createdAt: t.Optional(t.Any()),
        }),
      ),
      articleContent: t.String(),
      articleTitle: t.Optional(t.String()),
      language: t.Optional(t.String()),
    }),
  },
);
