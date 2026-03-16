# Streaming with Server Actions

> Real-time progress updates for long-running operations.

---

## Pattern: Long-Running Action with Progress

### Good Example - Import with streaming progress

```typescript
// app/actions/import.ts
"use server";

import { createStreamableValue } from "ai/rsc";

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
import { readStreamableValue } from 'ai/rsc'
import { importData } from '@/app/actions/import'

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

**Why good:** Real-time progress for long-running operations. Uses streamable values for server-to-client updates. User sees progress instead of just a spinner.

**Note:** This example uses `ai/rsc` (Vercel AI SDK) for streamable values. Use your streaming solution's equivalent API if different.

---

## When to Use Streaming

| Scenario             | Use Streaming? |
| -------------------- | -------------- |
| File imports/exports | Yes            |
| Batch operations     | Yes            |
| AI/LLM responses     | Yes            |
| Simple CRUD          | No - overkill  |
| Quick mutations      | No - overkill  |
