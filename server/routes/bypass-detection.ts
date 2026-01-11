/**
 * Bypass Detection Route - POST /api/bypass-detection
 *
 * Uses AI to detect whether a paywall was successfully bypassed.
 * Premium-only feature.
 */

import { Elysia, t } from "elysia";
import { OpenRouter } from "@openrouter/sdk";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../../lib/redis";
import { compressAsync, decompressAsync } from "../../lib/redis-compression";
import {
  createRequestContext,
  extractClientIp,
} from "../../lib/request-context";
import { getAuthInfo } from "../middleware/auth";
import { createBypassDetectionError } from "../../lib/errors/bypass-detection";
import { env } from "../env";

// Rate limits for premium users (generous but prevents abuse)
const DAILY_LIMIT = 200;
const MINUTE_LIMIT = 30;

const dailyRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(DAILY_LIMIT, "24h"),
  analytics: true,
  prefix: "ratelimit:bypass:daily",
});

const minuteRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(MINUTE_LIMIT, "1m"),
  analytics: true,
  prefix: "ratelimit:bypass:minute",
});

// Initialize OpenRouter SDK
const openRouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

// Free models first, paid fallback
const FREE_MODELS = [
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "arcee-ai/trinity-mini:free",
  "qwen/qwen3-4b:free",
];
const PAID_FALLBACK = "openai/gpt-5-nano";

// Helper to extract string content from OpenRouter response
function extractContent(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    // Find the first text content item
    for (const item of content) {
      if (item && typeof item === "object" && "type" in item && item.type === "text" && "text" in item) {
        return String(item.text);
      }
    }
  }
  return null;
}

// Clean HTML by removing non-content junk (scripts, styles, etc.)
function cleanHtml(html: string): { cleaned: string; beforeSize: number; afterSize: number } {
  const beforeSize = html.length;

  const cleaned = html
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove style tags and content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    // Remove noscript tags
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    // Remove SVG elements (often huge)
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, "")
    // Collapse multiple whitespace
    .replace(/\s+/g, " ")
    .trim();

  const afterSize = cleaned.length;
  return { cleaned, beforeSize, afterSize };
}

// Max size for cleaned HTML before falling back to text (50KB)
const MAX_HTML_SIZE = 50_000;

const SYSTEM_PROMPT_HTML = `Analyze this HTML to determine if we extracted the complete article.

BYPASSED (complete):
- Article has clear beginning, middle, and natural ending
- No paywall divs, subscribe buttons, or "continue reading" prompts
- Content is substantial (not just a headline and teaser)
- No login walls or subscription CTAs in the DOM

BLOCKED (truncated/paywalled):
- Content cuts off mid-sentence or mid-paragraph
- Contains paywall elements: "subscribe", "sign in", "premium", "members only"
- Only shows preview content (headline + 1-2 paragraphs)
- Has truncation markers or "read more" that leads nowhere

UNCERTAIN:
- Too short to judge (<200 words)
- Not an article (homepage, error page, list page)
- Legitimately brief content

Reply with ONLY one word: bypassed OR blocked OR uncertain`;

const SYSTEM_PROMPT_TEXT = `Analyze this text to determine if we extracted the complete article.

BYPASSED (complete):
- Article has clear beginning, middle, and natural ending
- Concludes with a proper ending (not mid-thought)
- No "subscribe to continue" or paywall messages in text
- Substantial content, not just a preview snippet

BLOCKED (truncated/paywalled):
- Content cuts off mid-sentence or abruptly
- Contains paywall text: "subscribe", "sign in to continue", "premium content"
- Very short with signs of truncation
- Ends with "..." or "Read more" without actual content

UNCERTAIN:
- Too short to judge (<200 words)
- Not an article (homepage, navigation, error)
- Could be legitimately brief

Reply with ONLY one word: bypassed OR blocked OR uncertain`;

interface ContentAnalysis {
  mode: "html" | "text";
  content: string;
  wordCount: number;
  htmlCleaningStats?: { beforeSize: number; afterSize: number };
}

function analyzeContent(
  textContent: string,
  htmlContent: string | undefined
): ContentAnalysis {
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

  // Try HTML first if available
  if (htmlContent && htmlContent.length > 0) {
    const { cleaned, beforeSize, afterSize } = cleanHtml(htmlContent);

    // Use HTML if it cleaned down to reasonable size
    if (cleaned.length <= MAX_HTML_SIZE && cleaned.length > 100) {
      return {
        mode: "html",
        content: cleaned,
        wordCount,
        htmlCleaningStats: { beforeSize, afterSize },
      };
    }
  }

  // Fall back to text content
  return {
    mode: "text",
    content: textContent,
    wordCount,
  };
}

function buildUserPrompt(analysis: ContentAnalysis, url: string): string {
  const { mode, content, wordCount } = analysis;

  return `URL: ${url}
Word count: ~${wordCount}

${mode === "html" ? "CLEANED HTML" : "ARTICLE TEXT"}:
${content}`;
}

export interface BypassDetectionResponse {
  status: "bypassed" | "uncertain" | "blocked";
  cached: boolean;
}

