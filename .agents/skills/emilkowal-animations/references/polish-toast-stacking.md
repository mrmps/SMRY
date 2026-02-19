---
title: Implement Toast Stacking with Scale and Offset
impact: MEDIUM
impactDescription: creates visual depth hierarchy in notification system
tags: polish, toast, stacking, scale, offset, sonner
---

## Implement Toast Stacking with Scale and Offset

Create visual depth in toast notifications by offsetting and scaling each preceding toast. This creates the polished stacking effect seen in [Sonner](https://github.com/emilkowalski/sonner).

**Incorrect (flat stacking, no depth):**

```css
.toast {
  position: absolute;
  bottom: calc(var(--index) * 70px);
}
/* Toasts stack flat, no visual hierarchy */
```

**Correct (scale + offset creates depth):**

```css
.toast {
  --lift-amount: 14px;
  --toasts-before: 0; /* Set via JS */

  position: absolute;
  transform:
    translateY(calc(var(--lift-amount) * var(--toasts-before) * -1))
    scale(calc(1 - (var(--toasts-before) * 0.05)));
}
/* Visual depth: Toast 0 at scale(1), Toast 1 at scale(0.95), etc. */
```

```tsx
toasts.map((toast, index) => (
  <div
    key={toast.id}
    className="toast"
    style={{ '--toasts-before': index }}
  />
))
```

Reference: [Building a Toast Component](https://emilkowal.ski/ui/building-a-toast-component)
