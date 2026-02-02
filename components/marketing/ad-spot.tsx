"use client";

import * as React from "react";
import Image from "next/image";
import { ExternalLink, Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { ResponsiveDrawer } from "@/components/features/responsive-drawer";
import { cn } from "@/lib/utils";

// Get the name of next month in user's locale
function useNextMonth(): string {
  const t = useTranslations("ads");
  const now = new Date();
  const monthIndex = (now.getMonth() + 1) % 12;
  const monthKeys = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ] as const;
  return t(`months.${monthKeys[monthIndex]}`);
}

// Google Analytics event helper
declare global {
  interface Window {
    gtag?: (
      command: "event",
      eventName: string,
      params?: {
        event_category?: string;
        event_label?: string;
        [key: string]: string | number | boolean | undefined;
      },
    ) => void;
  }
}

const trackGAEvent = (
  eventName: string,
  params?: {
    event_category?: string;
    event_label?: string;
    [key: string]: string | number | boolean | undefined;
  },
) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, params);
  }
};

const STRIPE_CHECKOUT_URL =
  process.env.NEXT_PUBLIC_STRIPE_AD_CHECKOUT_URL ??
  "https://buy.stripe.com/dRm9AU5E9258f4EcaHfYY00";

const WISPR_REFERRAL_URL = "https://ref.wisprflow.ai/michael-r";
const GPT_HUMAN_URL = "https://gpthuman.ai/?via=michael-ryaboy";

interface AdSpotProps {
  className?: string;
}

// ============================================
// SPONSORED AD: Wispr Flow
// ============================================

function WisprAdCard({ className }: { className?: string }) {
  const t = useTranslations("ads");
  const handleClick = () => {
    trackGAEvent("ad_click", {
      event_category: "Ads",
      event_label: "Wispr Flow Ad",
      ad_type: "sponsored",
    });
  };

  return (
    <a
      href={WISPR_REFERRAL_URL}
      target="_blank"
      rel="noreferrer"
      onClick={handleClick}
      className={cn(
        "block p-0.5 bg-accent rounded-[14px] group overflow-hidden shrink-0",
        className,
      )}
    >
      <div className="bg-card rounded-xl p-4 transition-colors group-hover:bg-accent/50">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image
            src="/whisper-flow-transparent.png"
            alt="Wispr Flow"
            width={120}
            height={28}
            className="h-6 w-auto dark:invert shrink-0"
          />
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground leading-tight" suppressHydrationWarning>
              {t("wispr.tagline")}
            </p>
            <p className="text-[10px] text-muted-foreground/70 italic leading-tight" suppressHydrationWarning>
              {t("wispr.endorsement")}
            </p>
          </div>
        </div>
      </div>
    </a>
  );
}

// ============================================
// SPONSORED AD: GPT Human
// ============================================

function GptHumanAdCard({ className }: { className?: string }) {
  const t = useTranslations("ads");
  const handleClick = () => {
    trackGAEvent("ad_click", {
      event_category: "Ads",
      event_label: "GPT Human Ad",
      ad_type: "sponsored",
    });
  };

  return (
    <a
      href={GPT_HUMAN_URL}
      target="_blank"
      rel="noreferrer"
      onClick={handleClick}
      className={cn(
        "block p-0.5 bg-accent rounded-[14px] group overflow-hidden shrink-0",
        className,
      )}
    >
      <div className="bg-card rounded-xl p-4 transition-colors group-hover:bg-accent/50">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image
            src="/gpt-human-transparent.png"
            alt="GPT Human"
            width={120}
            height={28}
            className="h-6 w-auto dark:invert shrink-0"
          />
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground leading-tight" suppressHydrationWarning>
              {t("gptHuman.tagline")}
            </p>
          </div>
        </div>
      </div>
    </a>
  );
}

// ============================================
// ADVERTISE CTA (for potential sponsors)
// ============================================

const AdvertiseTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }
>(({ className, onClick, label, ...props }, ref) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    trackGAEvent("advertise_modal_open", {
      event_category: "Ads",
      event_label: "Advertise Modal",
    });
    onClick?.(e);
  };

  return (
    <button
      ref={ref}
      className={cn(
        "text-xs font-medium px-3 py-1.5 rounded-full border border-border bg-background hover:bg-accent text-foreground transition-colors",
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      📣 {label}
    </button>
  );
});
AdvertiseTrigger.displayName = "AdvertiseTrigger";

