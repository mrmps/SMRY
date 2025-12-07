"use client";

import * as React from "react";
import Image from "next/image";
import { Megaphone, ExternalLink, Users, Zap, Eye, Check, Crown } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

import { ResponsiveDrawer } from "@/components/features/responsive-drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      }
    ) => void;
  }
}

const trackGAEvent = (
  eventName: string,
  params?: {
    event_category?: string;
    event_label?: string;
    [key: string]: string | number | boolean | undefined;
  }
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
      className={cn("block p-0.5 bg-accent rounded-[14px] group", className)}
    >
      <div className="bg-card rounded-xl p-5 md:p-6 transition-colors group-hover:bg-accent/50">
        <div className="flex flex-col items-center gap-3 md:gap-4 text-center">
          <Image
            src="/whisper-flow-transparent.png"
            alt="Wispr Flow"
            width={120}
            height={28}
            className="h-6 md:h-7 w-auto dark:invert"
          />
          <div className="space-y-1">
            <p className="text-xs md:text-sm text-muted-foreground">
              Voice-to-text I use daily
            </p>
            <p className="text-[10px] md:text-xs text-muted-foreground/70 italic">
              — michael, creator of smry
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
      className={cn("block p-0.5 bg-accent rounded-[14px] group", className)}
    >
      <div className="bg-card rounded-xl p-5 md:p-6 transition-colors group-hover:bg-accent/50">
        <div className="flex flex-col items-center gap-3 md:gap-4 text-center">
          <Image
            src="/gpt-human-transparent.png"
            alt="GPT Human"
            width={120}
            height={28}
            className="h-6 md:h-7 w-auto dark:invert"
          />
          <div className="space-y-1">
            <p className="text-xs md:text-sm text-muted-foreground">
              Bypass AI detectors <br />
              and write like a human
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
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
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
        "text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      Advertise
    </button>
  );
});
AdvertiseTrigger.displayName = "AdvertiseTrigger";

function AdDrawerContent() {
  const [showStats, setShowStats] = React.useState(false);

  return (
    <div className="flex flex-col bg-background">
      {/* Hero Section */}
      <div className="px-6 pt-6 pb-4 text-center">
        <div className="mx-auto mb-3 size-14 rounded-2xl bg-[#B46201]/10 flex items-center justify-center">
          <Megaphone className="size-7 text-[#B46201]" />
        </div>
        <h3 className="text-xl font-semibold">Advertise on SMRY</h3>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-[#B46201]">
          Sponsor Program
        </p>
      </div>

      {/* Feature cards - nested card pattern */}
      <div className="px-6 space-y-2">
        <FeatureCard
          icon={<Users className="size-4" />}
          title="Hundreds of thousands of readers"
          description="Reach engaged readers and grow your brand"
          action={
            !showStats ? (
              <button
                onClick={() => setShowStats(true)}
                className="text-[10px] font-medium text-[#B46201] hover:text-[#B46201]/80 transition-colors whitespace-nowrap"
              >
                View stats →
              </button>
            ) : null
          }
        />
        {showStats && (
          <div className="p-0.5 bg-accent rounded-[14px] animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-card rounded-xl p-2 overflow-hidden">
              <Image
                src="/stats.png"
                alt="SMRY Analytics - 1.4M views, 213K users"
                width={800}
                height={600}
                className="w-full h-auto rounded-lg"
                priority={false}
              />
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Analytics from Google Analytics on 12/06/2025
              </p>
            </div>
          </div>
        )}
        <FeatureCard
          icon={<Eye className="size-4" />}
          title="Premium placement"
          description="Sidebar on desktop, banner on mobile across all pages"
        />
        <FeatureCard
          icon={<Zap className="size-4" />}
          title="Fair rotation"
          description="Sponsors rotate every 10 seconds for equal visibility"
        />
      </div>

      {/* Availability Section */}
      <div className="px-6 mt-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Availability
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Check className="size-4 text-[#B46201]" />
            <span className="text-muted-foreground">5 spots total</span>
            <span className="ml-auto font-medium text-[#B46201]">
              Only 3 left
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Check className="size-4 text-[#039550]" />
            <span className="text-muted-foreground">Next available</span>
            <span className="ml-auto font-medium">December 15th</span>
          </div>
        </div>
      </div>

      {/* Pricing Card - nested card pattern */}
      <div className="px-6 mt-5">
        <div className="p-0.5 bg-accent rounded-[14px]">
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">$499</span>
              <span className="text-sm text-muted-foreground">one-time deposit</span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Locks your spot for January. Applied toward your{" "}
              <span className="text-foreground font-medium">$999/mo</span> rate.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pt-5 pb-6">
        <Button
          size="lg"
          className="w-full"
          render={(defaultProps) => {
            const handleCheckoutClick = () => {
              trackGAEvent("advertise_checkout_click", {
                event_category: "Ads",
                event_label: "Stripe Checkout",
                checkout_type: "advertise_deposit",
              });
            };

            return (
              <a
                {...defaultProps}
                href={STRIPE_CHECKOUT_URL}
                target="_blank"
                rel="noreferrer"
                onClick={handleCheckoutClick}
              >
                Lock spot for January
                <ExternalLink className="ml-2 size-4" />
              </a>
            );
          }}
        />
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Questions?{" "}
          <a href="mailto:contact@smry.ai" className="underline hover:text-foreground">
            contact@smry.ai
          </a>
        </p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-0.5 bg-accent rounded-[14px]">
      <div className="flex gap-3 bg-card rounded-xl p-3">
        <div className="shrink-0 size-9 rounded-lg bg-accent flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm">{title}</p>
            {action}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement<Record<string, unknown>>;
  nativeButton?: boolean;
}) {
  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title="Advertise on SMRY"
      scrollable
      showCloseButton
      nativeButton={nativeButton}
    >
      <AdDrawerContent />
    </ResponsiveDrawer>
  );
}

