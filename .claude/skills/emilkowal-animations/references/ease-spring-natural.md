---
title: Use Spring Animations for Natural Motion
impact: HIGH
impactDescription: spring physics creates organic, lifelike movement
tags: ease, spring, framer-motion, motion, physics, natural
---

## Use Spring Animations for Natural Motion

Nothing in the real world moves with perfect easing curves. Spring animations create organic, lifelike movement that makes interfaces feel more connected to reality.

**Incorrect (instant value update):**

```tsx
function Counter({ value }) {
  return <span>{value}</span>
}
// Value jumps instantly, feels artificial
```

**Correct (spring-interpolated value):**

```tsx
import { useSpring, motion } from 'framer-motion'

function Counter({ value }) {
  const spring = useSpring(value, { stiffness: 100, damping: 30 })
  return <motion.span>{spring}</motion.span>
}
// Value animates with spring physics, feels natural
```

**When NOT to use springs:**
- Functional interfaces where speed matters (banking apps, data entry)
- High-frequency interactions the user performs hundreds of times daily

Reference: [Good vs Great Animations](https://emilkowal.ski/ui/good-vs-great-animations)
