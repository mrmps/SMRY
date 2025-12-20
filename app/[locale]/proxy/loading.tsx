import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 px-4 backdrop-blur-xl supports-backdrop-filter:bg-background/60">
        {/* Logo Placeholder */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20" />
              </div>

        {/* Desktop Pills Placeholder */}
        <div className="hidden md:flex items-center p-0.5 bg-accent rounded-lg absolute left-1/2 -translate-x-1/2">
          <Skeleton className="h-7 w-[200px]" />
            </div>

        {/* Actions Placeholder */}
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="hidden md:block h-8 w-24 rounded-md" />
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto bg-card">
          <div className="mx-auto max-w-3xl p-6 min-h-[calc(100vh-3.5rem)]">
            {/* Tabs/Source Selector Skeleton */}
            <div className="sticky top-0 z-20 mb-8">
               <Skeleton className="h-10 w-full sm:w-[400px] rounded-xl" />
            </div>

            {/* Article Content Skeleton */}
            <div className="space-y-8 animate-pulse">
              {/* Title Area */}
              <div className="space-y-4">
                <Skeleton className="h-10 w-3/4 sm:w-2/3" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>

              {/* Hero Image Placeholder */}
              <Skeleton className="w-full aspect-video rounded-lg" />

              {/* Text Content */}
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
                <Skeleton className="h-4 w-full" />
              </div>
              
              <div className="space-y-4 pt-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[92%]" />
                <Skeleton className="h-4 w-[98%]" />
                <Skeleton className="h-4 w-[85%]" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
