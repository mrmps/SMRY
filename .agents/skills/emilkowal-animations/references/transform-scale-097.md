---
title: Scale Buttons to 0.97 on Press
impact: HIGH
impactDescription: instant responsive feedback with subtle physical feel
tags: transform, scale, button, press, active, feedback
---

## Scale Buttons to 0.97 on Press

Add a subtle scale-down effect when buttons are pressed. A scale of 0.97 with ~150ms transition provides instant feedback that makes interfaces feel responsive.

**Incorrect (no press feedback):**

```css
.button {
  background: blue;
}
.button:hover {
  background: darkblue;
}
/* No tactile feedback on press */
```

**Correct (scale on press):**

```css
.button {
  background: blue;
  transition: transform 150ms ease-out;
}
.button:hover {
  background: darkblue;
}
.button:active {
  transform: scale(0.97);
}
/* Subtle but noticeable press feedback */
```

This small detail makes the interface feel like it's listening to the user.

Reference: [7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)
