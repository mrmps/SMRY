"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { Check } from "lucide-react";

const features = [
  "Unlimited article summaries",
  "Full reading history",
  "Search all past articles",
  "Ad-free experience",
  "Early access to new features",
];

export function CustomPricingTable() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
      {/* Monthly */}
      <div className="p-0.5 bg-accent rounded-[14px]">
        <div className="bg-card rounded-xl p-6 h-full flex flex-col">
          <div className="mb-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">Monthly</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">$7.99</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </div>

          <ul className="space-y-2 mb-6 flex-1">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="size-4 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <SignedIn>
            <div className="checkout-btn-secondary">
              <CheckoutButton planId="premium" planPeriod="month">
                Start 7-day free trial
              </CheckoutButton>
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="w-full py-2.5 px-4 rounded-lg bg-accent text-foreground font-medium text-sm hover:bg-accent/80 transition-colors border border-border">
                Sign in to start trial
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>

      {/* Annual - Highlighted */}
      <div className="p-0.5 bg-gradient-to-b from-foreground/20 to-foreground/5 rounded-[14px] relative">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-foreground text-background text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
            Most Popular
          </span>
        </div>
        <div className="bg-card rounded-xl p-6 h-full flex flex-col">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium text-muted-foreground">Annual</p>
              <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                Save 62%
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">$3</span>
              <span className="text-muted-foreground">/month</span>
              <span className="text-sm text-muted-foreground line-through">$7.99</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Billed $36/year</p>
          </div>

          <ul className="space-y-2 mb-6 flex-1">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="size-4 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <SignedIn>
            <div className="checkout-btn-primary">
              <CheckoutButton planId="premium" planPeriod="annual">
                Start 7-day free trial
              </CheckoutButton>
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="w-full py-2.5 px-4 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 transition-colors">
                Sign in to start trial
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </div>
  );
}
