---
title: Use clip-path for Layout-Free Reveals
impact: MEDIUM-HIGH
impactDescription: hardware-accelerated, no layout shifts, no extra DOM
tags: props, clip-path, reveal, performance, hardware
---

## Use clip-path for Layout-Free Reveals

Clip-path creates reveal animations without layout shifts—elements occupy their full space while visually clipped. It's hardware-accelerated and requires no extra DOM elements.

**Incorrect (animating height causes layout shift):**

```css
.reveal {
  height: 0;
  overflow: hidden;
  transition: height 300ms ease-out;
}
.reveal.open {
  height: auto; /* Causes layout recalculation */
}
```

**Correct (clip-path, no layout shift):**

```css
.reveal {
  clip-path: inset(0 0 100% 0); /* Hidden */
  transition: clip-path 300ms ease-out;
}
.reveal.open {
  clip-path: inset(0 0 0 0); /* Fully revealed */
}
```

**Common clip-path patterns:**
- `inset(0 0 100% 0)` - Hide bottom
- `inset(100% 0 0 0)` - Hide top
- `inset(0 100% 0 0)` - Hide right
- `inset(0 0 0 100%)` - Hide left

Reference: [The Magic of clip-path](https://emilkowal.ski/ui/the-magic-of-clip-path)
