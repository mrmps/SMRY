import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-6xl sm:text-7xl",
};

export function Logo({ className, size = "md" }: LogoProps) {
  return (
    <span
      className={cn(
        "font-syne font-bold tracking-tight text-foreground",
        sizeClasses[size],
        className
      )}
    >
      smry
    </span>
  );
}
