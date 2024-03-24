import React, { Suspense } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResponseItem } from "@/app/proxy/page";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { Skeleton } from "./ui/skeleton";
import { Link1Icon } from "@radix-ui/react-icons";
import { Source, getData } from "@/lib/data";

interface ArticleContentProps {
  url: string;
  source: Source;
}

export const ArticleContent = async ({ url, source }: ArticleContentProps) => {
  const content: ResponseItem = await getData(url, source);

  return (
    <div className="mt-10">
      <article>
        <Suspense
          fallback={
            <Skeleton
              className="h-10 rounded-lg animate-pulse bg-zinc-200"
              style={{ width: "100%" }}
            />
          }
        >
          <h1>{content.article?.title || "Title Not Found"}</h1>
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
        </Suspense>

        <Suspense
          fallback={
            <Skeleton
              className="h-32 rounded-lg animate-pulse bg-zinc-200"
              style={{ width: "100%" }}
            />
          }
        >
          {content.article?.content ? (
            <div
              className="max-w-full overflow-wrap break-words mt-10"
              dangerouslySetInnerHTML={{
                __html: content.article?.content,
              }}
            />
          ) : (
            <div className="mt-10 flex items-center space-x-2">
              <p className="text-gray-600">Content not available.</p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    {/* <span className="inline-block bg-gray-200 rounded-full p-1 cursor-help"> */}
                    <QuestionMarkCircleIcon
                      className=" inline-block mb-3 -ml-2 rounded-full cursor-help"
                      height={18}
                      width={18}
                    />
                    {/* </span> */}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Error: {content.error || "Unknown error occurred."}</p>
                    <p>There was an issue retrieving the content.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </Suspense>
      </article>
    </div>
  );
};
