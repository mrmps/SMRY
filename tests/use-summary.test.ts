import { describe, expect, it } from "bun:test";
import {
  createSummaryError,
  SummaryError,
} from "@/lib/errors/summary";
import { normalizeSummaryError } from "@/lib/hooks/use-summary";

describe("normalizeSummaryError", () => {
  it("returns SummaryError instances unchanged", () => {
    const error = createSummaryError("GENERATION_FAILED");
    expect(normalizeSummaryError(error)).toBe(error);
  });

  it("parses JSON-encoded errors from Error.message", () => {
    const payload: SummaryError = {
      code: "RATE_LIMITED",
      message: "Too many requests",
      userMessage: "Please wait.",
      showUpgrade: false,
      retryAfter: 5,
    };
    const normalized = normalizeSummaryError(new Error(JSON.stringify(payload)));
    expect(normalized.code).toBe("RATE_LIMITED");
    expect(normalized.retryAfter).toBe(5);
  });

  it("falls back to generic error when parsing fails", () => {
    const normalized = normalizeSummaryError(new Error("unknown failure"));
    expect(normalized.code).toBe("GENERATION_FAILED");
    expect(normalized.message.length).toBeGreaterThan(0);
  });

  it("does not treat DOMException-like objects as SummaryError", () => {
    const domError = { name: "AbortError", code: 20 };
    const normalized = normalizeSummaryError(domError);
    expect(normalized.code).toBe("GENERATION_FAILED");
    expect(normalized.userMessage.length).toBeGreaterThan(0);
  });
});
