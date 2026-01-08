import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header Skeleton */}
      <header className="z-30 flex h-14 shrink-0 items-center border-b border-border/40 bg-background px-4">
        {/* Left: Logo + View Mode Pills */}
        <div className="flex items-center gap-3 shrink-0">
          <Skeleton className="h-6 w-20" />
          {/* View mode pills - desktop only */}
          <div className="hidden md:flex items-center p-1 bg-muted rounded-xl">
            <Skeleton className="h-7 w-[180px]" />
          </div>
        </div>

        {/* Center: Spacer */}
        <div className="flex-1" />

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
          <div className="hidden md:block w-px h-5 bg-border/60 mx-1" />
          <Skeleton className="hidden md:block size-8 rounded-md" />
          <Skeleton className="hidden md:block size-8 rounded-md" />
          <Skeleton className="size-7 rounded-full" />
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto overscroll-y-none bg-card pb-20 lg:pb-0">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 min-h-[calc(100vh-3.5rem)]">
            {/* Tabs/Source Selector Skeleton */}
            <div className="sticky top-0 z-20 mb-4">
               <Skeleton className="h-10 w-full sm:w-[400px] rounded-xl" />
            </div>

            {/* Article Content Skeleton */}
            <div className="mt-2">
              {/* Article Header - matches content.tsx structure */}
              <div className="mb-8 space-y-6 border-b border-border pb-6">
                {/* Favicon + Site Name */}
                <div className="flex items-center gap-3">
                  <Skeleton className="size-5 rounded-sm" />
                  <Skeleton className="h-4 w-24" />
                </div>

                {/* Title */}
                <Skeleton className="h-10 w-full sm:h-12 sm:w-4/5" />

                {/* Metadata Row: byline • read time | date */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>

              {/* Article Body - prose content */}
              <div className="space-y-4 mt-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[88%]" />
              </div>

              <div className="space-y-4 pt-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[92%]" />
                <Skeleton className="h-4 w-[98%]" />
                <Skeleton className="h-4 w-[85%]" />
              </div>

              <div className="space-y-4 pt-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[94%]" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[78%]" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
