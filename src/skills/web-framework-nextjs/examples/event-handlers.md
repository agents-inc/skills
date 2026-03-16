# Non-Form Event Handlers

> Calling Server Actions from click handlers and other events. See [server-actions.md](server-actions.md) for form-based patterns.

---

## Pattern: Server Action with useTransition

### Good Example - Toggle button with optimistic update

```typescript
// components/bookmark-button.tsx
'use client'

import { useState, useTransition } from 'react'
import { toggleBookmark } from '@/app/actions/bookmarks'

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

**Why good:** `startTransition` keeps UI responsive. Optimistic update for instant feedback. Error handling reverts state on failure.

---

## When to Use Forms vs Event Handlers

| Use Form + action              | Use onClick + useTransition  |
| ------------------------------ | ---------------------------- |
| Creating/updating data         | Toggle actions               |
| Multi-field submissions        | Single-value mutations       |
| Progressive enhancement needed | Complex UI interactions      |
| Native validation helpful      | Non-form UI (buttons, icons) |
