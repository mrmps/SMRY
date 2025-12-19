// FoundersLetter.tsx
// A personal note from the founder - clean, readable, follows design system

"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTranslations } from "next-intl";

export function FoundersLetter() {
  const t = useTranslations("foundersLetter");

  return (
    <div className="p-0.5 bg-accent rounded-[14px] h-full">
      <div className="bg-card rounded-xl p-6 space-y-4 h-full">
        {/* Label */}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("label")}
        </p>

        {/* Letter content - clean, readable */}
        <div className="space-y-3 text-sm text-foreground/90">
          <p>{t("p1")}</p>
          <p>{t("p2")}</p>
        </div>

        {/* Signature + Contact */}
        <div className="pt-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src="/face.png" />
                <AvatarFallback>M</AvatarFallback>
              </Avatar>
            <p className="text-sm font-medium">Michael</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://x.com/michael_chomsky"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg bg-accent"
            >
              @michael_chomsky
            </a>
            <a
              href="https://smryai.userjot.com/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg bg-accent"
            >
              {t("feedback")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
