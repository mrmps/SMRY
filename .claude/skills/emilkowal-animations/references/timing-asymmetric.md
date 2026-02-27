---
title: Use Asymmetric Timing for Press and Release
impact: HIGH
impactDescription: slow press for confirmation, fast release for feedback
tags: timing, duration, press, release, asymmetric, hold
---

## Use Asymmetric Timing for Press and Release

Press and release actions have different purposes. Pressing should be slow to allow user confirmation; release should be fast for snappy feedback.

**Incorrect (symmetric timing):**

```css
.hold-button .progress {
  transition: clip-path 500ms ease-out;
}
/* Same speed for both directions feels wrong */
```

**Correct (asymmetric timing):**

```css
.hold-button .progress {
  transition: clip-path 200ms ease-out; /* Fast release */
}

.hold-button:active .progress {
  transition: clip-path 2s linear; /* Slow press for confirmation */
}
```

This pattern is used in hold-to-delete and hold-to-confirm interactions where the slow press gives users time to reconsider, while the fast release provides immediate feedback.

Reference: [Building a Hold to Delete Component](https://emilkowal.ski/ui/building-a-hold-to-delete-component)
