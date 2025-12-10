// FoundersLetter.tsx
// A personal note from the founder - clean, readable, follows design system

import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export function FoundersLetter() {
  return (
    <div className="p-0.5 bg-accent rounded-[14px] h-full">
      <div className="bg-card rounded-xl p-6 space-y-4 h-full">
        {/* Label */}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          A note from the developer
        </p>

        {/* Letter content - clean, readable */}
        <div className="space-y-3 text-sm text-foreground/90">
          <p>
            I built SMRY because I was kept hitting paywalls on articles and found it annoying to have to click through 5 different tools to try to read them.
          </p>

          <p>
            To support SMRY, consider becoming monthly or yearly patron. Patrons get some extra features and help keep this project alive.
          </p>
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
            <Link
              href="https://smryai.userjot.com/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg bg-accent"
            >
              Feedback
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
