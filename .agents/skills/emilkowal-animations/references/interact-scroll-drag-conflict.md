---
title: Resolve Scroll and Drag Conflicts
impact: MEDIUM-HIGH
impactDescription: prevents accidental closure during scroll momentum
tags: interact, scroll, drag, conflict, drawer, mobile
---

## Resolve Scroll and Drag Conflicts

In scrollable containers like drawers, dragging should only start when scrolled to the top. Add a timeout after reaching top to prevent accidental closure from scroll momentum.

**Incorrect (drag starts immediately at top):**

```tsx
const shouldDrag = () => {
  return scrollContainer.scrollTop === 0
}
// Scroll momentum can accidentally trigger dismiss
```

**Correct (timeout prevents momentum accidents):**

```tsx
const [canDrag, setCanDrag] = useState(false)
const timeoutRef = useRef()

const onScroll = () => {
  clearTimeout(timeoutRef.current)

  if (scrollContainer.scrollTop === 0) {
    timeoutRef.current = setTimeout(() => {
      setCanDrag(true)
    }, 100) // Wait for momentum to settle
  } else {
    setCanDrag(false)
  }
}
```

This matches iOS drawer behavior where you must pause at the top before dragging to close.

Reference: [Building a Drawer Component](https://emilkowal.ski/ui/building-a-drawer-component)
