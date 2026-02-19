---
title: Use ease-out as Your Default Easing
impact: CRITICAL
impactDescription: transforms animation feel from sluggish to responsive
tags: ease, easing, ease-out, transitions, responsiveness
---

## Use ease-out as Your Default Easing

The ease-out curve starts fast and slows at the end, creating an impression of quick response while maintaining smooth transitions. This mimics how objects naturally decelerate.

**Incorrect (linear easing feels robotic):**

```css
.modal {
  transition: opacity 200ms linear, transform 200ms linear;
}
/* Animation feels mechanical and disconnected */
```

**Correct (ease-out feels responsive):**

```css
.modal {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
/* Starts fast, giving immediate feedback, then settles smoothly */
```

**When to use ease-out:**
- Enter and exit animations
- User-initiated interactions (dropdowns, modals, tooltips)
- Any element responding to user action

Reference: [Great Animations](https://emilkowal.ski/ui/great-animations)
