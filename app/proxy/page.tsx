
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
import ErrorBoundary from "@/components/error";

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

  // if the url contains "orlandosentinel.com" then we should return nothing and let the user know that the orlando sentinel article is not available

  if (url?.includes("orlandosentinel.com")) {
    return <div className="mt-20">Sorry, articles from the orlando sentinel are not available</div>;
  }

  const sources = ["smry", "archive", "wayback", "jina.ai"];

  const adSelection = Math.floor(Math.random() * 4);

  return (
    // removed other ads so that always asking for feedback
    <div className="mt-20">
      {adSelection === 999 ? (
        <Ad
          onClickTrack="stealthwriter click"
          adStart="Bypass AI detectors. Checkout "
          adEnd="StealthWriter, an AI writing humanizer"
          link="https://stealthwriter.ai?via=smry"
        />
      ) : adSelection === 999 ? (
        <Ad
          onClickTrack="klap click"
          adStart="Turn your videos into viral shorts with "
          adEnd="Klap, an AI video editing tool"
          link="https://klap.app?via=smry"
        />
      ) : adSelection === 1 || adSelection === 2 ? (
        // https://www.buymeacoffee.com/jotarokujo
        <Ad
          onClickTrack="buymeacoffee click"
          adStart="I'd like to make money off this app :) "
          adEnd="Buy me a coffee"
          link="https://www.buymeacoffee.com/jotarokujo"
        />
      ) : adSelection === 0 ? (
        <Ad
          onClickTrack="special feedback click"
          adStart="I'd like to make money off this app :) "
          adEnd="What features would you pay for/like to see?"
          link="/feedback"
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
                  <ErrorBoundary fallback={<div>Could not fetch from direct source, refresh the page to try again</div>}>
                    <Suspense key={"direct"} fallback={null}>
                      <ArticleLength url={url} source={"direct"} />
                    </Suspense>
                  </ErrorBoundary>
                }
                lengthWayback={
                  <ErrorBoundary fallback={<div>Could not fetch from wayback source, refresh the page to try again</div>}>
                    <Suspense key={"wayback"} fallback={null}>
                      <ArticleLength url={url} source={"wayback"} />
                    </Suspense>
                  </ErrorBoundary>
                }
                lengthJina={
                  <ErrorBoundary fallback={<div>Could not fetch from jina.ai source, refresh the page to try again</div>}>
                    <Suspense key={"jina.ai"} fallback={null}>
                      <ArticleLength url={url} source={"jina.ai"} />
                    </Suspense>
                  </ErrorBoundary>
                }
                lengthArchive={
                  <ErrorBoundary fallback={<div>Could not fetch from archive source, refresh the page to try again</div>}>
                    <Suspense key={"archive"} fallback={null}>
                      <ArticleLength url={url} source={"archive"} />
                    </Suspense>
                  </ErrorBoundary>
                }
                innerHTMLDirect={
                  <ErrorBoundary fallback={<div>Could not fetch from direct source, refresh the page to try again</div>}>
                    <Suspense key={"direct"} fallback={<Loading />}>
                      <ArticleContent url={url} source={"direct"} />
                    </Suspense>
                  </ErrorBoundary>
                }
                innerHTMLWayback={
                  <ErrorBoundary fallback={<div>Could not fetch from wayback source, refresh the page to try again</div>}>
                    <Suspense key={"wayback"} fallback={<Loading />}>
                      <ArticleContent url={url} source={"wayback"} />
                    </Suspense>
                  </ErrorBoundary>
                }
                innerHTMLGoogle={
                  <ErrorBoundary fallback={<div>Could not fetch from jina.ai source, refresh the page to try again</div>}>
                    <Suspense key={"jina.ai"} fallback={<Loading />}>
                      <ArticleContent url={url} source={"jina.ai"} />
                    </Suspense>
                  </ErrorBoundary>
                }
                innerHTMLArchive={
                  <ErrorBoundary fallback={<div>Could not fetch from archive.is source, refresh the page to try again</div>}>
                    <Suspense key={"archive.is"} fallback={<Loading />}>
                      <ArticleContent url={url} source={"archive"} />
                    </Suspense>
                  </ErrorBoundary>
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