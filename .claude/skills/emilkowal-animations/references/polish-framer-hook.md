---
title: Use useReducedMotion Hook in Framer Motion
impact: MEDIUM
impactDescription: programmatic control over motion preferences
tags: polish, accessibility, framer-motion, motion, hook, react
---

## Use useReducedMotion Hook in Framer Motion

Framer Motion provides the `useReducedMotion` hook for programmatic control over motion preferences. Use it to provide alternative animations.

**Incorrect (ignores motion preference):**

```tsx
function Sidebar({ isOpen }) {
  return (
    <motion.div
      animate={{ x: isOpen ? 0 : '-100%' }}
    />
  )
}
// Slides regardless of user preference
```

**Correct (respects motion preference):**

```tsx
import { useReducedMotion, motion } from 'framer-motion'

function Sidebar({ isOpen }) {
  const shouldReduceMotion = useReducedMotion()
  const closedX = shouldReduceMotion ? 0 : '-100%'

  return (
    <motion.div
      animate={{
        opacity: isOpen ? 1 : 0,
        x: isOpen ? 0 : closedX
      }}
    />
  )
}
// Fades only when motion is reduced, slides otherwise
```

Reference: [Great Animations](https://emilkowal.ski/ui/great-animations)
