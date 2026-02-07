import { NextRequest, NextResponse } from "next/server";
import { getMarkdownForRoute } from "@/lib/llm/content";

export const runtime = "edge";

const BASE_URL = "https://smry.ai";

export async function GET(request: NextRequest) {
  const page = request.nextUrl.searchParams.get("page") || "/";
  const markdown = getMarkdownForRoute(page);

  if (!markdown) {
    return new NextResponse("Not found", { status: 404 });
  }

  const accept = request.headers.get("accept") || "";
  const contentType = accept.includes("text/plain")
    ? "text/plain; charset=utf-8"
    : "text/markdown; charset=utf-8";

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, s-maxage=3600, max-age=300",
      "X-Llms-Txt": `${BASE_URL}/llms.txt`,
      Link: `<${BASE_URL}/llms.txt>; rel="llms-txt"`,
      "X-Robots-Tag": "noindex, nofollow",
      Vary: "Accept",
    },
  });
}
