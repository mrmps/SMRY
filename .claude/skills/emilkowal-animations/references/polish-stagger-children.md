---
title: Stagger Child Animations for Orchestration
impact: LOW-MEDIUM
impactDescription: staggered reveals feel more polished than simultaneous
tags: polish, stagger, orchestration, children, framer-motion
---

## Stagger Child Animations for Orchestration

Stagger child animations to create orchestrated reveals. Children should animate sequentially with small delays rather than all at once.

**Incorrect (all children animate simultaneously):**

```tsx
<motion.ul animate={{ opacity: 1 }}>
  {items.map(item => (
    <motion.li animate={{ opacity: 1, y: 0 }}>
      {item.name}
    </motion.li>
  ))}
</motion.ul>
// All items appear at once
```

**Correct (staggered children):**

```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05, // 50ms between each child
      delayChildren: 0.1    // 100ms before first child
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
}

<motion.ul variants={container} initial="hidden" animate="show">
  {items.map(listItem => (
    <motion.li variants={itemVariants}>{listItem.name}</motion.li>
  ))}
</motion.ul>
// Items cascade in sequence
```

Reference: [animations.dev](https://animations.dev/)
