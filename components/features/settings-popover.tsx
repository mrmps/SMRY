"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import {
  Check,
  User,
  Globe,
  Crown,
  MessageSquare,
} from "@/components/ui/icons";
import { FeedbackIcon } from "@/components/ui/custom-icons";
import { cn } from "@/lib/utils";
import { useIsPremium } from "@/lib/hooks/use-is-premium";
import { buildUrlWithReturn, storeReturnUrl } from "@/lib/hooks/use-return-url";
import { routing, languageNames, type Locale } from "@/i18n/routing";
import { stripLocaleFromPathname } from "@/lib/i18n-pathname";
import { useChatLanguage, type ChatLanguageCode } from "@/lib/hooks/use-chat-language";
import {
  Dialog,
  DialogPopup,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsDesktop } from "@/lib/hooks/use-media-query";

// =============================================================================
// SECTION TYPES
// =============================================================================

type SettingsSection = "language" | "chat" | "account" | "support";

const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
  { id: "language", label: "Language", icon: <Globe className="size-5" /> },
  { id: "chat", label: "AI Chat", icon: <MessageSquare className="size-5" /> },
  { id: "account", label: "Account", icon: <User className="size-5" /> },
  { id: "support", label: "Support", icon: <FeedbackIcon className="size-5" /> },
];

// =============================================================================
// COMPONENTS
// =============================================================================

