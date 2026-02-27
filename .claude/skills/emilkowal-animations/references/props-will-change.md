---
title: Use will-change to Prevent 1px Shift
impact: MEDIUM
impactDescription: prevents subpixel rendering inconsistencies at animation end
tags: props, will-change, gpu, layer, subpixel
---

## Use will-change to Prevent 1px Shift

If you notice a 1px shift at the end of your animation, use `will-change: transform` to keep the element on its own compositor layer throughout the animation.

**Incorrect (subpixel shift at end):**

```css
.card {
  transition: transform 200ms ease-out;
}
/* May show 1px shift when animation completes */
```

**Correct (stable layer throughout):**

```css
.card {
  transition: transform 200ms ease-out;
  will-change: transform;
}
/* GPU handles animation consistently, no shift */
```

**Caution:** Don't overuse `will-change`—it consumes memory. Only apply to elements that will animate frequently.

Reference: [@emilkowalski_](https://x.com/emilkowalski_/status/1981352193262256182)
