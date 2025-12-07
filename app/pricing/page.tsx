"use client";

import { PricingTable } from "@clerk/nextjs";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { Crown, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function PricingPage() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
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
      <div className="flex flex-1 flex-col items-center px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-amber-500/10">
            <Crown className="size-8 text-amber-500" />
          </div>
          <h1 className="text-3xl font-bold">Go Premium</h1>
          <p className="mt-2 text-muted-foreground">
            Remove ads and support SMRY development
          </p>
        </div>

        {/* Clerk Pricing Table */}
        <div className="w-full max-w-2xl">
          <PricingTable />
        </div>

        {/* Benefits */}
        <div className="mt-12 grid max-w-2xl gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <p className="font-medium">No Ads</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clean, distraction-free reading
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <p className="font-medium">7-Day Trial</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try before you commit
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
            <p className="font-medium">Cancel Anytime</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No questions asked
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

