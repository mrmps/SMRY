export function createErrorResponse(
  message: string,
  status: number,
  details = {}
) {
  return new Response(
    JSON.stringify({
      source: "error",
      article: undefined,
      status: status.toString(),
      error: message,
      cacheURL: "",
      details: details,
    }),
    {
      headers: { "Content-Type": "application/json" },
      status,
    }
  );
}
