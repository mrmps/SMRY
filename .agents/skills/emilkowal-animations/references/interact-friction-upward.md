---
title: Allow Upward Drag with Friction
impact: MEDIUM
impactDescription: friction feels natural, hard stops feel rigid and broken
tags: interact, friction, drag, resistance, toast, sonner
---

## Allow Upward Drag with Friction

When users drag in the "wrong" direction (e.g., upward on a swipe-to-dismiss toast), allow movement with increasing friction rather than blocking completely.

**Incorrect (hard block):**

```tsx
const onDrag = (y) => {
  if (y < 0) return // Block upward drag completely
  setDragY(y)
}
// Feels rigid and unnatural
```

**Correct (friction-based resistance):**

```tsx
const onDrag = (y) => {
  if (y < 0) {
    // Allow upward drag with friction
    const friction = 0.3
    setDragY(y * friction)
  } else {
    setDragY(y)
  }
}
// Feels soft and natural, like pushing against resistance
```

This is nicer than just stopping the element immediately—it acknowledges the user's input while guiding them.

Reference: [Building a Toast Component](https://emilkowal.ski/ui/building-a-toast-component)
