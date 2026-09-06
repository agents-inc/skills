# SSE Examples - Core Patterns

> Core code examples for Server-Sent Events. The primary API comes first; the numbered patterns after it are the React hooks built on top. See [SKILL.md](../SKILL.md) for concepts.

**Extended patterns:** See [reconnection.md](reconnection.md) for advanced reconnection and [fetch-streaming.md](fetch-streaming.md) for fetch-based streaming.

---

## Primary API

### EventSource Lifecycle

```typescript
const SSE_URL = "/api/events";

const eventSource = new EventSource(SSE_URL);

eventSource.onopen = () => {
  // Connection is ready — the server can push from here
};

eventSource.onmessage = (event: MessageEvent) => {
  handleMessage(event.data);
  // event.lastEventId is the id: field, replayed as Last-Event-ID on reconnect
};

eventSource.onerror = () => {
  if (eventSource.readyState === EventSource.CLOSED) {
    // Permanently closed — the browser will not retry an HTTP error status
    scheduleManualReconnect();
  } else if (eventSource.readyState === EventSource.CONNECTING) {
    // The browser is already retrying — show a reconnecting state and wait
  }
};

// When the consumer goes away
eventSource.close();
```

**Why:** All three lifecycle events are handled, and the `readyState` branch is what separates a retry in progress from a stream the browser has given up on.

```typescript
// BAD — silent failure and a connection that never closes
const eventSource = new EventSource("/api/events");
eventSource.onmessage = (event) => console.log(event.data);
```

**Why bad:** With no `onerror`, a failed stream is indistinguishable from a quiet one. With no `close()`, the connection outlives its consumer and counts against the browser's per-domain limit.

---

### Custom Event Types

A message carrying an `event:` field is routed to a listener of that name; messages without one go to `onmessage`.

```typescript
const eventSource = new EventSource("/api/notifications");

eventSource.onmessage = (event: MessageEvent) => {
  handleDefault(event.data);
};

eventSource.addEventListener("notification", (event: MessageEvent) => {
  const notification = JSON.parse(event.data);
  showNotification(notification.title, notification.body);
});

eventSource.addEventListener("user-joined", (event: MessageEvent) => {
  updateUserList(JSON.parse(event.data));
});

eventSource.addEventListener("heartbeat", (event: MessageEvent) => {
  markConnectionHealthy(event.data);
});
```

---

### Credentials and Cross-Origin

```typescript
const eventSource = new EventSource("https://api.example.com/events", {
  withCredentials: true, // send cookies cross-origin
});

eventSource.onerror = () => {
  // A CORS rejection surfaces here with nothing more specific than "error"
};
```

**Why:** `withCredentials` is the only authentication mechanism `EventSource` offers, and the server has to allow credentials in its CORS configuration for it to work.

---

### Connection State Wrapper

Tracks status for UI feedback and adds the manual retry `EventSource` will not perform after an HTTP error.

```typescript
const MAX_MANUAL_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

type SSEStatus = "connecting" | "open" | "closed" | "error";

export class SSEConnection {
  private eventSource: EventSource | null = null;
  private status: SSEStatus = "closed";
  private manualRetryCount = 0;

  constructor(
    private url: string,
    private options: {
      onStatusChange?: (status: SSEStatus) => void;
      onMessage?: (data: string, eventType: string) => void;
    } = {},
  ) {}

  connect(): void {
    if (this.eventSource) this.disconnect();

    this.setStatus("connecting");
    this.eventSource = new EventSource(this.url);

    this.eventSource.onopen = () => {
      this.setStatus("open");
      this.manualRetryCount = 0;
    };

    this.eventSource.onmessage = (event: MessageEvent) => {
      this.options.onMessage?.(event.data, "message");
    };

    this.eventSource.onerror = () => {
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.setStatus("closed");
        this.attemptManualReconnect();
      } else {
        this.setStatus("error");
      }
    };
  }

  private attemptManualReconnect(): void {
    if (this.manualRetryCount >= MAX_MANUAL_RETRIES) return;
    this.manualRetryCount++;
    setTimeout(() => this.connect(), RETRY_DELAY_MS);
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
    this.setStatus("closed");
  }

  private setStatus(status: SSEStatus): void {
    this.status = status;
    this.options.onStatusChange?.(status);
  }

  getStatus(): SSEStatus {
    return this.status;
  }
}
```

