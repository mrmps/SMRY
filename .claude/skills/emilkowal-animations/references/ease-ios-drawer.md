---
title: Use iOS-Style Easing for Drawer Components
impact: MEDIUM-HIGH
impactDescription: matches native platform feel users expect
tags: ease, drawer, ios, cubic-bezier, vaul, mobile
---

## Use iOS-Style Easing for Drawer Components

Drawer components should match the native iOS Sheet animation feel. The curve `cubic-bezier(0.32, 0.72, 0, 1)` with 500ms duration closely matches iOS behavior.

**Incorrect (generic easing):**

```css
.drawer {
  transition: transform 300ms ease-out;
}
/* Feels like a web component, not native */
```

**Correct (iOS-matched curve):**

```css
.drawer {
  transition: transform 500ms cubic-bezier(0.32, 0.72, 0, 1);
}
/* Matches iOS Sheet animation, feels native */
```

This specific curve comes from the Ionic Framework and is used in [Vaul](https://github.com/emilkowalski/vaul), Emil's drawer component library.

Reference: [Building a Drawer Component](https://emilkowal.ski/ui/building-a-drawer-component)
