import { z } from "zod";

const KnownErrorSchema = z.object({
    message: z.string(),
    status: z.number(),
    error: z.string(),
    details: z.record(z.string()).optional(),
  });
  
  const UnknownErrorSchema = z.object({
    message: z.string(),
    error: z.string().optional(),
  });

export function safeError(error: unknown) {
    const knownErrorResult = KnownErrorSchema.safeParse(error);
    if (knownErrorResult.success) {
      return knownErrorResult.data;
    }
  
    const unknownErrorResult = UnknownErrorSchema.safeParse(error);
    if (unknownErrorResult.success) {
      return { ...unknownErrorResult.data, status: 500 };
    }
  
    console.error("Invalid error object:", error);
    return {
      message: "An unexpected error occurred.",
      status: 500,
      error: "Internal Server Error",
    };
  }
  