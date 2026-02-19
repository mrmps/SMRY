---
title: Use preserve-3d for 3D Transform Effects
impact: MEDIUM
impactDescription: enables rotateX/rotateY for depth effects like card flips
tags: transform, 3d, rotateX, rotateY, preserve-3d, perspective
---

## Use preserve-3d for 3D Transform Effects

Combine `transform-style: preserve-3d` with `rotateX()` and `rotateY()` to create 3D effects like card flips, orbiting elements, and depth animations.

**Incorrect (flat rotation, no 3D depth):**

```css
.card {
  transition: transform 500ms ease-out;
}
.card:hover {
  transform: rotateY(180deg);
}
/* Card rotates but children flatten, back isn't visible */
```

**Correct (preserve-3d maintains depth):**

```css
.card-container {
  perspective: 1000px;
}
.card {
  transform-style: preserve-3d;
  transition: transform 500ms ease-out;
}
.card:hover {
  transform: rotateY(180deg);
}
.card-front, .card-back {
  backface-visibility: hidden;
}
.card-back {
  transform: rotateY(180deg);
}
/* True 3D flip with front/back faces */
```

**Mental Model:** Think of rotateX/rotateY axes like screws—rotateX rotates around a horizontal axis (like a garage door), rotateY around a vertical axis (like a revolving door).

Reference: [CSS Transforms](https://emilkowal.ski/ui/css-transforms)
