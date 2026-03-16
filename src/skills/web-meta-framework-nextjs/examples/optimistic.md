# Optimistic Updates

> Instant UI feedback while server processes. See [server-actions.md](server-actions.md) for foundational patterns.

---

## Pattern: useOptimistic for Instant Feedback

### Good Example - Optimistic message list

```typescript
// components/message-thread.tsx
'use client'

import { useOptimistic } from 'react'
import { sendMessage } from '@/app/actions/messages'

type Message = {
  id: string
  content: string
  pending?: boolean
}

export function MessageThread({ messages }: { messages: Message[] }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newContent: string) => [
      ...state,
      { id: `temp-${Date.now()}`, content: newContent, pending: true },
    ]
  )

  const handleSubmit = async (formData: FormData) => {
    const content = formData.get('content') as string

    // Immediately show optimistic update
    addOptimisticMessage(content)

    // Then perform server action
    await sendMessage(formData)
  }

  return (
    <div>
      <ul>
        {optimisticMessages.map((message) => (
          <li
            key={message.id}
            style={{ opacity: message.pending ? 0.7 : 1 }}
          >
            {message.content}
            {message.pending && <span> (sending...)</span>}
          </li>
        ))}
      </ul>

      <form action={handleSubmit}>
        <input type="text" name="content" required />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}
```

**Why good:** Instant UI feedback while server processes. Visual indication of pending messages. Proper state management with reducer pattern.

---

## When to Use Optimistic Updates

| Scenario                              | Use Optimistic?         |
| ------------------------------------- | ----------------------- |
| Adding to a list (messages, comments) | Yes                     |
| Toggle actions (like, bookmark)       | Yes                     |
| Delete operations                     | Yes (with confirmation) |
| Complex forms with validation         | No - wait for server    |
| Payment/financial operations          | No - wait for server    |
| Operations with complex side effects  | No - wait for server    |
