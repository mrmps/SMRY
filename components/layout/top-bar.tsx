"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import useScroll from "@/lib/hooks/use-scroll";
import ScrollProgress from "./scroll-progress";

const TopBar = () => {
  const [progress, setProgress] = useState(0);
  const isVisible = useScroll();

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
    <div>
      <div
        style={{ top: isVisible ? "0" : "-100px", transition: "top 0.3s" }}
        className="fixed top-0 z-10 w-full transition-transform bg-opacity-50 border-b border-gray-300 bg-white backdrop-filter backdrop-blur-md border-opacity-10"
      >
        <div className="flex items-center py-5 mx-auto max-w-prose">
          <h2 className="text-xl font-bold text-gray-800">
            <Link href="/">
              <Image
                src="/logo.svg"
                width={150}
                height={150}
                alt="smry logo"
                className="sm:-ml-4"
              />
            </Link>
          </h2>
        </div>
        <div
          className="absolute inset-x-0 h-px origin-left bg-gray-300"
          style={{ transform: "scaleX(1)" }}
        ></div>
        {/* Render the Scroll Progress component */}
        <ScrollProgress progress={progress} />
      </div>
      <div
        className={`fixed top-[1px] z-[60] w-full ${isVisible ? "hidden" : ""}`}
      >
        <ScrollProgress progress={progress} />
      </div>
    </div>
  );
};

export default TopBar;
