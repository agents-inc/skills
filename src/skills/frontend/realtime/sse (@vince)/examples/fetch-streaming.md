# SSE Examples - Fetch Streaming Patterns

> Fetch-based streaming for Server-Sent Events when EventSource limitations apply. See [SKILL.md](../SKILL.md) for concepts.

**When to use fetch streaming instead of EventSource:**
- Need to send custom HTTP headers (Authorization, custom headers)
- Need to use POST or other HTTP methods
- Need request body (JSON payload, etc.)
- Need more control over connection lifecycle

---

## Pattern 16: Basic Fetch Streaming

When EventSource's GET-only limitation is a problem, use fetch with ReadableStream.

### Constants

```typescript
const SSE_URL = "/api/events";
const SSE_CONTENT_TYPE = "text/event-stream";
```

### Implementation

```typescript
// ✅ Good Example - Fetch-based SSE streaming
async function* streamSSE(
  url: string,
  options?: RequestInit
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: SSE_CONTENT_TYPE,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by double newlines
      const parts = buffer.split("\n\n");

      // Keep the last incomplete part in buffer
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (part.trim()) {
          yield part;
        }
      }
    }

    // Process any remaining data
    if (buffer.trim()) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}

// Usage
async function consumeStream() {
  try {
    for await (const message of streamSSE(SSE_URL)) {
      console.log("SSE message:", message);
      // Parse and handle the message
    }
  } catch (error) {
    console.error("Stream error:", error);
  }
}
```

**Why good:** AsyncGenerator provides clean iteration API, TextDecoder handles partial UTF-8 sequences, buffer handles message boundaries, proper resource cleanup with releaseLock

---

## Pattern 17: SSE Message Parser

Parse raw SSE format into structured data.

```typescript
// utils/sse-parser.ts

interface SSEParsedMessage {
  data: string;
  event: string | null;
  id: string | null;
  retry: number | null;
}

function parseSSEMessage(raw: string): SSEParsedMessage {
  const lines = raw.split("\n");
  const dataLines: string[] = [];
  let event: string | null = null;
  let id: string | null = null;
  let retry: number | null = null;

  for (const line of lines) {
    // Comment (keep-alive)
    if (line.startsWith(":")) {
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const field = line.slice(0, colonIndex);
    // Value starts after colon, skip optional space
    let value = line.slice(colonIndex + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    switch (field) {
      case "data":
        dataLines.push(value);
        break;
      case "event":
        event = value;
        break;
      case "id":
        id = value;
        break;
      case "retry":
        const retryValue = parseInt(value, 10);
        if (!isNaN(retryValue)) {
          retry = retryValue;
        }
        break;
    }
  }

  return {
    data: dataLines.join("\n"),
    event,
    id,
    retry,
  };
}

export { parseSSEMessage, type SSEParsedMessage };
```

### Usage with Fetch Streaming

```typescript
// ✅ Good Example - Parse SSE stream
import { parseSSEMessage } from "./utils/sse-parser";

async function* parseSSEStream(
  url: string,
  options?: RequestInit
): AsyncGenerator<SSEParsedMessage, void, unknown> {
  for await (const raw of streamSSE(url, options)) {
    yield parseSSEMessage(raw);
  }
}

async function consumeParsedStream() {
  for await (const message of parseSSEStream(SSE_URL)) {
    if (message.event === "notification") {
      handleNotification(JSON.parse(message.data));
    } else if (message.data) {
      handleDefaultMessage(JSON.parse(message.data));
    }
  }
}
```

**Why good:** Handles all SSE fields (data, event, id, retry), supports multi-line data, handles comments (keep-alive), proper field parsing with optional space

---

## Pattern 18: Fetch SSE with Authentication

Send authorization headers that EventSource cannot support.

### Constants

```typescript
const SSE_URL = "/api/protected/stream";
const AUTH_HEADER = "Authorization";
```

### Implementation