**Why:** The retry counter resets on a successful open, so a flapping connection does not exhaust its budget. `disconnect()` before `connect()` is what stops a reconnect leaving the previous stream open.

---

### Typed Message Handling

```typescript
type SSEMessage =
  | {
      type: "notification";
      title: string;
      body: string;
      priority: "low" | "high";
    }
  | { type: "user-update"; userId: string; action: "joined" | "left" }
  | { type: "data-sync"; payload: unknown; timestamp: number }
  | { type: "heartbeat"; serverTime: number };

// Named for the payload, not the wire format — the SSE field parser in
// fetch-streaming.md is a different function with a different job.
function parsePayload(data: string): SSEMessage | null {
  try {
    return JSON.parse(data) as SSEMessage;
  } catch {
    return null;
  }
}

function handleSSEMessage(message: SSEMessage): void {
  switch (message.type) {
    case "notification":
      return showNotification(message.title, message.body, message.priority);
    case "user-update":
      return updateUserPresence(message.userId, message.action);
    case "data-sync":
      return syncData(message.payload, message.timestamp);
    case "heartbeat":
      return updateServerTime(message.serverTime);
    default: {
      const exhaustive: never = message;
      return exhaustive;
    }
  }
}

eventSource.onmessage = (event: MessageEvent) => {
  const message = parsePayload(event.data);
  if (message) handleSSEMessage(message);
};
```

**Why:** Parsing and handling are separate, so a malformed payload returns `null` instead of throwing out of the handler. The `never` assignment turns an unhandled server message type into a compile error.

---

## Pattern 7: Custom React Hook (useEventSource)

A comprehensive custom hook for EventSource management in React applications.

### Type Definitions

```typescript
// types/sse.ts
export type SSEStatus = "connecting" | "open" | "closed" | "error";

export interface UseEventSourceOptions {
  withCredentials?: boolean;
  onMessage?: (event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onOpen?: () => void;
  enabled?: boolean;
}

export interface UseEventSourceReturn {
  status: SSEStatus;
  lastMessage: string | null;
  lastEventId: string | null;
  error: Event | null;
  close: () => void;
  reconnect: () => void;
}
```

### Hook Implementation

```typescript
// hooks/use-event-source.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  UseEventSourceOptions,
  UseEventSourceReturn,
  SSEStatus,
} from "../types/sse";

export function useEventSource(
  url: string | null,
  options: UseEventSourceOptions = {},
): UseEventSourceReturn {
  const {
    withCredentials = false,
    onMessage,
    onOpen,
    onError,
    enabled = true,
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const [status, setStatus] = useState<SSEStatus>("closed");
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [error, setError] = useState<Event | null>(null);

  const connect = useCallback(() => {
    if (!url || !enabled) return;

    setStatus("connecting");
    setError(null);

    const eventSource = new EventSource(url, { withCredentials });
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus("open");
      onOpen?.();
    };

    eventSource.onmessage = (event: MessageEvent) => {
      setLastMessage(event.data);
      setLastEventId(event.lastEventId || null);
      onMessage?.(event);
    };

    eventSource.onerror = (err: Event) => {
      setError(err);
      onError?.(err);

      if (eventSource.readyState === EventSource.CLOSED) {
        setStatus("closed");
      } else {
        setStatus("error");
      }
    };
  }, [url, withCredentials, onMessage, onOpen, onError, enabled]);

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setStatus("closed");
    }
  }, []);

  const reconnect = useCallback(() => {
    close();
    // Small delay before reconnecting
    setTimeout(connect, 100);
  }, [close, connect]);

  useEffect(() => {
    connect();
    return close;
  }, [connect, close]);

  return { status, lastMessage, lastEventId, error, close, reconnect };
}
```

### Usage Example

```typescript
// components/live-feed.tsx
import { useCallback, useState } from "react";
import { useEventSource } from "../hooks/use-event-source";

const SSE_URL = "/api/feed";

interface FeedItem {
  id: string;
  content: string;
  timestamp: number;
}

export function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);

  const handleMessage = useCallback((event: MessageEvent) => {
    const item: FeedItem = JSON.parse(event.data);
    setItems((prev) => [item, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  const { status, reconnect } = useEventSource(SSE_URL, {
    onMessage: handleMessage,
  });

  return (
    <div>
      <div>
        Status: {status}
        {status === "closed" && (
          <button onClick={reconnect}>Reconnect</button>
        )}
      </div>

      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.content}</li>
        ))}
      </ul>
    </div>
  );
}
```

