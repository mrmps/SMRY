import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Ratelimit } from "@upstash/ratelimit";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Development-only logger
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
};

// Request schema
const SummaryRequestSchema = z.object({
  content: z.string().min(100, "Content must be at least 100 characters"),
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
    
    devLog(`\n🔄 Summary Request:`, { 
      contentLength: body.content?.length, 
      title: body.title,
      language: body.language 
    });

    const validationResult = SummaryRequestSchema.safeParse(body);

    if (!validationResult.success) {
      devLog("❌ Validation error:", validationResult.error);
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );
    }

    const { content, title, url, ip, language } = validationResult.data;
    const clientIp = ip || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "unknown";

    devLog(`📍 Client IP: ${clientIp}`);
    devLog(`🌐 Language: ${language}`);
    devLog(`📝 Content length: ${content.length} chars`);

    // Rate limiting
    if (process.env.NODE_ENV !== "development") {
      const dailyRatelimit = new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(20, "1 d"),
      });

      const minuteRatelimit = new Ratelimit({
        redis: kv,
        limiter: Ratelimit.slidingWindow(6, "1 m"),
      });

      const { success: dailySuccess } = await dailyRatelimit.limit(
        `ratelimit_daily_${clientIp}`
      );
      const { success: minuteSuccess } = await minuteRatelimit.limit(
        `ratelimit_minute_${clientIp}`
      );

      if (!dailySuccess) {
        devLog("⚠️  Daily rate limit exceeded");
        return NextResponse.json(
          {
            error:
              "Your daily limit of 20 summaries has been reached. Please return tomorrow for more summaries.",
          },
          { status: 429 }
        );
      }

      if (!minuteSuccess) {
        devLog("⚠️  Minute rate limit exceeded");
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
    
    const cached = await kv.get(cacheKey);

    if (cached && typeof cached === "string") {
      devLog(`✓ Cache hit`);
      return NextResponse.json({ summary: cached, cached: true });
    }

    // Validate content length
    if (content.length < 2000) {
      devLog("⚠️  Content too short");
      return NextResponse.json(
        { error: "Content is too short to be summarized (minimum 2000 characters)" },
        { status: 400 }
      );
    }

    devLog(`📝 Generating summary for ${title || 'article'}...`);

    // Get language-specific prompts
    const prompts = LANGUAGE_PROMPTS[language] || LANGUAGE_PROMPTS.en;

    // Generate summary with OpenAI
    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
      temperature: 1,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const summary = openaiResponse.choices[0].message.content;

    if (!summary) {
      devLog("❌ No summary generated");
      return NextResponse.json(
        { error: "Failed to generate summary" },
        { status: 500 }
      );
    }

    devLog(`✅ Summary generated (${summary.length} chars)`);

    // Cache the summary
    await kv.set(cacheKey, summary);

    return NextResponse.json({ summary, cached: false });
  } catch (error) {
    devLog("❌ Unexpected error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

