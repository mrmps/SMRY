"use client";

import { PricingTable } from "@clerk/nextjs";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { Heart, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { FoundersLetter } from "@/components/marketing/founders-letter";

export default function PricingPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to SMRY
          </Link>
          <div className="flex items-center gap-4">
            <SignedIn>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "size-8"
                  }
                }}
              />
            </SignedIn>
            <Link href="/">
              <Image
                src="/logo.svg"
                width={80}
                height={80}
                alt="smry logo"
                className="dark:invert"
              />
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center px-4 py-10">
        {/* Hero Section */}
        <div className="mb-8 w-full max-w-md">
          <div className="p-0.5 bg-accent rounded-[14px]">
            <div className="bg-card rounded-xl p-6 text-center">
              <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-accent">
                <Heart className="size-4 text-foreground/70" />
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Annual Plan · Save 62%
              </p>
              <h1 className="text-xl font-semibold">Support the Developer</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Keep SMRY free for everyone + unlock premium features
              </p>
            </div>
          </div>
        </div>
        {/* Clerk Pricing Table */}
        <div className="w-full max-w-2xl mb-10">
          <PricingTable />
        </div>

        {/* Benefits */}
        <div className="w-full max-w-2xl mb-8">
          <div className="p-0.5 bg-accent rounded-[14px]">
            <div className="bg-card rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                What you get with Premium
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">✓</span>
                  <span>Ad-free reading</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">✓</span>
                  <span>Full history & search</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">✓</span>
                  <span>Early access to features</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">✓</span>
                  <span>Support indie dev</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Founder's Letter */}
        <div className="w-full max-w-2xl mb-8">
          <FoundersLetter />
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <span>7-day free trial</span>
          <span className="text-border">•</span>
          <span>Cancel anytime</span>
          <span className="text-border">•</span>
          <span>No questions asked</span>
        </div>
      </div>
    </main>
  );
}
