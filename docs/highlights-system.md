# Highlights & Annotations System

## Where Are Highlights Saved?

**Not signed in (anonymous users):**
- Saved in your browser's **localStorage** under keys like `article-highlights-abc123`
- Each article gets its own key based on a hash of the article URL
- If you clear browser data or switch browsers, highlights are gone

**Signed in (Clerk auth):**
- Saved on our server in **Upstash Redis** (compressed JSON)
- Key format: `highlights:{userId}:{articleHash}`
- A separate Redis Set (`highlights:{userId}:index`) tracks which articles have highlights
- TTL: **365 days** — highlights expire after 1 year of no updates
- Data syncs via React Query with 30s stale time

**In both cases:** highlights are stored as a JSON array of `Highlight` objects per article. The article is identified by a hash of its URL.

---

## Architecture Overview

```
User selects text
       |
       v
HighlightToolbar (popover with colors, copy, note, ask AI)
       |
       v
useHighlights hook (CRUD operations)
       |
       +-- Anonymous: localStorage
       +-- Signed-in: POST /api/highlights/:hash → Redis
       |
       v
HighlightsContext (React context, shared state)
       |
       +-- useInlineHighlights (renders <mark> elements in article DOM)
       +-- AnnotationsPanel (sidebar list of all highlights)
       +-- AnnotationCard (individual highlight card)
       +-- HighlightActionPopover (click existing mark → change color, delete, share)
```

---

## File Map

### Data Layer

| File | Purpose |
|------|---------|
| `lib/hooks/use-highlights.ts` | Core hook: CRUD operations, localStorage/server persistence, React Query integration |
| `lib/contexts/highlights-context.tsx` | React context provider, exposes highlights + callbacks to all consumers |
| `server/routes/highlights.ts` | Elysia API routes: GET/POST/DELETE highlights, Redis storage with compression |

### Rendering (DOM Marks)

| File | Purpose |
|------|---------|
| `lib/hooks/use-inline-highlights.ts` | Renders highlights as `<mark>` elements on article text. Builds a charmap of text nodes, finds text matches, wraps ranges. Handles incremental updates and MutationObserver re-application |
| `app/globals.css` (mark styles) | CSS for `mark[data-highlight-color]` — theme-aware background colors for each highlight color |

### UI Components

| File | Purpose |
|------|---------|
| `components/features/highlight-toolbar.tsx` | Popover shown on text selection: color picker, copy, add note, ask AI |
| `components/features/highlight-action-popover.tsx` | Popover shown on clicking an existing mark: change color, share, add note, delete |
| `components/features/highlight-popover.tsx` | Shared popover shell: portal, positioning, click-outside/escape dismiss, animation. Also exports `HIGHLIGHT_COLORS` array |
| `components/features/annotations-panel.tsx` | Main panel content: header with count/filter/export/clear, scrollable list of AnnotationCards |
| `components/features/annotation-card.tsx` | Individual highlight card: colored text preview, note display/edit, timestamp, hover actions (edit, color, copy, delete) |
| `components/features/annotations-sidebar.tsx` | Desktop sidebar wrapper using the Sidebar component (slides from right) |
| `components/features/mobile-annotations-drawer.tsx` | Mobile bottom sheet drawer using vaul-base |
| `components/features/export-highlights.tsx` | Export highlights as Markdown/JSON |

### Integration Points

| File | What it does |
|------|-------------|
| `components/features/proxy-content.tsx` | Wraps `ArticleContent` + `AnnotationsSidebar` in `HighlightsProvider`. Uses `SidebarProvider` from `components/ui/sidebar.tsx` for the chat sidebar (pushes content left) and a separate `AnnotationsSidebar` overlay from the right. Handles mobile drawer state. Keyboard shortcut `A` toggles annotations sidebar |
| `components/article/content.tsx` | `ArticleContent` component: calls `useInlineHighlights` to render marks, handles click-on-mark to show action popover, passes `onHighlight` to toolbar |
| `components/ui/sidebar.tsx` | Shadcn-style Sidebar component used for the chat sidebar. Supports controlled open/close via `SidebarProvider` with `open`/`onOpenChange` props |

---

## Data Model

