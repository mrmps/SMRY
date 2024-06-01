import { ResponseItem } from "@/app/proxy/page";
import { getUrlWithSource } from "@/lib/get-url-with-source";
export type Source = "direct" | "google" | "wayback" | "archive";

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


export async function getData(url: string, source: Source): Promise<ResponseItem | any> {
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_URL}/api/direct?url=${encodeURIComponent(url)}&source=${source}`
        );

        if (!res.ok) {
            const data = await res.json();
            return {
                ...data,
            }
        }

        return await res.json();
    } catch (error) {
        return createErrorResponse(
            "Failed to fetch data",
            500,
            { cacheURL: getUrlWithSource(source, url) }
        );
    }
}
  