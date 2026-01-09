import TopBar from "@/components/layout/top-bar";
import UnderlineLink from "@/components/shared/underline-link";
import { siteConfig } from "@/config/site";
import { createLogger } from "@/lib/logger";
import { normalizeUrl } from "@/lib/validation/url";
import { ProxyContent } from "@/components/features/proxy-content";
import { api } from "@/lib/eden";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorComponentProps } from "@tanstack/react-router";
import { z } from "zod";
import { SourceSchema } from "@/types/api";

const logger = createLogger("proxy");

// View modes for article display
export const VIEW_MODES = ["markdown", "html", "iframe"] as const;
export const ViewModeSchema = z.enum(VIEW_MODES);
export type ViewMode = z.infer<typeof ViewModeSchema>;

export const proxySearchSchema = z.object({
  url: z.string().optional(),
  source: SourceSchema.optional().default("smry-fast"),
  view: ViewModeSchema.optional().default("markdown"),
  sidebar: z.boolean().optional().default(false),
});

export type ProxySearchParams = z.infer<typeof proxySearchSchema>;

interface ArticleMetadata {
  title: string;
  description: string;
  siteName: string;
}

interface ProxyOkData {
  status: "ok";
  normalizedUrl: string;
  metadata: ArticleMetadata;
}
interface ProxyInvalidData {
  status: "invalid";
  message: string;
}
interface ProxyBlockedData { status: "blocked" }
interface ProxyMissingData { status: "missing" }

export type ProxyLoaderData =
  | ProxyOkData
  | ProxyInvalidData
  | ProxyBlockedData
  | ProxyMissingData;

const DEFAULT_METADATA: ArticleMetadata = {
  title: "SMRY - Article Reader & Summarizer",
  description: "Read articles without paywalls and get AI-powered summaries.",
  siteName: "SMRY",
};

async function fetchArticleMetadata(url: string): Promise<ArticleMetadata | null> {
  try {
    // Use Eden Treaty - on server, calls Elysia directly (no HTTP overhead)
    // On client, makes HTTP request to /api/article
    const client = await api();
    const { data, error } = await client.api.article.get({
      query: { url, source: "smry-fast" },
    });

    if (error || !data?.article) return null;

    const article = data.article;
    const description = article.textContent
      ? `${article.textContent.slice(0, 160).trim()}...`
      : DEFAULT_METADATA.description;

    return {
      title: article.title ?? DEFAULT_METADATA.title,
      description,
      siteName: article.siteName ?? DEFAULT_METADATA.siteName,
    };
  } catch (error) {
    logger.warn({ error }, "failed to load proxy metadata");
    return null;
  }
}

function buildFallbackMetadata(normalizedUrl: string): ArticleMetadata {
  let title = "Article";
  let siteName = "Unknown";

  try {
    const urlObj = new URL(normalizedUrl);
    siteName = urlObj.hostname.replace("www.", "");
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      title =
        pathParts[pathParts.length - 1]
          .replace(/[-_]/g, " ")
          .replace(/\.[^/.]+$/, "")
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ") || "Article";
    }
  } catch (error) {
    logger.warn({ normalizedUrl, error }, "failed to parse url for metadata fallback");
  }

  return {
    title,
    description: `Read "${title}" from ${siteName} on SMRY - No paywalls, AI summaries available`,
    siteName,
  };
}

export async function proxyLoader({
  location,
}: {
  location: { search: Record<string, unknown> }
}): Promise<ProxyLoaderData> {
  const search = location.search as z.infer<typeof proxySearchSchema>;
  const rawUrl = (search?.url ?? "").trim();

  if (!rawUrl) {
    return { status: "missing" };
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(rawUrl);
  } catch (error) {
    logger.warn({ invalidUrl: rawUrl, error }, "invalid url for proxy page");
    const message =
      error instanceof Error
        ? error.message
        : "Please enter a valid URL (e.g. example.com or https://example.com).";
    return { status: "invalid", message };
  }

  if (normalizedUrl.includes("orlandosentinel.com")) {
    return { status: "blocked" };
  }

  const metadata = (await fetchArticleMetadata(normalizedUrl)) ?? buildFallbackMetadata(normalizedUrl);
  return {
    status: "ok",
    normalizedUrl,
    metadata,
  };
}

