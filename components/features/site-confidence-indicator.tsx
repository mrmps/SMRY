import clsx from "clsx";
import { FaviconImage } from "@/components/shared/favicon-image";
import { CheckCircle, Info, AlertTriangle } from "@/components/ui/icons";

const TIER_CONFIG = {
  "works-great": {
    bg: "bg-emerald-500/[0.06] dark:bg-emerald-400/[0.08]",
    text: "text-emerald-700/80 dark:text-emerald-300/80",
    key: "confidenceWorksGreat",
    Icon: CheckCircle,
  },
  "usually-works": {
    bg: "bg-amber-500/[0.06] dark:bg-amber-400/[0.08]",
    text: "text-amber-700/80 dark:text-amber-300/80",
    key: "confidenceUsuallyWorks",
    Icon: Info,
  },
  limited: {
    bg: "bg-orange-500/[0.06] dark:bg-orange-400/[0.08]",
    text: "text-orange-700/80 dark:text-orange-300/80",
    key: "confidenceLimited",
    Icon: AlertTriangle,
  },
} as const;

type ConfidenceTier = keyof typeof TIER_CONFIG;

export function SiteConfidenceIndicator({
  tier,
  domain,
  t,
}: {
  tier: ConfidenceTier;
  domain: string;
  t: (key: string) => string;
}) {
  const config = TIER_CONFIG[tier];
  const { Icon } = config;

  return (
    <div
      className={clsx(
        "mt-3 mx-auto flex w-fit items-center gap-1.5",
        "rounded-full px-3 py-1.5",
        config.bg,
        "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
      )}
      role="status"
      aria-live="polite"
    >
      <span className="size-3.5 shrink-0 overflow-hidden rounded-sm">
        <FaviconImage domain={domain} className="size-full" />
      </span>
      <span className={clsx("text-[11px] sm:text-xs font-medium", config.text)}>
        {domain}
      </span>
      <span className={clsx("text-[11px] sm:text-xs opacity-40", config.text)}>&middot;</span>
      <span className={clsx("text-[11px] sm:text-xs", config.text)}>
        {t(config.key)}
      </span>
      <Icon className={clsx("size-3 shrink-0", config.text)} />
    </div>
  );
}
