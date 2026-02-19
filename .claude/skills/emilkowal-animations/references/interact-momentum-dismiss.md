---
title: Use Momentum-Based Dismissal
impact: HIGH
impactDescription: flick gestures feel natural, threshold-only feels rigid
tags: interact, momentum, velocity, swipe, dismiss, gesture
---

## Use Momentum-Based Dismissal

Allow users to dismiss elements with a fast flick, not just by dragging past a threshold. Calculate velocity and dismiss if either distance OR velocity exceeds threshold.

**Incorrect (distance-only threshold):**

```tsx
const onDragEnd = (dragDistance) => {
  if (Math.abs(dragDistance) > 100) {
    dismiss()
  }
}
// Fast flicks don't dismiss if distance is short
```

**Correct (momentum-based):**

```tsx
const onDragEnd = (dragDistance, dragDuration) => {
  const velocity = Math.abs(dragDistance) / dragDuration

  if (Math.abs(dragDistance) > 100 || velocity > 0.11) {
    dismiss()
  }
}
// Fast flicks dismiss even with short distance
```

The velocity threshold of ~0.11 pixels/millisecond works well for most swipe-to-dismiss interactions.

Reference: [Building a Toast Component](https://emilkowal.ski/ui/building-a-toast-component)
