---
title: Use Hardware-Accelerated Animations When Main Thread Is Busy
impact: HIGH
impactDescription: CSS/WAAPI animations stay smooth during JavaScript execution
tags: props, hardware, gpu, waapi, css, performance
---

## Use Hardware-Accelerated Animations When Main Thread Is Busy

When the main thread is executing JavaScript, requestAnimationFrame-based animations (like Framer Motion) can become laggy. CSS animations and WAAPI run on the compositor thread, staying smooth regardless.

**Incorrect (JavaScript-driven animation):**

```tsx
// Framer Motion during heavy computation
<motion.div animate={{ x: 100 }} />
// Animation may stutter if main thread is blocked
```

**Correct (CSS or WAAPI animation):**

```tsx
// CSS transition (hardware-accelerated)
<div style={{ transform: 'translateX(100px)' }} className="transition-transform" />

// Or WAAPI
element.animate(
  [{ transform: 'translateX(0)' }, { transform: 'translateX(100px)' }],
  { duration: 200, easing: 'ease-out' }
)
```

Use Framer Motion for complex orchestration; use CSS/WAAPI for performance-critical animations during heavy computation.

Reference: [Great Animations](https://emilkowal.ski/ui/great-animations)
