import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from "ai";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { auth } from "@clerk/nextjs/server";
import { createRequestContext, extractRequestInfo, extractClientIp } from "@/lib/request-context";

// Rate limiters as module-level singletons to prevent memory leaks
// Creating new Ratelimit instances per request causes memory accumulation
const dailyLimit = process.env.NODE_ENV === "development" ? 100 : 20;

const dailyRatelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(dailyLimit, "1 d"),
  prefix: "ratelimit_daily",
});

const minuteRatelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(12, "1 m"),
  prefix: "ratelimit_minute",
});

// Configure OpenRouter provider]
// OpenRouter provides unified access to 300+ AI models with automatic provider fallback
// Documentation: https://openrouter.ai/docs
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  headers: {
    // Optional headers for app attribution and rankings
    // See: https://openrouter.ai/docs/features/app-attribution
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://13ft.com',
    'X-Title': '13ft - Paywall Bypass & AI Summaries',
  },
});

// Request schema for useCompletion
const SummaryRequestSchema = z.object({
  prompt: z.string().min(2000, "Content must be at least 2000 characters"),
  title: z.string().optional(),
  url: z.string().optional(),
  ip: z.string().optional(),
  language: z.string().optional().default("en"),
});

// Language names for prompting
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  zh: "Chinese",
  ja: "Japanese",
  pt: "Portuguese",
  ru: "Russian",
  hi: "Hindi",
  it: "Italian",
  ko: "Korean",
  ar: "Arabic",
  nl: "Dutch",
  tr: "Turkish",
};

// Build system and user prompts with explicit language requirements
function buildSummaryPrompts(articleText: string, language: string): { system: string; user: string } {
  const langName = LANGUAGE_NAMES[language] || "English";

  // For non-English languages, be extra explicit
  const isNonEnglish = language !== "en";

  const system = isNonEnglish
    ? `You are a summarization assistant. You MUST write your ENTIRE response in ${langName}. Do NOT use English or any other language. Every single word must be in ${langName}.`
    : `You are a summarization assistant that writes clear, concise summaries.`;

  const user = `${isNonEnglish ? `[LANGUAGE REQUIREMENT: Write in ${langName} ONLY]\n\n` : ""}Summarize this article:

---
${articleText}
---

Format:
1. Core Thesis (1 paragraph)
2. Key Points (3-5 bullets)
3. Conclusion (1 sentence)

${isNonEnglish ? `REMINDER: Your entire response must be in ${langName}. Not English.` : ""}`;

  return { system, user };
}

/**
 * POST /api/summary
 * Generate AI summary of article content
 *
 * Uses wide event pattern - one canonical log line per request with all context.
 */
export async function POST(request: NextRequest) {
  const ctx = createRequestContext({
    ...extractRequestInfo(request),
    ip: extractClientIp(request),
  });
  ctx.set("endpoint", "/api/summary");

  try {
    const body = await request.json();

    ctx.merge({
      content_length: body.prompt?.length,
      title: body.title,
      language: body.language,
    });

    const validationResult = SummaryRequestSchema.safeParse(body);

    if (!validationResult.success) {
      const error = validationResult.error.errors[0]?.message || "Invalid request parameters";
      ctx.error(error, { error_type: "VALIDATION_ERROR", status_code: 400 });
      return NextResponse.json({ error }, { status: 400 });
    }

    const { prompt: content, title, url, ip, language } = validationResult.data;
    const clientIp = ip || extractClientIp(request);

    ctx.merge({ client_ip: clientIp, url });

    // Check if user is premium
    const { has } = await auth();
    const isPremium = has?.({ plan: "premium" }) ?? false;
    ctx.set("is_premium", isPremium);

    // Usage tracking
    let currentUsage = 0;

    // Rate limiting - skip for premium users
    if (!isPremium) {
      try {
        // Use module-level singleton rate limiters (not per-request instances)
        const { success: dailySuccess, remaining: dailyRemaining } = await dailyRatelimit.limit(
          clientIp
        );
        const { success: minuteSuccess, reset: minuteReset } = await minuteRatelimit.limit(
          clientIp
        );

        currentUsage = dailyLimit - dailyRemaining;
        ctx.merge({ usage_count: currentUsage, usage_limit: dailyLimit });

        if (!dailySuccess) {
          ctx.error("Daily rate limit exceeded", {
            error_type: "RATE_LIMIT",
            status_code: 429,
            rate_limit_type: "daily",
          });
          return NextResponse.json(
            { error: `Daily limit reached`, usage: currentUsage, limit: dailyLimit },
            {
              status: 429,
              headers: {
                "X-Usage-Count": String(currentUsage),
                "X-Usage-Limit": String(dailyLimit),
                "X-Is-Premium": "false",
              }
            }
          );
        }

        if (!minuteSuccess) {
          const waitSeconds = Math.ceil((minuteReset - Date.now()) / 1000);
          ctx.error("Minute rate limit exceeded", {
            error_type: "RATE_LIMIT",
            status_code: 429,
            rate_limit_type: "minute",
            retry_after_seconds: waitSeconds,
          });
          return NextResponse.json(
            { error: `Too many requests. Wait ${waitSeconds}s or upgrade for unlimited.`, usage: currentUsage, limit: dailyLimit, retryAfter: waitSeconds },
            {
              status: 429,
              headers: {
                "X-Usage-Count": String(currentUsage),
                "X-Usage-Limit": String(dailyLimit),
                "X-Is-Premium": "false",
                "Retry-After": String(waitSeconds),
              }
            }
          );
        }
      } catch {
        // Redis failure - allow request to proceed
        ctx.set("rate_limit_redis_error", true);
      }
    }

    const usageHeaders = {
      "X-Usage-Count": String(currentUsage),
      "X-Usage-Limit": String(dailyLimit),
      "X-Is-Premium": String(isPremium),
    };

    // Check cache
    const cacheKey = url
      ? `summary:${language}:${url}`
      : `summary:${language}:${Buffer.from(content.substring(0, 500)).toString('base64').substring(0, 50)}`;

    try {
      const cacheStart = Date.now();
      const cached = await redis.get<string>(cacheKey);
      ctx.set("cache_lookup_ms", Date.now() - cacheStart);

      if (cached && typeof cached === "string") {
        ctx.merge({
          cache_hit: true,
          summary_length: cached.length,
          status_code: 200,
        });
        ctx.success();
        return new Response(cached, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Cache-Hit": "true",
            ...usageHeaders,
          },
        });
      }
    } catch {
      ctx.set("cache_lookup_error", true);
    }

    ctx.set("cache_hit", false);

    // Build prompts and stream
    const { system, user: userPrompt } = buildSummaryPrompts(content.substring(0, 6000), language);

    const result = streamText({
      model: openrouter("openai/gpt-oss-20b:free"),
      system,
      messages: [{ role: "user", content: userPrompt }],
      onFinish: async ({ text, usage }) => {
        ctx.merge({
          summary_length: text.length,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          total_tokens: usage.totalTokens,
          status_code: 200,
        });
        ctx.success();

        // Cache result
        try {
          await redis.set(cacheKey, text, { ex: 60 * 60 * 24 * 7 });
        } catch {
          // Ignore cache errors
        }
      },
    });

    return result.toTextStreamResponse({
      headers: usageHeaders,
    });
  } catch (error) {
    ctx.error(error instanceof Error ? error : String(error), {
      error_type: "UNKNOWN_ERROR",
      status_code: 500,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
