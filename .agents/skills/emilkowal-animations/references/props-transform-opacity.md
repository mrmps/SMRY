---
title: Animate Only Transform and Opacity
impact: CRITICAL
impactDescription: transform/opacity trigger only composite; layout properties cause jank
tags: props, transform, opacity, performance, composite, gpu
---

## Animate Only Transform and Opacity

Animating transform and opacity only triggers the composite rendering step—the cheapest operation. Animating layout properties (margin, padding, width, height) triggers expensive layout recalculations.

**Incorrect (animates layout property):**

```css
.accordion {
  transition: height 300ms ease-out, padding 300ms ease-out;
}
/* Triggers layout → paint → composite on every frame */
```

**Correct (animates transform only):**

```css
.accordion {
  transition: transform 300ms ease-out, opacity 300ms ease-out;
}
/* Triggers only composite, GPU-accelerated */
```

**Rendering Pipeline:**
1. **Layout** - Calculate positions (expensive)
2. **Paint** - Draw pixels (expensive)
3. **Composite** - Combine layers (cheap, GPU)

Transform and opacity skip steps 1 and 2.

Reference: [Great Animations](https://emilkowal.ski/ui/great-animations)
