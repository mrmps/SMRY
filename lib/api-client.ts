import { ArticleResponse, ArticleRequest, Source } from "@/types/api";

/**
 * Type-safe API client for fetching articles
 */
export const articleAPI = {
  /**
   * Fetch article from a specific source
   */
  async getArticle(url: string, source: Source): Promise<ArticleResponse> {
    const params = new URLSearchParams({
      url,
      source,
    });

    const response = await fetch(`/api/article?${params.toString()}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data as ArticleResponse;
  },
};

