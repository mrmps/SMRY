import React, { Suspense } from "react";
import { ResponseItem } from "@/app/proxy/page";
import { Source, getData } from "@/lib/data";

interface ArticleLengthProps {
  url: string;
  source: Source;
}

export const ArticleLength = async ({ url, source }: ArticleLengthProps) => {
  const content: ResponseItem = await getData(url, source);

  return <Suspense fallback={null}>{(content.article?.length ?? 0 ) + " words"}</Suspense>;
};
