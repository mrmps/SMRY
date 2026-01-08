/**
 * Summary Route - POST /api/summary
 *
 * Uses OpenRouter SDK directly for streaming with model fallbacks.
 */

import { Elysia, t } from "elysia";
import { OpenRouter } from "@openrouter/sdk";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../../lib/redis";
import {
  createRequestContext,
  extractClientIp,
} from "../../lib/request-context";
import { getAuthInfo } from "../middleware/auth";
import { createHash } from "crypto";
import {
  createSummaryError,
  formatSummaryErrorResponse,
} from "../../lib/errors/summary";
import { getLanguagePrompt } from "../../types/api";
import { env } from "../../lib/env";

// Rate limits - single source of truth
const DAILY_LIMIT = env.NODE_ENV === "development" ? 100 : 20;
const MINUTE_LIMIT = env.NODE_ENV === "development" ? 60 : 12;

const dailyRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(DAILY_LIMIT, "24h"),
  analytics: true,
  prefix: "ratelimit:summary:daily",
});

const minuteRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MINUTE_LIMIT, "1m"),
  analytics: true,
  prefix: "ratelimit:summary:minute",
});

// Initialize OpenRouter SDK
const openRouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

// Primary model + fallbacks - OpenRouter will try next if one fails
const MODELS = [
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "arcee-ai/trinity-mini:free",
  "qwen/qwen3-4b:free",
];

export const summaryRoutes = new Elysia({ prefix: "/api" }).post(
  "/summary",
  async ({ body, request, set }) => {
    const ctx = createRequestContext({
      method: "POST",
      path: "/api/summary",
      url: request.url,
      ip: extractClientIp(request),
    });
    ctx.set("endpoint", "/api/summary");

    try {
      // Extract content from request body (support both content + prompt payloads)
      const content = body.content ?? body.prompt;

      if (!content || content.length < 100) {
        ctx.error("Content too short", {
          error_type: "VALIDATION_ERROR",
          status_code: 422,
        });
        set.status = 422;
        return formatSummaryErrorResponse(
          createSummaryError("CONTENT_TOO_SHORT"),
        );
      }

      const { title, url, language = "en" } = body;
      ctx.merge({ content_length: content.length, language });

      const { isPremium, userId } = await getAuthInfo(request);
      ctx.set("is_premium", isPremium);

      const clientIp = extractClientIp(request);
      const rateLimitKey = userId || clientIp;

      // Track usage for headers - premium users get -1 (unlimited)
      let usageRemaining = isPremium ? -1 : DAILY_LIMIT;

      if (!isPremium) {
        const dailyResult = await dailyRateLimit.limit(rateLimitKey);
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

        const minuteResult = await minuteRateLimit.limit(rateLimitKey);
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
      }

      // Set usage headers for all successful responses
      set.headers["X-Is-Premium"] = String(isPremium);
      set.headers["X-Usage-Remaining"] = String(usageRemaining);
      set.headers["X-Usage-Limit"] = String(isPremium ? -1 : DAILY_LIMIT);

      const cacheKey = url
        ? `summary:${language}:${url}`
        : `summary:${language}:${createHash("md5").update(content).digest("hex")}`;

      const cachedSummary = await redis.get(cacheKey);
      if (cachedSummary && typeof cachedSummary === "string") {
        ctx.merge({
          cache_hit: true,
          summary_length: cachedSummary.length,
          status_code: 200,
        });
        ctx.success();
        return new Response(cachedSummary, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Cached": "true",
            "X-Is-Premium": String(isPremium),
            "X-Usage-Remaining": String(usageRemaining),
            "X-Usage-Limit": String(isPremium ? -1 : DAILY_LIMIT),
          },
        });
      }

      const languagePrompt = getLanguagePrompt(language);
      const systemPrompt =
        `You are a helpful assistant that summarizes articles. Provide a clear, concise summary of the main points in 3-5 paragraphs. ${languagePrompt}`.trim();
      const userPrompt = title
        ? `Please summarize this article titled "${title}":\n\n${content.slice(0, 12000)}`
        : `Please summarize this article:\n\n${content.slice(0, 12000)}`;

      // Use OpenRouter SDK with streaming
      const result = await openRouter.chat.send({
        model: MODELS[0],
        // Fallback models - OpenRouter tries next if primary fails
        models: MODELS,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      });

      // Create a readable stream from the async iterator
      let fullText = "";

      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Iterate over streaming chunks
            for await (const chunk of result) {
              const content = chunk.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                controller.enqueue(new TextEncoder().encode(content));
              }
            }

            // Cache the completed summary
            if (fullText.length > 100) {
              ctx.merge({
                cache_hit: false,
                summary_length: fullText.length,
                status_code: 200,
              });
              ctx.success();
              await redis.set(cacheKey, fullText, { ex: 60 * 60 * 24 * 7 });
            }

            controller.close();
          } catch (error) {
            ctx.error(error instanceof Error ? error : String(error), {
              error_type: "STREAM_ERROR",
              status_code: 500,
            });
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          Connection: "keep-alive",
          "X-Is-Premium": String(isPremium),
          "X-Usage-Remaining": String(usageRemaining),
          "X-Usage-Limit": String(isPremium ? -1 : DAILY_LIMIT),
        },
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
      content: t.Optional(t.String({ minLength: 100 })),
      prompt: t.Optional(t.String({ minLength: 100 })),
      title: t.Optional(t.String()),
      url: t.Optional(t.String()),
      language: t.Optional(t.String()),
    }),
  },
);
