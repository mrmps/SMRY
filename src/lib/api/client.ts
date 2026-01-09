import { ArticleResponse, Source, ErrorResponse } from "@/types/api";
import { DebugContext } from "@/lib/errors/types";
import { api } from "@/lib/eden";

/**
 * Custom error that includes debug context
 */
export class ArticleFetchError extends Error {
  public debugContext?: DebugContext;
  public errorType?: string;
  public details?: unknown;

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
 * Uses Eden Treaty - isomorphic client that works on both server and client
 */
export const articleAPI = {
  /**
   * Fetch article from a specific source
   */
  async getArticle(url: string, source: Source): Promise<ArticleResponse> {
    const client = await api();
    const { data, error } = await client.api.article.get({
      query: { url, source },
    });

    if (error) {
      const errorData = error as unknown as ErrorResponse;
      throw new ArticleFetchError(
        errorData?.error ?? `Failed to fetch article`,
        errorData
      );
    }

    return data as ArticleResponse;
  },
};