// Inner component that uses useSearchParams - must be wrapped in Suspense
function LanguageSectionInner() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const rawPathname = usePathname();
  const searchParams = useSearchParams();

  const switchLocale = (newLocale: Locale) => {
    const pathname = stripLocaleFromPathname(rawPathname);
    const search = searchParams.toString();
    const fullPath = `${pathname}${search ? `?${search}` : ''}`;
    router.replace(fullPath, { locale: newLocale });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select the language for the interface.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {routing.locales.map((loc) => (
          <button
            key={loc}
            onClick={() => switchLocale(loc)}
            className={cn(
              "flex items-center justify-between px-4 py-3.5 text-sm rounded-xl border-2 transition-all min-h-[52px]",
              "active:scale-[0.98]",
              locale === loc
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <span className="font-medium">{languageNames[loc]}</span>
            {locale === loc && <Check className="size-5 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// Wrapper with Suspense boundary for useSearchParams
function LanguageSection() {
  return (
    <React.Suspense fallback={
      <div className="space-y-4">
        <div className="h-5 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[52px] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <LanguageSectionInner />
    </React.Suspense>
  );
}

function AccountSection({ onClose }: { onClose?: () => void }) {
  const { isPremium } = useIsPremium();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const authRedirectUrl = typeof window !== "undefined"
    ? buildUrlWithReturn("/auth/redirect")
    : "/auth/redirect";

  const handleCardClick = () => {
    // Find Clerk's UserButton trigger inside the card and click it
    const btn = cardRef.current?.querySelector<HTMLButtonElement>(
      "button[data-clerk-component], button[aria-label], .cl-userButtonTrigger, .cl-avatarBox"
    );
    if (btn) {
      btn.click();
      return;
    }
    // Fallback: find any button inside the Clerk-rendered div
    const fallback = cardRef.current?.querySelector<HTMLButtonElement>("button");
    fallback?.click();
  };

  return (
    <div className="space-y-4">
      <SignedIn>
        <div
          ref={cardRef}
          className="flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-muted/30 cursor-pointer transition-opacity hover:bg-muted/50 active:opacity-80"
          onClick={handleCardClick}
        >
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-14",
              },
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-lg">Signed in</p>
            {isPremium ? (
              <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                <Crown className="size-4" />
                <span>Pro member</span>
              </div>
            ) : (
              <Link
                href="/pricing"
                className="text-sm text-primary hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose?.();
                }}
              >
                Upgrade to Pro
              </Link>
            )}
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sign in to sync your settings and access premium features.
          </p>
          <div className="flex gap-3">
            <SignInButton mode="modal" fallbackRedirectUrl={authRedirectUrl}>
              <button
                className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-muted hover:bg-accent text-sm font-medium transition-colors active:scale-[0.98]"
                onClick={onClose}
              >
                <User className="size-5" />
                Sign in
              </button>
            </SignInButton>
            <Link
              href="/pricing"
              onClick={() => {
                storeReturnUrl();
                onClose?.();
              }}
              className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(to bottom, color(display-p3 1 0.88 0.5), color(display-p3 1 0.76 0.18))',
                color: 'color(display-p3 0.15 0.1 0)',
              }}
            >
              Get Pro
            </Link>
          </div>
        </div>
      </SignedOut>
    </div>
  );
}

function ChatLanguageSection() {
  const { language, setLanguage, languages } = useChatLanguage();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose the language for AI responses. The AI will respond in your selected language.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code as ChatLanguageCode)}
            className={cn(
              "flex items-center justify-between px-4 py-3.5 text-sm rounded-xl border-2 transition-all min-h-[52px]",
              "active:scale-[0.98]",
              language === lang.code
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <span className="font-medium">{lang.nativeName}</span>
            {language === lang.code && <Check className="size-5 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function SupportSection() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Have feedback or found a bug? Let us know.
      </p>
      <a
        href="https://smryai.userjot.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:bg-muted transition-colors min-h-[64px] active:scale-[0.98]"
      >
        <FeedbackIcon className="size-6 text-muted-foreground" />
        <div>
          <p className="font-medium">Send Feedback</p>
          <p className="text-sm text-muted-foreground">Report bugs or suggest features</p>
        </div>
      </a>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface SettingsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPopover({ open, onOpenChange }: SettingsPopoverProps) {
  const isDesktop = useIsDesktop();
  const [activeSection, setActiveSection] = React.useState<SettingsSection>("language");

  const renderContent = () => {
    switch (activeSection) {
      case "language":
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-semibold">Language</h3>
              <p className="text-sm text-muted-foreground mt-1">Select your preferred language</p>
            </div>
            <LanguageSection />
          </div>
        );
      case "chat":
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-semibold">AI Chat</h3>
              <p className="text-sm text-muted-foreground mt-1">Configure AI conversation settings</p>
            </div>
            <ChatLanguageSection />
          </div>
        );
      case "account":
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-semibold">Account</h3>
              <p className="text-sm text-muted-foreground mt-1">Manage your account settings</p>
            </div>
            <AccountSection onClose={() => onOpenChange(false)} />
          </div>
        );
      case "support":
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-semibold">Support</h3>
              <p className="text-sm text-muted-foreground mt-1">Get help and provide feedback</p>
            </div>
            <SupportSection />
          </div>
        );
    }
  };

  // Desktop: Dialog with sidebar
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPopup className="sm:max-w-4xl p-0 gap-0 overflow-hidden">
          <div className="flex h-[720px]">
            {/* Sidebar */}
            <div className="w-60 border-r border-border bg-muted/30 p-3 flex flex-col">
              <div className="flex items-center justify-between px-3 py-4 mb-2">
                <h2 className="text-lg font-semibold">Settings</h2>
              </div>
              <nav className="flex-1 space-y-1">
                {SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-3 text-sm rounded-xl transition-colors min-h-[48px]",
                      activeSection === section.id
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    {section.icon}
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto">
              {renderContent()}
            </div>
          </div>
        </DialogPopup>
      </Dialog>
    );
  }

  // Mobile: Full drawer with proper touch targets
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b border-border pb-4">
          <DrawerTitle className="text-lg font-semibold">Settings</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto" data-vaul-no-drag>
          {/* Section tabs - horizontal scroll with proper touch targets */}
          <div className="sticky top-0 bg-background z-10 border-b border-border">
            <div className="flex gap-2 overflow-x-auto py-3 px-4 scrollbar-hide">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm rounded-full whitespace-nowrap transition-colors min-h-[44px]",
                    "active:scale-[0.97]",
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground font-medium"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {section.icon}
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {renderContent()}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
