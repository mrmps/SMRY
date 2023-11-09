import { EyeIcon } from "lucide-react";
import {
  AdjustmentsHorizontalIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

type PageData = {
  title: string;
  byline: null | string;  // Assuming 'byline' can be a string as well
  dir: null | string;     // Assuming 'dir' can be a string as well
  lang: string;
  content: string;
  textContent: string;
  length: number;
  excerpt: string;
  siteName: null | string; // Assuming 'siteName' can be a string as well
};


async function getData(url: string) {
  const res = await fetch(`http://localhost:3001/api/getCache?url=${encodeURIComponent(url)}`);
  // The return value is *not* serialized
  // You can return Date, Map, Set, etc.

  if (!res.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Failed to fetch data");
  }

  return res.json();
}

// Replace the respective SVGs with these components
export default async function Page({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const url =
    typeof searchParams["url"] === "string" ? searchParams["url"] : null;

  if (!url) {
    // Handle the case where URL is not provided or not a string
    console.error("URL parameter is missing or invalid");
    return;
  }

  const content: PageData = await getData(url);

  return (
    <div className="px-4 py-8 md:py-12 mt-20">
      <div className="mx-auto space-y-10 max-w-prose">
        <main className="prose">
          <article>
            <h1>{content.title}</h1>
            <div className="leading-3 text-gray-600 flex space-x-4 items-center -ml-4 -mt-4 flex-wrap">
              <div className="flex items-center mt-4 ml-4 space-x-1.5">
                <GlobeAltIcon className="w-4 h-4 text-gray-600" />
                <Link
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gray-600 hover:text-gray-400 transition"
                >
                  {(new URL(url)).hostname}
                </Link>
              </div>
              <div className="flex items-center mt-4 ml-4 space-x-1.5">
                <EyeIcon className="w-4 h-4 text-gray-600" />
                <div>2</div>
              </div>
            </div>

            <div dangerouslySetInnerHTML={{ __html: content.content }} />
          </article>
        </main>
      </div>
    </div>
  );
}
