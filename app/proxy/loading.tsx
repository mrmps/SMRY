import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mt-20">
      <div className="px-4 py-8 md:py-12">
        <div className="mx-auto max-w-prose space-y-10">
          <main className="prose">
            {/* Logo and Header Skeleton */}
            <div className="tokens visible my-10 flex border-collapse list-none overflow-auto rounded-lg border border-zinc-100 bg-[#f9f9fb] text-left text-base font-normal text-[#111111] shadow-sm">
              <div className="grid w-full p-6">
                <Skeleton className="size-24 rounded-full" />
                <Skeleton className="my-2 h-8 w-3/4" /> {/* Title */}
                <Skeleton className="my-1 h-6 w-2/3" /> {/* Subtitle */}
              </div>
            </div>

            {/* Navbar Skeleton */}
            <div className="justify-left my-4 flex gap-1 rounded-md border border-zinc-100 p-2">
              <Skeleton className="h-12 w-full" />
            </div>

            <div className="article-skeleton">
              {/* Article Title */}
              <Skeleton className="my-4 h-16 w-2/3" />

              <div className="ml-4 mt-8 flex flex-row space-x-4">
                {/* Skeleton for the first icon-text pair */}
                <div className="flex items-center space-x-1.5">
                  <Skeleton className="size-4 rounded-full" />{" "}
                  {/* Globe Icon Placeholder */}
                  <Skeleton className="h-4 w-24 rounded" />{" "}
                  {/* URL Text Placeholder */}
                </div>

                {/* Skeleton for the second icon-text pair */}
                <div className="flex items-center space-x-1.5">
                  <Skeleton className="size-4 rounded-full" />{" "}
                  {/* Link Icon Placeholder */}
                  <Skeleton className="h-4 w-24 rounded" />{" "}
                  {/* Source Text Placeholder */}
                </div>
              </div>

              {/* Hero Image */}
              <Skeleton className=" my-8 h-96 w-full" />

              {/* Article Content */}
              <div className="article-content">
                {/* Introduction Section */}
                <Skeleton className="my-4 h-6 w-2/3" />
                <Skeleton className="my-4 h-6 w-full" />

                {/* Main Content Section */}
                <Skeleton className="my-4 h-6 w-full" />
                <Skeleton className="my-4 h-6 w-full" />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
