"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useSpring, MotionProps } from "framer-motion";
import useLocalStorage from "@/lib/hooks/use-local-storage";
import dynamic from "next/dynamic";

const ModeToggle = dynamic(
  () => import("@/components/shared/mode-toggle").then((mod) => mod.ModeToggle),
  { ssr: false, loading: () => <div className="size-7" /> }
);

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
      <div className="w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-11 max-w-prose items-center justify-between px-3 sm:px-0">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Image
              src="/logo.svg"
              width={120}
              height={40}
              alt="smry logo"
              className="h-6 w-auto sm:-ml-3 dark:invert"
              priority
            />
          </Link>
          <ModeToggle />
        </div>
        
        {/* Scroll Progress - fixed at the top of the screen for reader view */}
        {isReaderView && (
          <ProgressDiv 
            className="fixed left-0 top-0 z-100 h-[2px] w-full origin-left bg-foreground-muted"
            style={{ scaleX } as any}
          />
        )}
      </div>
    </div>
  );
};

export default TopBar;
