import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { auth } from "@clerk/nextjs/server";

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

const logger = createLogger('api:summary');

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
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    logger.info({ 
      contentLength: body.prompt?.length, 
      title: body.title,
      language: body.language 
    }, 'Summary Request');

    const validationResult = SummaryRequestSchema.safeParse(body);

    if (!validationResult.success) {
      const error = validationResult.error.errors[0]?.message || "Invalid request parameters";
      logger.error({ error: validationResult.error }, 'Validation error');
      return NextResponse.json({ error }, { status: 400 });
    }

    const { prompt: content, title, url, ip, language } = validationResult.data;
    const clientIp = ip || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "unknown";

    logger.debug({ clientIp, language, contentLength: content.length }, 'Request details');

    // Check if user is premium - premium users get unlimited summaries
    const { has } = await auth();
    const isPremium = has?.({ plan: "premium" }) ?? false;

    // Usage tracking - will be added to response headers
    const dailyLimit = process.env.NODE_ENV === "development" ? 100 : 20;
    let currentUsage = 0;

    // Rate limiting - skip for premium users
    if (!isPremium) {
      try {
        const dailyRatelimit = new Ratelimit({
          redis: redis,
          limiter: Ratelimit.slidingWindow(dailyLimit, "1 d"),
        });

        const minuteRatelimit = new Ratelimit({
          redis: redis,
          limiter: Ratelimit.slidingWindow(12, "1 m"),
        });

        const { success: dailySuccess, remaining: dailyRemaining } = await dailyRatelimit.limit(
          `ratelimit_daily_${clientIp}`
        );
        const { success: minuteSuccess, reset: minuteReset } = await minuteRatelimit.limit(
          `ratelimit_minute_${clientIp}`
        );

        // Calculate current usage from remaining (after this request)
        currentUsage = dailyLimit - dailyRemaining;

        if (!dailySuccess) {
          logger.warn({ clientIp }, 'Daily rate limit exceeded');
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
          logger.warn({ clientIp, waitSeconds }, 'Minute rate limit exceeded');
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
      } catch (redisError) {
        // If Redis fails, log the error but allow the request to proceed
        // This ensures that Redis outages don't break the summary feature
        logger.warn({ error: redisError, clientIp }, 'Redis rate limiting failed, allowing request');
      }
    } else {
      logger.debug({ clientIp }, 'Premium user - skipping rate limits');
    }

    // Common headers for usage tracking
    const usageHeaders = {
      "X-Usage-Count": String(currentUsage),
      "X-Usage-Limit": String(dailyLimit),
      "X-Is-Premium": String(isPremium),
    };

    // Check cache (use content hash or URL for cache key)
    const cacheKey = url
      ? `summary:${language}:${url}`
      : `summary:${language}:${Buffer.from(content.substring(0, 500)).toString('base64').substring(0, 50)}`;

    logger.debug({ cacheKey, language, url }, 'Cache lookup');

    // Try to get cached summary, but don't fail if Redis is down
    try {
      const cached = await redis.get<string>(cacheKey);

      if (cached && typeof cached === "string") {
        logger.info({ cacheKey, language, cachedLength: cached.length }, 'Cache hit');
        return new Response(cached, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Cache-Hit": "true",
            ...usageHeaders,
          },
        });
      }
    } catch (redisError) {
      logger.warn({ error: redisError }, 'Redis cache retrieval failed, will generate fresh summary');
    }

    logger.info({ title: title || 'article', language }, 'Generating summary');

    // Build prompts with system message for better language instruction following
    const { system, user: userPrompt } = buildSummaryPrompts(content.substring(0, 6000), language);

    const result = streamText({
      model: openrouter("openai/gpt-oss-20b:free"),
      system,
      messages: [{ role: "user", content: userPrompt }],
      onFinish: async ({ text, usage }) => {
        // Cache the complete summary after streaming finishes
        logger.info({ 
          length: text.length,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens
        }, 'Summary generated with OpenRouter');
        
        // Try to cache with 1 week TTL, but don't fail if Redis is down
        try {
          await redis.set(cacheKey, text, { ex: 60 * 60 * 24 * 7 }); // 1 week
          logger.debug('Summary cached successfully');
        } catch (redisError) {
          // Log the error but don't break the streaming response
          logger.warn({ error: redisError }, 'Failed to cache summary in Redis');
        }
      },
    });

    return result.toTextStreamResponse({
      headers: usageHeaders,
    });
  } catch (error) {
    logger.error({ error }, 'Unexpected error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
