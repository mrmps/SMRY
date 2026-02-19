---
title: Avoid CSS Variables for Drag Animations
impact: HIGH
impactDescription: CSS variable inheritance causes style recalculation cascade
tags: props, css-variables, drag, performance, vaul
---

## Avoid CSS Variables for Drag Animations

CSS variables are inherited by all children. During drag animations, updating a CSS variable causes expensive style recalculation for every child element.

**Incorrect (CSS variable updates cascade):**

```tsx
function Drawer({ children }) {
  const [dragY, setDragY] = useState(0)

  return (
    <div style={{ '--drag-y': `${dragY}px` }}>
      <div style={{ transform: 'translateY(var(--drag-y))' }}>
        {children} {/* All children recalculate styles */}
      </div>
    </div>
  )
}
```

**Correct (direct style update):**

```tsx
function Drawer({ children }) {
  const drawerRef = useRef()

  const onDrag = (y) => {
    drawerRef.current.style.transform = `translateY(${y}px)`
  }

  return <div ref={drawerRef}>{children}</div>
}
```

This fix eliminated frame drops in Vaul with 20+ list items.

Reference: [Building a Drawer Component](https://emilkowal.ski/ui/building-a-drawer-component)
