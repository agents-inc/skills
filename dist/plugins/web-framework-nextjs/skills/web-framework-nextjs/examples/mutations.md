# Parallel Mutations

> Running independent Server Actions concurrently for better performance.

---

## Pattern: Running Independent Actions Concurrently

### Good Example - Parallel settings update

```typescript
// components/settings-form.tsx
'use client'

import { useTransition } from 'react'
import { updateProfile, updateNotifications } from '@/app/actions/settings'

export function SettingsForm({
  profile,
  notifications,
}: {
  profile: Profile
  notifications: NotificationSettings
}) {
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    startTransition(async () => {
      // Run independent mutations in parallel
      await Promise.all([
        updateProfile(profile),
        updateNotifications(notifications),
      ])
    })
  }

  return (
    <div>
      {/* Form fields */}
      <button onClick={handleSave} disabled={isPending}>
        {isPending ? 'Saving...' : 'Save All'}
      </button>
    </div>
  )
}
```

**Why good:** Independent mutations run concurrently for faster completion. Single loading state for the entire save operation.

---

## When to Use Parallel Mutations

| Scenario                      | Parallel?                               |
| ----------------------------- | --------------------------------------- |
| Independent settings sections | Yes                                     |
| Unrelated data updates        | Yes                                     |
| Sequential dependencies       | No - use await sequentially             |
| Transactions (all-or-nothing) | No - use single action with transaction |
