# Vercel AI SDK Chat Examples

> useChat patterns for React chat interfaces, message handling, system prompts, and multi-turn conversations. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Tool calling in chat:** See [tools.md](tools.md).

---

## Pattern 1: Basic Chat with useChat

### Good Example -- Complete Chat Interface

```tsx
// components/chat.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

export function Chat() {
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    onFinish(message) {
      console.log("Assistant response complete:", message.id);
    },
    onError(error) {
      console.error("Chat error:", error);
    },
  });

  const isStreaming = status === "streaming";
  const isSubmitted = status === "submitted";
  const isDisabled = isSubmitted || isStreaming;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message message-${message.role}`}>
            <strong>{message.role === "user" ? "You" : "AI"}:</strong>
            <div>
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return <p key={index}>{part.text}</p>;
                }
                if (part.type === "tool-invocation") {
                  return (
                    <pre key={index}>Tool: {part.toolInvocation.toolName}</pre>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {isSubmitted && (
          <div className="message message-assistant">
            <em>Thinking...</em>
          </div>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <p>Error: {error.message}</p>
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isDisabled}
          autoFocus
        />
        {isStreaming ? (
          <button type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={isDisabled}>
            Send
          </button>
        )}
      </form>
    </div>
  );
}
```

**Why good:** External input state (v6 pattern), status-based UI, stop button during streaming, error display with dismiss, message parts rendering, loading indicator

### Bad Example -- Using Deprecated v4 API

```tsx
// BAD: v4 patterns
import { useChat } from "ai/react"; // Wrong import path

function Chat() {
  const {
    messages,
    input, // v6 no longer manages input
    handleInputChange, // Removed in v6
    handleSubmit, // Removed in v6
    isLoading, // Replaced by status in v6
  } = useChat();

  return (
    <form onSubmit={handleSubmit}>
      <input value={input} onChange={handleInputChange} />
      <button disabled={isLoading}>Send</button>
    </form>
  );
}
```

**Why bad:** Wrong import path (`ai/react` -> `@ai-sdk/react`), v6 no longer manages input state, `isLoading` replaced by `status`, `handleSubmit`/`handleInputChange` removed

---

## Pattern 2: Server-Side Chat Route

### Good Example -- Server Route Handler

```typescript
// app/api/chat/route.ts
import { streamText } from "ai";

export async function POST(request: Request) {
  const { messages } = await request.json();

  const result = streamText({
    model: "openai/gpt-4o",
    system:
      "You are a helpful coding assistant. Respond with clear explanations and code examples when appropriate.",
    messages,
    onError({ error }) {
      console.error("Chat stream error:", error);
    },
  });

  return result.toUIMessageStreamResponse();
}
```

**Why good:** System prompt defines behavior, `toUIMessageStreamResponse()` creates proper streaming response for `useChat`, error logging

### Good Example -- With Custom Headers and Body

```typescript
// components/chat-with-context.tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

interface ChatWithContextProps {
  projectId: string;
  userId: string;
}

export function ChatWithContext({ projectId, userId }: ChatWithContextProps) {
  const [input, setInput] = useState('');

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: {
        'X-Project-Id': projectId,
      },
      body: {
        userId,
        projectId,
      },
    }),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input.trim() });
    setInput('');
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... message rendering ... */}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={status !== 'ready'}
      />
      <button type="submit" disabled={status !== 'ready'}>Send</button>
    </form>
  );
}
```

**Why good:** v6 transport-based configuration, custom headers for auth, extra body params for context, typed props

---

## Pattern 3: Message Parts Rendering

### Good Example -- Rich Message Display

```tsx
// components/message-display.tsx
"use client";

import type { UIMessage } from "@ai-sdk/react";

interface MessageDisplayProps {
  message: UIMessage;
}

