"use server";

import { kv } from "@vercel/kv";
import { Ratelimit } from "@upstash/ratelimit";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getSummary(formData: FormData) {
  try {
    const url = formData.get("url") as string;
    const ip = formData.get("ip") as string;

    if (!url) {
      return "URL parameter is missing or invalid";
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

    if (process.env.NODE_ENV != "development") {
      if (!dailySuccess) {
        return "Your daily limit of 20 summaries has been reached. Please return tomorrow for more summaries.";
      }
      if (!minuteSuccess) {
        return "Your limit of 6 summaries per minute has been reached. Please slow down.";
      }
    }

    const cached = (await kv.get(url)) as string | undefined;
    if (cached) {
      return cached;
    }

    const response = await fetchWithTimeout(url);
    const text = await response.text();

    if (!text) {
      return "No text found";
    }

    if (text.length < 2200) {
      return "Text is short to be summarized";
    }

    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          "role": "system",
          // @ts-ignore
          "content": [
            {
              "type": "text",
              "text": "You are an intelligent summary assistant."
            }
          ]
        },
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": `Create a useful summary of the following article:\n\n${text.substring(0, 4000)}\n\nOnly return the short summary and nothing else, no quotes, just a useful summary in the form of a paragraph.`
            }
          ]
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
      return null;
    }

    await kv.set(url, summary);
    return summary;
  } catch (error) {
    console.error(`Error in getSummary: ${error}`);
    return null;
  }
}
