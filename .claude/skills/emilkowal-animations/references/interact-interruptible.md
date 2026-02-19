---
title: Make Animations Interruptible
impact: HIGH
impactDescription: interruptible animations feel responsive, locked animations feel broken
tags: interact, interruptible, css, transitions, framer-motion
---

## Make Animations Interruptible

Users should be able to change animation state at any time with smooth transitions. CSS transitions naturally support interruption; keyframes do not.

**Incorrect (keyframes can't be interrupted):**

```css
.sidebar {
  animation: slideIn 300ms ease-out;
}
@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
/* If user closes mid-animation, it jumps or glitches */
```

**Correct (transitions retarget smoothly):**

```css
.sidebar {
  transform: translateX(-100%);
  transition: transform 300ms ease-out;
}
.sidebar.open {
  transform: translateX(0);
}
/* User can open/close anytime, animation retargets smoothly */
```

Framer Motion also supports interruptible animations natively.

Reference: [Great Animations](https://emilkowal.ski/ui/great-animations)