export function MessageDisplay({ message }: MessageDisplayProps) {
  return (
    <div className={`message message-${message.role}`}>
      <div className="message-header">
        <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
      </div>
      <div className="message-content">
        {message.parts.map((part, index) => {
          switch (part.type) {
            case "text":
              return (
                <div key={index} className="text-part">
                  {part.text}
                </div>
              );

            case "tool-invocation": {
              const { toolInvocation } = part;
              return (
                <div key={index} className="tool-part">
                  <details>
                    <summary>
                      Tool: {toolInvocation.toolName}
                      {toolInvocation.state === "result"
                        ? " (done)"
                        : " (pending)"}
                    </summary>
                    <pre>{JSON.stringify(toolInvocation.args, null, 2)}</pre>
                    {toolInvocation.state === "result" && (
                      <pre>
                        {JSON.stringify(toolInvocation.result, null, 2)}
                      </pre>
                    )}
                  </details>
                </div>
              );
            }

            case "source":
              return (
                <div key={index} className="source-part">
                  <a href={part.url} target="_blank" rel="noopener noreferrer">
                    {part.title ?? part.url}
                  </a>
                </div>
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
```

**Why good:** Handles all message part types, tool invocations with state tracking, source links, typed with `UIMessage`

---

## Pattern 4: Chat with Initial Messages

### Good Example -- Pre-Seeded Conversation

```tsx
// components/onboarding-chat.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

const WELCOME_MESSAGE = {
  id: "welcome-1",
  role: "assistant" as const,
  parts: [
    {
      type: "text" as const,
      text: "Welcome! I can help you set up your project. What would you like to build?",
    },
  ],
};

export function OnboardingChat() {
  const [input, setInput] = useState("");

  const { messages, sendMessage, status } = useChat({
    messages: [WELCOME_MESSAGE],
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input.trim() });
    setInput("");
  }

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong>
          {m.parts.map((p, i) =>
            p.type === "text" ? <span key={i}>{p.text}</span> : null,
          )}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== "ready"}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

**Why good:** Welcome message provides context, `messages` option for initial state, named constant for welcome

---

## Pattern 5: Regenerate and Edit Messages

### Good Example -- Message Actions

```tsx
// components/chat-with-actions.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

export function ChatWithActions() {
  const [input, setInput] = useState("");

  const { messages, sendMessage, regenerate, setMessages, status, stop } =
    useChat();

  const isActive = status === "streaming" || status === "submitted";

  function handleRegenerate() {
    if (isActive) return;
    regenerate();
  }

  function handleClearHistory() {
    if (isActive) return;
    setMessages([]);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim() || isActive) return;
    sendMessage({ text: input.trim() });
    setInput("");
  }

  const lastMessage = messages[messages.length - 1];
  const canRegenerate = lastMessage?.role === "assistant" && !isActive;

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong>
          {m.parts.map((p, i) =>
            p.type === "text" ? <span key={i}>{p.text}</span> : null,
          )}
        </div>
      ))}

      <div className="actions">
        {canRegenerate && (
          <button onClick={handleRegenerate}>Regenerate</button>
        )}
        {messages.length > 0 && !isActive && (
          <button onClick={handleClearHistory}>Clear</button>
        )}
        {isActive && <button onClick={stop}>Stop</button>}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isActive}
        />
        <button type="submit" disabled={isActive}>
          Send
        </button>
      </form>
    </div>
  );
}
```

**Why good:** `regenerate()` re-sends last assistant message, `setMessages()` for clearing, conditional action buttons, guard against actions during active streaming

---

## Pattern 6: Shared Chat State (Multiple Components)

### Good Example -- Chat Hook with ID

```tsx
// components/chat-messages.tsx
"use client";

import { useChat } from "@ai-sdk/react";

const CHAT_ID = "main-chat";

export function ChatMessages() {
  const { messages, status } = useChat({ id: CHAT_ID });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          {m.parts.map((p, i) =>
            p.type === "text" ? <p key={i}>{p.text}</p> : null,
          )}
        </div>
      ))}
      {status === "streaming" && <p>Typing...</p>}
    </div>
  );
}
```

```tsx
// components/chat-input.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

const CHAT_ID = "main-chat";

export function ChatInput() {
  const [input, setInput] = useState("");
  const { sendMessage, status } = useChat({ id: CHAT_ID });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input.trim() });
    setInput("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={status !== "ready"}
      />
      <button type="submit" disabled={status !== "ready"}>
        Send
      </button>
    </form>
  );
}
```

**Why good:** Same `id` shares state between components, messages and input in separate components, enables flexible layouts

---

_For tool calling patterns, see [tools.md](tools.md). For structured output, see [structured-output.md](structured-output.md)._