```typescript
// ✅ Good Example - Authenticated SSE with fetch
async function createAuthenticatedSSEStream(
  url: string,
  getToken: () => string | Promise<string>
): Promise<AsyncGenerator<SSEParsedMessage, void, unknown>> {
  const token = await getToken();

  return parseSSEStream(url, {
    headers: {
      [AUTH_HEADER]: `Bearer ${token}`,
    },
  });
}

// Usage with token refresh
class AuthenticatedSSEClient {
  private abortController: AbortController | null = null;
  private url: string;
  private getToken: () => Promise<string>;
  private onMessage: (message: SSEParsedMessage) => void;

  constructor(
    url: string,
    getToken: () => Promise<string>,
    onMessage: (message: SSEParsedMessage) => void
  ) {
    this.url = url;
    this.getToken = getToken;
    this.onMessage = onMessage;
  }

  async connect(): Promise<void> {
    const token = await this.getToken();
    this.abortController = new AbortController();

    try {
      const stream = parseSSEStream(this.url, {
        headers: {
          [AUTH_HEADER]: `Bearer ${token}`,
        },
        signal: this.abortController.signal,
      });

      for await (const message of stream) {
        this.onMessage(message);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("SSE stream aborted");
      } else if (error instanceof Error && error.message.includes("401")) {
        // Token expired - refresh and retry
        await this.reconnectWithFreshToken();
      } else {
        throw error;
      }
    }
  }

  private async reconnectWithFreshToken(): Promise<void> {
    console.log("Token expired, reconnecting...");
    await this.connect();
  }

  disconnect(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}

export { AuthenticatedSSEClient };
```

**Why good:** Supports custom Authorization header (impossible with EventSource), AbortController enables clean cancellation, token refresh on 401, async token getter supports refresh tokens

---

## Pattern 19: POST Request with SSE Response

Send a POST request and stream the response (common for LLM APIs).

### Constants

```typescript
const LLM_API_URL = "/api/chat/stream";
const CONTENT_TYPE_JSON = "application/json";
```

### Implementation

```typescript
// ✅ Good Example - POST with streaming response (LLM pattern)
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface StreamingChatOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

async function streamChat(options: StreamingChatOptions): Promise<void> {
  const { messages, model, temperature, onToken, onComplete, onError } = options;

  let fullResponse = "";

  try {
    const response = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": CONTENT_TYPE_JSON,
        Accept: SSE_CONTENT_TYPE,
      },
      body: JSON.stringify({ messages, model, temperature }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (!part.trim()) continue;

        const parsed = parseSSEMessage(part);

        // Handle different SSE events
        if (parsed.event === "done" || parsed.data === "[DONE]") {
          onComplete?.(fullResponse);
          return;
        }

        if (parsed.data) {
          try {
            const chunk = JSON.parse(parsed.data);
            const token = chunk.choices?.[0]?.delta?.content || chunk.content || "";

            if (token) {
              fullResponse += token;
              onToken?.(token);
            }
          } catch {
            // Non-JSON data, treat as plain text token
            fullResponse += parsed.data;
            onToken?.(parsed.data);
          }
        }
      }
    }

    onComplete?.(fullResponse);
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export { streamChat, type StreamingChatOptions };
```

### React Component Usage

```typescript
// components/chat-stream.tsx
import { useState, useCallback } from "react";
import { streamChat, type StreamingChatOptions } from "../utils/stream-chat";

export function ChatInterface() {
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSubmit = useCallback(async (userMessage: string) => {
    setIsStreaming(true);
    setResponse("");

    await streamChat({
      messages: [{ role: "user", content: userMessage }],
      onToken: (token) => {
        setResponse((prev) => prev + token);
      },
      onComplete: () => {
        setIsStreaming(false);
      },
      onError: (error) => {
        console.error("Chat error:", error);
        setIsStreaming(false);
      },
    });
  }, []);

  return (
    <div>
      <div>{response}</div>
      {isStreaming && <span>Generating...</span>}
    </div>
  );
}
```

**Why good:** POST request with JSON body (impossible with EventSource), handles LLM-style streaming responses, token-by-token callbacks for real-time UI updates, handles [DONE] marker, accumulates full response

---

## Pattern 20: Fetch SSE with Reconnection

Implement reconnection logic for fetch-based SSE (no auto-reconnect like EventSource).

### Constants

```typescript
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
```

### Implementation

