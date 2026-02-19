---
title: Faster Animations Improve Perceived Performance
impact: CRITICAL
impactDescription: 180ms vs 400ms creates noticeably different responsiveness feel
tags: timing, duration, speed, performance, perceived
---

## Faster Animations Improve Perceived Performance

Faster animations don't just complete quicker—they make your entire interface feel more responsive and performant. A 180ms animation feels noticeably better than 400ms.

**Incorrect (unnecessarily slow):**

```css
.select-dropdown {
  transition: transform 400ms ease-out;
}
/* Feels slow even though animation is smooth */
```

**Correct (appropriately fast):**

```css
.select-dropdown {
  transition: transform 180ms ease-out;
}
/* Feels snappy and responsive */
```

**The Speed Principle:**
- Animations improve perceived performance when fast
- Animations degrade perceived performance when slow
- When in doubt, make it faster

Reference: [7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)
