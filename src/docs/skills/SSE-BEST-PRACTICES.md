# Server-Sent Events (SSE) Best Practices Research

> **Research Date:** January 2026
> **Purpose:** Comprehensive guide for implementing Server-Sent Events in modern web applications

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [EventSource vs Fetch Streaming](#eventsource-vs-fetch-streaming)
3. [Server Implementation Patterns](#server-implementation-patterns)
4. [Client Implementation Patterns](#client-implementation-patterns)
5. [React Hooks for SSE](#react-hooks-for-sse)
6. [Vue Composables for SSE](#vue-composables-for-sse)
7. [Error Handling and Reconnection](#error-handling-and-reconnection)
8. [Authentication Patterns](#authentication-patterns)
9. [Performance and Scaling](#performance-and-scaling)
10. [SSE vs WebSockets Comparison](#sse-vs-websockets-comparison)
11. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
12. [Edge Runtime Considerations](#edge-runtime-considerations)

---

## Core Concepts

### What are Server-Sent Events?

Server-Sent Events (SSE) is a standard that enables servers to push real-time updates to clients over a single, long-lived HTTP connection. Unlike WebSockets, SSE is **unidirectional** (server to client only), making it ideal for scenarios where clients only need to receive updates.

### Key Characteristics

| Feature | Description |
|---------|-------------|
| **Protocol** | Standard HTTP/HTTPS |
| **Direction** | Unidirectional (server to client) |
| **Data Format** | Text only (UTF-8 encoded) |
| **Auto-Reconnect** | Built-in automatic reconnection |
| **Browser Support** | All modern browsers (no IE) |

### Event Stream Format

SSE messages follow a specific text-based format with required headers and field types.

#### Required HTTP Headers

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

#### SSE Field Types

| Field | Description |
|-------|-------------|
| `event` | Custom event type name (triggers `addEventListener`) |
| `data` | Message content (multiple lines concatenated with newlines) |
| `id` | Event ID (used for reconnection via `Last-Event-ID` header) |
| `retry` | Reconnection time in milliseconds |
| `:` | Comment (keep-alive, ignored by client) |

#### Message Format Examples

```
: This is a comment (keep-alive)

data: Simple message

data: Multi-line message
data: continues here

event: custom-event
data: {"key": "value"}
id: 123

retry: 5000
data: Reconnect after 5 seconds if disconnected
```

---

## EventSource vs Fetch Streaming

### EventSource API (Recommended for Most Cases)

The native `EventSource` API provides built-in connection management, automatic reconnection, and message parsing.

#### TypeScript Client Implementation

```typescript
interface SSEConfig {
  url: string;
  withCredentials?: boolean;
  onMessage?: (data: string) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
}

const createEventSource = (config: SSEConfig): EventSource => {
  const { url, withCredentials = false, onMessage, onError, onOpen } = config;

  const eventSource = new EventSource(url, { withCredentials });

  eventSource.onopen = () => {
    console.log('SSE connection opened');
    onOpen?.();
  };

  eventSource.onmessage = (event: MessageEvent) => {
    onMessage?.(event.data);
  };

  eventSource.onerror = (error: Event) => {
    console.error('SSE error:', error);
    onError?.(error);

    // Check if connection is closed
    if (eventSource.readyState === EventSource.CLOSED) {
      console.log('Connection closed by server');
    }
  };

  return eventSource;
};

// Usage
const sse = createEventSource({
  url: '/api/events',
  onMessage: (data) => console.log('Received:', data),
  onError: (error) => console.error('Error:', error),
});

// Cleanup
// sse.close();
```

#### Listening for Custom Events

```typescript
const eventSource = new EventSource('/api/events');

// Default message event
eventSource.onmessage = (event) => {
  console.log('Message:', event.data);
};

// Custom named events
eventSource.addEventListener('user-joined', (event: MessageEvent) => {
  const user = JSON.parse(event.data);
  console.log('User joined:', user);
});

eventSource.addEventListener('notification', (event: MessageEvent) => {
  const notification = JSON.parse(event.data);
  showNotification(notification);
});
```

### Fetch API with ReadableStream (For POST Requests or Custom Headers)

When you need to send data with the request or set custom headers, use the Fetch API with streaming.

```typescript
interface StreamConfig {
  url: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  onChunk: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

const streamFetch = async (config: StreamConfig): Promise<void> => {
  const { url, method = 'GET', body, headers = {}, onChunk, onComplete, onError } = config;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        onComplete?.();
        break;
      }

      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    }
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
};

// Usage for LLM streaming
await streamFetch({
  url: '/api/chat',
  method: 'POST',
  body: { prompt: 'Hello, AI!' },
  onChunk: (chunk) => {
    // Parse SSE format if needed
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data !== '[DONE]') {
          appendToOutput(data);
        }
      }
    }
  },
  onComplete: () => console.log('Stream complete'),
  onError: (error) => console.error('Stream error:', error),
});
```

### SSE Parser for Fetch Streams

```typescript
interface SSEMessage {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

const parseSSEStream = async function* (
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<SSEMessage> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';

    for (const block of lines) {
      const message: SSEMessage = { data: '' };

      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) {
          message.event = line.slice(7);
        } else if (line.startsWith('data: ')) {
          message.data += (message.data ? '\n' : '') + line.slice(6);
        } else if (line.startsWith('id: ')) {
          message.id = line.slice(4);
        } else if (line.startsWith('retry: ')) {
          message.retry = parseInt(line.slice(7), 10);
        }
      }

      if (message.data) {
        yield message;
      }
    }
  }
};

// Usage
const response = await fetch('/api/stream');
const reader = response.body!.getReader();

for await (const message of parseSSEStream(reader)) {
  console.log('Event:', message.event);
  console.log('Data:', message.data);
  console.log('ID:', message.id);
}
```

---

## Server Implementation Patterns

### Node.js with Express

```typescript
import express, { Request, Response } from 'express';

const app = express();

// SSE middleware to set headers
const sseHeaders = (_req: Request, res: Response, next: () => void) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();
  next();
};

// Simple SSE endpoint
app.get('/api/events', sseHeaders, (req: Request, res: Response) => {
  let messageId = 0;

  // Send initial connection message
  res.write(`data: Connected\n\n`);

  // Send periodic updates
  const interval = setInterval(() => {
    const data = JSON.stringify({
      time: new Date().toISOString(),
      message: 'Server update',
    });

    res.write(`id: ${messageId++}\n`);
    res.write(`event: time-update\n`);
    res.write(`data: ${data}\n\n`);
  }, 1000);

  // Keep-alive comment every 15 seconds
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    clearInterval(keepAlive);
    res.end();
  });
});

// SSE with custom events
app.get('/api/notifications', sseHeaders, (req: Request, res: Response) => {
  const userId = req.query.userId as string;

  // Register this connection for the user
  const sendNotification = (notification: object) => {
    res.write(`event: notification\n`);
    res.write(`data: ${JSON.stringify(notification)}\n\n`);
  };

  // Subscribe to notifications (pseudo-code)
  notificationService.subscribe(userId, sendNotification);

  req.on('close', () => {
    notificationService.unsubscribe(userId, sendNotification);
    res.end();
  });
});
```

### Hono Framework (Edge-Compatible)

```typescript
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

const app = new Hono();

let eventId = 0;

// Basic SSE streaming
app.get('/api/events', async (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial connection event
    await stream.writeSSE({
      data: 'Connected',
      event: 'connected',
      id: String(eventId++),
    });

    // Continuous updates
    while (true) {
      const data = JSON.stringify({
        time: new Date().toISOString(),
        value: Math.random(),
      });

      await stream.writeSSE({
        data,
        event: 'update',
        id: String(eventId++),
      });

      await stream.sleep(1000);
    }
  });
});

// SSE with request body (using POST)
app.post('/api/chat/stream', async (c) => {
  const body = await c.req.json<{ prompt: string }>();

  return streamSSE(c, async (stream) => {
    // Simulate LLM token streaming
    const response = await generateLLMResponse(body.prompt);

    for await (const token of response) {
      await stream.writeSSE({
        data: token,
        event: 'token',
        id: String(eventId++),
      });
    }

    // Signal completion
    await stream.writeSSE({
      data: '[DONE]',
      event: 'complete',
      id: String(eventId++),
    });
  });
});

export default app;
```

### Better-SSE Library (Production-Ready)

```typescript
import express from 'express';
import { createSession, createChannel } from 'better-sse';

const app = express();

// Create a broadcast channel
const notificationChannel = createChannel();

// SSE endpoint with session management
app.get('/api/notifications', async (req, res) => {
  const session = await createSession(req, res);

  // Register session to channel
  notificationChannel.register(session);

  // Send welcome message
  session.push({ type: 'welcome', message: 'Connected to notifications' });

  // Cleanup on disconnect
  session.on('disconnected', () => {
    console.log('Client disconnected');
  });
});

// Broadcast to all connected clients
app.post('/api/broadcast', express.json(), (req, res) => {
  const { message, event } = req.body;

  notificationChannel.broadcast(message, event);

  res.json({ success: true, clients: notificationChannel.sessionCount });
});

// Send to specific session with batching
app.post('/api/batch-send', async (req, res) => {
  const session = getSessionById(req.body.sessionId);

  if (session) {
    // Batch multiple events for efficiency
    await session.batch(async (buffer) => {
      await buffer.iterate(['event1', 'event2', 'event3']);
    });
  }

  res.json({ success: true });
});
```

### Edge Runtime (Vercel/Cloudflare Workers)

```typescript
// Works with Web Standards API
export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let id = 0;

      const sendEvent = (data: string, event?: string) => {
        let message = '';
        if (event) message += `event: ${event}\n`;
        message += `id: ${id++}\n`;
        message += `data: ${data}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial event
      sendEvent('Connected', 'connected');

      // Simulate periodic updates
      const interval = setInterval(() => {
        sendEvent(JSON.stringify({ time: Date.now() }), 'update');
      }, 1000);

      // Handle abort
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## Client Implementation Patterns

### TypeScript SSE Client Class

```typescript
type SSEStatus = 'connecting' | 'open' | 'closed' | 'error';

interface SSEClientOptions {
  url: string;
  withCredentials?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface SSEEventHandlers {
  onOpen?: () => void;
  onMessage?: (data: string, event: MessageEvent) => void;
  onError?: (error: Event) => void;
  onStatusChange?: (status: SSEStatus) => void;
}

class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: SSEStatus = 'closed';

  constructor(
    private options: SSEClientOptions,
    private handlers: SSEEventHandlers = {}
  ) {}

  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    this.setStatus('connecting');

    this.eventSource = new EventSource(this.options.url, {
      withCredentials: this.options.withCredentials ?? false,
    });

    this.eventSource.onopen = () => {
      this.setStatus('open');
      this.reconnectAttempts = 0;
      this.handlers.onOpen?.();
    };

    this.eventSource.onmessage = (event) => {
      this.handlers.onMessage?.(event.data, event);
    };

    this.eventSource.onerror = (error) => {
      this.handlers.onError?.(error);

      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.setStatus('closed');
        this.attemptReconnect();
      } else {
        this.setStatus('error');
      }
    };
  }

  addEventListener<K extends string>(
    event: K,
    handler: (event: MessageEvent) => void
  ): void {
    this.eventSource?.addEventListener(event, handler as EventListener);
  }

  removeEventListener<K extends string>(
    event: K,
    handler: (event: MessageEvent) => void
  ): void {
    this.eventSource?.removeEventListener(event, handler as EventListener);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setStatus('closed');
  }

  private setStatus(status: SSEStatus): void {
    this.status = status;
    this.handlers.onStatusChange?.(status);
  }

  private attemptReconnect(): void {
    const { reconnect = true, reconnectInterval = 3000, maxReconnectAttempts = 10 } = this.options;

    if (!reconnect) return;
    if (this.reconnectAttempts >= maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = reconnectInterval * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  getStatus(): SSEStatus {
    return this.status;
  }
}

// Usage
const client = new SSEClient(
  {
    url: '/api/events',
    reconnect: true,
    maxReconnectAttempts: 5,
  },
  {
    onOpen: () => console.log('Connected'),
    onMessage: (data) => console.log('Message:', data),
    onError: (error) => console.error('Error:', error),
    onStatusChange: (status) => console.log('Status:', status),
  }
);

client.connect();

// Listen to custom events
client.addEventListener('notification', (event) => {
  const notification = JSON.parse(event.data);
  showNotification(notification);
});

// Cleanup
// client.disconnect();
```

---

## React Hooks for SSE

### Basic useEventSource Hook

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

type SSEStatus = 'connecting' | 'open' | 'closed' | 'error';

interface UseEventSourceOptions {
  withCredentials?: boolean;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  enabled?: boolean;
}

interface UseEventSourceReturn {
  status: SSEStatus;
  lastMessage: string | null;
  error: Event | null;
  close: () => void;
  reconnect: () => void;
}

export const useEventSource = (
  url: string,
  options: UseEventSourceOptions = {}
): UseEventSourceReturn => {
  const { withCredentials = false, onMessage, onError, enabled = true } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const [status, setStatus] = useState<SSEStatus>('closed');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [error, setError] = useState<Event | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !url) return;

    setStatus('connecting');
    setError(null);

    const eventSource = new EventSource(url, { withCredentials });
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus('open');
    };

    eventSource.onmessage = (event) => {
      setLastMessage(event.data);
      onMessage?.(event);
    };

    eventSource.onerror = (err) => {
      setError(err);
      onError?.(err);

      if (eventSource.readyState === EventSource.CLOSED) {
        setStatus('closed');
      } else {
        setStatus('error');
      }
    };
  }, [url, withCredentials, onMessage, onError, enabled]);

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setStatus('closed');
    }
  }, []);

  const reconnect = useCallback(() => {
    close();
    connect();
  }, [close, connect]);

  useEffect(() => {
    connect();
    return close;
  }, [connect, close]);

  return { status, lastMessage, error, close, reconnect };
};
```

### Advanced useSSE Hook with Custom Events

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

interface SSEEvent<T = unknown> {
  type: string;
  data: T;
  id?: string;
  timestamp: number;
}

interface UseSSEOptions<T> {
  events?: string[];
  parser?: (data: string) => T;
  onEvent?: (event: SSEEvent<T>) => void;
  reconnectOnError?: boolean;
  reconnectInterval?: number;
  maxRetries?: number;
}

interface UseSSEReturn<T> {
  isConnected: boolean;
  isConnecting: boolean;
  lastEvent: SSEEvent<T> | null;
  events: SSEEvent<T>[];
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
}

export function useSSE<T = unknown>(
  url: string | null,
  options: UseSSEOptions<T> = {}
): UseSSEReturn<T> {
  const {
    events: customEvents = [],
    parser = JSON.parse,
    onEvent,
    reconnectOnError = true,
    reconnectInterval = 3000,
    maxRetries = 5,
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent<T> | null>(null);
  const [events, setEvents] = useState<SSEEvent<T>[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const handleEvent = useCallback(
    (type: string) => (event: MessageEvent) => {
      try {
        const data = parser(event.data);
        const sseEvent: SSEEvent<T> = {
          type,
          data,
          id: (event as MessageEvent & { lastEventId?: string }).lastEventId,
          timestamp: Date.now(),
        };

        setLastEvent(sseEvent);
        setEvents((prev) => [...prev.slice(-99), sseEvent]); // Keep last 100 events
        onEvent?.(sseEvent);
      } catch (parseError) {
        console.error('Failed to parse SSE data:', parseError);
      }
    },
    [parser, onEvent]
  );

  const connect = useCallback(() => {
    if (!url || eventSourceRef.current) return;

    setIsConnecting(true);
    setError(null);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      retriesRef.current = 0;
    };

    // Listen to default message event
    eventSource.onmessage = handleEvent('message');

    // Listen to custom events
    customEvents.forEach((eventType) => {
      eventSource.addEventListener(eventType, handleEvent(eventType) as EventListener);
    });

    eventSource.onerror = () => {
      setIsConnected(false);
      setIsConnecting(false);

      if (eventSource.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;

        if (reconnectOnError && retriesRef.current < maxRetries) {
          retriesRef.current++;
          const delay = reconnectInterval * Math.pow(2, retriesRef.current - 1);
          setTimeout(connect, delay);
        } else {
          setError(new Error('SSE connection failed'));
        }
      }
    };
  }, [url, customEvents, handleEvent, reconnectOnError, reconnectInterval, maxRetries]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    lastEvent,
    events,
    error,
    connect,
    disconnect,
  };
}

// Usage example
function NotificationList() {
  const { isConnected, events, error } = useSSE<{ title: string; body: string }>(
    '/api/notifications',
    {
      events: ['notification', 'alert'],
      onEvent: (event) => {
        if (event.type === 'alert') {
          showToast(event.data.title);
        }
      },
    }
  );

  if (error) return <div>Connection error: {error.message}</div>;

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <ul>
        {events.map((event, index) => (
          <li key={index}>
            [{event.type}] {event.data.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### React Query Integration

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

// Hook to sync SSE updates with React Query cache
export function useSSEQuerySync<T>(
  queryKey: readonly unknown[],
  sseUrl: string,
  options?: {
    events?: string[];
    transform?: (data: unknown) => T;
  }
) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    const handleUpdate = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      const transformed = options?.transform ? options.transform(data) : data;

      // Update the query cache
      queryClient.setQueryData(queryKey, (old: T | undefined) => {
        if (Array.isArray(old) && Array.isArray(transformed)) {
          return [...old, ...transformed];
        }
        return transformed;
      });
    };

    eventSource.onmessage = handleUpdate;

    options?.events?.forEach((eventType) => {
      eventSource.addEventListener(eventType, handleUpdate as EventListener);
    });

    return () => {
      eventSource.close();
    };
  }, [sseUrl, queryKey, queryClient, options]);

  // Initial data fetch
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(sseUrl.replace('/stream', ''));
      return response.json() as Promise<T>;
    },
  });
}

// Usage
function Dashboard() {
  const { data: metrics } = useSSEQuerySync<Metrics>(
    ['metrics'],
    '/api/metrics/stream',
    {
      events: ['metric-update'],
      transform: (data) => data as Metrics,
    }
  );

  return <MetricsDisplay data={metrics} />;
}
```

---

## Vue Composables for SSE

### VueUse useEventSource (Recommended)

```typescript
// Using VueUse's built-in composable
import { useEventSource } from '@vueuse/core';

// Basic usage
const { status, data, error, close, open } = useEventSource('/api/events');

// With named events
const { status, data, event, error } = useEventSource('/api/events', ['notification', 'update']);

// With auto-reconnect
const { status, data, error } = useEventSource('/api/events', [], {
  autoReconnect: {
    retries: 3,
    delay: 1000,
    onFailed() {
      console.error('Failed to reconnect after 3 attempts');
    },
  },
});
```

### Custom Vue Composable

```typescript
import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue';

type SSEStatus = 'CONNECTING' | 'OPEN' | 'CLOSED';

interface UseSSEOptions {
  immediate?: boolean;
  autoReconnect?: boolean | {
    retries?: number;
    delay?: number;
    onFailed?: () => void;
  };
}

interface UseSSEReturn<T> {
  status: Ref<SSEStatus>;
  data: Ref<T | null>;
  error: Ref<Event | null>;
  eventSource: Ref<EventSource | null>;
  open: () => void;
  close: () => void;
}

export function useSSE<T = unknown>(
  url: Ref<string> | string,
  events: string[] = [],
  options: UseSSEOptions = {}
): UseSSEReturn<T> {
  const { immediate = true, autoReconnect = false } = options;

  const status = ref<SSEStatus>('CLOSED');
  const data = ref<T | null>(null) as Ref<T | null>;
  const error = ref<Event | null>(null);
  const eventSource = ref<EventSource | null>(null);

  let retryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  const getUrl = () => (typeof url === 'string' ? url : url.value);

  const open = () => {
    close();

    const urlValue = getUrl();
    if (!urlValue) return;

    status.value = 'CONNECTING';
    const es = new EventSource(urlValue);
    eventSource.value = es;

    es.onopen = () => {
      status.value = 'OPEN';
      error.value = null;
      retryCount = 0;
    };

    es.onmessage = (event) => {
      try {
        data.value = JSON.parse(event.data) as T;
      } catch {
        data.value = event.data as T;
      }
    };

    // Listen to custom events
    events.forEach((eventName) => {
      es.addEventListener(eventName, (event: Event) => {
        const messageEvent = event as MessageEvent;
        try {
          data.value = JSON.parse(messageEvent.data) as T;
        } catch {
          data.value = messageEvent.data as T;
        }
      });
    });

    es.onerror = (err) => {
      error.value = err;

      if (es.readyState === EventSource.CLOSED) {
        status.value = 'CLOSED';
        eventSource.value = null;

        if (autoReconnect) {
          const config = typeof autoReconnect === 'object' ? autoReconnect : {};
          const maxRetries = config.retries ?? 3;
          const delay = config.delay ?? 1000;

          if (retryCount < maxRetries) {
            retryCount++;
            retryTimeout = setTimeout(open, delay * retryCount);
          } else {
            config.onFailed?.();
          }
        }
      }
    };
  };

  const close = () => {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }

    if (eventSource.value) {
      eventSource.value.close();
      eventSource.value = null;
      status.value = 'CLOSED';
    }
  };

  // Auto-connect on URL change
  if (typeof url !== 'string') {
    watch(url, () => {
      if (status.value !== 'CLOSED') {
        open();
      }
    });
  }

  onMounted(() => {
    if (immediate) open();
  });

  onUnmounted(close);

  return {
    status,
    data,
    error,
    eventSource,
    open,
    close,
  };
}

// Usage in a component
// <script setup lang="ts">
// import { useSSE } from '@/composables/useSSE';
//
// const { status, data, error, close } = useSSE<Notification>(
//   '/api/notifications',
//   ['notification', 'alert'],
//   {
//     autoReconnect: {
//       retries: 5,
//       delay: 2000,
//       onFailed: () => console.error('Connection lost'),
//     },
//   }
// );
// </script>
```

---

## Error Handling and Reconnection

### Connection States

```typescript
// EventSource.readyState values
const CONNECTING = 0; // Connection is being established
const OPEN = 1;       // Connection is open and receiving events
const CLOSED = 2;     // Connection is closed (or couldn't be opened)
```

### Robust Error Handler

```typescript
interface ReconnectionConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: ReconnectionConfig = {
  maxRetries: 10,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

class RobustEventSource {
  private eventSource: EventSource | null = null;
  private retryCount = 0;
  private config: ReconnectionConfig;
  private listeners: Map<string, Set<(event: MessageEvent) => void>> = new Map();

  constructor(
    private url: string,
    config: Partial<ReconnectionConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  connect(): void {
    this.eventSource = new EventSource(this.url);

    this.eventSource.onopen = () => {
      console.log('SSE connected');
      this.retryCount = 0;
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);

      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.handleDisconnect();
      }
    };

    // Re-attach all listeners
    this.listeners.forEach((handlers, eventType) => {
      handlers.forEach((handler) => {
        this.eventSource?.addEventListener(eventType, handler as EventListener);
      });
    });
  }

  private handleDisconnect(): void {
    this.eventSource = null;

    if (this.retryCount >= this.config.maxRetries) {
      console.error('Max retries reached, giving up');
      this.dispatchRetryExhausted();
      return;
    }

    const delay = Math.min(
      this.config.baseDelay * Math.pow(this.config.backoffMultiplier, this.retryCount),
      this.config.maxDelay
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.retryCount + 1})`);
    this.retryCount++;

    setTimeout(() => this.connect(), delay);
  }

  on(eventType: string, handler: (event: MessageEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(handler);

    if (this.eventSource) {
      this.eventSource.addEventListener(eventType, handler as EventListener);
    }
  }

  off(eventType: string, handler: (event: MessageEvent) => void): void {
    this.listeners.get(eventType)?.delete(handler);
    this.eventSource?.removeEventListener(eventType, handler as EventListener);
  }

  close(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.listeners.clear();
  }

  private dispatchRetryExhausted(): void {
    const event = new CustomEvent('retryexhausted');
    window.dispatchEvent(event);
  }
}
```

### Server-Side Retry Control

```typescript
// Server can control client reconnection behavior
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  // Tell client to wait 5 seconds before reconnecting
  res.write('retry: 5000\n\n');

  // If server wants to stop reconnection, respond with 204
  if (shouldStopClient) {
    res.status(204).end();
    return;
  }

  // Normal event streaming...
});
```

### Last-Event-ID for Message Recovery

```typescript
// Server: Track and use Last-Event-ID
app.get('/api/events', (req, res) => {
  const lastEventId = req.headers['last-event-id'];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  // If client reconnected, send missed events
  if (lastEventId) {
    const missedEvents = getMissedEvents(parseInt(lastEventId, 10));
    missedEvents.forEach((event) => {
      res.write(`id: ${event.id}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    });
  }

  // Continue with real-time events...
  let eventId = lastEventId ? parseInt(lastEventId, 10) + 1 : 0;

  const sendEvent = (data: object) => {
    res.write(`id: ${eventId++}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);

    // Store event for potential replay
    storeEvent(eventId - 1, data);
  };

  // Subscribe to events...
});
```

---

## Authentication Patterns

### Cookie-Based Authentication (Recommended)

The simplest approach - cookies are automatically sent with EventSource requests.

```typescript
// Client - withCredentials for cross-origin
const eventSource = new EventSource('/api/events', {
  withCredentials: true,
});

// Server - validate session cookie
app.get('/api/events', (req, res) => {
  const session = req.session;

  if (!session?.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Set SSE headers and stream...
});
```

### Query Parameter Token (Simple but Less Secure)

```typescript
// Client
const token = getAccessToken();
const eventSource = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

// Server
app.get('/api/events', (req, res) => {
  const token = req.query.token as string;

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  // Stream events...
});
```

**Warning:** Query parameter tokens can be logged in server logs and browser history.

### Fetch-Based SSE with Authorization Header

When you need proper Authorization headers, use the Fetch API instead of EventSource.

```typescript
const streamWithAuth = async (url: string, token: string) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    // Parse SSE format...
    processSSEChunk(chunk);
  }
};
```

### Token Refresh Strategy

```typescript
class AuthenticatedSSE {
  private eventSource: EventSource | null = null;
  private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private baseUrl: string,
    private getToken: () => string,
    private refreshToken: () => Promise<string>
  ) {}

  connect(): void {
    const token = this.getToken();
    this.eventSource = new EventSource(`${this.baseUrl}?token=${encodeURIComponent(token)}`);

    this.eventSource.addEventListener('token-expiring', async () => {
      // Server signals token is about to expire
      const newToken = await this.refreshToken();
      this.reconnectWithNewToken(newToken);
    });

    // Schedule token refresh before expiry
    this.scheduleTokenRefresh();
  }

  private scheduleTokenRefresh(): void {
    const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes

    this.tokenRefreshTimer = setTimeout(async () => {
      const newToken = await this.refreshToken();
      this.reconnectWithNewToken(newToken);
    }, TOKEN_REFRESH_INTERVAL);
  }

  private reconnectWithNewToken(token: string): void {
    const lastEventId = this.getLastEventId();
    this.close();

    // Reconnect with new token, preserving event position
    const url = new URL(this.baseUrl);
    url.searchParams.set('token', token);
    if (lastEventId) {
      url.searchParams.set('lastEventId', lastEventId);
    }

    this.eventSource = new EventSource(url.toString());
    this.scheduleTokenRefresh();
  }

  private getLastEventId(): string | null {
    // Implementation depends on how you track this
    return null;
  }

  close(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
    this.eventSource?.close();
    this.eventSource = null;
  }
}
```

---

## Performance and Scaling

### Connection Limits

| Protocol | Connections per Domain |
|----------|----------------------|
| HTTP/1.1 | 6 (browser limit) |
| HTTP/2 | 100+ (negotiated) |

**Recommendation:** Always use HTTP/2 in production for SSE.

### Server Resource Management

```typescript
// Track active connections
const connections = new Map<string, Response>();
const MAX_CONNECTIONS_PER_USER = 3;

