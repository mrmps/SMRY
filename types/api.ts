import { z } from "zod";
import { AppError } from "@/lib/errors";

// Source type
export const SourceSchema = z.enum(["direct", "wayback", "jina.ai"]);
export type Source = z.infer<typeof SourceSchema>;

// Article schema
export const ArticleSchema = z.object({
  title: z.string(),
  byline: z.string().nullable(),
  dir: z.string().nullable(),
  lang: z.string().nullable(),
  content: z.string(),
  textContent: z.string(),
  length: z.number().int().nonnegative(),
  siteName: z.string().nullable(),
});
export type Article = z.infer<typeof ArticleSchema>;

// API Request schema
export const ArticleRequestSchema = z.object({
  url: z.string().url("Invalid URL format"),
  source: SourceSchema,
});
export type ArticleRequest = z.infer<typeof ArticleRequestSchema>;

// API Response schema
export const ArticleResponseSchema = z.object({
  source: SourceSchema,
  cacheURL: z.string(),
  article: ArticleSchema.optional(),
  status: z.string().optional(),
  error: z.string().optional(),
});
export type ArticleResponse = z.infer<typeof ArticleResponseSchema>;

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  type: z.string().optional(),
  details: z.any().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Summary request schema
export const SummaryRequestSchema = z.object({
  content: z.string().min(100, "Content must be at least 100 characters"),
  title: z.string().optional(),
  url: z.string().optional(),
  ip: z.string().optional(),
  language: z.string().optional().default("en"),
});
export type SummaryRequest = z.infer<typeof SummaryRequestSchema>;

// Summary response schema
export const SummaryResponseSchema = z.object({
  summary: z.string(),
  cached: z.boolean().optional(),
});
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

// Jina cache GET request schema
export const JinaCacheRequestSchema = z.object({
  url: z.string().url("Invalid URL format"),
});
export type JinaCacheRequest = z.infer<typeof JinaCacheRequestSchema>;

// Jina cache POST/update schema
export const JinaCacheUpdateSchema = z.object({
  url: z.string().url("Invalid URL format"),
  article: z.object({
    title: z.string(),
    content: z.string(),
    textContent: z.string(),
    length: z.number().int().positive(),
    siteName: z.string(),
  }),
});
export type JinaCacheUpdate = z.infer<typeof JinaCacheUpdateSchema>;

// Available languages
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "pt", name: "Português" },
  { code: "ru", name: "Русский" },
] as const;

