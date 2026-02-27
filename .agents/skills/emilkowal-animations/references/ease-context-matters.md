---
title: Match Easing to Animation Context
impact: MEDIUM
impactDescription: wrong easing for context feels off even if technically smooth
tags: ease, easing, context, enter, exit, hover
---

## Match Easing to Animation Context

Different animation contexts require different easing approaches. Using the wrong easing for a context makes animations feel off even when technically smooth.

**Easing by Context:**

| Context | Recommended Easing | Why |
|---------|-------------------|-----|
| Enter/Exit | ease-out | Immediate response, smooth settle |
| On-screen movement | ease-in-out | Natural acceleration/deceleration |
| Hover effects | ease (built-in OK) | Simple, quick feedback |
| Spring interactions | spring physics | Natural, interruptible feel |
| Exit only | ease-in | Accelerates away from view |

**Incorrect (ease-in for enter animation):**

```css
.modal-enter {
  animation: slideIn 200ms ease-in;
}
/* Slow start feels unresponsive to user action */
```

**Correct (ease-out for enter animation):**

```css
.modal-enter {
  animation: slideIn 200ms ease-out;
}
/* Fast start responds to user action immediately */
```

Reference: [animations.dev](https://animations.dev/)
