---
title: Use Custom Easing Curves Over Built-in CSS
impact: CRITICAL
impactDescription: built-in CSS curves lack energy, custom curves feel 2-3× more polished
tags: ease, easing, cubic-bezier, custom-curves
---

## Use Custom Easing Curves Over Built-in CSS

Built-in CSS easing curves (ease, ease-in, ease-out) are usually not strong enough. Custom cubic-bezier curves feel more energetic and polished.

**Incorrect (weak built-in curve):**

```css
.dropdown {
  transition: transform 200ms ease-out;
}
/* Feels generic and muted */
```

**Correct (custom curve with more character):**

```css
.dropdown {
  transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}
/* Feels energetic and intentional */
```

**Exception:** The `ease` keyword works well for basic hover effects like background color changes—anything more complex needs a custom curve.

**Resources for custom curves:**
- [easings.co](https://easings.co)
- [easing.dev](https://easing.dev)

Reference: [Good vs Great Animations](https://emilkowal.ski/ui/good-vs-great-animations)
