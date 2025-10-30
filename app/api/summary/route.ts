import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import OpenAI from "openai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const logger = createLogger('api:summary');

// Request schema
const SummaryRequestSchema = z.object({
  content: z.string().min(2000, "Content must be at least 2000 characters"),
  title: z.string().optional(),
  url: z.string().optional(),
  ip: z.string().optional(),
  language: z.string().optional().default("en"),
});

// Language prompts
const LANGUAGE_PROMPTS: Record<string, { system: string; user: string }> = {
  en: {
    system: "You are an intelligent summary assistant.",
    user: "Create a useful summary of the following article:\n\n{text}\n\nOnly return the short summary and nothing else, no quotes, just a useful summary in the form of a paragraph.",
  },
  es: {
    system: "Eres un asistente inteligente de resúmenes.",
    user: "Crea un resumen útil del siguiente artículo:\n\n{text}\n\nDevuelve solo el resumen corto y nada más, sin comillas, solo un resumen útil en forma de párrafo.",
  },
  fr: {
    system: "Vous êtes un assistant de résumé intelligent.",
    user: "Créez un résumé utile de l'article suivant :\n\n{text}\n\nRetournez uniquement le résumé court et rien d'autre, sans guillemets, juste un résumé utile sous forme de paragraphe.",
  },
  de: {
    system: "Sie sind ein intelligenter Zusammenfassungsassistent.",
    user: "Erstellen Sie eine nützliche Zusammenfassung des folgenden Artikels:\n\n{text}\n\nGeben Sie nur die kurze Zusammenfassung zurück und sonst nichts, keine Anführungszeichen, nur eine nützliche Zusammenfassung in Form eines Absatzes.",
  },
  zh: {
    system: "你是一个智能摘要助手。",
    user: "创建以下文章的有用摘要：\n\n{text}\n\n只返回简短摘要，不要其他内容，没有引号，只是一个有用的段落形式的摘要。",
  },
  ja: {
    system: "あなたは知的な要約アシスタントです。",
    user: "次の記事の有用な要約を作成してください：\n\n{text}\n\n短い要約だけを返し、他のものは返さないでください。引用符なしで、段落形式の有用な要約だけです。",
  },
  pt: {
    system: "Você é um assistente inteligente de resumos.",
    user: "Crie um resumo útil do seguinte artigo:\n\n{text}\n\nRetorne apenas o resumo curto e nada mais, sem aspas, apenas um resumo útil em forma de parágrafo.",
  },
  ru: {
    system: "Вы - интеллектуальный помощник по созданию резюме.",
    user: "Создайте полезное резюме следующей статьи:\n\n{text}\n\nВерните только короткое резюме и ничего более, без кавычек, просто полезное резюме в форме абзаца.",
  },
};

/**
 * POST /api/summary
 * Generate AI summary of article content
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    logger.info({ 
      contentLength: body.content?.length, 
      title: body.title,
      language: body.language 
    }, 'Summary Request');

    const validationResult = SummaryRequestSchema.safeParse(body);

    if (!validationResult.success) {
      logger.error({ error: validationResult.error }, 'Validation error');
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    const { content, title, url, ip, language } = validationResult.data;
    const clientIp = ip || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "unknown";

    logger.debug({ clientIp, language, contentLength: content.length }, 'Request details');

    // Rate limiting
    if (process.env.NODE_ENV !== "development") {
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
          {
            error:
              "Your daily limit of 20 summaries has been reached. Please return tomorrow for more summaries.",
          },
          { status: 429 }
        );
      }

      if (!minuteSuccess) {
        logger.warn({ clientIp }, 'Minute rate limit exceeded');
        return NextResponse.json(
          {
            error:
              "Your limit of 6 summaries per minute has been reached. Please slow down.",
          },
          { status: 429 }
        );
      }
    }

    // Check cache (use content hash or URL for cache key)
    const cacheKey = url 
      ? `summary:${language}:${url}`
      : `summary:${language}:${Buffer.from(content.substring(0, 500)).toString('base64').substring(0, 50)}`;
    
    const cached = await redis.get<string>(cacheKey);

    if (cached && typeof cached === "string") {
      logger.debug('Cache hit');
      return NextResponse.json({ summary: cached, cached: true });
    }

    // Content length is already validated by schema (minimum 2000 characters)

    logger.info({ title: title || 'article' }, 'Generating summary');

    // Get language-specific prompts
    const prompts = LANGUAGE_PROMPTS[language] || LANGUAGE_PROMPTS.en;

    // Generate summary with OpenAI
    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: prompts.system,
        },
        {
          role: "user",
          content: prompts.user.replace("{text}", content.substring(0, 6000)),
        },
      ],
    });

    const summary = openaiResponse.choices[0].message.content;

    if (!summary) {
      logger.error('No summary generated');
      return NextResponse.json(
        { error: "Failed to generate summary" },
        { status: 500 }
      );
    }

    logger.info({ length: summary.length }, 'Summary generated');

    // Cache the summary
    await redis.set(cacheKey, summary);

    return NextResponse.json({ summary, cached: false });
  } catch (error) {
    logger.error({ error }, 'Unexpected error');
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