app.get('/api/events', (req, res) => {
  const userId = req.userId;
  const userConnections = getUserConnections(userId);

  // Limit connections per user
  if (userConnections.length >= MAX_CONNECTIONS_PER_USER) {
    // Close oldest connection
    const oldest = userConnections[0];
    oldest.end();
  }

  // Set headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const connectionId = generateId();
  connections.set(connectionId, res);

  // Keep-alive to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    connections.delete(connectionId);
  });
});
```

### Load Balancing with Sticky Sessions

For SSE to work with load balancers, you need sticky sessions or a message broker.

```typescript
// Using Redis Pub/Sub for cross-server broadcasting
import Redis from 'ioredis';

const publisher = new Redis();
const subscriber = new Redis();

// Subscribe to channel
subscriber.subscribe('notifications');

// On message, broadcast to local connections
subscriber.on('message', (channel, message) => {
  connections.forEach((res) => {
    res.write(`data: ${message}\n\n`);
  });
});

// Publish from any server
const broadcastNotification = (notification: object) => {
  publisher.publish('notifications', JSON.stringify(notification));
};
```

### Data Optimization

```typescript
// 1. Batch small updates
const eventBuffer: object[] = [];
const BATCH_INTERVAL = 100; // ms

setInterval(() => {
  if (eventBuffer.length > 0) {
    const batch = eventBuffer.splice(0, eventBuffer.length);
    broadcast({ type: 'batch', events: batch });
  }
}, BATCH_INTERVAL);

