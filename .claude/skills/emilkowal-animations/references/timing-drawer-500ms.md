---
title: Use 500ms Duration for Drawer Animations
impact: MEDIUM
impactDescription: matches iOS Sheet timing users expect
tags: timing, duration, drawer, ios, modal, vaul
---

## Use 500ms Duration for Drawer Animations

Drawer components are an exception to the 300ms rule. The 500ms duration with iOS-style easing matches native mobile behavior users expect.

**Incorrect (too fast for drawer):**

```css
.drawer {
  transition: transform 200ms ease-out;
}
/* Feels rushed, doesn't match native behavior */
```

**Correct (iOS-matched timing):**

```css
.drawer {
  transition: transform 500ms cubic-bezier(0.32, 0.72, 0, 1);
}
/* Matches iOS Sheet, feels native and polished */
```

The 500ms duration works because:
- Drawers cover large screen areas
- Users expect mobile-native behavior
- The custom easing makes it feel faster than it is

Reference: [Building a Drawer Component](https://emilkowal.ski/ui/building-a-drawer-component)
