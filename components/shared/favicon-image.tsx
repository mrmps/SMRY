import { cn } from "@/lib/utils";

export function FaviconImage({
  domain,
  className,
}: {
  domain: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/favicon?domain=${domain}`}
      alt=""
      className={cn("bg-white", className)}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