**Why:** The effect returns `close`, so the stream dies with the component rather than outliving it. `reconnect` exists because the `CLOSED` branch is the one the browser will not retry for you.

---

## Pattern 8: Advanced useSSE Hook with Custom Events

A more advanced hook that supports custom event types and typed messages.

### Type Definitions

```typescript
// types/sse-advanced.ts
export interface SSEEvent<T = unknown> {
  type: string;
  data: T;
  id: string | null;
  timestamp: number;
}

export interface UseSSEOptions<T> {
  events?: string[];
  parser?: (data: string) => T;
  onEvent?: (event: SSEEvent<T>) => void;
  onOpen?: () => void;
  onError?: (error: Event) => void;
  maxEvents?: number;
}

export interface UseSSEReturn<T> {
  isConnected: boolean;
  isConnecting: boolean;
  lastEvent: SSEEvent<T> | null;
  events: SSEEvent<T>[];
  error: Event | null;
  connect: () => void;
  disconnect: () => void;
}
```

### Hook Implementation

```typescript
// hooks/use-sse.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  UseSSEOptions,
  UseSSEReturn,
  SSEEvent,
} from "../types/sse-advanced";

const DEFAULT_MAX_EVENTS = 100;

export function useSSE<T = unknown>(
  url: string | null,
  options: UseSSEOptions<T> = {},
): UseSSEReturn<T> {
  const {
    events: customEvents = [],
    parser = JSON.parse,
    onEvent,
    onOpen,
    onError,
    maxEvents = DEFAULT_MAX_EVENTS,
  } = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent<T> | null>(null);
  const [events, setEvents] = useState<SSEEvent<T>[]>([]);
  const [error, setError] = useState<Event | null>(null);

  const handleEvent = useCallback(
    (eventType: string) => (event: MessageEvent) => {
      try {
        const data = parser(event.data);
        const sseEvent: SSEEvent<T> = {
          type: eventType,
          data,
          id: event.lastEventId || null,
          timestamp: Date.now(),
        };

        setLastEvent(sseEvent);
        setEvents((prev) => [...prev.slice(-(maxEvents - 1)), sseEvent]);
        onEvent?.(sseEvent);
      } catch (parseError) {
        console.error("Failed to parse SSE data:", parseError);
      }
    },
    [parser, onEvent, maxEvents],
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
      onOpen?.();
    };

    // Default message handler
    eventSource.onmessage = handleEvent("message");

    // Custom event handlers
    customEvents.forEach((eventType) => {
      eventSource.addEventListener(
        eventType,
        handleEvent(eventType) as EventListener,
      );
    });

    eventSource.onerror = (err) => {
      setError(err);
      onError?.(err);

      if (eventSource.readyState === EventSource.CLOSED) {
        setIsConnected(false);
        setIsConnecting(false);
        eventSourceRef.current = null;
      }
    };
  }, [url, customEvents, handleEvent, onOpen, onError]);

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
```

### Usage with Multiple Event Types

```typescript
// components/notifications.tsx
import { useCallback } from "react";
import { useSSE } from "../hooks/use-sse";

const SSE_URL = "/api/notifications";

interface Notification {
  id: string;
  title: string;
  body: string;
  priority: "low" | "normal" | "high";
}

export function NotificationCenter() {
  const handleEvent = useCallback((event: { type: string; data: Notification }) => {
    if (event.type === "alert" && event.data.priority === "high") {
      // Show toast for high-priority alerts
      showToast(event.data.title, event.data.body);
    }
  }, []);

  const { isConnected, events, error, disconnect, connect } = useSSE<Notification>(
    SSE_URL,
    {
      events: ["notification", "alert", "system"],
      onEvent: handleEvent,
    }
  );

  if (error) {
    return (
      <div>
        Connection error
        <button onClick={connect}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <header>
        Notifications {isConnected ? "(live)" : "(offline)"}
        <button onClick={isConnected ? disconnect : connect}>
          {isConnected ? "Disconnect" : "Connect"}
        </button>
      </header>

      <ul>
        {events.map((event, index) => (
          <li key={event.id || index} data-priority={event.data.priority}>
            <strong>[{event.type}]</strong> {event.data.title}
            <p>{event.data.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Why:** Named events need a listener registered per name, so the hook takes the names as an option rather than guessing them. The history is capped because a long-lived stream would otherwise grow it without bound.

---

## Pattern 9: Shared SSE Connection via Context

When multiple components need the same SSE connection, use a context provider to share it.

### Context Implementation

```typescript
// context/sse-context.tsx
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";

