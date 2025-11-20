cat DESIGN_PHILOSOPHY.md
# Design Philosophy: Nested Card Aesthetic

## Core Principles

This design system follows an **"investor update"** aesthetic—professional, clean, and document-like. Every component should feel cohesive, subtle, and well-structured.

---

## 1. Double-Layer Depth

**Philosophy**: Create subtle visual hierarchy through layering, not harsh borders.

### Implementation
```tsx
// Outer wrapper
className="p-0.5 bg-accent rounded-[14px]"

// Inner content
className="bg-card rounded-xl p-4"
```

### Rules
- ✅ Use `p-0.5` for outer wrapper
- ✅ Use semantic tokens: `bg-accent` for outer layer
- ✅ Use semantic tokens: `bg-card` for inner content
- ✅ Semantic colors automatically adapt to light/dark mode
- ❌ No heavy box-shadows
- ❌ No harsh border colors
- ❌ Avoid hardcoded Tailwind colors (e.g., `gray-100`, `gray-800`)

### When to Use
- Cards containing multiple pieces of information
- List items that need visual separation
- Important content sections
- Interactive elements (selections, toggles)

---

## 2. Generous Rounding

**Philosophy**: Soft, modern corners that feel friendly and approachable.

### Values
- **Outer container**: `rounded-[14px]` (14px)
- **Inner content**: `rounded-xl` (12px)
- **Small elements**: `rounded-lg` (8px)
- **Icons/avatars**: `rounded-full`

### Rules
- ✅ Always maintain 2px difference between nested layers
- ✅ Use specific pixel values for consistency
- ❌ Don't mix arbitrary values with standard scale
- ❌ Avoid sharp corners (`rounded-none`) in primary UI

---

## 3. Minimal Headers

**Philosophy**: Information should be immediately scannable without visual clutter.

### Typography Scale
- **Card titles**: `text-xs font-medium` (uppercase tracking for labels)
- **Section headings**: `text-base font-medium`
- **Body text**: `text-sm` (no bold unless emphasis needed)
- **Metadata**: `text-xs text-muted-foreground`

### Rules
- ✅ Small, uppercase labels for category/section titles
- ✅ Inline descriptions using muted text
- ❌ No CardDescription components (use `<p>` instead)
- ❌ No heavy dividers between header and content
- ❌ Avoid redundant text decoration

---

## 4. Soft Separations Over Hard Borders

**Philosophy**: Use subtle visual cues rather than aggressive lines.

### Options (in order of preference)
1. **Spacing alone**: `space-y-3` or `space-y-4`
2. **Subtle dividers**: `border-border` (semantic token)
3. **Background tints**: `bg-accent` or `bg-muted` (semantic tokens)
4. **Layer separation**: Nested card double-layer effect

### Rules
- ✅ Let white space do the work
- ✅ Use 1px borders only when necessary
- ✅ Use semantic border token: `border-border`
- ✅ Semantic colors automatically work in both themes
- ❌ No thick borders (avoid `border-2` except for accents)
- ❌ No harsh contrast borders
- ❌ Avoid `shadow-lg` or heavy shadows

---

## 5. Flat, Static Design

**Philosophy**: Professional applications should feel stable, not playful.

### Interaction States
```css
/* ❌ Avoid */
hover:scale-[1.02]
transition-all
hover:shadow-lg

/* ✅ Prefer */
hover:bg-accent
hover:text-accent-foreground
transition-colors
```

### Rules
- ✅ Subtle color changes on hover
- ✅ Fast, simple transitions (colors only)
- ❌ No scale transformations
- ❌ No shadow animations
- ❌ No complex multi-property transitions

---

## 6. Ghost-First Button Philosophy

**Philosophy**: Buttons should be present but not dominate the interface.

### Button Hierarchy
1. **Primary actions**: `variant="default"` - Use sparingly (1-2 per page)
2. **Secondary actions**: `variant="ghost"` - Default for most buttons
3. **Destructive actions**: `variant="destructive"` - Delete, remove, etc.
4. **Special emphasis**: Custom colored (e.g., Twitter blue)

### Visual Style
```tsx
// Standard secondary button
<Button variant="ghost" size="sm">
  Action
</Button>

// With icon
<Button variant="ghost" size="sm">
  <Icon className="size-4 mr-1.5" />
  Action
</Button>
```

