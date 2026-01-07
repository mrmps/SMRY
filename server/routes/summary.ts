/**
 * Summary Route - POST /api/summary
 */

import { Elysia, t } from "elysia";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../../lib/redis";
import { createRequestContext, extractClientIp } from "../../lib/request-context";
import { getAuthInfo } from "../middleware/auth";
import { createHash } from "crypto";

const dailyRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(process.env.NODE_ENV === "development" ? 100 : 20, "24h"),
  analytics: true,
  prefix: "ratelimit:summary:daily",
});

const minuteRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(12, "1m"),
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

const LANGUAGE_PROMPTS: Record<string, string> = {
  en: "",
  es: "Responde siempre en español.",
  fr: "Réponds toujours en français.",
  de: "Antworte immer auf Deutsch.",
  zh: "请用中文回答。",
  ja: "日本語で回答してください。",
};

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
      const { content, title, url, language = "en" } = body;
      ctx.merge({ content_length: content.length, language });

      const { isPremium, userId } = await getAuthInfo(request);
      ctx.set("is_premium", isPremium);

      const clientIp = extractClientIp(request);
      const rateLimitKey = userId || clientIp;

      if (!isPremium) {
        const dailyResult = await dailyRateLimit.limit(rateLimitKey);
        if (!dailyResult.success) {
          ctx.error("Daily rate limit exceeded", { error_type: "RATE_LIMIT", status_code: 429 });
          set.status = 429;
          set.headers["Retry-After"] = String(Math.ceil((dailyResult.reset - Date.now()) / 1000));
          return { error: "Daily summary limit reached." };
        }

        const minuteResult = await minuteRateLimit.limit(rateLimitKey);
        if (!minuteResult.success) {
          ctx.error("Minute rate limit exceeded", { error_type: "RATE_LIMIT", status_code: 429 });
          set.status = 429;
          return { error: "Too many requests. Please wait." };
        }
      }

      set.headers["X-Is-Premium"] = String(isPremium);

      const cacheKey = url
        ? `summary:${language}:${url}`
        : `summary:${language}:${createHash("md5").update(content).digest("hex")}`;

      const cachedSummary = await redis.get(cacheKey);
      if (cachedSummary && typeof cachedSummary === "string") {
        ctx.merge({ cache_hit: true, summary_length: cachedSummary.length, status_code: 200 });
        ctx.success();
        return new Response(cachedSummary, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "X-Cached": "true" },
        });
      }

      const languagePrompt = LANGUAGE_PROMPTS[language] || "";
      const systemPrompt = `You are a helpful assistant that summarizes articles. Provide a clear, concise summary of the main points in 3-5 paragraphs. ${languagePrompt}`.trim();
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
      ctx.error(error instanceof Error ? error : String(error), { error_type: "UNKNOWN_ERROR", status_code: 500 });
      set.status = 500;
      return { error: "Failed to generate summary" };
    }
  },
  {
    body: t.Object({
      content: t.String({ minLength: 100 }),
      title: t.Optional(t.String()),
      url: t.Optional(t.String()),
      language: t.Optional(t.String()),
    }),
  }
);
