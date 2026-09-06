# Streaming with Server Actions

> Reporting progress from a long-running action. See [server-actions.md](server-actions.md) for the
> single-response shape.

---

## Pattern: Long-Running Action with Progress

`createStreamableValue` and `readStreamableValue` below are **placeholders** — Next.js ships no
streamable-value primitive, so these stand in for whichever streaming library the project uses.
Substitute its names. Only two contracts matter:

- **The writer**, created on the server with an initial value, carrying `update(value)`,
  `done(value)` and `error(value)`. Its `.value` is what the action returns.
- **The reader**, which turns that returned value into an async iterable on the client.

### Good Example — a file import that reports its progress

```typescript
// app/actions/import.ts
"use server";

import { createStreamableValue } from "./streamable"; // placeholder — see above

export async function importData(formData: FormData) {
  const stream = createStreamableValue({ progress: 0, status: "starting" });

  // Process in background, updating stream
  (async () => {
    try {
      const items = await parseFile(formData.get("file"));
      const total = items.length;

      for (let i = 0; i < items.length; i++) {
        await processItem(items[i]);
        stream.update({
          progress: Math.round(((i + 1) / total) * 100),
          status: `Processing ${i + 1} of ${total}`,
        });
      }

      stream.done({ progress: 100, status: "complete" });
    } catch (error) {
      stream.error({ progress: 0, status: "Import failed" });
    }
  })();

  return stream.value;
}
```

```typescript
// components/import-form.tsx
'use client'

import { useState } from 'react'
import { readStreamableValue } from './streamable' // placeholder — see above
import { importData } from '../app/actions/import'

export function ImportForm() {
  const [status, setStatus] = useState({ progress: 0, status: '' })

  const handleSubmit = async (formData: FormData) => {
    const stream = await importData(formData)

    for await (const value of readStreamableValue(stream)) {
      if (value) setStatus(value)
    }
  }

  return (
    <form action={handleSubmit}>
      <input type="file" name="file" />
      <button type="submit">Import</button>
      {status.status && (
        <div>
          <progress value={status.progress} max={100} />
          <span>{status.status}</span>
        </div>
      )}
    </form>
  )
}
```

**Why good:** The action returns the stream handle immediately and keeps working in the background, so
the user watches a count rise instead of a spinner with no end in sight. A failure arrives as a
stream value rather than an unhandled rejection.

---

## When to Use Streaming

The threshold is whether the user would otherwise be looking at an indeterminate spinner for long
enough to wonder if it has hung.

| Scenario                 | Use Streaming? |
| ------------------------ | -------------- |
| File imports and exports | Yes            |
| Batch operations         | Yes            |
| Token-by-token responses | Yes            |
| Ordinary create/update   | No             |