### Rules
- ✅ Use `ghost` for navigation and secondary actions
- ✅ Use `default` only for primary CTAs (submit, save, create)
- ✅ Icons should be `size-4` with `mr-1.5` spacing
- ❌ Don't use `outline` variant (too heavy)
- ❌ Don't overuse `default` variant
- ❌ Avoid button text in all caps

---

## 7. Selection Components (Nested Style)

**Philosophy**: Interactive selections should feel like choosing from organized options.

### Implementation
```tsx
<div className="p-0.5 bg-accent rounded-[14px]">
  <button
    className={cn(
      "w-full text-left bg-card rounded-xl p-4 transition-colors",
      isSelected && "bg-primary/5 ring-2 ring-primary ring-inset"
    )}
  >
    {/* Content */}
  </button>
</div>
```

### Rules
- ✅ Each option gets the nested card treatment
- ✅ Use `ring-inset` for selection state (not borders)
- ✅ Subtle background tint when selected (`bg-primary/5`)
- ✅ Include checkmark icon in top-right when selected
- ❌ No heavy borders that change on selection
- ❌ No background color swaps (only tints)

---

## 8. Form Fields

**Philosophy**: Forms should be clear and easy to scan.

### Style
- Labels: `text-xs font-medium text-muted-foreground uppercase tracking-wide`
- Inputs: Standard shadcn with subtle focus states
- Descriptions: `text-xs text-muted-foreground`
- Spacing: `space-y-4` between fields

### Rules
- ✅ Group related fields in nested cards
- ✅ Use subtle dividers between major sections
- ✅ Show validation inline, not in modals
- ❌ Don't use placeholder text as labels
- ❌ Avoid complex multi-column layouts

---

## 9. Color Usage

**Philosophy**: Color should communicate meaning, not decorate.

### Semantic Colors (Using P3 Color Space)
- **Success**: `bg-success/10` (uses theme token)
- **Info/Action**: `bg-blue-500/10` (P3 color with opacity)
- **Warning**: `bg-amber-500/10` (P3 color with opacity)
- **Danger**: `bg-destructive/10` (uses theme token)
- **Neutral layers**: `bg-accent` (outer), `bg-card` (inner)

### P3 Color Format
```tsx
// Custom P3 colors use oklch format
className="bg-[oklch(0.55_0.18_250)]"
// Light: oklch(lightness, chroma, hue)
// Dark: oklch(adjusted_lightness, chroma, hue)
```

### Rules
- ✅ Use semantic tokens when available (`bg-success`, `bg-destructive`)
- ✅ Use P3 colors (oklch) for custom brand colors
- ✅ Use tints (10% opacity) for backgrounds: `/10`
- ✅ Full saturation only for icons and small badges
- ✅ Ensure 4.5:1 contrast for text
- ❌ No bright, saturated backgrounds
- ❌ Don't use default Tailwind colors (`gray-500`, `blue-500` alone)
- ❌ Don't use color as the only indicator

---

## 10. Dark Mode

**Philosophy**: Dark mode should be equally refined, not an afterthought.

### Semantic Token Approach
All colors use semantic tokens that automatically adapt:
- `bg-accent` → light gray in light mode, dark gray in dark mode
- `bg-card` → white in light mode, dark in dark mode
- `border-border` → light border in light mode, subtle in dark mode
- `text-foreground` → dark in light mode, light in dark mode

### P3 Colors in Dark Mode
When using custom P3 colors, define both variants:
```tsx
// Email icon example
bgColor="bg-[oklch(0.55_0.18_250)] dark:bg-[oklch(0.65_0.16_250)]"
```

### Rules
- ✅ Prefer semantic tokens (they handle dark mode automatically)
- ✅ Test every component in both modes
- ✅ Use `/10` opacity for colored backgrounds (works in both modes)
- ✅ Custom P3 colors need explicit dark mode variants
- ✅ Reduce contrast slightly in dark mode (better for eyes)
- ❌ Don't use pure black (`#000000`)
- ❌ Avoid pure white text in dark mode
- ❌ Don't hardcode theme-specific colors (`gray-800`, `gray-950`)

---

## Component Checklist

When creating or updating a component, verify:

