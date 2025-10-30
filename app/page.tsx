"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { CornerDownLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { z } from "zod";
import Github from "@/components/marketing/github";
import { Fira_Code } from "next/font/google";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Banner } from "@/components/marketing/banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { BookmarkletLink } from "@/components/marketing/bookmarklet";
import {PaperAirplaneIcon} from "@heroicons/react/24/solid"
import clsx from "clsx";
import { FAQ } from "@/components/marketing/faq";

const fira = Fira_Code({
  subsets: ["latin"],
});

const urlSchema = z.object({
  url: z.string().url().min(1),
});

export default function Home() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

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
      <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 text-black mt-28 sm:mt-0 bg-[#FAFAFA]">
        <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto z-10 sm:mt-16">
          <a
            className="flex max-w-fit items-center justify-center space-x-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm transition-colors hover:bg-gray-100 mb-10 mr-4"
            href="https://github.com/mrmps/SMRY"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github />
            <p>Star on GitHub</p>
          </a>
          <h1 className="text-4xl font-semibold text-center text-black md:text-5xl">
            <Image
              src="/logo.svg"
              width={280}
              height={280}
              alt={"smry logo"}
              className="-ml-4"
            />
          </h1>

          <form onSubmit={handleSubmit} className="mt-6 w-full">
            <div
              className={`${
                urlError ? "border-red-500" : ""
              } flex rounded-lg overflow-hidden bg-white shadow-sm border border-[#E5E5E5] focus-within:ring-offset-0 focus-within:ring-4 focus-within:ring-purple-200 focus-within:border-purple-500`}
            >
              <input
                className="w-full px-4 py-3 bg-transparent rounded-l-lg focus:outline-none shadow-lg p-4"
                ref={inputRef}
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
                className="px-4 py-2 font-mono transition-all duration-300 ease-in-out rounded-r-lg cursor-pointer"
                type="submit"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {/* Icon here */}

                <div className="hidden sm:block">
                  <CornerDownLeft
                    className={clsx(
                      "w-4 h-4 transition-transform duration-300 ease-in-out",
                      {
                        "text-black transform scale-110": isHovered,
                        "text-gray-800": isValidUrl(url),
                        "text-gray-400": !isValidUrl(url),
                      }
                    )}
                  />
                </div>
                <div className="sm:hidden">
                  <PaperAirplaneIcon
                    className={clsx(
                      "w-5 h-5 transition-transform duration-300 ease-in-out",
                      {
                        "text-black transform scale-110": isHovered,
                        "text-purple-500": isValidUrl(url),
                        "text-gray-400": !isValidUrl(url),
                      }
                    )}
                  />
                </div>
              </button>
            </div>
          </form>
          <h2 className="w-full text-center text-stone-700 mt-4">
            Bypass paywalls and get instant{" "}
            <Link href="/proxy?url=https://www.theatlantic.com/technology/archive/2017/11/the-big-unanswered-questions-about-paywalls/547091">
              <span className="border-b border-gray-400 transition-border duration-300 hover:border-black">
                summaries
              </span>
            </Link>
            .
          </h2>
          <p className="text-center text-sm text-stone-500 mt-2">
            by{" "}
            <a
              href="https://x.com/michael_chomsky"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-700 transition-colors border-b border-stone-300"
            >
              @michael_chomsky
            </a>
          </p>

          {urlError && (
            <p
              className="text-red-500 mt-2 flex items-center animate-fade-in"
              role="alert"
            >
              <ExclamationCircleIcon className="h-5 w-5 mr-2 text-red-500" />
              Please enter a valid URL (e.g., https://example.com).
            </p>
          )}

          <div className="mt-12 text-center max-w-2xl mx-auto space-y-4">
            <p className="text-stone-600 text-[15px] leading-relaxed">
              You can also use smry by prepending{" "}
              <code className="bg-yellow-200 px-2 py-0.5 rounded text-stone-700 font-mono text-xs">
                https://smry.ai/
              </code>{" "}
              to any URL.
            </p>
            
            <div className="hidden sm:block pt-2 border-t border-stone-200">
              <p className="text-stone-600 text-sm leading-relaxed">
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
