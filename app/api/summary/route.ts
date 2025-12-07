import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { auth } from "@clerk/nextjs/server";

// Configure OpenRouter provider
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

// Base summary prompt template
const BASE_SUMMARY_PROMPT = `You are an expert researcher and editor, skilled at distilling complex texts into clear, concise, and accurate summaries.

I will provide you with an article. Your task is to generate a summary that captures the essence of the text while adhering to the following instructions.

Instructions for the summary:

Core Thesis: Begin by identifying and stating the article's central argument or main topic in a single, clear sentence.

Key Points: Extract the primary supporting arguments, findings, or main points of the article. Present these as a bulleted list, with each point being a complete and self-contained sentence.

Conclusion: Summarize the article's conclusion, implications, or call to action in a final sentence.

What to Exclude:

Do not include minor details, tangential information, or lengthy, specific examples.

Paraphrase all information; do not use direct quotes.

Exclude your own opinions, interpretations, or any information not explicitly present in the provided article.

Format and Structure:

Start with a brief introductory paragraph that states the core thesis.

Follow with a bulleted list of the key supporting points.

End with a concluding sentence that captures the article's final message.

Length: The entire summary should be approximately 2-3 paragraphs.

Tone and Audience:

Maintain a neutral, objective, and informative tone throughout.

The summary should be written for an audience that has not read the article and needs to quickly grasp its essential information.

Here is the article to summarize:

{text}`;

// Language-specific instructions
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "Summarize in English.",
  es: "Summarize in Spanish.",
  fr: "Summarize in French.",
  de: "Summarize in German.",
  zh: "Summarize in Chinese.",
  ja: "Summarize in Japanese.",
  pt: "Summarize in Portuguese.",
  ru: "Summarize in Russian.",
  hi: "Summarize in Hindi.",
  it: "Summarize in Italian.",
  ko: "Summarize in Korean.",
  ar: "Summarize in Arabic.",
  nl: "Summarize in Dutch.",
  tr: "Summarize in Turkish.",
};

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

    // Rate limiting - skip for premium users
    if (!isPremium) {
      try {
        const dailyRatelimit = new Ratelimit({
          redis: redis,
          limiter: Ratelimit.slidingWindow(20, "1 d"),
        });

        const minuteRatelimit = new Ratelimit({
          redis: redis,
          limiter: Ratelimit.slidingWindow(6, "1 m"),
        });

        const { success: dailySuccess } = await dailyRatelimit.limit(
          `ratelimit_daily_${clientIp}`
        );
        const { success: minuteSuccess } = await minuteRatelimit.limit(
          `ratelimit_minute_${clientIp}`
        );

        if (!dailySuccess) {
          logger.warn({ clientIp }, 'Daily rate limit exceeded');
          return NextResponse.json(
            { error: "Your daily limit of 20 summaries has been reached. Please return tomorrow." },
            { status: 429 }
          );
        }

        if (!minuteSuccess) {
          logger.warn({ clientIp }, 'Minute rate limit exceeded');
          return NextResponse.json(
            { error: "Your limit of 6 summaries per minute has been reached. Please slow down." },
            { status: 429 }
          );
        }
      } catch (redisError) {
        // If Redis fails, log the error but allow the request to proceed
        // This ensures that Redis outages don't break the summary feature
        logger.warn({ error: redisError, clientIp }, 'Redis rate limiting failed, allowing request');
      }
    } else if (isPremium) {
      logger.debug({ clientIp }, 'Premium user - skipping rate limits');
    }

    // Check cache (use content hash or URL for cache key)
    const cacheKey = url 
      ? `summary:${language}:${url}`
      : `summary:${language}:${Buffer.from(content.substring(0, 500)).toString('base64').substring(0, 50)}`;
    
    // Try to get cached summary, but don't fail if Redis is down
    let cached: string | null = null;
    try {
      cached = await redis.get<string>(cacheKey);
      
      if (cached && typeof cached === "string") {
        logger.debug('Cache hit');
        // Return cached response as plain text for useCompletion
        return new Response(cached, {
          headers: { 
            "Content-Type": "text/plain; charset=utf-8",
            "X-Cache-Hit": "true"
          },
        });
      }
    } catch (redisError) {
      // If Redis cache retrieval fails, log it but proceed to generate the summary
      logger.warn({ error: redisError }, 'Redis cache retrieval failed, will generate fresh summary');
    }

    // Content length is already validated by schema (minimum 2000 characters)

    logger.info({ title: title || 'article' }, 'Generating summary');

    // Get language-specific instruction
    const languageInstruction = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;
    
    // Combine base prompt with language instruction
    const userPrompt = `${BASE_SUMMARY_PROMPT}\n\n${languageInstruction}`;

    // Using OpenRouter's free tier model with automatic provider fallback
    // Primary model: openai/gpt-oss-20b:free (20B parameters)
    // - Free tier with rate limits (100-200 requests/day depending on account credits)
    // - OpenRouter automatically handles provider failover for high uptime
    // 
    // To add model-level fallback, you can:
    // 1. Use OpenRouter's native 'models' array parameter (requires custom fetch)
    // 2. Implement try-catch with fallback models (see OPENROUTER_MIGRATION.md)
    // 3. Use different models for different use cases
    //
    // Alternative free models: 
    // - meta-llama/llama-3.2-3b-instruct:free (faster, smaller)
    // - google/gemma-2-9b-it:free (better instruction following)
    // - qwen/qwen-2.5-7b-instruct:free (strong reasoning)
    // Browse all: https://openrouter.ai/models?max_price=0
    const result = streamText({
      model: openrouter("openai/gpt-oss-20b:free"),
      messages: [
        {
          role: "user",
          content: userPrompt.replace("{text}", content.substring(0, 6000)),
        },
      ],
      onFinish: async ({ text, usage }) => {
        // Cache the complete summary after streaming finishes
        logger.info({ 
          length: text.length,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens
        }, 'Summary generated with OpenRouter');
        
        // Try to cache, but don't fail if Redis is down
        try {
          await redis.set(cacheKey, text);
          logger.debug('Summary cached successfully');
        } catch (redisError) {
          // Log the error but don't break the streaming response
          logger.warn({ error: redisError }, 'Failed to cache summary in Redis');
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    logger.error({ error }, 'Unexpected error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
