---
title: Marketing Sites Are the Exception
impact: LOW-MEDIUM
impactDescription: low-frequency visits allow 2-3× longer animation durations
tags: strategy, marketing, landing, exception, expression
---

## Marketing Sites Are the Exception

Marketing and landing pages are exceptions to speed rules. Users visit once or infrequently, so longer, more expressive animations are acceptable.

**Incorrect (app-style timing on marketing page):**

```css
/* Marketing hero animation */
.hero-element {
  transition: transform 200ms ease-out;
}
/* Too fast for marketing, misses opportunity for delight */
```

**Correct (expressive timing for infrequent visits):**

```css
/* Marketing hero animation */
.hero-element {
  animation: floatIn 800ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
/* Longer, more expressive animation appropriate for one-time viewing */
```

**Guidelines by context:**
- **App UI:** <300ms, subtle, functional
- **Marketing:** 500-1000ms OK, expressive, attention-grabbing
- **Onboarding:** Can be playful, guiding
- **Documentation:** Minimal, functional

Reference: [You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations)
