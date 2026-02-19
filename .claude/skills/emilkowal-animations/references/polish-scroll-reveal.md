---
title: Trigger Scroll Animations at Appropriate Threshold
impact: MEDIUM
impactDescription: prevents premature activation when element barely enters viewport
tags: polish, scroll, intersection, reveal, viewport
---

## Trigger Scroll Animations at Appropriate Threshold

Don't trigger scroll-based animations the instant an element enters the viewport. Wait until a meaningful portion (at least 100px) is visible.

**Incorrect (triggers at viewport edge):**

```tsx
const { ref, inView } = useInView({ threshold: 0 })

<motion.div
  ref={ref}
  animate={{ opacity: inView ? 1 : 0 }}
/>
// Animation starts when 1px enters viewport
```

**Correct (triggers when meaningfully visible):**

```tsx
const { ref, inView } = useInView({
  threshold: 0,
  rootMargin: '-100px 0px' // Must be 100px into viewport
})

<motion.div
  ref={ref}
  animate={{ opacity: inView ? 1 : 0 }}
  transition={{ once: true }} // Only animate once
/>
// Animation starts when 100px is visible
```

The `once: true` option ensures the animation only plays on first visibility.

Reference: [The Magic of clip-path](https://emilkowal.ski/ui/the-magic-of-clip-path)
