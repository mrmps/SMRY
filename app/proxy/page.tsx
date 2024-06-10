
import { Configuration, OpenAIApi } from "openai-edge";
import { kv } from "@vercel/kv";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { encode, decode } from "gpt-tokenizer";
import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import ArrowTabs from "@/components/arrow-tabs";
import { ArticleContent } from "@/components/article-content";
import { ArticleLength } from "@/components/article-length";
import Loading from "./loading";
import { ResponsiveDrawer } from "@/components/responsiveDrawer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm"; // GitHub flavored markdown
import Ad from "@/components/ad";
import SummaryForm from "@/components/summary-form";

export const dynamic='force-dynamic';

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

  // error is here, searchParams are empty in production

  const url = searchParams?.url as string;

  if (!url) {
    // Handle the case where URL is not provided or not a string
    console.error("URL parameter is missing or invalid", url, searchParams["url"], searchParams);
  }

  const sources = ["smry", "archive", "wayback", "jina.ai"];

  const adSelection = Math.floor(Math.random() * 3);

  return (
    <div className="mt-20">
      {adSelection === 0 ? (
        <Ad
          onClickTrack="stealthwriter click"
          adStart="Bypass AI detectors. Checkout "
          adEnd="StealthWriter, an AI writing humanizer"
          link="https://stealthwriter.ai?via=smry"
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
          adStart="I value your feedback! Please share your thoughts and help me improve smry.ai :)"
          adEnd="Give Feedback "
          link="/feedback"
        />
      )}
      <div className="px-4 py-8 md:py-12 mt-20">
        <div className="mx-auto space-y-10 max-w-prose">
          <main className="prose">
            {url ? (
              <>
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
                    <SummaryForm urlProp={url} ipProp={ip} />
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
                lengthJina={
                  <Suspense key={"jina.ai"} fallback={null}>
                    <ArticleLength url={url} source={"jina.ai"} />
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
                  <Suspense key={"jina.ai"} fallback={<Loading />}>
                    <ArticleContent url={url} source={"jina.ai"} />
                  </Suspense>
                }
                innerHTMLArchive={
                  <Suspense key={"archive.is"} fallback={<Loading />}>
                    <ArticleContent url={url} source={"archive"} />
                  </Suspense>
                }
              />
              </>
            ) : (
              <Skeleton />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}