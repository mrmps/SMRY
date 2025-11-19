"use client";

import React from "react";
import { Source } from "@/types/api";
import { UseQueryResult } from "@tanstack/react-query";
import { ArticleResponse } from "@/types/api";
import { ErrorBadge } from "../shared/error-display";

import { ArticleFetchError } from "@/lib/api/client";
import { AppError } from "@/lib/errors";

import { Skeleton } from "@/components/ui/skeleton";

interface ArticleLengthProps {
  query: UseQueryResult<ArticleResponse, Error>;
  source: Source;
}

export const ArticleLength = ({ query, source: _source }: ArticleLengthProps) => {
  const { data, isLoading, isError, error } = query;

  // Loading state
  if (isLoading) {
    return <Skeleton className="h-3 w-20" />;
  }

  // Error state
  if (isError) {
    // Try to preserve error details if possible
    const errorProps: AppError = error instanceof ArticleFetchError && error.errorType
      ? {
          type: error.errorType as any,
          message: error.message,
          url: "",
          ...(error.details || {})
        }
      : {
          type: "NETWORK_ERROR",
          message: error?.message || "Failed to load",
          url: "",
        };

    return (
      <>
        {" · "}
        <ErrorBadge error={errorProps} />
      </>
    );
  }

  // Success state
  if (data?.article?.length) {
    return <>{" · " + data.article.length + " words"}</>;
  }

  return null;
};
