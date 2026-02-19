---
title: Use Pointer Capture for Drag Operations
impact: MEDIUM
impactDescription: drag continues even when pointer leaves element bounds
tags: interact, pointer-capture, drag, swipe, gesture
---

## Use Pointer Capture for Drag Operations

Use pointer capture during drag operations so the drag continues even when the pointer moves outside the element bounds.

**Incorrect (drag breaks at boundary):**

```tsx
const onPointerMove = (e) => {
  if (!isDragging) return
  updatePosition(e.clientY)
}
// Drag breaks if pointer leaves element
```

**Correct (pointer capture maintains drag):**

```tsx
const onPointerDown = (e) => {
  e.target.setPointerCapture(e.pointerId)
  setIsDragging(true)
}

const onPointerMove = (e) => {
  if (!isDragging) return
  updatePosition(e.clientY)
}

const onPointerUp = (e) => {
  e.target.releasePointerCapture(e.pointerId)
  setIsDragging(false)
}
// Drag continues even if pointer leaves element bounds
```

This is essential for swipe-to-dismiss and drag interactions where users naturally overshoot.

Reference: [Building a Toast Component](https://emilkowal.ski/ui/building-a-toast-component)
