---
title: Provide Immediate Feedback on All Actions
impact: MEDIUM
impactDescription: interfaces should feel like they're listening to the user
tags: strategy, feedback, responsive, loading, state
---

## Provide Immediate Feedback on All Actions

The interface should feel like it's listening to the user. Every action should have immediate visual feedback—loading states, success confirmations, error indicators.

**Incorrect (no feedback during action):**

```tsx
const onSubmit = async () => {
  await saveData() // User waits with no feedback
}

<button onClick={onSubmit}>Save</button>
// User wonders if click registered
```

**Correct (immediate feedback):**

```tsx
const onSubmit = async () => {
  setIsLoading(true)
  await saveData()
  setIsLoading(false)
  setShowSuccess(true)
}

<button onClick={onSubmit} disabled={isLoading}>
  {isLoading ? <Spinner /> : 'Save'}
</button>
{showSuccess && <CheckAnimation />}
// User knows action is processing
```

Feedback should be instant—even if the actual operation takes time.

Reference: [7 Practical Animation Tips](https://emilkowal.ski/ui/7-practical-animation-tips)
