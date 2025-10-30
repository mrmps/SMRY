"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import useLocalStorage from "./use-local-storage";
import { Source } from "@/types/api";

interface SummaryParams {
  content: string;
  title: string;
  url: string;
  ip: string;
  language: string;
  source: Source;
}

interface SummaryResponse {
  summary: string;
  cached?: boolean;
}

async function generateSummary(params: SummaryParams): Promise<SummaryResponse> {
  const response = await fetch("/api/summary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: params.content,
      title: params.title,
      url: params.url,
      ip: params.ip,
      language: params.language,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to generate summary");
  }

  return response.json();
}

/**
 * Hook for auto-generating summary on mount using useQuery pattern
 * Automatically runs when enabled, no useEffect needed
 */
export function useAutoSummary(params: SummaryParams | null, enabled: boolean) {
  return useQuery({
    queryKey: ["summary", params?.url, params?.language, params?.source],
    queryFn: () => generateSummary(params!),
    enabled: enabled && params !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
}

/**
 * Hook for manual summary regeneration using useMutation pattern
 */
export function useRegenerateSummary() {
  // Persist language preference in localStorage
  const [preferredLanguage, setPreferredLanguage] = useLocalStorage<string>(
    "summary-language",
    "en"
  );

  const mutation = useMutation<SummaryResponse, Error, SummaryParams>({
    mutationFn: generateSummary,
  });

  return {
    regenerate: mutation.mutate,
    isRegenerating: mutation.isPending,
    error: mutation.error,
    preferredLanguage,
    setPreferredLanguage,
  };
}

