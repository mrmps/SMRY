import { Configuration, OpenAIApi } from "openai-edge";
import { OpenAIStream } from "ai";
import { kv } from "@vercel/kv";
import { Tokens } from "ai/react";
import { Suspense } from "react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { encode, decode } from "gpt-tokenizer";
import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import ArrowTabs from "@/components/arrow-tabs";
import { ArticleContent } from "@/components/article-content";
export const runtime = "edge";
import { Source, getData } from "@/lib/data";
import { ArticleLength } from "@/components/article-length";
import Loading from "./loading";


const apiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Article = {
  title: string;
  byline: null | string;
  dir: null | string;
  lang: null | string;
  content: string;
  textContent: string;
  length: number;
  siteName: null | string;
};

export type ResponseItem = {
  source: string;
  article?: Article;
  status?: string; // Assuming 'status' is optional and a string
  error?: string;
  cacheURL: string;
};




export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const headersList = headers();
  const ip = headersList.get("x-real-ip") || "default_ip";

  const url =
    typeof searchParams["url"] === "string" ? searchParams["url"] : null;

  if (!url) {
    // Handle the case where URL is not provided or not a string
    console.error("URL parameter is missing or invalid");
    return;
  }

  const sources = ["smry", "wayback", "google"];

  return (
    <div className="mt-20">
      <div className="px-4 py-8 md:py-12 mt-20">
        <div className="mx-auto space-y-10 max-w-prose">
          <main className="prose">
            <div
              className="tokens my-10 shadow-sm border-zinc-100 border flex border-collapse text-[#111111] text-base font-normal list-none text-left visible overflow-auto rounded-lg bg-[#f9f9fb]"
              style={{
                animationDuration: "0.333s",
                animationFillMode: "forwards",
                animationTimingFunction: "cubic-bezier(0, 0, 0, 1)",
                fontFamily:
                  '-apple-system, Roboto, SegoeUI, "Segoe UI", "Helvetica Neue", Helvetica, "Microsoft YaHei", "Meiryo UI", Meiryo, "Arial Unicode MS", sans-serif',
              }}
            >
              <div className="p-6 w-full grid">
                <Image
                  src="/logo.svg"
                  width={150}
                  height={150}
                  alt={"smry logo"}
                  className="-ml-4"
                />
                <div className="w-full">
                  <Suspense
                    key={"summary"}
                    fallback={
                      <Skeleton
                        className="h-32 rounded-lg animate-pulse bg-zinc-200"
                        style={{ width: "100%" }}
                      />
                    }
                  >
                    <Wrapper
                      ip={ip}
                      url={url}
                    />
                  </Suspense>
                </div>
              </div>
            </div>

            <ArrowTabs
              sources={sources}
              lengthDirect={
                <Suspense key={"direct"} fallback={null}>
                  <ArticleLength url={url} source={"direct"} />
                </Suspense>
              }
              lengthWayback={
                <Suspense key={"wayback"} fallback={null}>
                  <ArticleLength url={url} source={"wayback"} />
                </Suspense>
              }
              lengthGoogle={
                <Suspense key={"google"} fallback={null}>
                  <ArticleLength url={url} source={"google"} />
                </Suspense>
              }
              innerHTMLDirect={
                <Suspense key={"direct"} fallback={<Loading />}>
                  <ArticleContent url={url} source={"direct"} />
                </Suspense>
              }
              innerHTMLWayback={
                <Suspense key={"wayback"} fallback={<Loading />}>
                  <ArticleContent url={url} source={"wayback"} />
                </Suspense>
              }
              innerHTMLGoogle={
                <Suspense key={"google"} fallback={<Loading />}>
                  <ArticleContent url={url} source={"google"} />
                </Suspense>
              }
            />
          </main>
        </div>
      </div>
    </div>
  );
}

const models = [
  { name: "mistral-7b-instruct", rateLimit: 500 },
  { name: "pplx-70b-chat", rateLimit: 120 },
  // { name: "codellama-34b-instruct", rateLimit: 300 },
  { name: "pplx-7b-chat", rateLimit: 150 },
  { name: "llama-2-70b-chat", rateLimit: 120 },
];

