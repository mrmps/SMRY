---
title: Use Percentage Values for translateY
impact: HIGH
impactDescription: element-relative values adapt to varying dimensions
tags: transform, translate, percentage, responsive, toast, drawer
---

## Use Percentage Values for translateY

Use percentage values instead of fixed pixels for translateY. Percentages are relative to the element's own dimensions, automatically adapting to varying content sizes.

**Incorrect (fixed pixel value):**

```css
.toast {
  transform: translateY(60px); /* Assumes toast is 60px tall */
}
/* Breaks if toast height varies */
```

**Correct (percentage value):**

```css
.toast {
  transform: translateY(100%); /* Always moves by its own height */
}
/* Works regardless of toast content/height */
```

This pattern is used in [Sonner](https://github.com/emilkowalski/sonner) for toasts and [Vaul](https://github.com/emilkowalski/vaul) for variable-height drawers.

Reference: [CSS Transforms](https://emilkowal.ski/ui/css-transforms)
