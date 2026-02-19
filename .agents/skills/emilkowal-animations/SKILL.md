---
name: emilkowal-animations
description: Emil Kowalski's animation best practices for web interfaces. Use when writing, reviewing, or implementing animations in React, CSS, or Framer Motion. Triggers on tasks involving transitions, easing, gestures, toasts, drawers, or motion.
---

# Emil Kowalski Animation Best Practices

Comprehensive animation guide for web interfaces based on Emil Kowalski's teachings, open-source libraries (Sonner, Vaul), and his [animations.dev](https://animations.dev) course. Contains 43 rules across 7 categories, prioritized by impact.

## When to Apply

Reference these guidelines when:
- Adding animations to React components
- Choosing easing curves or timing values
- Implementing gesture-based interactions (swipe, drag)
- Building toast notifications or drawer components
- Optimizing animation performance
- Ensuring animation accessibility

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Easing Selection | CRITICAL | `ease-` |
| 2 | Timing & Duration | CRITICAL | `timing-` |
| 3 | Property Selection | HIGH | `props-` |
| 4 | Transform Techniques | HIGH | `transform-` |
| 5 | Interaction Patterns | MEDIUM-HIGH | `interact-` |
| 6 | Strategic Animation | MEDIUM | `strategy-` |
| 7 | Accessibility & Polish | MEDIUM | `polish-` |

## Quick Reference

### 1. Easing Selection (CRITICAL)

- [`ease-out-default`](references/ease-out-default.md) - Use ease-out as your default easing
- [`ease-custom-curves`](references/ease-custom-curves.md) - Use custom cubic-bezier over built-in CSS
- [`ease-in-out-onscreen`](references/ease-in-out-onscreen.md) - Use ease-in-out for on-screen movement
- [`ease-spring-natural`](references/ease-spring-natural.md) - Use spring animations for natural motion
- [`ease-ios-drawer`](references/ease-ios-drawer.md) - Use iOS-style easing for drawer components
- [`ease-context-matters`](references/ease-context-matters.md) - Match easing to animation context

### 2. Timing & Duration (CRITICAL)

- [`timing-300ms-max`](references/timing-300ms-max.md) - Keep UI animations under 300ms
- [`timing-faster-better`](references/timing-faster-better.md) - Faster animations improve perceived performance
- [`timing-asymmetric`](references/timing-asymmetric.md) - Use asymmetric timing for press and release
- [`timing-tooltip-delay`](references/timing-tooltip-delay.md) - Delay initial tooltips, instant subsequent ones
- [`timing-drawer-500ms`](references/timing-drawer-500ms.md) - Use 500ms duration for drawer animations

### 3. Property Selection (HIGH)

- [`props-transform-opacity`](references/props-transform-opacity.md) - Animate only transform and opacity
- [`props-hardware-accelerated`](references/props-hardware-accelerated.md) - Use hardware-accelerated animations when main thread is busy
- [`props-will-change`](references/props-will-change.md) - Use will-change to prevent 1px shift
- [`props-avoid-css-variables`](references/props-avoid-css-variables.md) - Avoid CSS variables for drag animations
- [`props-clip-path-performant`](references/props-clip-path-performant.md) - Use clip-path for layout-free reveals

### 4. Transform Techniques (HIGH)

- [`transform-scale-097`](references/transform-scale-097.md) - Scale buttons to 0.97 on press
- [`transform-never-scale-zero`](references/transform-never-scale-zero.md) - Never animate from scale(0)
- [`transform-percentage-translate`](references/transform-percentage-translate.md) - Use percentage values for translateY
- [`transform-origin-aware`](references/transform-origin-aware.md) - Make animations origin-aware
- [`transform-scale-children`](references/transform-scale-children.md) - Scale transforms affect children
- [`transform-3d-preserve`](references/transform-3d-preserve.md) - Use preserve-3d for 3D transform effects

### 5. Interaction Patterns (MEDIUM-HIGH)

- [`interact-interruptible`](references/interact-interruptible.md) - Make animations interruptible
- [`interact-momentum-dismiss`](references/interact-momentum-dismiss.md) - Use momentum-based dismissal
- [`interact-damping`](references/interact-damping.md) - Damp drag at boundaries
- [`interact-scroll-drag-conflict`](references/interact-scroll-drag-conflict.md) - Resolve scroll and drag conflicts
- [`interact-snap-points`](references/interact-snap-points.md) - Implement velocity-aware snap points
- [`interact-friction-upward`](references/interact-friction-upward.md) - Allow upward drag with friction
- [`interact-pointer-capture`](references/interact-pointer-capture.md) - Use pointer capture for drag operations

### 6. Strategic Animation (MEDIUM)

- [`strategy-keyboard-no-animate`](references/strategy-keyboard-no-animate.md) - Never animate keyboard-initiated actions
- [`strategy-frequency-matters`](references/strategy-frequency-matters.md) - Consider interaction frequency before animating
- [`strategy-purpose-required`](references/strategy-purpose-required.md) - Every animation must have a purpose
- [`strategy-feedback-immediate`](references/strategy-feedback-immediate.md) - Provide immediate feedback on all actions
- [`strategy-marketing-exception`](references/strategy-marketing-exception.md) - Marketing sites are the exception

### 7. Accessibility & Polish (MEDIUM)

- [`polish-reduced-motion`](references/polish-reduced-motion.md) - Respect prefers-reduced-motion
- [`polish-opacity-fallback`](references/polish-opacity-fallback.md) - Use opacity as reduced motion fallback
- [`polish-framer-hook`](references/polish-framer-hook.md) - Use useReducedMotion hook in Framer Motion
- [`polish-dont-remove-all`](references/polish-dont-remove-all.md) - Don't remove all animation for reduced motion
- [`polish-blur-bridge`](references/polish-blur-bridge.md) - Use blur to bridge animation states
- [`polish-clip-path-tabs`](references/polish-clip-path-tabs.md) - Use clip-path for tab transitions
- [`polish-toast-stacking`](references/polish-toast-stacking.md) - Implement toast stacking with scale and offset
- [`polish-scroll-reveal`](references/polish-scroll-reveal.md) - Trigger scroll animations at appropriate threshold
- [`polish-hover-gap-fill`](references/polish-hover-gap-fill.md) - Fill gaps between hoverable elements
- [`polish-stagger-children`](references/polish-stagger-children.md) - Stagger child animations for orchestration

## Key Values Reference

| Value | Usage |
|-------|-------|
| `cubic-bezier(0.32, 0.72, 0, 1)` | iOS-style drawer/sheet animation |
| `scale(0.97)` | Button press feedback |
| `scale(0.95)` | Minimum enter scale (never scale(0)) |
| `200ms ease-out` | Standard UI transition |
| `300ms` | Maximum duration for UI animations |
| `500ms` | Drawer animation duration |
| `0.11 px/ms` | Velocity threshold for momentum dismiss |
| `100px` | Scroll-reveal viewport threshold |
| `14px` | Toast stack offset |

## Reference Files

| File | Description |
|------|-------------|
| [references/_sections.md](references/_sections.md) | Category definitions and ordering |
| [assets/templates/_template.md](assets/templates/_template.md) | Template for new rules |
| [metadata.json](metadata.json) | Version and reference information |
