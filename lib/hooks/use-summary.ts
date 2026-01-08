/**
 * useSummary - Streaming summary hook using TanStack Query
 *
 * Pattern: useMutation for streaming + queryClient cache for persistence
 * - useMutation handles the imperative streaming request
 * - queryClient.setQueryData updates cache progressively during stream
 * - Cached summaries are instantly available on re-visit
 *
 * Based on: https://github.com/TanStack/query/discussions/7723
 */

import { useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api/config";
import {
  createSummaryError,
  parseSummaryError,
  type SummaryError,
} from "@/lib/errors/summary";

export interface UsageData {
  remaining: number;
  limit: number;
  isPremium: boolean;
}

export interface UseSummaryOptions {
  url: string;
  language: string;
  onUsageUpdate?: (usage: UsageData) => void;
}

export interface UseSummaryResult {
  summary: string;
  isLoading: boolean;
  isStreaming: boolean;
  error: SummaryError | null;
  generate: (content: string, title?: string) => void;
  stop: () => void;
}

interface GenerateParams {
  content: string;
  title?: string;
  url: string;
  language: string;
}

export function normalizeSummaryError(errorInput: unknown): SummaryError {
  if (
    typeof errorInput === "object" &&
    errorInput &&
    "code" in errorInput &&
    typeof (errorInput as SummaryError).code === "string" &&
    "userMessage" in errorInput
  ) {
    return errorInput as SummaryError;
  }

  const parsed =
    errorInput instanceof Error
      ? parseSummaryError(errorInput)
      : typeof errorInput === "string"
        ? parseSummaryError(errorInput)
        : null;

  if (parsed) return parsed;
  return createSummaryError("GENERATION_FAILED");
}

async function* streamSummary(
  params: GenerateParams,
  signal: AbortSignal,
  onUsageUpdate?: (usage: UsageData) => void,
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(getApiUrl("/api/summary"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal,
    credentials: "include",
  });

  // Extract usage headers
  const remaining = response.headers.get("X-Usage-Remaining");
  const limit = response.headers.get("X-Usage-Limit");
  const premium = response.headers.get("X-Is-Premium");

  if (remaining !== null && limit !== null && onUsageUpdate) {
    onUsageUpdate({
      remaining: parseInt(remaining, 10),
      limit: parseInt(limit, 10),
      isPremium: premium === "true",
    });
  }

  if (!response.ok) {
    const errorData = await response.json();
    const error: SummaryError = {
      code: errorData.code || "GENERATION_FAILED",
      message: errorData.message || "Failed to generate summary",
      userMessage:
        errorData.userMessage || "Something went wrong. Please try again.",
      retryAfter: errorData.retryAfter,
      usage: errorData.usage,
      limit: errorData.limit,
    };
    throw error;
  }

  const reader = response.body?.getReader();
  if (!reader) throw createSummaryError("GENERATION_FAILED");

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } catch (error) {
    throw normalizeSummaryError(error);
  }
}

export function useSummary({
  url,
  language,
  onUsageUpdate,
}: UseSummaryOptions): UseSummaryResult {
  const queryClient = useQueryClient();
  const cacheKey = ["summary", url, language] as const;

  // Track streaming state separately (mutation isPending doesn't capture streaming phase)
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Read cached summary
  const { data: cachedSummary } = useQuery({
    queryKey: cacheKey,
    queryFn: () => queryClient.getQueryData<string>(cacheKey) ?? "",
    staleTime: Infinity, // Never refetch - we manage this manually
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
  });

  // Mutation for streaming generation
  const mutation = useMutation({
    mutationFn: async ({
      content,
      title,
    }: {
      content: string;
      title?: string;
    }) => {
      // Abort any existing request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Clear existing cache for this key
      queryClient.setQueryData(cacheKey, "");

      let fullText = "";
      setIsStreaming(true);

      try {
        for await (const chunk of streamSummary(
          { content, title, url, language },
          abortControllerRef.current.signal,
          onUsageUpdate,
        )) {
          fullText += chunk;
          // Progressively update cache - this triggers re-renders
          queryClient.setQueryData(cacheKey, fullText);
        }
      } finally {
        setIsStreaming(false);
      }

      return fullText;
    },
    onError: () => {
      setIsStreaming(false);
      // Keep partial text in cache if any was received
    },
  });

  const generate = useCallback(
    (content: string, title?: string) => {
      mutation.mutate({ content, title });
    },
    [mutation],
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  return {
    summary: cachedSummary ?? "",
    isLoading: mutation.isPending,
    isStreaming,
    error: mutation.error ? normalizeSummaryError(mutation.error) : null,
    generate,
    stop,
  };
}