const SSE_URL = "/api/events";

type SSEStatus = "connecting" | "open" | "closed";

interface SSEContextValue {
  status: SSEStatus;
  subscribe: (
    eventType: string,
    handler: (data: unknown) => void
  ) => () => void;
}

const SSEContext = createContext<SSEContextValue | null>(null);

export function SSEProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SSEStatus>("connecting");
  const eventSourceRef = useRef<EventSource | null>(null);
  const subscribersRef = useRef<Map<string, Set<(data: unknown) => void>>>(
    new Map()
  );

  useEffect(() => {
    const eventSource = new EventSource(SSE_URL);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => setStatus("open");
    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setStatus("closed");
      }
    };

    // Route all messages to subscribers
    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const eventType = data.type || "message";

        const handlers = subscribersRef.current.get(eventType);
        handlers?.forEach((handler) => handler(data));
      } catch {
        console.error("Failed to parse SSE message");
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const subscribe = useCallback(
    (eventType: string, handler: (data: unknown) => void) => {
      if (!subscribersRef.current.has(eventType)) {
        subscribersRef.current.set(eventType, new Set());
      }
      subscribersRef.current.get(eventType)!.add(handler);

      // Return unsubscribe function
      return () => {
        subscribersRef.current.get(eventType)?.delete(handler);
      };
    },
    []
  );

  return (
    <SSEContext.Provider value={{ status, subscribe }}>
      {children}
    </SSEContext.Provider>
  );
}

export function useSSEContext() {
  const context = useContext(SSEContext);
  if (!context) {
    throw new Error("useSSEContext must be used within SSEProvider");
  }
  return context;
}
```

### Component Using Shared Connection

```typescript
// components/user-activity.tsx
import { useEffect, useState } from "react";
import { useSSEContext } from "../context/sse-context";

interface UserActivity {
  type: "user-activity";
  userId: string;
  action: string;
  timestamp: number;
}

export function UserActivityFeed() {
  const { status, subscribe } = useSSEContext();
  const [activities, setActivities] = useState<UserActivity[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe("user-activity", (data) => {
      const activity = data as UserActivity;
      setActivities((prev) => [activity, ...prev].slice(0, 20));
    });

    return unsubscribe;
  }, [subscribe]);

  return (
    <div>
      <div>Connection: {status}</div>
      <ul>
        {activities.map((activity, index) => (
          <li key={index}>
            User {activity.userId}: {activity.action}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Why:** One connection instead of one per component, which matters because each stream counts against the browser's per-domain limit. `subscribe` returns its own unsubscribe so a consumer can return it straight from an effect.

---

## Pattern 10: Conditional Connection

Enable or disable SSE connection based on conditions (authentication, visibility, etc.).

```typescript
// hooks/use-conditional-sse.ts
import { useEffect, useState, useRef } from "react";

const SSE_URL = "/api/events";

interface UseConditionalSSEOptions {
  enabled: boolean;
  onMessage?: (data: unknown) => void;
}

export function useConditionalSSE(options: UseConditionalSSEOptions) {
  const { enabled, onMessage } = options;
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Close existing connection when disabled
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Connect when enabled
    const eventSource = new EventSource(SSE_URL);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => setIsConnected(true);
    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setIsConnected(false);
      }
    };
    eventSource.onmessage = (event) => {
      onMessage?.(JSON.parse(event.data));
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    };
  }, [enabled, onMessage]);

  return { isConnected };
}

// Usage - connect only when tab is visible
function Dashboard() {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const { isConnected } = useConditionalSSE({
    enabled: isVisible,
    onMessage: (data) => console.log("Update:", data),
  });

  return <div>Connection: {isConnected ? "Live" : "Paused"}</div>;
}
```

**Why:** A hidden tab holds a connection open for nobody, and closing it frees both the server's slot and one of the browser's per-domain connections. Toggling `enabled` rather than unmounting keeps the component's own state intact across the pause. A fast tab switch will open and close the stream repeatedly — [reconnection.md](reconnection.md) adds the resume delay that damps it.
