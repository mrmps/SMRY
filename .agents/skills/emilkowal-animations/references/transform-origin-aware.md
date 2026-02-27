---
title: Make Animations Origin-Aware
impact: HIGH
impactDescription: animations from source feel intentional, arbitrary origins feel broken
tags: transform, transform-origin, dropdown, popover, radix
---

## Make Animations Origin-Aware

Dropdowns and popovers should animate from their trigger element, not from an arbitrary center point. Set transform-origin to match where the animation originates.

**Incorrect (default center origin):**

```css
.dropdown {
  transform-origin: center; /* Default */
  animation: scaleIn 200ms ease-out;
}
/* Dropdown scales from middle, disconnected from button */
```

**Correct (origin matches trigger):**

```css
.dropdown {
  transform-origin: top center; /* Matches button position */
  animation: scaleIn 200ms ease-out;
}
```

**With Radix UI:**

```css
.dropdown {
  transform-origin: var(--radix-dropdown-menu-content-transform-origin);
}
/* Radix automatically calculates correct origin */
```

shadcn/ui handles this automatically.

Reference: [Good vs Great Animations](https://emilkowal.ski/ui/good-vs-great-animations)
