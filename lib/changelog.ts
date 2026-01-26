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
