---
title: Don't Remove All Animation for Reduced Motion
impact: MEDIUM
impactDescription: some animation aids accessibility and comprehension
tags: polish, accessibility, reduced-motion, ux, feedback
---

## Don't Remove All Animation for Reduced Motion

Going nuclear and removing all animation hurts usability. Some animations help accessibility—like loading indicators and state change feedback. Provide gentler alternatives instead.

**Incorrect (removes everything):**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
/* Loading spinners vanish, state changes are invisible */
```

**Correct (thoughtful alternatives):**

```css
@media (prefers-reduced-motion: reduce) {
  /* Disable spatial movement */
  .slide-in {
    transform: none;
    transition: opacity 200ms ease-out;
  }

  /* Keep essential feedback animations */
  .spinner {
    /* Still animates, but with reduced motion */
    animation: pulse 1s ease-in-out infinite;
  }

  .error-shake {
    /* Replace shake with color pulse */
    animation: error-pulse 200ms ease-out;
  }
}
```

Reference: [Great Animations](https://emilkowal.ski/ui/great-animations)
