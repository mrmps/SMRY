"use client";

import Link from "next/link";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-sm" showCloseButton={false}>
        <div className="p-6 text-center">
          <DialogTitle className="text-lg">You've hit your daily limit</DialogTitle>
          <DialogDescription className="mt-2">
            Upgrade for unlimited summaries.
            <span className="block text-xs mt-1 text-muted-foreground/60">
              $3/mo billed yearly · Cancel anytime
            </span>
          </DialogDescription>

          <div className="mt-5 space-y-2">
            <Link
              href="/pricing"
              className="flex w-full items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              See plans
            </Link>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Continue for free
            </button>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