- [ ] Uses nested card structure when appropriate
- [ ] Rounded corners follow the scale (14px outer, 12px inner)
- [ ] No unnecessary shadows
- [ ] Buttons use `ghost` variant unless primary action
- [ ] No scale/transform animations
- [ ] Works perfectly in dark mode
- [ ] Typography follows the scale
- [ ] Color usage is semantic and subtle
- [ ] Spacing is consistent (`space-y-3` or `space-y-4`)
- [ ] Selection states use ring, not border changes

---

## Examples

### Good ✅
```tsx
// Nested card with action (semantic tokens)
<div className="p-0.5 bg-accent rounded-[14px]">
  <div className="bg-card rounded-xl p-4 flex items-center justify-between">
    <div>
      <p className="font-medium text-base">Item Title</p>
      <p className="text-xs text-muted-foreground">Metadata info</p>
    </div>
    <Button variant="ghost" size="sm">
      <Icon className="size-4 mr-1.5" />
      Action
    </Button>
  </div>
</div>
```

### Bad ❌
```tsx
// Too many effects, heavy styling
<div className="border-2 border-primary shadow-lg rounded-sm hover:scale-105 transition-all">
  <div className="border-b-2 p-6">
    <h3 className="text-2xl font-bold uppercase">ITEM TITLE</h3>
  </div>
  <div className="p-6">
    <Button variant="outline" className="w-full">
      <Icon />
      ACTION
    </Button>
  </div>
</div>
```

---

## Design Rationale

This system prioritizes:
1. **Professionalism**: Looks like a well-designed business application
2. **Readability**: Content is easy to scan and understand
3. **Consistency**: Patterns repeat predictably
4. **Accessibility**: High contrast, clear hierarchy, keyboard-friendly
5. **Maintainability**: Simple rules that scale

By following these principles, we create interfaces that feel **calm, organized, and trustworthy**—perfect for a professional sponsorship marketplace.

git acp idk
🪓🏗️👹 Preparing orc axes for the mighty project conquest! 👹🏗️🪓
Get ready for battle, this may take a while...

> rentmyheader@0.1.0 lint /Users/michaelryaboy/projects/better-banner
> eslint .

🔍 Checking type runes with TypeScript sorcery...
🎉 No problems found: initiating orcish conquest now.... ✨🚀🏹🛡️
[main 777adb1] idk
 3 files changed, 4036 insertions(+), 4423 deletions(-)
 create mode 100644 Flow.md
Enumerating objects: 10, done.
Counting objects: 100% (10/10), done.
Delta compression using up to 10 threads
Compressing objects: 100% (6/6), done.
Writing objects: 100% (6/6), 21.46 KiB | 7.15 MiB/s, done.
Total 6 (delta 4), reused 0 (delta 0), pack-reused 0
remote: Resolving deltas: 100% (4/4), completed with 4 local objects.
To https://github.com/mrmps/monetize-banner.git
   306a6f6..777adb1  main -> main
cat DESIGN_PHILOSOPHY.md
# Design Philosophy: Nested Card Aesthetic

## Core Principles

This design system follows an **"investor update"** aesthetic—professional, clean, and document-like. Every component should feel cohesive, subtle, and well-structured.

---

## 1. Double-Layer Depth

**Philosophy**: Create subtle visual hierarchy through layering, not harsh borders.

### Implementation
```tsx
// Outer wrapper
className="p-0.5 bg-accent rounded-[14px]"

// Inner content
className="bg-card rounded-xl p-4"
```

### Rules
- ✅ Use `p-0.5` for outer wrapper
- ✅ Use semantic tokens: `bg-accent` for outer layer
- ✅ Use semantic tokens: `bg-card` for inner content
- ✅ Semantic colors automatically adapt to light/dark mode
- ❌ No heavy box-shadows
- ❌ No harsh border colors
- ❌ Avoid hardcoded Tailwind colors (e.g., `gray-100`, `gray-800`)

### When to Use
- Cards containing multiple pieces of information
- List items that need visual separation
- Important content sections
- Interactive elements (selections, toggles)

---

## 2. Generous Rounding

**Philosophy**: Soft, modern corners that feel friendly and approachable.

### Values
- **Outer container**: `rounded-[14px]` (14px)
- **Inner content**: `rounded-xl` (12px)
- **Small elements**: `rounded-lg` (8px)
- **Icons/avatars**: `rounded-full`

### Rules
- ✅ Always maintain 2px difference between nested layers
- ✅ Use specific pixel values for consistency
- ❌ Don't mix arbitrary values with standard scale
- ❌ Avoid sharp corners (`rounded-none`) in primary UI

