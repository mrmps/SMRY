import { z } from "zod";
import { NormalizedUrlSchema } from "@/lib/validation/url";

// Source type
export const SOURCES = [
  "smry-fast",
  "smry-slow",
  "wayback",
] as const;
export const SourceSchema = z.enum(SOURCES);
export type Source = z.infer<typeof SourceSchema>;

// Debug context schema
export const DebugStepSchema = z.object({
  step: z.string(),
  timestamp: z.string(),
  status: z.enum(["success", "error", "warning", "info"]),
  message: z.string(),
  data: z.any().optional(),
});

export const DebugContextSchema = z.object({
  timestamp: z.string(),
  url: z.string(),
  source: z.string(),
  steps: z.array(DebugStepSchema),
});

// Paywall detection schema (frontend-only, based on error state)
export const PaywallBypassStatusSchema = z.enum(["success", "blocked"]);
export type PaywallBypassStatus = z.infer<typeof PaywallBypassStatusSchema>;

// Bypass detection status (attached to article for instant results on reload)
export const BypassStatusSchema = z.enum(["bypassed", "blocked", "uncertain"]);
export type BypassStatus = z.infer<typeof BypassStatusSchema>;

// Article schema
export const ArticleSchema = z.object({
  title: z.string(),
  byline: z.string().nullable().optional(),
  dir: z.enum(["rtl", "ltr"]).default("ltr"),
  lang: z.string().nullable().optional(),
  content: z.string(),
  textContent: z.string(),
  length: z.number().int().nonnegative(),
  siteName: z.string().nullable().optional(),
  publishedTime: z.string().nullable().optional(),
  image: z.string().nullable().optional(), // Preview image URL
  htmlContent: z.string().optional(), // Original page HTML (full DOM)
  // Bypass detection (cached with article for instant results on reload)
  bypassStatus: BypassStatusSchema.optional(),
});
export type Article = z.infer<typeof ArticleSchema>;

// API Request schema
export const ArticleRequestSchema = z.object({
  url: NormalizedUrlSchema,
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
  debugContext: DebugContextSchema.optional(),
});
export type ArticleResponse = z.infer<typeof ArticleResponseSchema>;

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  type: z.string().optional(),
  details: z.any().optional(),
  debugContext: DebugContextSchema.optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Summary request schema
export const SummaryRequestSchema = z
  .object({
    content: z.string().min(100, "Content must be at least 100 characters").optional(),
    prompt: z.string().min(100, "Prompt must be at least 100 characters").optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    ip: z.string().optional(),
    language: z.string().optional().default("en"),
  })
  .refine((data) => Boolean(data.content || data.prompt), {
    message: "Either content or prompt must be provided",
    path: ["content"],
  });
export type SummaryRequest = z.infer<typeof SummaryRequestSchema>;

// Summary response schema
export const SummaryResponseSchema = z.object({
  summary: z.string(),
  cached: z.boolean().optional(),
});
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;


// Available languages with display names and AI prompts
// This is the single source of truth for language configuration
export const LANGUAGES = [
  { code: "en", name: "English", prompt: "" },
  { code: "es", name: "Español", prompt: "Responde siempre en español." },
  { code: "fr", name: "Français", prompt: "Réponds toujours en français." },
  { code: "de", name: "Deutsch", prompt: "Antworte immer auf Deutsch." },
  { code: "zh", name: "中文", prompt: "请用中文回答。" },
  { code: "ja", name: "日本語", prompt: "日本語で回答してください。" },
  { code: "pt", name: "Português", prompt: "Responda sempre em português." },
  { code: "ru", name: "Русский", prompt: "Всегда отвечай на русском языке." },
  { code: "hi", name: "हिन्दी", prompt: "कृपया हमेशा हिंदी में उत्तर दें।" },
  { code: "it", name: "Italiano", prompt: "Rispondi sempre in italiano." },
  { code: "ko", name: "한국어", prompt: "항상 한국어로 답변해 주세요." },
  { code: "ar", name: "العربية", prompt: "أجب دائماً باللغة العربية." },
  {
    code: "nl",
    name: "Nederlands",
    prompt: "Antwoord altijd in het Nederlands.",
  },
  { code: "tr", name: "Türkçe", prompt: "Her zaman Türkçe olarak yanıt ver." },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

// Helper to get language prompt by code
export function getLanguagePrompt(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.prompt ?? "";
}

// =============================================================================
// Context API (ad serving) - POST /api/context
// =============================================================================

// Device info for ad targeting
export const ContextDeviceSchema = z.object({
  timezone: z.string().optional(),
  locale: z.string().optional(),
  language: z.string().optional(),
  ua: z.string().optional(),
  os: z.string().optional(),
  browser: z.string().optional(),
  deviceType: z.enum(["desktop", "mobile", "tablet"]).optional(),
  screenWidth: z.number().optional(),
  screenHeight: z.number().optional(),
  viewportWidth: z.number().optional(),
  viewportHeight: z.number().optional(),
});
export type ContextDevice = z.infer<typeof ContextDeviceSchema>;

// User info for ad targeting
export const ContextUserSchema = z.object({
  id: z.string().optional(),
  email: z.string().optional(),
});
export type ContextUser = z.infer<typeof ContextUserSchema>;

// Request body for /api/context
export const ContextRequestSchema = z.object({
  url: z.string(),
  title: z.string(),
  articleContent: z.string(), // The actual article text (truncated to ~4000 chars)
  sessionId: z.string(),
  device: ContextDeviceSchema.optional(),
  user: ContextUserSchema.optional(),
  // Additional article metadata for better ad targeting
  byline: z.string().optional(), // Author name
  siteName: z.string().optional(), // Publisher name
  publishedTime: z.string().optional(), // Publication date
  lang: z.string().optional(), // Article language
  prompt: z.string().optional(), // Extra instruction for ad generation (e.g. "keep it short")
});
export type ContextRequest = z.infer<typeof ContextRequestSchema>;

// Ad data from Gravity
export const ContextAdSchema = z.object({
  adText: z.string(),
  title: z.string(),
  clickUrl: z.string(),
  impUrl: z.string(),
  brandName: z.string(),
  url: z.string().optional(),
  favicon: z.string().optional(),
  cta: z.string().optional(),
});
export type ContextAd = z.infer<typeof ContextAdSchema>;

// Response status for /api/context - tells client WHY there's no ad
export const ContextResponseStatusSchema = z.enum([
  "filled",        // Ad was returned successfully
  "no_fill",       // Gravity had no matching ad
  "premium_user",  // User is premium, no ads shown
  "gravity_error", // Gravity API returned an error
  "timeout",       // Request to Gravity timed out
  "error",         // Unexpected error on our end
]);
export type ContextResponseStatus = z.infer<typeof ContextResponseStatusSchema>;

// Full response from /api/context
export const ContextResponseSchema = z.object({
  status: ContextResponseStatusSchema,
  ad: ContextAdSchema.optional(),
  ads: z.array(ContextAdSchema).optional(),
  // Debug info (only included when no ad)
  debug: z.object({
    gravityStatus: z.number().optional(),
    errorMessage: z.string().optional(),
  }).optional(),
});
export type ContextResponse = z.infer<typeof ContextResponseSchema>;
