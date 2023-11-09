import { EyeIcon } from "lucide-react";
import {
  AdjustmentsHorizontalIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { Configuration, OpenAIApi } from "openai-edge";
import { OpenAIStream, StreamingTextResponse } from "ai";
import kv from "@vercel/kv";
import { Tokens } from "ai/react";
import { Suspense } from "react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

export const runtime = "edge";

const apiConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY!,
});

const openai = new OpenAIApi(apiConfig);

type PageData = {
  title: string;
  byline: null | string; // Assuming 'byline' can be a string as well
  dir: null | string; // Assuming 'dir' can be a string as well
  lang: string;
  content: string;
  textContent: string;
  length: number;
  excerpt: string;
  siteName: null | string; // Assuming 'siteName' can be a string as well
};

async function getData(url: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/getCache?url=${encodeURIComponent(url)}`
  );
  // The return value is *not* serialized
  // You can return Date, Map, Set, etc.

  if (!res.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Failed to fetch data");
  }

  return res.json();
}

// Replace the respective SVGs with these components
export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const url =
    typeof searchParams["url"] === "string" ? searchParams["url"] : null;

  if (!url) {
    // Handle the case where URL is not provided or not a string
    console.error("URL parameter is missing or invalid");
    return;
  }

  const content: PageData = await getData(url);

  return (
    <div className="px-4 py-8 md:py-12 mt-20">
      <div className="mx-auto space-y-10 max-w-prose">
        <main className="prose">
          <article>
            <h1>{content.title}</h1>
            <div className="leading-3 text-gray-600 flex space-x-4 items-center -ml-4 -mt-4 flex-wrap">
              <div className="flex items-center mt-4 ml-4 space-x-1.5">
                <GlobeAltIcon className="w-4 h-4 text-gray-600" />
                <Link
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-600 hover:text-gray-400 transition"
                >
                  {new URL(url).hostname}
                </Link>
              </div>
              {/* <div className="flex items-center mt-4 ml-4 space-x-1.5">
                <EyeIcon className="w-4 h-4 text-gray-600" />
                <div>2</div>
              </div> */}
            </div>
            <div
              className="tokens my-10 shadow-sm border-zinc-100 border flex border-collapse text-[#111111] text-base font-normal list-none text-left visible overflow-auto rounded-lg bg-[#f9f9fb]"
              style={{
                animationDuration: "0.333s",
                animationFillMode: "forwards",
                animationName: "yourAnimationName", // Replace with your actual animation name
                animationTimingFunction: "cubic-bezier(0, 0, 0, 1)",
                fontFamily:
                  '-apple-system, Roboto, SegoeUI, "Segoe UI", "Helvetica Neue", Helvetica, "Microsoft YaHei", "Meiryo UI", Meiryo, "Arial Unicode MS", sans-serif',
                // Include other custom properties as needed
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
                    <Wrapper siteText={content.textContent} />
                  </Suspense>
                </div>
              </div>
            </div>

            <div dangerouslySetInnerHTML={{ __html: content.content }} />
          </article>
        </main>
      </div>
    </div>
  );
}

// We add a wrapper component to avoid suspending the entire page while the OpenAI request is being made
async function Wrapper({ siteText }: { siteText: string }) {
  const prompt = "Summarize the following in under 200 words: " + siteText;

  // See https://sdk.vercel.ai/docs/concepts/caching
  const cached = (await kv.get(prompt)) as string | undefined;

  if (cached) {
    console.log("cached")
    return cached;

  }

  const response = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    stream: true,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Convert the response into a friendly text-stream
  const stream = OpenAIStream(response, {
    async onCompletion(completion) {
      await kv.set(prompt, completion);
      // await kv.expire(prompt, 60 * 10);
    },
  });

  return <Tokens stream={stream} />;
}
