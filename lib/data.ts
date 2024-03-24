
import { track } from "@vercel/analytics/server";
import { ResponseItem } from "@/app/proxy/page";
import { getUrlWithSource } from "@/app/api/direct/route";
export type Source = "direct" | "google" | "wayback";


export async function getData(url: string, source: Source) {
    const urlBase = new URL(url).hostname;
    // track("Search", { urlBase: urlBase, fullUrl: url });
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_URL}/api/direct?url=${encodeURIComponent(
        url
      )}&source=${source}`
    );

    if (!res.ok) {
      // This will activate the closest `error.js` Error Boundary, but first we log it to analytics
      // track("Error", { urlBase: urlBase, fullUrl: url, status: res.status, source: source, error: res.statusText });
      return {
        source: source,
        article: undefined,
        status: res.status.toString(),
        error: res.statusText,
        cacheURL: getUrlWithSource(source, url),
      } as ResponseItem;
      // throw new Error(`Error fetching data: ${res.statusText} for ${url} from ${source}`);
    }
  
    return res.json();
  }
  