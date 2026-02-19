---
title: Implement Velocity-Aware Snap Points
impact: MEDIUM
impactDescription: fast flicks skip snap points naturally, slow drags snap to closest
tags: interact, snap, velocity, drawer, momentum, vaul
---

## Implement Velocity-Aware Snap Points

Snap points should respond to velocity—fast flicks can skip intermediate points, while slow drags snap to the closest point.

**Incorrect (always snaps to closest):**

```tsx
const onDragEnd = (position) => {
  const closest = snapPoints.reduce((a, b) =>
    Math.abs(b - position) < Math.abs(a - position) ? b : a
  )
  animateTo(closest)
}
// Fast flick to close stops at intermediate point
```

**Correct (velocity allows skipping):**

```tsx
const onDragEnd = (position, velocity) => {
  if (velocity > 0.5) {
    // Fast flick - snap to point in direction of velocity
    const target = velocity > 0 ? snapPoints[snapPoints.length - 1] : snapPoints[0]
    animateTo(target)
  } else {
    // Slow drag - snap to closest
    const closest = findClosest(snapPoints, position)
    animateTo(closest)
  }
}
// Fast flicks can close completely, slow drags snap to nearest
```

Reference: [Building a Drawer Component](https://emilkowal.ski/ui/building-a-drawer-component)