---

## 3. Minimal Headers

**Philosophy**: Information should be immediately scannable without visual clutter.

### Typography Scale
- **Card titles**: `text-xs font-medium` (uppercase tracking for labels)
- **Section headings**: `text-base font-medium`
- **Body text**: `text-sm` (no bold unless emphasis needed)
- **Metadata**: `text-xs text-muted-foreground`

### Rules
- ✅ Small, uppercase labels for category/section titles
- ✅ Inline descriptions using muted text
- ❌ No CardDescription components (use `<p>` instead)
- ❌ No heavy dividers between header and content
- ❌ Avoid redundant text decoration

---

## 4. Soft Separations Over Hard Borders

**Philosophy**: Use subtle visual cues rather than aggressive lines.

### Options (in order of preference)
1. **Spacing alone**: `space-y-3` or `space-y-4`
2. **Subtle dividers**: `border-border` (semantic token)
3. **Background tints**: `bg-accent` or `bg-muted` (semantic tokens)
4. **Layer separation**: Nested card double-layer effect

### Rules
- ✅ Let white space do the work
- ✅ Use 1px borders only when necessary
- ✅ Use semantic border token: `border-border`
- ✅ Semantic colors automatically work in both themes
- ❌ No thick borders (avoid `border-2` except for accents)
- ❌ No harsh contrast borders
- ❌ Avoid `shadow-lg` or heavy shadows

---

## 5. Flat, Static Design

**Philosophy**: Professional applications should feel stable, not playful.

### Interaction States
```css
/* ❌ Avoid */
hover:scale-[1.02]
transition-all
hover:shadow-lg

/* ✅ Prefer */
hover:bg-accent
hover:text-accent-foreground
transition-colors
```

### Rules
- ✅ Subtle color changes on hover
- ✅ Fast, simple transitions (colors only)
- ❌ No scale transformations
- ❌ No shadow animations
- ❌ No complex multi-property transitions

---

## 6. Ghost-First Button Philosophy

**Philosophy**: Buttons should be present but not dominate the interface.

### Button Hierarchy
1. **Primary actions**: `variant="default"` - Use sparingly (1-2 per page)
2. **Secondary actions**: `variant="ghost"` - Default for most buttons
3. **Destructive actions**: `variant="destructive"` - Delete, remove, etc.
4. **Special emphasis**: Custom colored (e.g., Twitter blue)

### Visual Style
```tsx
// Standard secondary button
<Button variant="ghost" size="sm">
  Action
</Button>

// With icon
<Button variant="ghost" size="sm">
  <Icon className="size-4 mr-1.5" />
  Action
</Button>
```

### Rules
- ✅ Use `ghost` for navigation and secondary actions
- ✅ Use `default` only for primary CTAs (submit, save, create)
- ✅ Icons should be `size-4` with `mr-1.5` spacing
- ❌ Don't use `outline` variant (too heavy)
- ❌ Don't overuse `default` variant
- ❌ Avoid button text in all caps

---

## 7. Selection Components (Nested Style)

**Philosophy**: Interactive selections should feel like choosing from organized options.

### Implementation
```tsx
<div className="p-0.5 bg-accent rounded-[14px]">
  <button
    className={cn(
      "w-full text-left bg-card rounded-xl p-4 transition-colors",
      isSelected && "bg-primary/5 ring-2 ring-primary ring-inset"
    )}
  >
    {/* Content */}
  </button>
</div>
```

### Rules
- ✅ Each option gets the nested card treatment
- ✅ Use `ring-inset` for selection state (not borders)
- ✅ Subtle background tint when selected (`bg-primary/5`)
- ✅ Include checkmark icon in top-right when selected
- ❌ No heavy borders that change on selection
- ❌ No background color swaps (only tints)

---

## 8. Form Fields

**Philosophy**: Forms should be clear and easy to scan.

### Style
- Labels: `text-xs font-medium text-muted-foreground uppercase tracking-wide`
- Inputs: Standard shadcn with subtle focus states
- Descriptions: `text-xs text-muted-foreground`
- Spacing: `space-y-4` between fields

### Rules
- ✅ Group related fields in nested cards
- ✅ Use subtle dividers between major sections
- ✅ Show validation inline, not in modals
- ❌ Don't use placeholder text as labels
- ❌ Avoid complex multi-column layouts

---

## 9. Color Usage