// ============================================
// GO PREMIUM CTA
// ============================================

function GoPremiumLink({ className }: { className?: string }) {
  const handleClick = () => {
    trackGAEvent("premium_cta_click", {
      event_category: "Premium",
      event_label: "Go Premium CTA",
    });
  };

  return (
    <Link
      href="/pricing"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-500 transition-colors font-medium",
        className
      )}
    >
      <Crown className="size-3" />
      Go Premium
    </Link>
  );
}

// Hook to check if user has premium using Clerk Billing
function useIsPremium() {
  const { isLoaded, has } = useAuth();
  
  if (!isLoaded) {
    return { isPremium: false, isLoading: true };
  }
  
  // Use Clerk Billing's has() to check for premium plan
  // This automatically checks the user's subscription status
  const isPremium = has?.({ plan: "premium" }) ?? false;
    
  return { isPremium, isLoading: false };
}

// ============================================
// EXPORTED COMPONENTS
// ============================================

export function AdSpot({ className }: AdSpotProps) {
  const { isPremium, isLoading } = useIsPremium();
  const isMobile = useMediaQuery("(max-width: 768px)", {
    defaultValue: false,
    initializeWithValue: false,
  });

  // Don't render ads for premium users
  if (isPremium) {
    return null;
  }

  // Show nothing while loading to prevent flash
  if (isLoading) {
    return null;
  }

  return isMobile ? (
    <AdSpotMobileBar className={className} />
  ) : (
    <AdSpotSidebar className={className} />
  );
}

export function AdSpotSidebar({ className }: AdSpotProps) {
  const [advertiseOpen, setAdvertiseOpen] = React.useState(false);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <WisprAdCard />
      <GptHumanAdCard />
      <div className="flex items-center justify-center gap-3 text-center">
        <AdvertiseModal
          open={advertiseOpen}
          onOpenChange={setAdvertiseOpen}
          trigger={<AdvertiseTrigger />}
          nativeButton
        />
        <span className="text-muted-foreground/50">·</span>
        <GoPremiumLink />
      </div>
    </div>
  );
}

function MobileAdPill({ href, imageSrc, alt, eventLabel }: { href: string; imageSrc: string; alt: string; eventLabel: string }) {
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

export function AdSpotMobileBar({ className }: AdSpotProps) {
  const [advertiseOpen, setAdvertiseOpen] = React.useState(false);

  return (
    <div className={cn("fixed bottom-0 inset-x-0 z-40 px-3 py-2 pb-safe bg-background/80 backdrop-blur-xl border-t border-border/40", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2">
          <GoPremiumLink />
          <span className="text-muted-foreground/30">·</span>
          <ResponsiveDrawer
            open={advertiseOpen}
            onOpenChange={setAdvertiseOpen}
            trigger={<AdvertiseTrigger />}
            title="Advertise on SMRY"
            scrollable
            showCloseButton
          >
            <AdDrawerContent />
          </ResponsiveDrawer>
        </div>
      </div>
    </div>
  );
}
