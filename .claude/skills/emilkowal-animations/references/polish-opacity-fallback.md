---
title: Use Opacity as Reduced Motion Fallback
impact: MEDIUM-HIGH
impactDescription: opacity changes don't trigger vestibular responses
tags: polish, accessibility, reduced-motion, opacity, fallback
---

## Use Opacity as Reduced Motion Fallback

Opacity changes don't affect perceived position, size, or shape—they're safe for users with vestibular disorders. Use opacity-only transitions as your reduced motion fallback.

**Incorrect (removes all animation):**

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
/* No feedback at all, confusing UX */
```

**Correct (opacity-only fallback):**

```css
.sidebar {
  transition: transform 300ms ease-out, opacity 300ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: opacity 200ms ease-out;
    transform: none; /* No movement, only fade */
  }
}
```

This provides visual feedback without triggering motion sensitivity.

Reference: [Great Animations](https://emilkowal.ski/ui/great-animations)