export const proxyHead = ({ loaderData }: { loaderData?: ProxyLoaderData }) => {
  const data = loaderData ?? { status: "missing" as const };
  const metadata = data.status === "ok" ? data.metadata : DEFAULT_METADATA;
  const titleSuffix = data.status === "ok" ? ` - SMRY` : "";
  const canonical = data.status === "ok"
    ? `${siteConfig.url}/proxy?url=${encodeURIComponent(data.normalizedUrl)}`
    : siteConfig.url;

  return {
    meta: [
      { title: `${metadata.title}${titleSuffix}` },
      { name: "description", content: metadata.description },
      { property: "og:title", content: metadata.title },
      { property: "og:description", content: metadata.description },
      { property: "og:image", content: siteConfig.ogImage },
      { property: "og:url", content: canonical },
      { property: "twitter:card", content: "summary_large_image" },
      { property: "twitter:title", content: metadata.title },
      { property: "twitter:description", content: metadata.description },
      { property: "twitter:image", content: siteConfig.ogImage },
    ],
    links: [
      { rel: "canonical", href: canonical },
    ],
  };
};

export function ProxyRouteView({ data }: { data: ProxyLoaderData }) {
  if (data.status === "missing") {
    return (
      <div className="mt-20 px-4 text-center text-muted-foreground">
        Please provide a URL to load an article.
      </div>
    );
  }

  if (data.status === "invalid") {
    return (
      <div className="mt-20 px-4 text-center text-muted-foreground">
        {data.message}
      </div>
    );
  }

  if (data.status === "blocked") {
    return (
      <div className="mt-20 px-4 text-center text-muted-foreground">
        Sorry, articles from the Orlando Sentinel are not available.
      </div>
    );
  }

  return <ProxyContent url={data.normalizedUrl} />;
}

export function ProxyLoading() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="z-30 flex h-14 shrink-0 items-center border-b border-border/40 bg-background px-4">
        <div className="flex items-center gap-3 shrink-0">
          <Skeleton className="h-6 w-20" />
          <div className="hidden md:flex items-center p-1 bg-muted rounded-xl">
            <Skeleton className="h-7 w-[180px]" />
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
          <div className="hidden md:block w-px h-5 bg-border/60 mx-1" />
          <Skeleton className="hidden md:block size-8 rounded-md" />
          <Skeleton className="hidden md:block size-8 rounded-md" />
          <Skeleton className="size-7 rounded-full" />
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto overscroll-y-none bg-card pb-20 lg:pb-0">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 min-h-[calc(100vh-3.5rem)]">
            <div className="sticky top-0 z-20 mb-4">
              <Skeleton className="h-10 w-full sm:w-[400px] rounded-xl" />
            </div>
            <div className="mt-2">
              <div className="mb-8 space-y-6 border-b border-border pb-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-5 rounded-sm" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-10 w-full sm:h-12 sm:w-4/5" />
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="space-y-4 mt-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[88%]" />
              </div>
              <div className="space-y-4 pt-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[92%]" />
                <Skeleton className="h-4 w-[98%]" />
                <Skeleton className="h-4 w-[85%]" />
              </div>
              <div className="space-y-4 pt-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[94%]" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[78%]" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function ProxyErrorComponent({ reset }: ErrorComponentProps) {
  return (
    <div className="bg-zinc-50 min-h-screen">
      <TopBar />
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-800">
          <div className="mx-auto max-w-md rounded-lg border bg-white p-8 text-center dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
              Oops, something went wrong
            </h2>
            <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              We&apos;ve logged the issue and are working on it. Click {" "}
              <button
                className="cursor-pointer underline decoration-from-font underline-offset-2 hover:opacity-80"
                onClick={() => reset()}
              >
                here
              </button>{" "}
              to try again, or <UnderlineLink href="/" text="read something else" />.
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
              Some providers still do not work with smry.ai. We are improving
              every day, but if the site you are trying to read is protected by a {" "}
              <UnderlineLink
                href="https://www.zuora.com/guides/what-is-a-hard-paywall/"
                text="hard paywall"
              />{" "}
              there is nothing we can do.
            </p>
            <p className="mt-6 text-sm leading-7 text-zinc-800 dark:text-zinc-100">
              Questions? <UnderlineLink href="/feedback" text="send us feedback" />.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
