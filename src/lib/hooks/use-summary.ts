'use client';

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
import { useAuth } from "@clerk/clerk-react";

/**
 * Wrapper class to properly throw SummaryError as an Error object
 * This satisfies the @typescript-eslint/only-throw-error rule
 */
class SummaryErrorWrapper extends Error {
  public readonly summaryError: SummaryError;

  constructor(summaryError: SummaryError) {
    super(summaryError.message);
    this.name = 'SummaryErrorWrapper';
    this.summaryError = summaryError;
  }
}

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
  // Handle SummaryErrorWrapper
  if (errorInput instanceof SummaryErrorWrapper) {
    return errorInput.summaryError;
  }

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
  authToken?: string,
): AsyncGenerator<string, void, unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(getApiUrl("/api/summary"), {
    method: "POST",
    headers,
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
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      try {
        const errorData = (await response.json()) as Record<string, unknown>;
        const retryAfter = typeof errorData.retryAfter === 'number' ? errorData.retryAfter : undefined;
        const usage = typeof errorData.usage === 'number' ? errorData.usage : undefined;
        const limit = typeof errorData.limit === 'number' ? errorData.limit : undefined;
        const error: SummaryError = {
          code: (typeof errorData.code === 'string' ? errorData.code : "GENERATION_FAILED") as SummaryError['code'],
          message: typeof errorData.message === 'string' ? errorData.message : "Failed to generate summary",
          userMessage:
            typeof errorData.userMessage === 'string' ? errorData.userMessage : "Something went wrong. Please try again.",
          retryAfter,
          usage,
          limit,
        };
        throw new SummaryErrorWrapper(error);
      } catch (jsonError) {
        if (jsonError instanceof SummaryErrorWrapper) {
          throw jsonError;
        }
        throw new SummaryErrorWrapper(normalizeSummaryError(jsonError));
      }
    }

    const fallbackBody = await response.text().catch(() => "");
    throw new SummaryErrorWrapper(normalizeSummaryError(fallbackBody || response.statusText));
  }

  const reader = response.body?.getReader();
  if (!reader) throw new SummaryErrorWrapper(createSummaryError("GENERATION_FAILED"));

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } catch (error) {
    throw new SummaryErrorWrapper(normalizeSummaryError(error));
  }
}

export function useSummary({
  url,
  language,
  onUsageUpdate,
}: UseSummaryOptions): UseSummaryResult {
  const { getToken } = useAuth();
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

      let authToken: string | undefined;
      if (typeof getToken === "function") {
        try {
          authToken = (await getToken()) ?? undefined;
        } catch (error) {
          console.warn("Failed to retrieve auth token for summary request", error);
        }
      }

      try {
        for await (const chunk of streamSummary(
          { content, title, url, language },
          abortControllerRef.current.signal,
          onUsageUpdate,
          authToken,
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
