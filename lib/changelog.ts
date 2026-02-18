export type ChangeType = "new" | "fix" | "improved";

export interface Change {
  type: ChangeType;
  /** Translation key for the change text (e.g., "entry1_change1_text") */
  textKey: string;
  /** Translation key for the detail (e.g., "entry1_change1_detail") */
  detailKey?: string;
  premium?: boolean;
}

export interface ChangelogEntry {
  /** Translation key for the date (e.g., "entry1_date") */
  dateKey: string;
  changes: Change[];
}

/**
 * Changelog entries using translation keys.
 * Actual text is in messages/{locale}.json under "changelogEntries"
 */
export const changelog: ChangelogEntry[] = [
  {
    dateKey: "entrySidebar_date",
    changes: [
      {
        type: "new",
        textKey: "entrySidebar_change1_text",
        detailKey: "entrySidebar_change1_detail",
      },
      {
        type: "new",
        textKey: "entrySidebar_change2_text",
        detailKey: "entrySidebar_change2_detail",
      },
      {
        type: "new",
        textKey: "entrySidebar_change3_text",
        detailKey: "entrySidebar_change3_detail",
      },
      {
        type: "new",
        textKey: "entrySidebar_change4_text",
        detailKey: "entrySidebar_change4_detail",
      },
      {
        type: "new",
        textKey: "entrySidebar_change5_text",
        detailKey: "entrySidebar_change5_detail",
      },
    ],
  },
  {
    dateKey: "entryDesign_date",
    changes: [
      {
        type: "new",
        textKey: "entryDesign_change1_text",
        detailKey: "entryDesign_change1_detail",
      },
      {
        type: "new",
        textKey: "entryDesign_change2_text",
        detailKey: "entryDesign_change2_detail",
      },
      {
        type: "improved",
        textKey: "entryDesign_change3_text",
        detailKey: "entryDesign_change3_detail",
      },
      {
        type: "improved",
        textKey: "entryDesign_change4_text",
        detailKey: "entryDesign_change4_detail",
      },
    ],
  },
  {
    dateKey: "entrySync_date",
    changes: [
      {
        type: "new",
        textKey: "entrySync_change1_text",
        detailKey: "entrySync_change1_detail",
        premium: true,
      },
      {
        type: "new",
        textKey: "entrySync_change2_text",
        detailKey: "entrySync_change2_detail",
        premium: true,
      },
      {
        type: "improved",
        textKey: "entrySync_change3_text",
        detailKey: "entrySync_change3_detail",
      },
      {
        type: "improved",
        textKey: "entrySync_change4_text",
        detailKey: "entrySync_change4_detail",
      },
    ],
  },
  {
    dateKey: "entry0_date",
    changes: [
      {
        type: "new",
        textKey: "entry0_change1_text",
        detailKey: "entry0_change1_detail",
      },
      {
        type: "improved",
        textKey: "entry0_change3_text",
        detailKey: "entry0_change3_detail",
      },
      {
        type: "new",
        textKey: "entry0_change4_text",
        detailKey: "entry0_change4_detail",
      },
    ],
  },
  {
    dateKey: "entry1_date",
    changes: [
      {
        type: "new",
        textKey: "entry1_change1_text",
        detailKey: "entry1_change1_detail",
      },
      {
        type: "new",
        textKey: "entry1_change2_text",
        detailKey: "entry1_change2_detail",
      },
      {
        type: "improved",
        textKey: "entry1_change3_text",
        detailKey: "entry1_change3_detail",
      },
      {
        type: "improved",
        textKey: "entry1_change4_text",
        detailKey: "entry1_change4_detail",
      },
      {
        type: "fix",
        textKey: "entry1_change5_text",
        detailKey: "entry1_change5_detail",
      },
    ],
  },
  {
    dateKey: "entry2_date",
    changes: [
      {
        type: "new",
        textKey: "entry2_change1_text",
        detailKey: "entry2_change1_detail",
      },
      {
        type: "fix",
        textKey: "entry2_change2_text",
        detailKey: "entry2_change2_detail",
      },
      {
        type: "fix",
        textKey: "entry2_change3_text",
        detailKey: "entry2_change3_detail",
      },
    ],
  },
  {
    dateKey: "entry3_date",
    changes: [
      {
        type: "new",
        textKey: "entry3_change1_text",
        detailKey: "entry3_change1_detail",
        premium: true,
      },
      {
        type: "new",
        textKey: "entry3_change2_text"
      },
    ],
  },
  {
    dateKey: "entry4_date",
    changes: [
      {
        type: "new",
        textKey: "entry4_change1_text",
        detailKey: "entry4_change1_detail",
        premium: true,
      },
    ],
  },
  {
    dateKey: "entry5_date",
    changes: [
      {
        type: "new",
        textKey: "entry5_change1_text",
        detailKey: "entry5_change1_detail",
      },
      {
        type: "new",
        textKey: "entry5_change2_text",
        detailKey: "entry5_change2_detail",
        premium: true,
      },
    ],
  },
  {
    dateKey: "entry6_date",
    changes: [
      {
        type: "improved",
        textKey: "entry6_change1_text",
        detailKey: "entry6_change1_detail",
      },
    ],
  },
  {
    dateKey: "entry7_date",
    changes: [
      {
        type: "new",
        textKey: "entry7_change1_text",
        detailKey: "entry7_change1_detail",
        premium: true,
      },
      {
        type: "new",
        textKey: "entry7_change2_text",
        detailKey: "entry7_change2_detail",
      },
    ],
  },
  {
    dateKey: "entry8_date",
    changes: [
      {
        type: "fix",
        textKey: "entry8_change1_text",
        detailKey: "entry8_change1_detail",
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
