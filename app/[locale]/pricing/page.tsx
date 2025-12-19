"use client";

import { SignedIn, UserButton } from "@clerk/nextjs";
import { Zap, ArrowLeft, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { FoundersLetter } from "@/components/marketing/founders-letter";
import { CustomPricingTable } from "@/components/marketing/custom-pricing-table";

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
        <div className="mb-8 w-full max-w-lg">
          <div className="p-0.5 bg-accent rounded-[14px]">
            <div className="bg-card rounded-xl p-6 text-center">
              <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-accent">
                <Zap className="size-4 text-foreground/70" />
              </div>
              <h1 className="text-xl font-semibold">Read Any Article, Instantly</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Stop paying $50+/month for multiple subscriptions. Get unlimited access to articles from NYT, WSJ, Bloomberg, and 1000+ sites.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="px-2 py-1 bg-accent rounded-md font-medium">7-day free trial</span>
                <span>·</span>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
        {/* Pricing Options */}
        <div className="w-full max-w-xl mb-10">
          <CustomPricingTable />
        </div>

        {/* Benefits */}
        <div className="w-full max-w-2xl mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-0.5 bg-accent rounded-[14px]">
              <div className="bg-card rounded-xl p-4 h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Unlimited Summaries</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  No daily limits. Read as much as you want, whenever you want.
                </p>
              </div>
            </div>
            <div className="p-0.5 bg-accent rounded-[14px]">
              <div className="bg-card rounded-xl p-4 h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Full History</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Never lose an article. Search and revisit everything you&apos;ve read.
                </p>
              </div>
            </div>
            <div className="p-0.5 bg-accent rounded-[14px]">
              <div className="bg-card rounded-xl p-4 h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Clean Reading</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  No ads, no distractions. Just the content you came for.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Value Comparison */}
        <div className="w-full max-w-2xl mb-8">
          <div className="p-0.5 bg-accent rounded-[14px]">
            <div className="bg-card rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                The math
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-border">
                  <span className="text-muted-foreground">NYT</span>
                  <span className="line-through text-muted-foreground">$17/mo</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border">
                  <span className="text-muted-foreground">WSJ</span>
                  <span className="line-through text-muted-foreground">$12/mo</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border">
                  <span className="text-muted-foreground">The Atlantic</span>
                  <span className="line-through text-muted-foreground">$6/mo</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border">
                  <span className="text-muted-foreground">Bloomberg</span>
                  <span className="line-through text-muted-foreground">$35/mo</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="font-medium">SMRY Premium</span>
                  <span className="font-medium text-foreground">All of the above</span>
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
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground mb-8">
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
