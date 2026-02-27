---
title: Fill Gaps Between Hoverable Elements
impact: LOW-MEDIUM
impactDescription: prevents hover state from dropping when crossing gaps
tags: polish, hover, pseudo-element, gap, toast
---

## Fill Gaps Between Hoverable Elements

When hovering should persist across a group of elements with gaps between them, use pseudo-elements to fill the gaps and maintain hover state.

**Incorrect (hover drops in gaps):**

```css
.toast {
  margin-bottom: 8px;
}
.toast:hover {
  /* Hover drops when moving between toasts */
}
```

**Correct (pseudo-element fills gap):**

```css
.toast {
  margin-bottom: 8px;
  position: relative;
}

.toast::after {
  content: '';
  position: absolute;
  bottom: -8px; /* Fills the gap */
  left: 0;
  right: 0;
  height: 8px;
}

.toast-container:hover .toast {
  /* Hover persists when moving between toasts */
}
```

This technique maintains hover state when moving mouse between stacked toasts.

Reference: [Building a Toast Component](https://emilkowal.ski/ui/building-a-toast-component)
