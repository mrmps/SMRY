---
title: Scale Transforms Affect Children
impact: MEDIUM
impactDescription: unlike width/height, scale applies proportionally to all descendants
tags: transform, scale, children, proportional
---

## Scale Transforms Affect Children

Unlike width/height changes, scale transforms apply proportionally to all child elements. This can be a feature (cohesive scaling) or a bug (unwanted text distortion).

**Incorrect (scale when text should stay readable):**

```tsx
function ZoomableContainer({ children, zoom }) {
  return (
    <div style={{ transform: `scale(${zoom})` }}>
      {children} {/* Text becomes unreadable at low zoom */}
    </div>
  )
}
// All children including text scale proportionally
```

**Correct (use opacity + translate when children shouldn't scale):**

```tsx
function FadeContainer({ children, visible }) {
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(10px)'
    }}>
      {children} {/* Children maintain original size */}
    </div>
  )
}
// Children stay readable, only position/opacity change
```

**When scale IS desired:** Card hover effects, zoom interfaces, thumbnail previews where everything should grow together.

Reference: [CSS Transforms](https://emilkowal.ski/ui/css-transforms)
