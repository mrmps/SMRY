import { cn } from "@/lib/utils";

interface SkeletonProps extends React.ComponentProps<"div"> {
  /** Delay before animation starts (for staggered effect) */
  delay?: number;
}

function Skeleton({ className, delay = 0, style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "skeleton-shimmer rounded-sm",
        className,
      )}
      data-slot="skeleton"
      style={{
        ...style,
        animationDelay: delay ? `${delay}ms` : undefined,
      }}
      {...props}
    />
  );
}

export { Skeleton };
