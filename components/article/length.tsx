"use client";

import React from "react";
import { Source } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";
import { ArticleResponse } from "@/types/api";
import { ErrorBadge } from "../shared/error-display";

interface ArticleLengthProps {
  query: UseQueryResult<ArticleResponse, Error>;
  source: Source;
}

export const ArticleLength = ({ query, source }: ArticleLengthProps) => {
  const { data, isLoading, isError, error } = query;

  // Loading state
  if (isLoading) {
    return <span className="text-gray-400">...</span>;
  }

  // Error state
  if (isError) {
    return (
      <>
        {" · "}
        <ErrorBadge error={{
          type: "NETWORK_ERROR",
          message: error?.message || "Failed to load",
          url: "",
        }} />
      </>
    );
  }

  // Success state
  if (data?.article?.length) {
    return <>{" · " + data.article.length + " words"}</>;
  }

  return null;
};
