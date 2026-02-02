export type ChangeType = "new" | "fix" | "improved";

export interface Change {
  type: ChangeType;
  text: string;
  detail?: string;
  premium?: boolean;
}

export interface ChangelogEntry {
  date: string;
  changes: Change[];
}

export const changelog: ChangelogEntry[] = [
  {
    date: "Feb 1, 2026",
    changes: [
      {
        type: "new",
        text: "Automatic smart source selection",
        detail:
          "Articles are now automatically fetched from the best available source. The system races multiple sources and picks the one with the most complete content.",
      },
      {
        type: "new",
        text: "Optimistic content updates",
        detail:
          "Content may be updated in real-time when a longer, more complete version is found from another source.",
      },
      {
        type: "improved",
        text: "Better loading experience",
        detail:
          "New richer loading skeleton and compact error display with streamlined retry options.",
      },
      {
        type: "improved",
        text: "Cleaner reading interface",
        detail:
          "Manual source selector is now hidden when auto-fetch is used. Mid-article and footer ad slots for less intrusive placement.",
      },
      {
        type: "fix",
        text: "Mobile horizontal scrolling",
        detail:
          "Fixed horizontal scrolling issues on mobile devices. Cards and ads now scale properly on all screen sizes.",
      },
    ],
  },
  {
    date: "Jan 25, 2025",
    changes: [
      {
        type: "new",
        text: "Language switcher on article page",
        detail:
          "Switch languages directly from the reader view without returning to the homepage.",
      },
      {
        type: "fix",
        text: "Fixed language switching",
        detail:
          "Language switching now works reliably across all pages and preserves your current article.",
      },
      {
        type: "fix",
        text: "Fixed mobile keyboard behavior",
        detail:
          "The keyboard no longer auto-opens on mobile when visiting the homepage, avoiding an annoying UX issue.",
      },
    ],
  },
  {
    date: "Jan 11, 2025",
    changes: [
      {
        type: "new",
        text: "Premium AI summaries",
        detail:
          "Premium users now get summaries powered by Claude 3.5 Haiku, Gemini 3 Flash, and GPT-5 Mini — higher quality and more accurate than free-tier models.",
        premium: true,
      },
      { type: "new", text: "Changelog page" },
    ],
  },
  {
    date: "Jan 10, 2025",
    changes: [
      {
        type: "new",
        text: "Bypass status indicator",
        detail:
          "See whether each source successfully retrieved the full article, got partial content, or was blocked.",
        premium: true,
      },
    ],
  },
  {
    date: "Dec 15, 2024",
    changes: [
      {
        type: "new",
        text: "Multi-language support",
        detail:
          "SMRY is now available in English, Spanish, German, Portuguese, Dutch, and Chinese.",
      },
      {
        type: "new",
        text: "Reading history",
        detail:
          "Track and search through your reading history. Pro users get unlimited history with full-text search.",
        premium: true,
      },
    ],
  },
  {
    date: "Dec 1, 2024",
    changes: [
      {
        type: "improved",
        text: "Parallel source fetching",
        detail:
          "Articles are now fetched from multiple sources simultaneously, reducing load times and improving bypass success rates.",
      },
    ],
  },
  {
    date: "Nov 20, 2024",
    changes: [
      {
        type: "new",
        text: "AI summaries",
        detail:
          "Get AI-generated summaries of any article in seconds, available in 8 languages. Premium users get unlimited summaries.",
        premium: true,
      },
      {
        type: "new",
        text: "Copy to LLMs",
        detail:
          "One-click copy articles as clean markdown for ChatGPT, Claude, or other AI assistants.",
      },
    ],
  },
  {
    date: "Nov 10, 2024",
    changes: [
      {
        type: "fix",
        text: "Improved paywall detection",
        detail:
          "Better handling of soft paywalls that use JavaScript to hide content after page load.",
      },
    ],
  },
];

/**
 * Get the most recent changes for "What's New" display
 * Returns a flat list of the most recent changes across all entries
 */
export function getRecentChanges(limit: number = 3): Change[] {
  const allChanges: Change[] = [];
  for (const entry of changelog) {
    for (const change of entry.changes) {
      allChanges.push(change);
      if (allChanges.length >= limit) {
        return allChanges;
      }
    }
  }
  return allChanges;
}