```typescript
interface Highlight {
  id: string;           // "hl-{timestamp}-{random}"
  text: string;         // The highlighted text
  note?: string;        // User's annotation
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  createdAt: string;    // ISO timestamp
  contextBefore?: string;  // ~30 chars before selection (for matching)
  contextAfter?: string;   // ~30 chars after selection (for matching)
}

interface ArticleHighlights {
  articleUrl: string;
  articleTitle?: string;
  highlights: Highlight[];
  updatedAt: string;
}
```

---

## How Text Matching Works (`use-inline-highlights.ts`)

When highlights need to be rendered on the article DOM:

1. **Build charmap**: Walk all text nodes in the article container. Store one entry per text node (typically 100-500 entries) with `{ node, start, length }`. Also build a normalized version (whitespace collapsed) with a `Uint32Array` mapping normalized positions back to original positions.

2. **Find text**: For each highlight, search the normalized text for the highlight's text (also normalized). If `contextBefore` exists, prefer the match that has the right preceding context.

3. **Map back**: Convert normalized match positions to original positions via the Uint32Array lookup. Binary search the text node entries to find which DOM nodes contain the start/end.

4. **Wrap in marks**: Create a `Range` and wrap it in `<mark>` elements with `data-highlight-id` and `data-highlight-color` attributes.

5. **Incremental updates**: On subsequent renders, only add new marks and remove deleted ones. Color changes just update the attribute (no DOM surgery).

6. **MutationObserver**: Watches for external DOM changes that might destroy marks (e.g., content re-render). Re-applies all marks after a 150ms debounce.

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/highlights` | Required | Get all highlights across all articles (for export) |
| GET | `/api/highlights/:articleHash` | Required | Get highlights for a specific article |
| POST | `/api/highlights/:articleHash` | Required | Save highlights for an article (full replace) |
| DELETE | `/api/highlights/:articleHash` | Required | Delete all highlights for an article |

---

## Performance Notes

- **Charmap**: Per-text-node entries (~100-500) instead of per-character (~100K). Uses `Uint32Array` for the position mapping — no GC pressure.
- **Binary search**: Text node lookup is O(log M) instead of linear scan.
- **Stable callbacks**: All CRUD functions use functional state updates so they don't close over the `highlights` array. This prevents cascading re-renders.
- **Optimistic updates**: For signed-in users, all mutations (add, update, delete, clear) update the React Query cache immediately before the server round-trip, so the UI reflects changes instantly.
- **Synchronous localStorage writes**: For anonymous users, localStorage is written synchronously inside the React state updater to prevent race conditions where rapid mutations could cause localStorage to diverge from React state.
- **Memoized context**: The context value is wrapped in `useMemo` — consumers only re-render when actual data changes.
- **React.memo on AnnotationCard**: Custom comparator skips re-render when nothing meaningful changed.
- **Fingerprint dep**: The main rendering effect uses a string fingerprint (`id:color` pairs) instead of the highlights array reference.
- **Provider scope**: `HighlightsProvider` wraps only the article content area, not the entire page (chat, ads, settings are excluded).

---

## Theming

Both popovers (`highlight-toolbar`, `highlight-action-popover`) use theme-aware CSS variables:
- `bg-popover` / `text-popover-foreground` for backgrounds and text
- `border-border` for borders
- `text-muted-foreground` for icons

The annotation card shows highlighted text with the **same color background** used on the actual `<mark>` elements in the article (e.g., `bg-yellow-200/70 dark:bg-yellow-500/30`).

Mark colors are defined in `app/globals.css` with separate rules for light and dark themes.

---

## Adding a New Highlight Color

1. Add the color to the `Highlight['color']` union type in `lib/hooks/use-highlights.ts`
2. Add an entry to `HIGHLIGHT_COLORS` in `components/features/highlight-popover.tsx`
3. Add `COLOR_BG` mapping in `components/features/annotation-card.tsx` and `components/features/mobile-annotations-drawer.tsx`
4. Add `mark[data-highlight-color="newcolor"]` CSS rules in `app/globals.css` (both light and dark)
5. Add the Tailwind class to `getHighlightClass()` in `highlight-toolbar.tsx`

**Note:** Per AGENTS.md, never use purple in the UI. The available colors are yellow, green, blue, pink, and orange.
