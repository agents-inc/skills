# Optimistic Updates

> Showing the result before the server confirms it. See [server-actions.md](server-actions.md) for
> the action shape.

---

## Pattern: useOptimistic for Instant Feedback

### Good Example — an optimistic message list

```typescript
// components/message-thread.tsx
'use client'

import { useOptimistic } from 'react'
import { sendMessage } from '../app/actions/messages'

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

**Why good:** The message appears the instant it is typed, dimmed until the server confirms it. React
discards the optimistic entry when the action settles, so a failure needs no rollback code — the list
reverts to the server's version.

---

## When to Use Optimistic Updates

The test is the success rate: reach for it where failure is rare, and skip it where a rollback would
confuse or alarm.

| Scenario                                             | Use Optimistic?          |
| ---------------------------------------------------- | ------------------------ |
| Adding to a list (messages, comments)                | Yes                      |
| Toggle actions (like, bookmark)                      | Yes                      |
| Delete operations                                    | Yes, with a confirmation |
| Forms whose validation runs on the server            | No — wait for the answer |
| Payments and anything financial                      | No — wait for the answer |
| Operations with side effects the user sees elsewhere | No — wait for the answer |
