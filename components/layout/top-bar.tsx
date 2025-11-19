"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ScrollProgress from "./scroll-progress";

const TopBar = () => {
  const [progress, setProgress] = useState(0);

  const onScroll = () => {
    const scrollTop = document.documentElement.scrollTop;
    const scrollHeight =
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight;
    const scrollProgress = (scrollTop / scrollHeight) * 100;
    setProgress(scrollProgress);
  };

  useEffect(() => {
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="absolute inset-x-0 top-0 z-50"
    >
      <div className="w-full border-b border-gray-200/50 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-prose items-center justify-between p-4 sm:px-0">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Image
              src="/logo.svg"
              width={120}
              height={40}
              alt="smry logo"
              className="h-8 w-auto sm:-ml-4"
              priority
            />
          </Link>
        </div>
        
        {/* Scroll Progress - absolute positioned at bottom */}
        <div className="absolute inset-x-0 bottom-0">
          <ScrollProgress progress={progress} />
        </div>
      </div>
    </div>
  );
};

export default TopBar;
