"use client";

import { useState } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Home() {
  const [url, setUrl] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    router.push(`/proxy?url=${encodeURIComponent(url)}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4sm:p-24 bg-white text-black">
      {/* <Image
        src="/bg.png"
        alt=""
        className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
        fill
      /> */}
      <div className="absolute inset-0 bg-[url(https://play.tailwindcss.com/img/grid.svg)] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] z-0"></div>

      <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto z-10">
        <h1 className="text-4xl font-semibold text-center text-black md:text-5xl">
          SMRY
        </h1>
        <form className="flex mt-6 w-full" onSubmit={handleSubmit}>
          <input
            className="w-full px-4 py-3 bg-white border border-r-0 rounded-l-lg transition focus:outline-none border-stone-300"
            autoComplete="off"
            placeholder="Enter article URL"
            name="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className="px-4 py-2 font-mono transition bg-white border border-l-0 rounded-r-lg cursor-pointer hover:bg-stone-100 border-stone-300"
            type="submit"
          >
            <PaperAirplaneIcon className="w-5 h-5 text-stone-700" />
          </button>
        </form>
        <h2 className="w-full text-center text-stone-800 mt-2">
          Read any online article and instantly get the summary.
        </h2>
      </div>
    </main>
  );
}
