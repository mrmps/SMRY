/**
 * Summary Route - POST /api/summary
 */

import { Elysia, t } from "elysia";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
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

const dailyRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(
    process.env.NODE_ENV === "development" ? 100 : 20,
    "24h",
  ),
  analytics: true,
  prefix: "ratelimit:summary:daily",
});

const minuteRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(
    process.env.NODE_ENV === "development" ? 60 : 12,
    "1m",
  ),
  analytics: true,
  prefix: "ratelimit:summary:minute",
});

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

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
      // AI SDK useCompletion sends content as "prompt", support both
      const content = body.prompt || body.content;
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

      const dailyLimit = process.env.NODE_ENV === "development" ? 100 : 20;

      // Track usage for headers - premium users get -1 (unlimited)
      let usageRemaining = isPremium ? -1 : dailyLimit;

      if (!isPremium) {
        const dailyResult = await dailyRateLimit.limit(rateLimitKey);
        // remaining is how many are left AFTER this request (0 if denied)
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
          set.headers["X-Usage-Limit"] = String(dailyLimit);
          set.headers["X-Is-Premium"] = "false";
          return formatSummaryErrorResponse(
            createSummaryError("DAILY_LIMIT_REACHED", {
              retryAfter,
              usage: dailyLimit - dailyResult.remaining,
              limit: dailyLimit,
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
          set.headers["X-Usage-Limit"] = String(dailyLimit);
          set.headers["X-Is-Premium"] = "false";
          return formatSummaryErrorResponse(
            createSummaryError("RATE_LIMITED", { retryAfter }),
          );
        }
      }

      // Set usage headers for all successful responses
      set.headers["X-Is-Premium"] = String(isPremium);
      set.headers["X-Usage-Remaining"] = String(usageRemaining);
      set.headers["X-Usage-Limit"] = String(isPremium ? -1 : dailyLimit);

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
            "X-Usage-Limit": String(isPremium ? -1 : dailyLimit),
          },
        });
      }

      const languagePrompt = getLanguagePrompt(language);
      const systemPrompt =
        `You are a helpful assistant that summarizes articles. Provide a clear, concise summary of the main points in 3-5 paragraphs. ${languagePrompt}`.trim();
      const userPrompt = title
        ? `Please summarize this article titled "${title}":\n\n${content.slice(0, 12000)}`
        : `Please summarize this article:\n\n${content.slice(0, 12000)}`;

      const result = await streamText({
        model: openrouter(MODELS[0]),
        system: systemPrompt,
        prompt: userPrompt,
        onFinish: async ({ text, usage }) => {
          ctx.merge({
            cache_hit: false,
            summary_length: text.length,
            input_tokens: usage?.inputTokens || 0,
            output_tokens: usage?.outputTokens || 0,
            status_code: 200,
          });
          ctx.success();

          if (text.length > 100) {
            await redis.set(cacheKey, text, { ex: 60 * 60 * 24 * 7 });
          }
        },
      });

      set.headers["Content-Type"] = "text/plain; charset=utf-8";
      return result.toTextStreamResponse();
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
      // AI SDK useCompletion sends content as "prompt"
      prompt: t.Optional(t.String({ minLength: 100 })),
      content: t.Optional(t.String({ minLength: 100 })),
      title: t.Optional(t.String()),
      url: t.Optional(t.String()),
      language: t.Optional(t.String()),
    }),
  },
);