// 2. Compress data when possible
const sendEvent = (data: object) => {
  // Remove unnecessary fields
  const minimal = {
    t: data.type,
    d: data.data,
    ts: Date.now(),
  };
  res.write(`data: ${JSON.stringify(minimal)}\n\n`);
};

// 3. Use delta updates instead of full state
const sendDelta = (previousState: object, newState: object) => {
  const delta = calculateDelta(previousState, newState);
  if (Object.keys(delta).length > 0) {
    res.write(`data: ${JSON.stringify({ delta })}\n\n`);
  }
};
```

### Monitoring and Metrics

```typescript
// Track SSE metrics
const metrics = {
  activeConnections: 0,
  totalMessages: 0,
  totalBytes: 0,
  connectionDurations: [] as number[],
};

app.get('/api/events', (req, res) => {
  const startTime = Date.now();
  metrics.activeConnections++;

  const originalWrite = res.write.bind(res);
  res.write = (chunk: string | Buffer) => {
    metrics.totalMessages++;
    metrics.totalBytes += Buffer.byteLength(chunk);
    return originalWrite(chunk);
  };

  req.on('close', () => {
    metrics.activeConnections--;
    metrics.connectionDurations.push(Date.now() - startTime);
  });

  // Stream events...
});

// Expose metrics endpoint
app.get('/api/sse-metrics', (req, res) => {
  res.json({
    ...metrics,
    avgConnectionDuration:
      metrics.connectionDurations.reduce((a, b) => a + b, 0) /
      metrics.connectionDurations.length || 0,
  });
});
```

---

## SSE vs WebSockets Comparison

### When to Use SSE

| Use Case | Why SSE |
|----------|---------|
| News feeds | One-way updates |
| Stock tickers | Server pushes data |
| Notifications | No client messages needed |
| Live scores | Simple to implement |
| Activity streams | Auto-reconnection helpful |
| LLM streaming | Token-by-token output |

### When to Use WebSockets

| Use Case | Why WebSockets |
|----------|----------------|
| Chat applications | Bidirectional messaging |
| Multiplayer games | Low-latency both ways |
| Collaborative editing | Real-time sync |
| Video conferencing | Binary data support |
| Financial trading | Sub-millisecond latency |

### Feature Comparison

| Feature | SSE | WebSockets |
|---------|-----|------------|
| Direction | Server to client | Bidirectional |
| Protocol | HTTP | WebSocket (ws://) |
| Data types | Text only | Text and binary |
| Auto-reconnect | Built-in | Manual |
| Connection overhead | ~5 bytes/message | ~2 bytes/frame |
| CORS | Standard HTTP | Requires handling |
| Proxy support | Excellent | May require config |
| Browser support | All modern | All modern |
| HTTP/2 multiplexing | Yes | Separate connection |
| Firewall friendly | Very (standard HTTP) | May be blocked |

### Hybrid Approach

Many applications combine both technologies.

```typescript
// SSE for server-to-client updates
const eventSource = new EventSource('/api/updates');
eventSource.onmessage = (event) => {
  updateUI(JSON.parse(event.data));
};