```typescript
// ✅ Good Example - Fetch SSE with manual reconnection
class FetchSSEClient {
  private abortController: AbortController | null = null;
  private lastEventId: string | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private url: string;
  private onMessage: (message: SSEParsedMessage) => void;
  private onStatusChange?: (status: string) => void;

  constructor(
    url: string,
    onMessage: (message: SSEParsedMessage) => void,
    onStatusChange?: (status: string) => void
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  async connect(): Promise<void> {
    if (this.isConnecting) return;

    this.isConnecting = true;
    this.abortController = new AbortController();
    this.onStatusChange?.("connecting");

    const headers: Record<string, string> = {
      Accept: SSE_CONTENT_TYPE,
    };

    // Send Last-Event-ID for message recovery
    if (this.lastEventId) {
      headers["Last-Event-ID"] = this.lastEventId;
    }

    try {
      const response = await fetch(this.url, {
        headers,
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.reconnectAttempts = 0;
      this.onStatusChange?.("connected");

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Server closed connection normally
          this.handleDisconnect("Server closed connection");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;

          const message = parseSSEMessage(part);

          // Track last event ID for reconnection
          if (message.id) {
            this.lastEventId = message.id;
          }

          this.onMessage(message);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        this.onStatusChange?.("disconnected");
        return; // Intentional abort
      }

      this.handleDisconnect(error instanceof Error ? error.message : "Unknown error");
    } finally {
      this.isConnecting = false;
    }
  }

  private async handleDisconnect(reason: string): Promise<void> {
    console.log("Disconnected:", reason);

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.onStatusChange?.("failed");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS
    );

    this.onStatusChange?.(`reconnecting in ${Math.round(delay / 1000)}s`);

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (!this.abortController?.signal.aborted) {
      this.connect();
    }
  }

  disconnect(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.onStatusChange?.("disconnected");
  }
}

export { FetchSSEClient };
```

**Why good:** Manual reconnection with exponential backoff, Last-Event-ID header for message recovery, AbortController for clean cancellation, status callbacks, retry limit prevents infinite loops

---

## Pattern 21: React Hook for Fetch SSE

A hook that wraps fetch-based SSE with React lifecycle management.

```typescript
// hooks/use-fetch-sse.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { parseSSEMessage, type SSEParsedMessage } from "../utils/sse-parser";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error" | "closed";

interface UseFetchSSEOptions {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  onMessage?: (message: SSEParsedMessage) => void;
  enabled?: boolean;
}

interface UseFetchSSEReturn {
  status: ConnectionStatus;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
}

export function useFetchSSE(options: UseFetchSSEOptions): UseFetchSSEReturn {
  const { url, method = "GET", body, headers, onMessage, enabled = true } = options;

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const connect = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setStatus("connecting");
    setError(null);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: "text/event-stream",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setStatus("connected");

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (part.trim()) {
            onMessage?.(parseSSEMessage(part));
          }
        }
      }

      setStatus("closed");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStatus("closed");
      } else {
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus("error");
      }
    }
  }, [url, method, body, headers, onMessage]);

  const disconnect = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus("closed");
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [enabled, connect]);

  return { status, error, connect, disconnect };
}
```

### Usage

```typescript
// components/streaming-response.tsx
import { useState, useCallback } from "react";
import { useFetchSSE } from "../hooks/use-fetch-sse";

const API_URL = "/api/generate";

export function StreamingResponse({ prompt }: { prompt: string }) {
  const [tokens, setTokens] = useState<string[]>([]);

  const handleMessage = useCallback((message: SSEParsedMessage) => {
    if (message.data) {
      setTokens((prev) => [...prev, message.data]);
    }
  }, []);

  const { status, error, disconnect } = useFetchSSE({
    url: API_URL,
    method: "POST",
    body: { prompt },
    onMessage: handleMessage,
    enabled: Boolean(prompt),
  });

  return (
    <div>
      <div>Status: {status}</div>
      {error && <div>Error: {error.message}</div>}
      <div>{tokens.join("")}</div>
      {status === "connected" && (
        <button onClick={disconnect}>Stop</button>
      )}
    </div>
  );
}
```

**Why good:** Supports both GET and POST, configurable headers and body, automatic cleanup on unmount, error state exposed, enabled flag for conditional connection
