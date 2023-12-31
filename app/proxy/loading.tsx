import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";

function randomWidth() {
  const widths = ["w-1/2", "w-2/3", "w-3/4", "w-full"];
  return widths[Math.floor(Math.random() * widths.length)];
}

function randomHeight() {
  const heights = ["h-3", "h-4", "h-5"];
  return heights[Math.floor(Math.random() * heights.length)];
}

// export default function Loading() {
//   return (
//     <div className="mt-20">
//       <div className="px-4 py-8 md:py-12">
//         <div className="mx-auto space-y-10 max-w-prose">
//           <main className="prose">
//             {/* Logo and Header Skeleton */}
//             <div className="tokens my-10 shadow-sm border-zinc-100 border flex border-collapse text-[#111111] text-base font-normal list-none text-left visible overflow-auto rounded-lg bg-[#f9f9fb]">
//               <div className="p-6 w-full grid">
//                 {/* <Skeleton className="w-24 h-24 rounded-full" /> */}
//                 <Image
//                   src="/logo.svg"
//                   width={150}
//                   height={150}
//                   alt={"smry logo"}
//                   className="-ml-4"
//                 />
//                 <Skeleton className="h-6 my-2" />
//                 <Skeleton className="h-6 my-2 w-4/6" />
//               </div>
//             </div>

//             <Skeleton className="relative border border-zinc-100 rounded-md shadow-sm p-1 h-14" />
//             <div className="mt-20">
//               <div className="px-4 py-8 md:py-12">
//                 <div className="mx-auto space-y-10 max-w-prose">
//                   <main className="prose">
//                     {/* Logo and Header Skeleton */}
//                     <div className="tokens my-10 shadow-sm border-zinc-100 border flex border-collapse text-[#111111] text-base font-normal list-none text-left visible overflow-auto rounded-lg bg-[#f9f9fb]">
//                       <div className="p-6 w-full grid">
//                         <Skeleton className="w-24 h-24 rounded-full" />{" "}
//                         {/* Logo */}
//                         <Skeleton className="h-8 my-2 w-3/4" />{" "}
//                         {/* Main Title */}
//                         <Skeleton className="h-6 my-1 w-1/2" />{" "}
//                         {/* Subtitle/Date */}
//                         <Skeleton className="h-6 my-1 w-2/3" />{" "}
//                         {/* Subtitle/Author */}
//                       </div>
//                     </div>
//                     {/* Content Skeletons */}
//                     <Skeleton className="h-6 my-2 w-full" /> {/* Paragraph */}
//                     <Skeleton className="h-32 w-full my-4" /> {/* Image */}
//                     <Skeleton className="h-6 my-2 w-5/6" /> {/* Paragraph */}
//                     <Skeleton className="h-6 my-2 w-4/6" /> {/* Paragraph */}
//                     <Skeleton className="h-8 w-1/4 my-2" /> {/* Button/Link */}
//                     <Skeleton className="h-4 w-4 my-2" />{" "}
//                     {/* Icon Placeholder */}
//                   </main>
//                 </div>
//               </div>
//             </div>
//           </main>
//         </div>
//       </div>
//     </div>
//   );
// }

export default function Loading() {
  return (
    <div className="mt-20">
      <div className="px-4 py-8 md:py-12">
        <div className="mx-auto space-y-10 max-w-prose">
          <main className="prose">
            {/* Logo and Header Skeleton */}
            <div className="tokens my-10 shadow-sm border-zinc-100 border flex border-collapse text-[#111111] text-base font-normal list-none text-left visible overflow-auto rounded-lg bg-[#f9f9fb]">
              <div className="p-6 w-full grid">
                <Skeleton className="w-24 h-24 rounded-full" />
                <Skeleton className="h-8 my-2 w-3/4" /> {/* Title */}
                <Skeleton className="h-6 my-1 w-2/3" /> {/* Subtitle */}
              </div>
            </div>

            {/* Navbar Skeleton */}
            <div className="flex justify-left my-4 gap-1 border border-zinc-100 p-2 rounded-md">
              <Skeleton className="w-full h-12" />
            </div>

            <div className="article-skeleton">
              {/* Article Title */}
              <Skeleton className="h-16 w-2/3 my-4" />

              <div className="flex flex-row mt-8 ml-4 space-x-4">
                {/* Skeleton for the first icon-text pair */}
                <div className="flex items-center space-x-1.5">
                  <Skeleton className="w-4 h-4 rounded-full" />{" "}
                  {/* Globe Icon Placeholder */}
                  <Skeleton className="h-4 w-24 rounded" />{" "}
                  {/* URL Text Placeholder */}
                </div>

                {/* Skeleton for the second icon-text pair */}
                <div className="flex items-center space-x-1.5">
                  <Skeleton className="w-4 h-4 rounded-full" />{" "}
                  {/* Link Icon Placeholder */}
                  <Skeleton className="h-4 w-24 rounded" />{" "}
                  {/* Source Text Placeholder */}
                </div>
              </div>

              {/* Hero Image */}
              <Skeleton className=" h-96 w-full my-8" />

              {/* Article Content */}
              <div className="article-content">
                {/* Introduction Section */}
                <Skeleton className="h-6 my-4 w-2/3" />
                <Skeleton className="h-6 my-4 w-full" />

                {/* Main Content Section */}
                <Skeleton className="h-6 my-4 w-full" />
                <Skeleton className="h-6 my-4 w-full" />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
