import { Loader2Icon, type IconProps } from "@/components/ui/icons";

import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: IconProps) {
  return (
    <Loader2Icon
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      role="status"
      {...props}
    />
  );
}

export { Spinner };
