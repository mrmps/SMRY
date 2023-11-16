import { EyeIcon } from "lucide-react";
import {
  AdjustmentsHorizontalIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { Configuration, OpenAIApi } from "openai-edge";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { kv } from "@vercel/kv";
import { Tokens } from "ai/react";
import { Suspense } from "react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { Link1Icon } from "@radix-ui/react-icons";
import { encode, decode } from "gpt-tokenizer";
import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import parse from "html-react-parser";
import ArrowTabs from "@/components/arrow-tabs";
import { track } from '@vercel/analytics/server';

export const runtime = "edge";

const apiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY!,
});

const openai = new OpenAIApi(apiConfig);

// type PageData = {
//   title: string;
//   byline: null | string; // Assuming 'byline' can be a string as well
//   dir: null | string; // Assuming 'dir' can be a string as well
//   lang: string;
//   content: string;
//   textContent: string;
//   length: number;
//   excerpt: string;
//   siteName: null | string; // Assuming 'siteName' can be a string as well
//   source: string;
//   sourceURL: string; // the url to the cache/wayback machine
//   flattenedHTML: string;
// };

// type Page = {
//   source: string;
//   article: PageData;
// };

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

type ResponseItem = {
  source: string;
  article?: Article;
  status?: string; // Assuming 'status' is optional and a string
  error?: string;
  cacheURL: string;
};

type ApiResponse = ResponseItem[];

async function getData(url: string) {
  const urlBase = new URL(url).hostname
  track('Search', { urlBase: urlBase, fullUrl: url });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_URL}/api/getCache?url=${encodeURIComponent(url)}`
  );
  // The return value is *not* serialized
  // You can return Date, Map, Set, etc.

  if (!res.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Failed to fetch data" + JSON.stringify(res.json()));
  }

  return res.json();
}

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

  const contents: ApiResponse = await getData(url);

  const sources = contents.map((page) => page.source);

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
                    fallback={
                      <Skeleton
                        className="h-32 rounded-lg animate-pulse bg-zinc-200"
                        style={{ width: "100%" }}
                      />
                    }
                  >
                    <Wrapper
                      ip={ip}
                      siteText={contents[0].article?.textContent ?? "N/A"}
                      url={url}
                    />
                  </Suspense>
                </div>
              </div>
            </div>

            <ArrowTabs
              sources={sources}
              innerHTML={contents.map((content) => (
                <div key={content.source} className="mt-10">
                  <article>
                    <h1>{content.article?.title || "Untitled"}</h1>
                    <div className="leading-3 text-gray-600 flex space-x-4 items-center -ml-4 -mt-4 flex-wrap">
                      <div className="flex items-center mt-4 ml-4 space-x-1.5">
                        <GlobeAltIcon className="w-4 h-4 text-gray-600" />
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-600 hover:text-gray-400 transition"
                        >
                          {new URL(url).hostname}
                        </a>
                      </div>
                      <div className="flex items-center mt-4 ml-4 space-x-1.5">
                        <Link1Icon className="w-4 h-4 text-gray-600" />
                        <a
                          href={decodeURIComponent(content.cacheURL) ?? ""}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-600 hover:text-gray-400 transition"
                        >
                          {content.source}
                        </a>
                      </div>
                    </div>

                    <Suspense
                      fallback={
                        <Skeleton
                          className="h-32 rounded-lg animate-pulse bg-zinc-200"
                          style={{ width: "100%" }}
                        />
                      }
                    >
                      <div
                        className="max-w-full overflow-wrap break-words"
                        dangerouslySetInnerHTML={{
                          __html:
                            content.article?.content ??
                            `<div>Could not retrieve content: ${content.error}</div>`,
                        }}
                      />

                      {/* <div>{JSON.stringify(content)}</div> */}
                      {/* <div dangerouslySetInnerHTML={{ __html: content.content }} /> */}
                      {/* {parse(content.content)} */}
                    </Suspense>
                  </article>
                </div>
              ))}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

const models = [
  { name: "mistral-7b-instruct", rateLimit: 250 },
  { name: "openhermes-2-mistral-7b", rateLimit: 250 },
  { name: "openhermes-2.5-mistral-7b", rateLimit: 250 },
  { name: "llama-2-13b-chat", rateLimit: 150 },
  { name: "llama-2-70b-chat", rateLimit: 60 },
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
  siteText,
  url,
  ip,
}: {
  siteText: string;
  url: string;
  ip: string;
}) {
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
    const { success: dailySuccess, limit: dailyLimit, reset: dailyReset, remaining: dailyRemaining } = 
      await dailyRatelimit.limit(`13ft_ratelimit_daily_${ip}`);
    
    // Usage for minute rate limit
    const { success: minuteSuccess, limit: minuteLimit, reset: minuteReset, remaining: minuteRemaining } = 
      await minuteRatelimit.limit(`13ft_ratelimit_minute_${ip}`);

    if (!dailySuccess) {
      return "Your daily limit of 10 summaries has been reached. Although you can continue using smry.ai for reading, additional summaries are not available today. Please return tomorrow for more summaries. If this limit is inconvenient for you, your feedback is welcome at contact@smry.ai.";
    }
    if (!minuteSuccess) {
      return "Your limit of 4 summaries per minute has been reached. Pretty sure you are a bot. Stop it!";
    }
  }

  try {
    const tokenLimit = 3200;
    const tokens = encode(prompt).splice(0, tokenLimit);
    const decodedText = decode(tokens);

    // const response = await openai.createChatCompletion({
    //   model: "gpt-3.5-turbo",
    //   stream: true,
    //   messages: [
    //     {
    //       role: "user",
    //       content: decodedText,
    //     },
    //   ],
    // });

    // // Convert the response into a friendly text-stream
    // const stream = OpenAIStream(response, {
    //   async onCompletion(completion) {
    //     await kv.set(url, completion);
    //     // await kv.expire(prompt, 60 * 10);
    //   },
    // });

    // const options = {
    //   method: 'POST',
    //   headers: {
    //     accept: 'application/json',
    //     'content-type': 'application/json',
    //     Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`
    //   },
    //   body: JSON.stringify({
    //     model: 'togethercomputer/llama-2-7b-chat',
    //     prompt: decodedText,
    //     max_tokens: 700,
    //     temperature: 0.7,
    //     top_p: 0.7,
    //     top_k: 50,
    //     repetition_penalty: 1,
    //     stream_tokens: true
    //   })
    // };

    // fetch('https://api.together.xyz/inference', options)
    //   .then(response => response.json())
    //   .then(response => console.log(response))
    //   .catch(err => console.error(err));

    // const response = await fetch('https://api.together.xyz/inference', options)

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: pickRandomModel(),
        stream: true,
        max_tokens: 700,
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