// Regular HTTP for client-to-server
const sendMessage = async (message: string) => {
  await fetch('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
};

// Or use WebSocket only for chat, SSE for everything else
```

---

## Anti-Patterns to Avoid

### 1. Not Handling Reconnection Properly

```typescript
// BAD: Ignoring reconnection
const eventSource = new EventSource('/api/events');
eventSource.onmessage = handleMessage;
// No error handling, no reconnection logic

// GOOD: Handle errors and reconnection
eventSource.onerror = (error) => {
  if (eventSource.readyState === EventSource.CLOSED) {
    console.log('Connection closed, will auto-reconnect');
  }
};
```

### 2. Not Using Event IDs

```typescript
// BAD: No event IDs, client may miss messages on reconnect
res.write(`data: ${message}\n\n`);

// GOOD: Include IDs for message recovery
res.write(`id: ${eventId++}\n`);
res.write(`data: ${message}\n\n`);

// Server should handle Last-Event-ID header
const lastId = req.headers['last-event-id'];
if (lastId) {
  replayMissedEvents(parseInt(lastId, 10), res);
}
```

### 3. Missing Keep-Alive for Proxy Timeout

```typescript
// BAD: Connection may timeout through proxies
app.get('/api/events', (req, res) => {
  // Only send events when they happen
  onEvent((data) => res.write(`data: ${data}\n\n`));
});

// GOOD: Send periodic keep-alive comments
const keepAlive = setInterval(() => {
  res.write(': keep-alive\n\n');
}, 15000);

req.on('close', () => clearInterval(keepAlive));
```

### 4. Not Cleaning Up on Disconnect

```typescript
// BAD: Resource leak
app.get('/api/events', (req, res) => {
  const interval = setInterval(() => {
    res.write(`data: ping\n\n`);
  }, 1000);
  // interval never cleared!
});

// GOOD: Cleanup on disconnect
app.get('/api/events', (req, res) => {
  const interval = setInterval(() => {
    res.write(`data: ping\n\n`);
  }, 1000);

  req.on('close', () => {
    clearInterval(interval);
    // Unsubscribe from any pub/sub
    // Remove from connection pool
    res.end();
  });
});
```

### 5. Sending Too Much Data

```typescript
// BAD: Sending full state every update
onStateChange((state) => {
  res.write(`data: ${JSON.stringify(state)}\n\n`); // 100KB each time
});

// GOOD: Send deltas or relevant portions only
onStateChange((state, previousState) => {
  const delta = computeDelta(previousState, state);
  res.write(`data: ${JSON.stringify(delta)}\n\n`); // ~1KB
});
```

### 6. Ignoring HTTP/2

```typescript
// BAD: Using HTTP/1.1 with many SSE connections
// 6 connection limit per domain causes issues

// GOOD: Enable HTTP/2 in production
// nginx.conf
// listen 443 ssl http2;

// Or use different subdomains as workaround
// events1.example.com, events2.example.com
```

### 7. Not Buffering Properly

```typescript
// BAD: Nginx buffers responses by default
// Add header to disable buffering
res.setHeader('X-Accel-Buffering', 'no');
res.setHeader('Cache-Control', 'no-cache, no-transform');
```

### 8. Using SSE for Bidirectional Communication

```typescript
// BAD: Trying to use SSE for chat
// SSE is one-way, you need WebSockets for bidirectional

// GOOD: Use SSE for receiving, HTTP POST for sending
const eventSource = new EventSource('/api/chat/stream');
eventSource.onmessage = (e) => displayMessage(JSON.parse(e.data));

const sendMessage = async (text: string) => {
  await fetch('/api/chat/send', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
};
```

---

## Edge Runtime Considerations

### Web Standards Compatibility

Edge runtimes (Vercel Edge, Cloudflare Workers) support SSE through Web Standards APIs.

```typescript
// Works on both Vercel Edge and Cloudflare Workers
export async function GET(request: Request): Promise<Response> {
  const encoder = new TextEncoder();
  let eventId = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: string, event?: string) => {
        let msg = '';
        if (event) msg += `event: ${event}\n`;
        msg += `id: ${eventId++}\n`;
        msg += `data: ${data}\n\n`;
        controller.enqueue(encoder.encode(msg));
      };

      // Your streaming logic here
      sendEvent('connected', 'open');

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### Limitations

- **Execution Time:** Edge functions have time limits (varies by provider)
- **No Node.js APIs:** Use Web APIs only (no `http` module)
- **Memory:** Limited memory per invocation
- **Keep-Alive:** May be terminated by platform after timeout

### Cloudflare Durable Objects (For Long-Running SSE)

```typescript
// Durable Objects can maintain long-running connections
export class SSEHandler {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Store connection for broadcasting
    this.state.setWebSocket(writer);

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }
}
```

---

## Summary

### Quick Decision Guide

```
Do you need real-time server-to-client updates?
├─ YES → Does client need to send messages?
│   ├─ YES → Consider WebSockets or HTTP POST + SSE
│   └─ NO → Use SSE
└─ NO → Use regular HTTP requests
```

### Key Takeaways

1. **SSE is simpler than WebSockets** for one-way server-to-client communication
2. **Always use HTTP/2** to avoid the 6-connection browser limit
3. **Implement proper reconnection** with exponential backoff
4. **Use event IDs** for message recovery on reconnect
5. **Send keep-alive comments** to prevent proxy timeouts
6. **Clean up resources** when clients disconnect
7. **Use the Fetch API** when you need custom headers or POST requests
8. **Consider edge runtimes** for global, low-latency SSE endpoints

---

## Sources

- [MDN Server-Sent Events Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN Using Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [MDN EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Ably: WebSockets vs SSE](https://ably.com/blog/websockets-vs-sse)
- [SoftwareMill: SSE vs WebSockets](https://softwaremill.com/sse-vs-websockets-comparing-real-time-communication-protocols/)
- [Hono Streaming Helper](https://hono.dev/docs/helpers/streaming)
- [VueUse useEventSource](https://vueuse.org/core/useeventsource/)
- [better-sse npm package](https://www.npmjs.com/package/better-sse)
- [Streaming LLM Responses - Tamas Piros](https://tpiros.dev/blog/streaming-llm-responses-a-deep-dive/)
- [Vercel: Introduction to Streaming](https://vercel.com/blog/an-introduction-to-streaming-on-the-web)
- [DEV: Real-Time Stock App with SSE](https://dev.to/itaybenami/sse-websockets-or-polling-build-a-real-time-stock-app-with-react-and-hono-1h1g)
- [Medium: Understanding EventSource](https://medium.com/@anish_29001/understanding-eventsource-in-javascript-a-deep-dive-2fc352fe9d69)
- [JavaScript.info: Server Sent Events](https://javascript.info/server-sent-events)