// Calculate total rate limits
const totalRateLimit = models.reduce((acc, model) => acc + model.rateLimit, 0);

function pickRandomModel() {
  let randomNum = Math.random() * totalRateLimit;
  for (let i = 0; i < models.length; i++) {
    if (randomNum < models[i].rateLimit) {
      return models[i].name;
    }
    randomNum -= models[i].rateLimit;
  }
}

// We add a wrapper component to avoid suspending the entire page while the OpenAI request is being made
async function Wrapper({
  url,
  ip,
}: {
  url: string;
  ip: string;
}) {
  const [direct, wayback]: ResponseItem[] = await Promise.all([
    getData(url, "direct"),
    getData(url, "wayback"),
  ]);

  const directSiteText = direct.article?.content || "";
  const waybackSiteText = wayback.article?.content || "";

  const siteText = directSiteText?.length > waybackSiteText.length ? direct.article?.content : wayback.article?.content;
  const prompt =
    "Summarize the following in under 300 words: " + siteText + "Summary:";

  // See https://sdk.vercel.ai/docs/concepts/caching

  const cached = (await kv.get(url)) as string | undefined;

  if (cached) {
    console.log("cached");
    return cached;
  }

  if (prompt.length < 2700) {
    return "Content too short to summarize.";
  }

  if (
    process.env.NODE_ENV != "development" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN
  ) {
    const dailyRatelimit = new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(10, "1 d"), // 10 requests per day
    });

    // New rate limit for 4 requests per minute
    const minuteRatelimit = new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(4, "1 m"), // 4 requests per minute
    });

    // Usage for daily rate limit
    const {
      success: dailySuccess,
      limit: dailyLimit,
      reset: dailyReset,
      remaining: dailyRemaining,
    } = await dailyRatelimit.limit(`13ft_ratelimit_daily_${ip}`);

    // Usage for minute rate limit
    const {
      success: minuteSuccess,
      limit: minuteLimit,
      reset: minuteReset,
      remaining: minuteRemaining,
    } = await minuteRatelimit.limit(`13ft_ratelimit_minute_${ip}`);

    if (!dailySuccess) {
      return "Your daily limit of 10 summaries has been reached. Although you can continue using smry.ai for reading, additional summaries are not available today. Please return tomorrow for more summaries. If this limit is inconvenient for you, your feedback is welcome at contact@smry.ai.";
    }
    if (!minuteSuccess) {
      return "Your limit of 4 summaries per minute has been reached. Pretty sure you are a bot. Stop it!";
    }
  }

  try {
    const tokenLimit = 2900;
    const tokens = encode(prompt).splice(0, tokenLimit);
    const decodedText = decode(tokens);

    // const response = await fetch("https://api.perplexity.ai/chat/completions", {
    //   method: "POST",
    //   headers: {
    //     Accept: "application/json",
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     model: pickRandomModel(),
    //     stream: true,
    //     max_tokens: 580,
    //     frequency_penalty: 1,
    //     temperature: 1,
    //     messages: [
    //       {
    //         role: "system",
    //         content: "Be precise and concise in your responses.",
    //       },
    //       {
    //         role: "user",
    //         content: decodedText,
    //       },
    //     ],
    //   }),
    // });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct",
        stream: true,
        max_tokens: 580,
        frequency_penalty: 1,
        temperature: 1,
        messages: [
          {
            role: "system",
            content: "Be precise and concise in your responses.",
          },
          {
            role: "user",
            content: decodedText,
          },
        ],
      }),
    });

    // Convert the response into a friendly text-stream
    const stream = OpenAIStream(response, {
      async onCompletion(completion) {
        await kv.set(url, completion);
        // await kv.expire(prompt, 60 * 10);
      },
    });

    if (!response.ok) {
      return "Well this sucks. Looks like I ran out of money to pay for summaries. Please be patient until a benevolent sponsor gives me either cash or sweet sweet OpenAI credits. If you would like to be that sponsor, feel free to reach out to contact@smry.ai!";
    }

    return <Tokens stream={stream} />;
  } catch (error) {
    return `Well this sucks. Looks like an unexpected error occured, so no summary for this site :( No I won't tell you the error, that is private. Really, you insist? Fine. The error is ${error} Happy?`;
  }
}
