import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="px-4 py-8 md:py-12 mt-20">
      <div className="mx-auto space-y-10 max-w-prose">

        {/* Header Skeleton */}
        <Skeleton className="h-8 w-full rounded-lg animate-pulse bg-zinc-200" />

        {/* Main Content Area */}
        <div className="space-y-4">

          {/* Article Title Skeleton */}
          <Skeleton className="h-6 w-3/4 rounded-lg animate-pulse bg-zinc-200" />

          {/* Information Icons and Links Skeleton */}
          <div className="flex space-x-2">
            <Skeleton className="h-4 w-4 rounded-full animate-pulse bg-zinc-200" />
            <Skeleton className="h-4 w-1/4 rounded-lg animate-pulse bg-zinc-200" />
          </div>

          {/* Main Article Body Skeleton */}
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded-lg animate-pulse bg-zinc-200" />
            ))}
          </div>

          {/* Interactive Elements Skeleton */}
          <Skeleton className="h-8 w-1/5 rounded-lg animate-pulse bg-zinc-200" />

        </div>

        {/* Footer Skeleton */}
        <Skeleton className="h-8 w-full rounded-lg animate-pulse bg-zinc-200" />

      </div>
    </div>
  );
}