export const bypassDetectionRoutes = new Elysia({ prefix: "/api" }).post(
  "/bypass-detection",
  async ({ body, request, set }) => {
    const ctx = createRequestContext({
      method: "POST",
      path: "/api/bypass-detection",
      url: request.url,
      ip: extractClientIp(request),
    });
    ctx.set("endpoint", "/api/bypass-detection");

    try {
      const { url, source, textContent, articleLength, htmlContent } = body;

      // Check premium status - this is a premium-only feature
      const { isPremium, userId } = await getAuthInfo(request);
      ctx.set("is_premium", isPremium);

      if (!isPremium) {
        ctx.error("Premium required", {
          error_type: "AUTH_ERROR",
          status_code: 403,
        });
        set.status = 403;
        return createBypassDetectionError("NOT_PREMIUM");
      }

      // Rate limiting for premium users
      const clientIp = extractClientIp(request);
      const rateLimitKey = userId || clientIp;

      const dailyResult = await dailyRateLimit.limit(rateLimitKey);
      if (!dailyResult.success) {
        ctx.error("Daily rate limit exceeded", {
          error_type: "RATE_LIMIT",
          status_code: 429,
        });
        set.status = 429;
        return createBypassDetectionError("RATE_LIMITED");
      }

      const minuteResult = await minuteRateLimit.limit(rateLimitKey);
      if (!minuteResult.success) {
        ctx.error("Minute rate limit exceeded", {
          error_type: "RATE_LIMIT",
          status_code: 429,
        });
        set.status = 429;
        return createBypassDetectionError("RATE_LIMITED");
      }

      // Validate content length
      if (!textContent || textContent.length < 100) {
        ctx.error("Content too short", {
          error_type: "VALIDATION_ERROR",
          status_code: 422,
        });
        set.status = 422;
        return createBypassDetectionError("CONTENT_TOO_SHORT");
      }

      // Analyze content - choose HTML or text mode
      const analysis = analyzeContent(textContent, htmlContent);
      const systemPrompt = analysis.mode === "html" ? SYSTEM_PROMPT_HTML : SYSTEM_PROMPT_TEXT;

      // Log analysis details
      ctx.merge({
        content_length: textContent.length,
        source,
        analysis_mode: analysis.mode,
        word_count: analysis.wordCount,
        ...(analysis.htmlCleaningStats && {
          html_before_size: analysis.htmlCleaningStats.beforeSize,
          html_after_size: analysis.htmlCleaningStats.afterSize,
          html_reduction_pct: Math.round(
            (1 - analysis.htmlCleaningStats.afterSize / analysis.htmlCleaningStats.beforeSize) * 100
          ),
        }),
      });

      // Check cache first
      const cacheKey = `bypass:${source}:${url}`;
      const cached = await redis.get(cacheKey);
      if (cached && typeof cached === "string") {
        try {
          const parsed = JSON.parse(cached) as BypassDetectionResponse;
          ctx.merge({ cache_hit: true, status_code: 200 });
          ctx.success();
          return { ...parsed, cached: true };
        } catch {
          // Invalid cache, continue to detection
        }
      }

      // Build the prompt
      const userPrompt = buildUserPrompt(analysis, url);

      // Try free models first
      let aiResponse: string | null = null;

      try {
        const result = await openRouter.chat.send({
          model: FREE_MODELS[0],
          models: FREE_MODELS,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          stream: false,
        });

        aiResponse = extractContent(result.choices?.[0]?.message?.content);
      } catch (freeError) {
        ctx.merge({ free_models_failed: true });

        // Try paid fallback
        try {
          const fallbackResult = await openRouter.chat.send({
            model: PAID_FALLBACK,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            stream: false,
          });

          aiResponse = extractContent(fallbackResult.choices?.[0]?.message?.content);
          ctx.merge({ used_paid_fallback: true });
        } catch (paidError) {
          ctx.error(
            paidError instanceof Error ? paidError : String(paidError),
            {
              error_type: "AI_ERROR",
              status_code: 500,
            }
          );
          set.status = 500;
          return createBypassDetectionError("DETECTION_FAILED");
        }
      }

      if (!aiResponse) {
        ctx.error("No AI response", {
          error_type: "AI_ERROR",
          status_code: 500,
        });
        set.status = 500;
        return createBypassDetectionError("DETECTION_FAILED");
      }

      // Parse the AI response - expecting just a single word
      const validStatuses = ["bypassed", "uncertain", "blocked"] as const;
      const normalizedResponse = aiResponse.toLowerCase().trim();

      let status: (typeof validStatuses)[number] = "uncertain";
      for (const validStatus of validStatuses) {
        if (normalizedResponse.includes(validStatus)) {
          status = validStatus;
          break;
        }
      }

      const response: BypassDetectionResponse = {
        status,
        cached: false,
      };

      // Save bypass status to the article cache (so it's instant on reload)
      const articleCacheKey = `article:${source}:${url}`;
      try {
        const rawArticle = await redis.get(articleCacheKey);
        if (rawArticle) {
          const article = await decompressAsync(rawArticle);
          if (article && typeof article === "object") {
            const updatedArticle = { ...article, bypassStatus: status };
            const compressed = await compressAsync(updatedArticle);
            await redis.set(articleCacheKey, compressed);
            ctx.merge({ article_cache_updated: true });
          }
        }
      } catch (cacheError) {
        // Non-fatal: log but don't fail the request
        ctx.merge({ article_cache_update_failed: true });
      }

      ctx.merge({ status_code: 200, detection_status: status });
      ctx.success();

      return response;
    } catch (error) {
      ctx.error(error instanceof Error ? error : String(error), {
        error_type: "UNKNOWN_ERROR",
        status_code: 500,
      });
      set.status = 500;
      return createBypassDetectionError("DETECTION_FAILED");
    }
  },
  {
    body: t.Object({
      url: t.String(),
      source: t.String(),
      textContent: t.String({ minLength: 100 }),
      articleLength: t.Number(),
      htmlContent: t.Optional(t.String()),
    }),
  }
);
