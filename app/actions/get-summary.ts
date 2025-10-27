"use server";

import { kv } from "@vercel/kv";
import { Ratelimit } from "@upstash/ratelimit";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { getUrlWithSource } from "@/lib/get-url-with-source";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function getSummaryWithSource(prevState: string | null, formData: FormData) {
  try {
    const originalUrl = formData.get("originalUrl") as string;
    const source = formData.get("source") as string;
    const ip = formData.get("ip") as string;

    if (!originalUrl) {
      return "URL parameter is missing or invalid";
    }

    console.log("getSummaryWithSource - originalUrl:", originalUrl);
    console.log("getSummaryWithSource - source:", source);
    
    // Construct the URL with the source
    const url = getUrlWithSource(source ?? "direct", originalUrl);
    console.log("getSummaryWithSource - constructed URL:", url);
    
    // Create new FormData with the constructed URL
    const newFormData = new FormData();
    newFormData.set("url", url);
    newFormData.set("ip", ip);
    
    // Call the original getSummary function
    return await getSummary(newFormData);
  } catch (error) {
    console.error(`Error in getSummaryWithSource: ${error}`);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

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

    const responseResult = await fetchWithTimeout(url);
    
    if (responseResult.isErr()) {
      return `Error fetching content: ${responseResult.error.message}`;
    }

    const response = responseResult.value;
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
      return null;
    }

    await kv.set(url, summary);
    return summary;
  } catch (error) {
    console.error(`Error in getSummary: ${error}`);
    return null;
  }
}
