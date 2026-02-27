---
title: Every Animation Must Have a Purpose
impact: MEDIUM
impactDescription: purposeless animation degrades rather than enhances experience
tags: strategy, purpose, intentional, design
---

## Every Animation Must Have a Purpose

The goal is not to animate for animation's sake. Every animation should serve a clear purpose—guiding attention, providing feedback, or maintaining context.

**Valid purposes for animation:**
- **Feedback** - Confirming user actions (button press, form submit)
- **Orientation** - Showing where something came from or went
- **Attention** - Drawing focus to important changes
- **Continuity** - Maintaining context during transitions

**Incorrect (animation without purpose):**

```tsx
// Random bounce on page load
<motion.h1
  animate={{ y: [0, -10, 0] }}
  transition={{ repeat: Infinity, duration: 2 }}
>
  Welcome
</motion.h1>
// Why is this bouncing? No clear purpose.
```

**Correct (animation with purpose):**

```tsx
// Feedback animation on successful action
<motion.div
  animate={isSuccess ? { scale: [1, 1.1, 1] } : {}}
>
  <CheckIcon />
</motion.div>
// Animation provides feedback for user action
```

Reference: [You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations)
