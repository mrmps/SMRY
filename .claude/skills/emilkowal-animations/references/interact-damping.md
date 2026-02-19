---
title: Damp Drag at Boundaries
impact: MEDIUM-HIGH
impactDescription: resistance at limits feels natural, hard stops feel broken
tags: interact, damping, drag, boundary, resistance, drawer
---

## Damp Drag at Boundaries

When users drag past boundaries, apply resistance (damping) instead of hard stops. The more they drag, the less the element moves—like stretching a rubber band.

**Incorrect (hard stop at boundary):**

```tsx
const onDrag = (y) => {
  const clampedY = Math.max(0, y) // Hard stop at 0
  setPosition(clampedY)
}
// Dragging up at top does nothing, feels broken
```

**Correct (damped resistance):**

```tsx
const onDrag = (y) => {
  if (y < 0) {
    // Apply resistance when dragging past boundary
    const damped = y * 0.3 // 70% resistance
    setPosition(damped)
  } else {
    setPosition(y)
  }
}
// Dragging past boundary has resistance, feels natural
```

This creates the "rubber band" effect users expect from native mobile interfaces.

Reference: [Building a Drawer Component](https://emilkowal.ski/ui/building-a-drawer-component)
