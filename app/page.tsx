"use client";

import { useState } from "react";
import {
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { CornerDownLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { z } from "zod";
import { GitHubStarsButton } from "@/components/ui/shadcn-io/github-stars-button";
import Link from "next/link";
import { Banner } from "@/components/marketing/banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { BookmarkletLink } from "@/components/marketing/bookmarklet";
import {PaperAirplaneIcon} from "@heroicons/react/24/solid"
import clsx from "clsx";
import { FAQ } from "@/components/marketing/faq";

const urlSchema = z.object({
  url: z.string().url().min(1),
});

export default function Home() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    try {
      urlSchema.parse({ url });
      setUrlError(false);
      router.push(`/proxy?url=${encodeURIComponent(url)}`);
    } catch (error) {
      setUrlError(true);
      console.error(error);
    }
  };

  const isValidUrl = (url: string) => {
    const { success } = urlSchema.safeParse({ url });
    return success;
  };

  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <main className="flex min-h-screen flex-col items-center bg-[#FAFAFA] p-4 pt-20 text-black sm:pt-24 md:p-24">
        <div className="z-10 mx-auto flex w-full max-w-lg flex-col items-center justify-center sm:mt-16">
          <GitHubStarsButton
            username="mrmps"
            repo="SMRY"
            formatted={true}
            className="mb-10 mr-4"
          />
          <h1 className="text-center text-4xl font-semibold text-black md:text-5xl">
            <Image
              src="/logo.svg"
              width={280}
              height={280}
              alt={"smry logo"}
              className="-ml-4"
              priority
            />
          </h1>

          <form onSubmit={handleSubmit} className="mt-6 w-full">
            <div
              className={`${
                urlError ? "border-red-500" : ""
              } flex overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-sm focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-200 focus-within:ring-offset-0`}
            >
              <input
                className="w-full rounded-l-lg bg-transparent p-4 py-3 shadow-lg focus:outline-none"
                autoFocus
                autoComplete="off"
                placeholder="https://example.com/page"
                name="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (urlError) setUrlError(false);
                }}
              />
              <button
                className="cursor-pointer rounded-r-lg px-4 py-2 font-mono transition-all duration-300 ease-in-out"
                type="submit"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {/* Icon here */}

                <div className="hidden sm:block">
                  <CornerDownLeft
                    className={clsx(
                      "size-4 transition-transform duration-300 ease-in-out",
                      {
                        "text-black scale-110": isHovered,
                        "text-gray-800": isValidUrl(url),
                        "text-gray-400": !isValidUrl(url),
                      }
                    )}
                  />
                </div>
                <div className="sm:hidden">
                  <PaperAirplaneIcon
                    className={clsx(
                      "size-5 transition-transform duration-300 ease-in-out",
                      {
                        "text-black scale-110": isHovered,
                        "text-purple-500": isValidUrl(url),
                        "text-gray-400": !isValidUrl(url),
                      }
                    )}
                  />
                </div>
              </button>
            </div>
          </form>
          <h2 className="mt-4 w-full text-center text-stone-700">
            Bypass paywalls and get instant{" "}
            <Link href="/proxy?url=https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091">
              <span className="transition-border border-b border-gray-400 duration-300 hover:border-black">
                summaries
              </span>
            </Link>
            .
          </h2>
          <p className="mt-2 text-center text-sm text-stone-500">
            by{" "}
            <a
              href="https://x.com/michael_chomsky"
              target="_blank"
              rel="noopener noreferrer"
              className="border-b border-stone-300 transition-colors hover:text-stone-700"
            >
              @michael_chomsky
            </a>
          </p>

          {urlError && (
            <p
              className="animate-fade-in mt-2 flex items-center text-red-500"
              role="alert"
            >
              <ExclamationCircleIcon className="mr-2 size-5 text-red-500" />
              Please enter a valid URL (e.g., https://example.com).
            </p>
          )}

          <div className="mx-auto mt-12 max-w-2xl space-y-4 text-center">
            <p className="text-[15px] leading-relaxed text-stone-600">
              You can also use smry by prepending{" "}
              <code className="rounded bg-yellow-200 px-2 py-0.5 font-mono text-xs text-stone-700">
                https://smry.ai/
              </code>{" "}
              to any URL.
            </p>
            
            <div className="hidden border-t border-stone-200 pt-2 sm:block">
              <p className="text-sm leading-relaxed text-stone-600">
                For quick access, bookmark this <BookmarkletLink />. Drag it to your bookmarks bar, 
                then click it on any page to open in SMRY.
              </p>
            </div>
          </div>
        </div>

        <Banner />
        <FAQ />
      </main>

      <div className="container flex-1 bg-[#FAFAFA]">
        <SiteFooter className="border-t" />
      </div>
    </>
  );
}
