import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { headers } from "next/headers";
import ArrowTabs from "@/components/arrow-tabs";
import { ArticleContent } from "@/components/article-content";
import { ArticleLength } from "@/components/article-length";
import Loading from "./loading";
import { ResponsiveDrawer } from "@/components/responsiveDrawer";
import Ad from "@/components/ad";
import SummaryForm from "@/components/summary-form";
import ErrorBoundary from "@/components/error";

export const dynamic = "force-dynamic";

const adCopies = [
  {
    onClickTrack:
      "Enjoy the freedom of reading without barriers, buy me a coffee! click",
    adStart: "Enjoy the freedom of reading without barriers, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Love instant summaries? Keep us going with a coffee! click",
    adStart: "Love instant summaries? ",
    adEnd: "Keep us going with a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Unlock premium content effortlessly, buy me a coffee! click",
    adStart: "Unlock premium content effortlessly, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Support our ad-free experience, buy me a coffee! click",
    adStart: "Support our ad-free experience, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack:
      "Keep enjoying clutter-free summaries, buy me a coffee! click",
    adStart: "Keep enjoying clutter-free summaries, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Enjoy ad-free summaries? Buy me a coffee! click",
    adStart: "Enjoy ad-free summaries? ",
    adEnd: "Buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Help us keep paywalls at bay, buy me a coffee! click",
    adStart: "Help us keep paywalls at bay, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Support seamless reading, buy me a coffee! click",
    adStart: "Support seamless reading, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Enjoy uninterrupted reading? Buy me a coffee! click",
    adStart: "Enjoy uninterrupted reading? ",
    adEnd: "Buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
  {
    onClickTrack: "Keep getting summaries fast, buy me a coffee! click",
    adStart: "Keep getting summaries fast, ",
    adEnd: "buy me a coffee!",
    link: "https://www.buymeacoffee.com/jotarokujo",
  },
];

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
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const headersList = await headers();
  
  // In Next.js 16, headers() returns a Headers object that needs to be accessed differently
  let ip = "default_ip";
  try {
    // Try to access the header value - headers might be a Headers object or a plain object
    if (headersList && typeof headersList.get === 'function') {
      ip = headersList.get("x-real-ip") || "default_ip";
    } else if (headersList && typeof headersList === 'object') {
      // Fallback for plain object access or iterator
      const headersObj = Object.fromEntries(headersList as any);
      ip = headersObj["x-real-ip"] || "default_ip";
    }
  } catch (error) {
    console.error("Error accessing headers:", error);
    ip = "default_ip";
  }

  // In Next.js 15+, searchParams and params are now Promises that need to be awaited
  const resolvedSearchParams = await searchParams;
  const url = resolvedSearchParams?.url as string;

  if (!url) {
    // Handle the case where URL is not provided or not a string
    console.error(
      "URL parameter is missing or invalid",
      url,
      resolvedSearchParams?.url,
      resolvedSearchParams
    );
  }

  // if the url contains "orlandosentinel.com" then we should return nothing and let the user know that the orlando sentinel article is not available

  if (url?.includes("orlandosentinel.com")) {
    return (
      <div className="mt-20">
        Sorry, articles from the orlando sentinel are not available
      </div>
    );
  }

  const sources = ["smry", "archive", "wayback", "jina.ai"];

  // Move random number generation to client-side or use a deterministic value
  const adSelection = 5; // Using a fixed value to avoid Math.random() during render

  return (
    <div className="mt-20">
      <Ad
        link={adCopies[adSelection].link}
        onClickTrack={adCopies[adSelection].onClickTrack}
        adStart={adCopies[adSelection].adStart}
        adEnd={adCopies[adSelection].adEnd}
      />

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
                    <ErrorBoundary
                      fallback={
                        <div>
                          Could not fetch from direct source, refresh the page
                          to try again
                        </div>
                      }
                    >
                      <Suspense key={"direct"} fallback={null}>
                        <ArticleLength url={url} source={"direct"} />
                      </Suspense>
                    </ErrorBoundary>
                  }
                  lengthWayback={
                    <ErrorBoundary
                      fallback={
                        <div>
                          Could not fetch from wayback source, refresh the page
                          to try again
                        </div>
                      }
                    >
                      <Suspense key={"wayback"} fallback={null}>
                        <ArticleLength url={url} source={"wayback"} />
                      </Suspense>
                    </ErrorBoundary>
                  }
                  lengthJina={
                    <ErrorBoundary
                      fallback={
                        <div>
                          Could not fetch from jina.ai source, refresh the page
                          to try again
                        </div>
                      }
                    >
                      <Suspense key={"jina.ai"} fallback={null}>
                        <ArticleLength url={url} source={"jina.ai"} />
                      </Suspense>
                    </ErrorBoundary>
                  }
                  lengthArchive={
                    <ErrorBoundary
                      fallback={
                        <div>
                          Could not fetch from archive source, refresh the page
                          to try again
                        </div>
                      }
                    >
                      <Suspense key={"archive"} fallback={null}>
                        <ArticleLength url={url} source={"archive"} />
                      </Suspense>
                    </ErrorBoundary>
                  }
                  innerHTMLDirect={
                    <ErrorBoundary
                      fallback={
                        <div>
                          Could not fetch from direct source, refresh the page
                          to try again
                        </div>
                      }
                    >
                      <Suspense key={"direct"} fallback={<Loading />}>
                        <ArticleContent url={url} source={"direct"} />
                      </Suspense>
                    </ErrorBoundary>
                  }
                  innerHTMLWayback={
                    <ErrorBoundary
                      fallback={
                        <div>
                          Could not fetch from wayback source, refresh the page
                          to try again
                        </div>
                      }
                    >
                      <Suspense key={"wayback"} fallback={<Loading />}>
                        <ArticleContent url={url} source={"wayback"} />
                      </Suspense>
                    </ErrorBoundary>
                  }
                  innerHTMLGoogle={
                    <ErrorBoundary
                      fallback={
                        <div>
                          Could not fetch from jina.ai source, refresh the page
                          to try again
                        </div>
                      }
                    >
                      <Suspense key={"jina.ai"} fallback={<Loading />}>
                        <ArticleContent url={url} source={"jina.ai"} />
                      </Suspense>
                    </ErrorBoundary>
                  }
                  innerHTMLArchive={
                    <ErrorBoundary
                      fallback={
                        <div>
                          Could not fetch from archive.is source, refresh the
                          page to try again
                        </div>
                      }
                    >
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
