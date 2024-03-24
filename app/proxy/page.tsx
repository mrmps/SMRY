import { Configuration, OpenAIApi } from "openai-edge";
import { kv } from "@vercel/kv";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { encode, decode } from "gpt-tokenizer";
import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import ArrowTabs from "@/components/arrow-tabs";
import { ArticleContent } from "@/components/article-content";
import { getData } from "@/lib/data";
import { ArticleLength } from "@/components/article-length";
import Loading from "./loading";
import { ResponsiveDrawer } from "@/components/responsiveDrawer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm"; // GitHub flavored markdown
import Ad from "@/components/ad";

export const runtime = "edge";

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

async function fetchWithRetry(
  url: string,
  options: RequestInit | undefined,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response; // If the fetch is successful, return the response
    } catch (error) {
      lastError = error as Error;
      console.log(`Retrying fetch (${i + 1}/${maxRetries})...`);
      // Optional: You may want to implement a delay here
    }
  }

  throw lastError || new Error("Fetch failed after retrying");
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

  const sources = ["smry", "wayback", "google", "archive"];

  const adSelection = Math.floor(Math.random() * 3);

  return (
    <div className="mt-20">
      {adSelection === 0 ? (
        <Ad
          onClickTrack="jotbot click"
          adStart="Never get stuck writing again. Checkout "
          adEnd="Jotbot, an AI writing assistant"
          link="https://myjotbot.com/?aff=smry"
        />
      ) : adSelection === 1 ? (
        <Ad
          onClickTrack="klap click"
          adStart="Turn your videos into viral shorts with "
          adEnd="Klap, an AI video editing tool"
          link="https://klap.app?via=smry"
        />
      ) : (
        <Ad
          onClickTrack="feedback click"
          adStart="We value your feedback! Please share your thoughts and help us improve. "
          adEnd="Give Feedback "
          link="/feedback"
        />
      )}
      <div className="px-4 py-8 md:py-12 mt-20">
        <div className="mx-auto space-y-10 max-w-prose">
          <main className="prose">
            <div className="flex items-center justify-between bg-[#FBF8FB] p-2 rounded-lg shadow-sm mb-4 border-zinc-100 border">
              <h2 className="ml-4 mt-0 mb-0 text-sm font-semibold text-gray-600">
                Get AI-powered key points
              </h2>
              <ResponsiveDrawer>
                <Suspense
                  key={"summary"}
                  fallback={
                    <Skeleton
                      className="h-32 rounded-lg animate-pulse bg-zinc-200"
                      style={{ width: "100%" }}
                    />
                  }
                >
                  <div className="remove-all">
                    <Wrapper ip={ip} url={url} />
                  </div>
                </Suspense>
              </ResponsiveDrawer>
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
              lengthArchive={
                <Suspense key={"archive"} fallback={null}>
                  <ArticleLength url={url} source={"archive"} />
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
              innerHTMLArchive={
                <Suspense key={"archive.is"} fallback={<Loading />}>
                  <ArticleContent url={url} source={"archive"} />
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
async function Wrapper({ url, ip }: { url: string; ip: string }) {
  const [direct, wayback]: ResponseItem[] = await Promise.all([
    getData(url, "direct"),
    getData(url, "wayback"),
  ]);

  const directSiteText = direct.article?.content || "";
  const waybackSiteText = wayback.article?.content || "";

  const siteText =
    directSiteText?.length > waybackSiteText.length
      ? direct.article?.content
      : wayback.article?.content;
  const prompt =
    "Provide a concise and comprehensive summary of the given text. The summary should capture the main points and key details of the text while conveying the author's intended meaning accurately. Please ensure that the summary is well-organized and easy to read. The length of the summary should be appropriate to capture the main points and key details of the text, without including unnecessary information or becoming overly long.\n\n" +
    siteText +
    "\n\nSummary:";

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
      limiter: Ratelimit.slidingWindow(20, "1 d"), // 20 requests per day
    });

    // New rate limit for 4 requests per minute
    const minuteRatelimit = new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(6, "1 m"), // 6 requests per minute
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
      return "Your daily limit of 20 summaries has been reached. Although you can continue using smry.ai for reading, additional summaries are not available today. Please return tomorrow for more summaries. If this limit is inconvenient for you, your feedback is welcome at contact@smry.ai.";
    }
    if (!minuteSuccess) {
      return "Your limit of 6 summaries per minute has been reached. Pretty sure you are a bot. Stop it!";
    }
  }

  try {
    const tokenLimit = 25000;
    const tokens = encode(prompt).splice(0, tokenLimit);
    const decodedText = decode(tokens);

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY in environment variables.");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // const response = model.generateContent([decodedText + "\n\nSummarize the above, give me easily digestible key points. Use a numbered list to convey points. Start at 1."])

    // const geminiStream = await model.generateContentStream([decodedText + "\n\nSummarize the above, give me easily digestible key points. Use a numbered list to convey points. Start at 1."])

    // // Convert the response into a friendly text-stream
    // const stream = GoogleGenerativeAIStream(geminiStream);

    const gemini = await model.generateContent([
      decodedText +
        "\n\nSummarize the above, give me easily digestible key points.",
    ]);

    console.log(gemini.response.text());

    const renderList = (tag: string, props: any, isNested: boolean) => {
      const Tag = tag; // 'ul' or 'ol'
      const baseClass = tag === "ul" ? "list-disc" : "list-decimal";
      const nestedClass = tag === "ul" ? "list-circle" : "list-decimal";
      return (
        <Tag
          className={`${isNested ? nestedClass : baseClass} list-inside ml-4`}
          {...props}
        />
      );
    };

    return (
      <ReactMarkdown
        className="list-disc"
        remarkPlugins={[gfm]}
        components={{
          // Apply TailwindCSS styles to lists and list items
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside" {...props} />
          ),
          li: ({ node, ...props }) => <li className="ml-4" {...props} />,
        }}
      >
        {gemini.response.text()}
      </ReactMarkdown>
    );

    // return <Tokens stream={stream} />;
  } catch (error) {
    return `Well this sucks. Looks like an unexpected error occured, so no summary for this site :( No I won't tell you the error, that is private. Really, you insist? Fine. The error is ${error} Happy?`;
  }
}
