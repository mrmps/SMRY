import { ArticleResponse, Source, ErrorResponse, ArticleAutoResponse, ArticleEnhancedResponse } from "@/types/api";
import { DebugContext } from "@/lib/errors/types";
import { getApiUrl } from "./config";

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

    const response = await fetch(getApiUrl(`/api/article?${params.toString()}`));

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

  /**
   * Fetch article using auto-selection (races all sources, returns first success)
   */
  async getArticleAuto(url: string): Promise<ArticleAutoResponse> {
    const params = new URLSearchParams({ url });

    const response = await fetch(getApiUrl(`/api/article/auto?${params.toString()}`));

    if (!response.ok) {
      const errorData: ErrorResponse = await response.json();
      throw new ArticleFetchError(
        errorData.error || `HTTP error! status: ${response.status}`,
        errorData
      );
    }

    const data = await response.json();
    return data as ArticleAutoResponse;
  },

  /**
   * Check if an enhanced (longer) version of the article is available
   * Call this after getArticleAuto returns mayHaveEnhanced: true
   */
  async getArticleEnhanced(
    url: string,
    currentLength: number,
    currentSource: Source
  ): Promise<ArticleEnhancedResponse> {
    const params = new URLSearchParams({
      url,
      currentLength: String(currentLength),
      currentSource,
    });

    const response = await fetch(getApiUrl(`/api/article/enhanced?${params.toString()}`));

    if (!response.ok) {
      // On error, just return not enhanced
      return { enhanced: false };
    }

    const data = await response.json();
    return data as ArticleEnhancedResponse;
  },
};

