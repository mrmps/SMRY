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
            I built SMRY because I was kept hitting paywalls on articles and found it annoying to have to try 5 different tricks to attempt to read them.
          </p>

          <p>
            This started as a weekend project and has grown into something I use daily.
            It feels amazing to have built something used regularly by over 250,000 people.
          </p>

          <p>
            After two years and over ten thousand dollars in costs, I&apos;ve decided to try to monetize SMRY. I&apos;m starting with a paid tier with more features, but I&apos;m still not sure what will work. I&apos;m open to feedback and suggestions.
          </p>

          <p>
            To support SMRY, please feel free to become a monthly or yearly patron.
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
              href="/feedback"
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
