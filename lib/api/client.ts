import { ArticleResponse, ArticleRequest, Source, ErrorResponse } from "@/types/api";
import { DebugContext } from "@/lib/errors/types";

/**
 * Custom error that includes debug context
 */
export class ArticleFetchError extends Error {
  public debugContext?: DebugContext;
  public errorType?: string;
  public details?: any;

  constructor(message: string, errorData?: ErrorResponse) {
    super(message);
    this.name = 'ArticleFetchError';
    this.debugContext = errorData?.debugContext;
    this.errorType = errorData?.type;
    this.details = errorData?.details;
  }
}

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
      const errorData: ErrorResponse = await response.json();
      // Throw custom error that preserves debug context
      throw new ArticleFetchError(
        errorData.error || `HTTP error! status: ${response.status}`,
        errorData
      );
    }

    const data = await response.json();
    return data as ArticleResponse;
  },
};