**Philosophy**: Color should communicate meaning, not decorate.

### Semantic Colors (Using P3 Color Space)
- **Success**: `bg-success/10` (uses theme token)
- **Info/Action**: `bg-blue-500/10` (P3 color with opacity)
- **Warning**: `bg-amber-500/10` (P3 color with opacity)
- **Danger**: `bg-destructive/10` (uses theme token)
- **Neutral layers**: `bg-accent` (outer), `bg-card` (inner)

### P3 Color Format
```tsx
// Custom P3 colors use oklch format
className="bg-[oklch(0.55_0.18_250)]"
// Light: oklch(lightness, chroma, hue)
// Dark: oklch(adjusted_lightness, chroma, hue)
```

### Rules
- ✅ Use semantic tokens when available (`bg-success`, `bg-destructive`)
- ✅ Use P3 colors (oklch) for custom brand colors
- ✅ Use tints (10% opacity) for backgrounds: `/10`
- ✅ Full saturation only for icons and small badges
- ✅ Ensure 4.5:1 contrast for text
- ❌ No bright, saturated backgrounds
- ❌ Don't use default Tailwind colors (`gray-500`, `blue-500` alone)
- ❌ Don't use color as the only indicator

---

## 10. Dark Mode

**Philosophy**: Dark mode should be equally refined, not an afterthought.

### Semantic Token Approach
All colors use semantic tokens that automatically adapt:
- `bg-accent` → light gray in light mode, dark gray in dark mode
- `bg-card` → white in light mode, dark in dark mode
- `border-border` → light border in light mode, subtle in dark mode
- `text-foreground` → dark in light mode, light in dark mode

### P3 Colors in Dark Mode
When using custom P3 colors, define both variants:
```tsx
// Email icon example
bgColor="bg-[oklch(0.55_0.18_250)] dark:bg-[oklch(0.65_0.16_250)]"
```

### Rules
- ✅ Prefer semantic tokens (they handle dark mode automatically)
- ✅ Test every component in both modes
- ✅ Use `/10` opacity for colored backgrounds (works in both modes)
- ✅ Custom P3 colors need explicit dark mode variants
- ✅ Reduce contrast slightly in dark mode (better for eyes)
- ❌ Don't use pure black (`#000000`)
- ❌ Avoid pure white text in dark mode
- ❌ Don't hardcode theme-specific colors (`gray-800`, `gray-950`)

---

## Component Checklist

When creating or updating a component, verify:

- [ ] Uses nested card structure when appropriate
- [ ] Rounded corners follow the scale (14px outer, 12px inner)
- [ ] No unnecessary shadows
- [ ] Buttons use `ghost` variant unless primary action
- [ ] No scale/transform animations
- [ ] Works perfectly in dark mode
- [ ] Typography follows the scale
- [ ] Color usage is semantic and subtle
- [ ] Spacing is consistent (`space-y-3` or `space-y-4`)
- [ ] Selection states use ring, not border changes

---

## Examples

### Good ✅
```tsx
// Nested card with action (semantic tokens)
<div className="p-0.5 bg-accent rounded-[14px]">
  <div className="bg-card rounded-xl p-4 flex items-center justify-between">
    <div>
      <p className="font-medium text-base">Item Title</p>
      <p className="text-xs text-muted-foreground">Metadata info</p>
    </div>
    <Button variant="ghost" size="sm">
      <Icon className="size-4 mr-1.5" />
      Action
    </Button>
  </div>
</div>
```

### Bad ❌
```tsx
// Too many effects, heavy styling
<div className="border-2 border-primary shadow-lg rounded-sm hover:scale-105 transition-all">
  <div className="border-b-2 p-6">
    <h3 className="text-2xl font-bold uppercase">ITEM TITLE</h3>
  </div>
  <div className="p-6">
    <Button variant="outline" className="w-full">
      <Icon />
      ACTION
    </Button>
  </div>
</div>
```

---

## Design Rationale

This system prioritizes:
1. **Professionalism**: Looks like a well-designed business application
2. **Readability**: Content is easy to scan and understand
3. **Consistency**: Patterns repeat predictably
4. **Accessibility**: High contrast, clear hierarchy, keyboard-friendly
5. **Maintainability**: Simple rules that scale

By following these principles, we create interfaces that feel **calm, organized, and trustworthy**—perfect for a professional sponsorship marketplace.