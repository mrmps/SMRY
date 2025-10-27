import React, { Suspense } from "react";
import { ResponseItem } from "@/app/proxy/page";
import { Source } from "@/lib/data";
import { getDataResult } from "./article-content";
import { ErrorBadge } from "./error-display";

export const revalidate = 3600;

interface ArticleLengthProps {
  url: string;
  source: Source;
}

export const ArticleLength = async ({ url, source }: ArticleLengthProps) => {
  const contentResult = await getDataResult(url, source);

  // Handle error case with a simple indicator
  if (contentResult.isErr()) {
    return (
      <Suspense fallback={null}>
        {" · "}
        <ErrorBadge error={contentResult.error} />
      </Suspense>
    );
  }

  const content = contentResult.value;

  return (
    <Suspense fallback={null}>
      {" · " + (content.article?.length ?? 0) + " words"}
    </Suspense>
  );
};
