# Parallel Mutations

> Running independent mutations at the same time. See [server-actions.md](server-actions.md) for the
> single-action shape.

---

## Pattern: One Action That Parallelises on the Server

Actions invoked from the client queue and run one at a time, so parallelism has to happen inside a
single action.

### Good Example — settings sections saved as one operation

```typescript
// app/actions/settings.ts
"use server";

import { revalidatePath } from "next/cache";

export async function updateSettings(
  profile: Profile,
  notifications: NotificationSettings,
) {
  // Inside one action these genuinely overlap
  await Promise.all([saveProfile(profile), saveNotifications(notifications)]);

  revalidatePath("/settings");
}
```

```typescript
// components/settings-form.tsx
'use client'

import { useTransition } from 'react'
import { updateSettings } from '../app/actions/settings'

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
      await updateSettings(profile, notifications)
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

**Why good:** One round trip instead of two, the two writes overlap on the server, and one
`isPending` flag covers the whole save so the UI has a single state to show.

### Bad Example — `Promise.all` over two actions from the client

```typescript
// The two calls are dispatched together and still execute back to back
await Promise.all([updateProfile(profile), updateNotifications(notifications)]);
```

**Why bad:** `Promise.all` parallelises the awaiting, not the execution — client-invoked Server
Actions queue. The code reads as concurrent and runs as sequential, so nothing reports the lost
time.

---

## When to Combine Mutations

| Scenario                        | One action?                               |
| ------------------------------- | ----------------------------------------- |
| Independent settings sections   | Yes — `Promise.all` inside it             |
| Unrelated data updates          | Yes, where one interaction triggers both  |
| One depends on another's result | Yes — await them in order inside it       |
| All-or-nothing                  | Yes — one action wrapping one transaction |
