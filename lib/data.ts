
import { track } from "@vercel/analytics/server";
export type Source = "direct" | "google" | "wayback";

export async function getData(url: string, source: Source) {
    const urlBase = new URL(url).hostname;
    track("Search", { urlBase: urlBase, fullUrl: url });
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_URL}/api/direct?url=${encodeURIComponent(
        url
      )}&source=${source}`
    );
  
    return res.json();
  }
  