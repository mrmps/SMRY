---
title: Never Animate from scale(0)
impact: HIGH
impactDescription: scale(0) feels unnatural; 0.9+ feels gentle and elegant
tags: transform, scale, enter, animation, natural
---

## Never Animate from scale(0)

Elements animating from scale(0) feel unnatural—nothing in the real world appears from nothing. Start from scale(0.9) or higher combined with opacity for gentle, elegant motion.

**Incorrect (scale from 0):**

```css
.modal {
  animation: appear 200ms ease-out;
}
@keyframes appear {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
/* Feels like element appears from nowhere */
```

**Correct (scale from 0.9+):**

```css
.modal {
  animation: appear 200ms ease-out;
}
@keyframes appear {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
/* Gentle expansion feels natural */
```

The higher initial scale makes movement feel more gentle, natural, and elegant.

Reference: [7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)
