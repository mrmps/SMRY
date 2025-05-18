import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Ratelimit } from "@upstash/ratelimit";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { url, ip } = await request.json();

    if (!url) {
      return NextResponse.json({ message: "URL parameter is missing or invalid" }, { status: 400 });
    }

    const dailyRatelimit = new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(20, "1 d"),
    });

    const minuteRatelimit = new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(6, "1 m"),
    });

    const { success: dailySuccess } = await dailyRatelimit.limit(`ratelimit_daily_${ip}`);
    const { success: minuteSuccess } = await minuteRatelimit.limit(`ratelimit_minute_${ip}`);

    if (process.env.NODE_ENV !== "development") {
      if (!dailySuccess) {
        return NextResponse.json(
          { message: "Your daily limit of 20 summaries has been reached. Please return tomorrow for more summaries." },
          { status: 429 }
        );
      }
      if (!minuteSuccess) {
        return NextResponse.json(
          { message: "Your limit of 6 summaries per minute has been reached. Please slow down." },
          { status: 429 }
        );
      }
    }

    // Check cache first
    const cached = (await kv.get(url)) as string | undefined;
    if (cached) {
      return NextResponse.json({ summary: cached });
    }

    const response = await fetchWithTimeout(url);
    const text = await response.text();

    if (!text) {
      return NextResponse.json({ message: "No text found" }, { status: 404 });
    }

    if (text.length < 2200) {
      return NextResponse.json({ message: "Text is too short to be summarized" }, { status: 400 });
    }

    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an intelligent summary assistant."
        },
        {
          role: "user",
          content: `Create a useful summary of the following article:\n\n${text.substring(0, 4000)}\n\nOnly return the short summary and nothing else, no quotes, just a useful summary in the form of a paragraph.`
        }
      ],
      temperature: 1,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const summary = openaiResponse.choices[0].message.content;

    if (!summary) {
      return NextResponse.json({ message: "Failed to generate summary" }, { status: 500 });
    }

    // Save to cache
    await kv.set(url, summary);
    
    return NextResponse.json({ summary });
  } catch (error) {
    console.error(`Error in summary API: ${error}`);
    return NextResponse.json({ message: "An unexpected error occurred" }, { status: 500 });
  }
} 