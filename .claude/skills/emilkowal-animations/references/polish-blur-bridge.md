---
title: Use Blur to Bridge Animation States
impact: MEDIUM
impactDescription: blur masks imperfections when easing alone isn't enough
tags: polish, blur, filter, crossfade, transition
---

## Use Blur to Bridge Animation States

When easing and timing adjustments don't resolve animation issues, add a subtle blur during the transition. Blur bridges the visual gap between states, masking imperfections.

**Incorrect (sharp crossfade):**

```css
.button {
  transition: background-color 200ms ease-out;
}
/* Hard transition between states */
```

**Correct (blur-bridged crossfade):**

```css
.button {
  transition: background-color 200ms ease-out, filter 200ms ease-out;
}
.button:active {
  filter: blur(2px);
}
```

**Why it works:** Blur tricks the eye into seeing a smooth transition by blending the two states together, rather than seeing two distinct objects.

Use blur sparingly—approximately 2px is usually enough.

Reference: [7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)
