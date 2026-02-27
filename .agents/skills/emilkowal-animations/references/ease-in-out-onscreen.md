---
title: Use ease-in-out for On-Screen Movement
impact: HIGH
impactDescription: natural acceleration/deceleration mimics physical motion
tags: ease, easing, ease-in-out, movement, physics
---

## Use ease-in-out for On-Screen Movement

For elements already visible that move from one position to another, ease-in-out creates natural motion by accelerating at the start and decelerating at the end—like a vehicle.

**Incorrect (ease-out for positional change):**

```css
.slider-thumb {
  transition: left 300ms ease-out;
}
/* Starts too fast, feels jarring for on-screen movement */
```

**Correct (ease-in-out for smooth repositioning):**

```css
.slider-thumb {
  transition: transform 300ms ease-in-out;
}
/* Accelerates naturally, then settles into place */
```

**When to use ease-in-out:**
- Carousel slides
- Tab indicator movement
- Drag-and-drop repositioning
- Any element moving across the screen

Reference: [Good vs Great Animations](https://emilkowal.ski/ui/good-vs-great-animations)
