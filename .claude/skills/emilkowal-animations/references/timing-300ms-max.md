---
title: Keep UI Animations Under 300ms
impact: CRITICAL
impactDescription: animations over 300ms feel slow and disconnected
tags: timing, duration, speed, responsiveness, ui
---

## Keep UI Animations Under 300ms

UI animations should stay under 300ms to feel responsive. Longer animations make interfaces feel slow and disconnected from user actions.

**Incorrect (slow animation):**

```css
.dropdown {
  transition: opacity 500ms ease-out, transform 500ms ease-out;
}
/* Feels sluggish, user waits for UI to catch up */
```

**Correct (snappy animation):**

```css
.dropdown {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
/* Feels responsive and connected to user action */
```

**Duration Guidelines:**
- 150–250ms for micro UI changes (buttons, toggles)
- 250–400ms for larger context switches (modals, page transitions)
- Longer durations only for marketing/intro animations

Reference: [7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)
