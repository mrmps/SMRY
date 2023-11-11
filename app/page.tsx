"use client";

import { useState } from "react";
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

  const [isHovered, setIsHovered] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-white text-black mt-36 sm:mt-0">
      <div className="absolute inset-0 bg-[url(https://play.tailwindcss.com/img/grid.svg)] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] z-0"></div>


      <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto z-10 sm:mt-16">
      <a
          className="flex max-w-fit items-center justify-center space-x-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 shadow-md transition-colors hover:bg-gray-100 mb-10 mr-4"
          href="https://github.com/Nutlope/twitterbio"
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
              urlError ? "border-red-500" : "border-[#b6c8d4]"
            } flex rounded-lg overflow-hidden bg-gradient-to-r from-zinc-100 to-[#e0f2fe66] backdrop-blur-lg shadow-md border`}
          >
            <input
              className="w-full px-4 py-3 bg-transparent rounded-l-lg focus:outline-none shadow-sm backdrop-blur-lg  hover:backdrop-blur-xl"
              style={{ backdropFilter: "saturate(150%) blur(15px)" }}
              autoComplete="off"
              placeholder="Enter article URL"
              name="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) setUrlError(false);
              }}
            />
            <button
              className="px-4 py-2 font-mono transition-all duration-300 ease-in-out rounded-r-lg cursor-pointer hover:bg-[#dae7f1] bg-[#e0f2fe66] shadow-sm"
              type="submit"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Icon here */}

              {isHovered ? (
                <PaperSolid className="w-5 h-5 text-stone-700 transform transition-transform duration-300 ease-in-out rotate-12 scale-110" />
              ) : (
                <PaperOutline className="w-5 h-5 text-stone-700" />
              )}
            </button>
          </div>
        </form>
        <h2 className="w-full text-center text-stone-700 mt-2">
          Read any online article and instantly get the summary.
        </h2>
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

      <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
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
  );
}