const TOP_COUNTRIES = [
  { flag: "🇺🇸", code: "US", users: 38713, percent: 17.8 },
  { flag: "🇧🇷", code: "BR", users: 29142, percent: 13.4 },
  { flag: "🇬🇧", code: "UK", users: 23825, percent: 11.0 },
  { flag: "🇩🇪", code: "DE", users: 20916, percent: 9.6 },
  { flag: "🇦🇺", code: "AU", users: 12870, percent: 5.9 },
  { flag: "🇪🇸", code: "ES", users: 11854, percent: 5.4 },
];

function CountryBar({
  flag,
  code,
  users,
  percent,
  maxPercent,
}: {
  flag: string;
  code: string;
  users: number;
  percent: number;
  maxPercent: number;
}) {
  const width = (percent / maxPercent) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{flag}</span>
      <span className="text-xs font-medium w-6">{code}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-14 text-right">
        {users.toLocaleString()}
      </span>
    </div>
  );
}

function AdDrawerContent() {
  const t = useTranslations("ads");
  const nextMonth = useNextMonth();

  const benefits = [
    t("modal.benefits.reach"),
    t("modal.benefits.placement"),
    t("modal.benefits.rotation"),
    t("modal.benefits.analytics"),
    t("modal.benefits.support"),
  ];

  const maxPercent = Math.max(...TOP_COUNTRIES.map((c) => c.percent));

  return (
    <div className="flex flex-col bg-background">
      {/* Hero Stats */}
      <div className="px-6 pt-6 pb-2">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-4 text-center">
          {t("modal.badge")}
        </p>

        {/* Big numbers row */}
        <div className="flex items-center justify-center gap-8 mb-2">
          <div className="text-center">
            <div className="text-4xl font-bold tracking-tight">1.6M</div>
            <div className="text-xs text-muted-foreground mt-1">
              {t("modal.stats.views")}
            </div>
          </div>
          <div className="w-px h-12 bg-border" />
          <div className="text-center">
            <div className="text-4xl font-bold tracking-tight">217K</div>
            <div className="text-xs text-muted-foreground mt-1">
              {t("modal.stats.users")}
            </div>
          </div>
        </div>
      </div>

      {/* Countries breakdown */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground">
            {t("modal.stats.topCountries")}
          </span>
          <span className="text-[10px] text-muted-foreground">
            214 {t("modal.stats.countriesTotal")}
          </span>
        </div>
        <div className="space-y-2.5">
          {TOP_COUNTRIES.map((country) => (
            <CountryBar
              key={country.code}
              {...country}
              maxPercent={maxPercent}
            />
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground text-center">
          {t("modal.heroSubtext")}
        </p>
      </div>

      {/* What's included - Cosmos style */}
      <div className="px-6 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm font-medium text-muted-foreground">
            {t("modal.whatsIncluded")}
          </span>
          <div className="flex-1 border-t border-dashed border-border" />
        </div>

        <div className="space-y-4">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
                <Check className="size-3.5 text-foreground" />
              </div>
              <span className="text-[15px]">{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing - clean and clear */}
      <div className="px-6 py-5 border-t border-border">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm text-muted-foreground">
            {t("modal.pricing.monthly")}
          </span>
          <span className="text-2xl font-bold">
            $999
            <span className="text-sm font-normal text-muted-foreground">
              /mo
            </span>
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">
            {t("modal.pricing.depositLabel")}
          </span>
          <span className="text-sm">
            $499{" "}
            <span className="text-muted-foreground">
              {t("modal.pricing.depositNote")}
            </span>
          </span>
        </div>
      </div>

      {/* Urgency - subtle */}
      <div className="px-6 py-3 bg-amber-500/10 border-y border-amber-500/20">
        <p className="text-sm text-center">
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {t("modal.urgency.spotsLeft")}
          </span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">
            {t("modal.urgency.nextAvailable", { month: nextMonth })}
          </span>
        </p>
      </div>

      {/* CTA */}
      <div className="px-6 pt-5 pb-6">
        <a
          href={STRIPE_CHECKOUT_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            trackGAEvent("advertise_checkout_click", {
              event_category: "Ads",
              event_label: "Stripe Checkout",
              checkout_type: "advertise_deposit",
            });
          }}
          className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-full bg-foreground text-background font-medium text-[15px] hover:bg-foreground/90 transition-colors"
        >
          {t("modal.cta", { month: nextMonth })}
        </a>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("modal.contact")}{" "}
          <a
            href="mailto:ads@smry.ai"
            className="underline hover:text-foreground"
          >
            ads@smry.ai
          </a>
        </p>
      </div>
    </div>
  );
}

// Responsive modal: Drawer on mobile, Dialog on desktop
function AdvertiseModal({
  open,
  onOpenChange,
  trigger,
  nativeButton = true,
  triggerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement<Record<string, unknown>>;
  nativeButton?: boolean;
  triggerId?: string;
}) {
  const t = useTranslations("ads");
  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title={t("modal.title")}
      scrollable
      showCloseButton
      nativeButton={nativeButton}
      triggerId={triggerId}
    >
      <AdDrawerContent />
    </ResponsiveDrawer>
  );
}

// ============================================
// EXPORTED COMPONENTS
// ============================================

export function AdSpot({ className: _className }: AdSpotProps) {
  // Temporarily disabled - no active ad campaigns
  return null;
}

export function AdSpotSidebar({
  className,
  hidden = false,
}: AdSpotProps & { hidden?: boolean }) {
  const [advertiseOpen, setAdvertiseOpen] = React.useState(false);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 transition-opacity duration-200 w-[200px] max-w-[200px] max-h-[calc(100vh-6rem)] overflow-hidden",
        hidden ? "opacity-0 pointer-events-none" : "opacity-100",
        className,
      )}
      aria-hidden={hidden}
    >
      <WisprAdCard className="w-full" />
      <GptHumanAdCard className="w-full" />
      <div className="flex items-center justify-center text-center">
        <AdvertiseModal
          open={advertiseOpen}
          onOpenChange={setAdvertiseOpen}
          trigger={<AdvertiseTrigger label="Advertise to 260k users" />}
          nativeButton
          triggerId="advertise-sidebar-trigger"
        />
      </div>
    </div>
  );
}

