---
title: Delay Initial Tooltips, Instant Subsequent Ones
impact: MEDIUM-HIGH
impactDescription: prevents accidental activation while maintaining speed
tags: timing, tooltip, delay, hover, instant
---

## Delay Initial Tooltips, Instant Subsequent Ones

Tooltips should have a delay before appearing to prevent accidental activation. Once a tooltip is open, subsequent tooltips should appear instantly with no animation.

**Incorrect (same delay for all):**

```css
.tooltip {
  transition: opacity 200ms ease-out;
  transition-delay: 300ms;
}
/* Every tooltip waits 300ms, feels slow when exploring */
```

**Correct (initial delay, instant subsequent):**

```css
.tooltip {
  transition: opacity 200ms ease-out;
  transition-delay: 300ms;
}

.tooltip[data-instant] {
  transition-duration: 0ms;
  transition-delay: 0ms;
}
```

```tsx
// Set data-instant when any tooltip is already open
const [instantTooltips, setInstantTooltips] = useState(false)
```

This feels faster without defeating the purpose of the initial delay.

Reference: [7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)
