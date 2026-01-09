"use client";

import React from "react";
import { LocalizedLink as Link } from "@/i18n/navigation";
import { motion, useScroll, useSpring, MotionProps } from "framer-motion";
import useLocalStorage from "@/lib/hooks/use-local-storage";
import { ModeToggle } from "@/components/shared/mode-toggle";

const TopBar = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });
  
  // Get view mode to conditionally show scroll progress
  const [viewMode] = useLocalStorage<"markdown" | "html" | "iframe">("article-view-mode", "markdown");
  const isReaderView = viewMode === "markdown";

  // Fix for framer-motion type issue with className
  const ProgressDiv = motion.div as React.FC<MotionProps & React.HTMLAttributes<HTMLDivElement>>;

  return (
    <div
      className="absolute inset-x-0 top-0 z-50"
    >
      <div className="w-full border-b border-gray-200/50 bg-white/80 backdrop-blur-md dark:bg-zinc-950/80 dark:border-zinc-800/50">
        <div className="mx-auto flex h-11 max-w-prose items-center justify-between px-3 sm:px-0">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <img
              src="/logo.svg"
              alt="smry logo"
              className="h-6 w-auto sm:-ml-3 dark:invert"
            />
          </Link>
          <ModeToggle />
        </div>
        
        {/* Scroll Progress - fixed at the top of the screen for reader view */}
        {isReaderView && (
          <ProgressDiv
            className="fixed left-0 top-0 z-100 h-[2px] w-full origin-left bg-[#595959] dark:bg-zinc-400"
            style={{ scaleX } as React.CSSProperties}
          />
        )}
      </div>
    </div>
  );
};

export default TopBar;