function MobileAdPill({
  href,
  imageSrc,
  alt,
  eventLabel,
}: {
  href: string;
  imageSrc: string;
  alt: string;
  eventLabel: string;
}) {
  const handleClick = () => {
    trackGAEvent("ad_click", {
      event_category: "Ads",
      event_label: eventLabel,
      ad_type: "sponsored",
    });
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={handleClick}
      className="flex items-center gap-1.5 px-3 py-2 bg-card rounded-full border border-border/50 transition-colors hover:bg-accent/50"
    >
      <Image
        src={imageSrc}
        alt={alt}
        width={80}
        height={20}
        className="h-4 w-auto dark:invert"
      />
      <ExternalLink className="size-3 text-muted-foreground" />
    </a>
  );
}

export function AdSpotMobileBar({
  className,
  hidden = false,
}: AdSpotProps & { hidden?: boolean }) {
  const t = useTranslations("ads");
  const [advertiseOpen, setAdvertiseOpen] = React.useState(false);

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 px-3 py-2 pb-safe bg-background/80 backdrop-blur-xl border-t border-border/40 transition-all duration-200 overflow-hidden",
        hidden
          ? "opacity-0 pointer-events-none translate-y-full"
          : "opacity-100 translate-y-0",
        className,
      )}
      aria-hidden={hidden}
    >
      <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 shrink-0">
          <MobileAdPill
            href={WISPR_REFERRAL_URL}
            imageSrc="/whisper-flow-transparent.png"
            alt="Wispr Flow"
            eventLabel="Wispr Flow Ad Mobile"
          />
          <MobileAdPill
            href={GPT_HUMAN_URL}
            imageSrc="/gpt-human-transparent.png"
            alt="GPT Human"
            eventLabel="GPT Human Ad Mobile"
          />
        </div>
        <ResponsiveDrawer
          open={advertiseOpen}
          onOpenChange={setAdvertiseOpen}
          trigger={<AdvertiseTrigger label="Advertise to 260k" />}
          title={t("modal.title")}
          scrollable
          showCloseButton
          triggerId="advertise-mobile-trigger"
        >
          <AdDrawerContent />
        </ResponsiveDrawer>
      </div>
    </div>
  );
}
