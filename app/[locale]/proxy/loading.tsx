"use client";

import Image from "next/image";

export default function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/logo.svg"
          width={100}
          height={32}
          alt="smry"
          className="h-8 w-auto dark:invert loader-logo"
          priority
        />
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-foreground/40 loader-dot-base loader-dot-1" />
          <span className="size-1.5 rounded-full bg-foreground/40 loader-dot-base loader-dot-2" />
          <span className="size-1.5 rounded-full bg-foreground/40 loader-dot-base loader-dot-3" />
        </div>
      </div>
    </div>
  );
}
