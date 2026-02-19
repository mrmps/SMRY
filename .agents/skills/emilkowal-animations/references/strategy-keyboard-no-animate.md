---
title: Never Animate Keyboard-Initiated Actions
impact: HIGH
impactDescription: keyboard users perform actions hundreds of times daily
tags: strategy, keyboard, frequency, no-animation, raycast
---

## Never Animate Keyboard-Initiated Actions

Keyboard navigation and actions may be performed hundreds of times daily. Animations on these interactions make the interface feel slow, delayed, and disconnected.

**Incorrect (animate keyboard actions):**

```tsx
const handleKeyDown = (e) => {
  if (e.key === 'ArrowDown') {
    setSelectedIndex(i => i + 1)
  }
}

// With animation
<motion.div animate={{ y: selectedIndex * 40 }} />
// Feels slow when pressing arrow keys rapidly
```

**Correct (instant keyboard response):**

```tsx
const handleKeyDown = (e) => {
  if (e.key === 'ArrowDown') {
    setSelectedIndex(i => i + 1)
  }
}

// Instant position update
<div style={{ transform: `translateY(${selectedIndex * 40}px)` }} />
// Keeps up with rapid key presses
```

Tools like Raycast that are used hundreds of times daily have no animations—and that's optimal.

Reference: [You Don't Need Animations](https://emilkowal.ski/ui/you-dont-need-animations)
