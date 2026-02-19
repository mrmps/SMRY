---
title: Consider Interaction Frequency Before Animating
impact: HIGH
impactDescription: animations on frequent actions become annoying, not delightful
tags: strategy, frequency, delight, annoyance, purpose
---

## Consider Interaction Frequency Before Animating

Animations that delight on first use become annoying on the hundredth. Consider how often users will see an animation before adding it.

**Frequency Guidelines:**

| Frequency | Animation Approach |
|-----------|-------------------|
| Once (onboarding) | Full, expressive animations OK |
| Daily | Subtle, fast animations |
| Hourly | Very subtle or none |
| Constantly | No animation |

**Incorrect (animate frequent action):**

```tsx
// User switches tabs dozens of times per session
<TabContent
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.3 }}
/>
// Initial delight fades, becomes annoying
```

**Correct (instant for frequent, animated for rare):**

```tsx
// Frequent: instant
<TabContent style={{ opacity: 1 }} />

// Rare (first visit): animated
{isFirstVisit && (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
)}
```

Reference: [You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations)
