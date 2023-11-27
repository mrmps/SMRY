"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExclamationCircleIcon,
  PaperAirplaneIcon as PaperOutline,
  DocumentTextIcon,
  LightBulbIcon,
  ClockIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { PaperAirplaneIcon as PaperSolid } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CardSpotlight } from "@/components/card-spotlight";
import { Unlock, Globe } from "lucide-react";
import { z } from "zod";
import Github from "@/components/github";
import { Fira_Code } from "next/font/google";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/banner";
import { SiteFooter } from "@/components/site-footer";
import { BookmarkletComponent } from "@/components/bookmarklet";
import clsx from "clsx";

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
      <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 text-black mt-36 sm:mt-0 bg-gradient-to-b from-white via-[#F7F7F7] to-white">
        <div className="absolute inset-0 h-full w-full bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)]"></div>

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
              } flex rounded-lg overflow-hidden bg-[#1C1C1C] backdrop-blur-lg`}
              style={{
                border: "1px solid rgba(0,0,0,0.15)",
                boxShadow:
                  "rgba(0, 0, 0, 0.1) 0px 2px 6px 0px, rgba(0, 0, 0, 0.08) 0px 8px 16px 0px",
              }}
            >
              <input
                className="w-full px-4 py-3 bg-transparent rounded-l-lg focus:outline-none text-white shadow-lg"
                ref={inputRef}
                autoComplete="off"
                placeholder="https://example.com/article"
                name="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (urlError) setUrlError(false);
                }}
              />
              <button
                className="px-4 py-2 font-mono transition-all duration-300 ease-in-out rounded-r-lg cursor-pointer shadow-sm"
                type="submit"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {/* Icon here */}

                <PaperSolid
                  className={clsx(
                    "w-5 h-5 transition-transform duration-300 ease-in-out",
                    {
                      "text-white transform rotate-6 scale-110": isHovered,
                      "text-gray-200": isValidUrl(url),
                      "text-gray-500": !isValidUrl(url),
                    }
                  )}
                />
              </button>
            </div>
          </form>
          <h2 className="w-full text-center text-stone-700 mt-4">
            Read any online article and instantly get the{" "}
            <Link href="/proxy?url=https://www.nytimes.com/2023/11/11/us/hawaii-kaelia-pond-pink.html">
              <span className="border-b border-gray-400 transition-border duration-300 hover:border-black">
                summary.
              </span>
            </Link>
          </h2>

          <h3 className="mt-24 text-center text-lg font-semibold text-gray-800">
            OR
            <span className="ml-3 text-gray-700 hover:text-gray-900 inline-block">
              <span
                className={cn(
                  "bg-white text-gray-700 font-mono py-2 px-4 rounded-md border border-zinc-200",
                  fira.className
                )}
                style={{
                  lineHeight: "1.4",
                  fontSize: "0.875rem",
                }}
              >
                https://smry.ai/
                <span
                  className="bg-[#FBF719] text-gray-700 px-2 py-1 rounded"
                  style={{ fontWeight: "500" }}
                >
                  &lt;URL&gt;
                </span>
              </span>
            </span>
          </h3>

          {urlError && (
            <p
              className="text-red-500 mt-2 flex items-center animate-fade-in"
              role="alert"
            >
              <ExclamationCircleIcon className="h-5 w-5 mr-2 text-red-500" />
              Please enter a valid URL (e.g., https://example.com).
            </p>
          )}
        </div>
        <BookmarkletComponent />

        <Banner />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <CardSpotlight
            heading="Quick Summaries"
            body="Get concise summaries of long articles in seconds."
            icon={<DocumentTextIcon className="h-4 w-4 text-neutral-600" />}
          />
          <CardSpotlight
            heading="Paywall Bypass"
            body="Access content behind paywalls without hassle."
            icon={<Unlock className="h-4 w-4 text-neutral-600" />}
          />
          <CardSpotlight
            heading="AI Powered"
            body="Leverage advanced AI to understand content contextually."
            icon={<LightBulbIcon className="h-4 w-4 text-neutral-600" />}
          />
          <CardSpotlight
            heading="Browser Friendly"
            body="Easily use our tool with your favorite web browser."
            icon={<Globe className="h-4 w-4 text-neutral-600" />}
          />
          <CardSpotlight
            heading="Save Time"
            body="Read less, learn more. Save time on extensive articles."
            icon={<ClockIcon className="h-4 w-4 text-neutral-600" />}
          />
          <CardSpotlight
            heading="User-Friendly Interface"
            body="Enjoy a seamless, intuitive interface for easy navigation."
            icon={<UserCircleIcon className="h-4 w-4 text-neutral-600" />}
          />
        </div>
      </main>

      <div className="container flex-1">
        <SiteFooter className="border-t" />
      </div>
    </>
  );
}
