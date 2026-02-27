---
title: Respect prefers-reduced-motion
impact: HIGH
impactDescription: motion can cause sickness and distraction for some users
tags: polish, accessibility, reduced-motion, media-query
---

## Respect prefers-reduced-motion

Animations can cause motion sickness or distract users with attention disorders. Respect the `prefers-reduced-motion` media query by providing alternative animations.

**Incorrect (ignores preference):**

```css
.element {
  animation: bounce 0.2s ease-out;
}
/* No consideration for motion sensitivity */
```

**Correct (respects preference):**

```css
.element {
  animation: bounce 0.2s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .element {
    animation: fade 0.2s ease-out; /* Gentler alternative */
  }
}
```

Don't remove all animation—provide safer alternatives that still communicate state changes.

Reference: [Great Animations](https://emilkowal.ski/ui/great-animations)
