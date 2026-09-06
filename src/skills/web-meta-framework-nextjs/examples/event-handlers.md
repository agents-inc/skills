# Non-Form Event Handlers

> Invoking Server Actions from click handlers. See [server-actions.md](server-actions.md) for the
> form-based route.

---

## Pattern: Server Action with useTransition

### Good Example — a toggle button

```typescript
// components/bookmark-button.tsx
'use client'

import { useState, useTransition } from 'react'
import { toggleBookmark } from '../app/actions/bookmarks'

export function BookmarkButton({
  postId,
  initialBookmarked,
}: {
  postId: string
  initialBookmarked: boolean
}) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked)
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    // Optimistic update
    setIsBookmarked(!isBookmarked)

    startTransition(async () => {
      try {
        const result = await toggleBookmark(postId)
        setIsBookmarked(result.bookmarked)
      } catch {
        // Revert on error
        setIsBookmarked(isBookmarked)
      }
    })
  }

  return (
    <button onClick={handleClick} disabled={isPending}>
      {isBookmarked ? 'Bookmarked' : 'Bookmark'}
    </button>
  )
}
```

**Why good:** `startTransition` marks the update non-urgent, so the click still feels instant while
the request is in flight, and `isPending` disables the button against a double-fire. The `catch`
restores the previous value, which is the work `useOptimistic` would do for you inside a form.

---

## When to Use Forms vs Event Handlers

A form buys progressive enhancement; a click handler is what remains when there is no form to
enhance.

| Use Form + action                  | Use onClick + useTransition         |
| ---------------------------------- | ----------------------------------- |
| Creating or updating a record      | Toggles                             |
| Multi-field submissions            | Single-value mutations              |
| Working without JavaScript matters | Interactions with no form to submit |
| Native validation helps            | Buttons and icons                   |
