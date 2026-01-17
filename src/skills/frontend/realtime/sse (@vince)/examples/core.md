# SSE Examples - Core Patterns

> Core code examples for Server-Sent Events in React. See [SKILL.md](../SKILL.md) for concepts.

**Extended patterns:** See [reconnection.md](reconnection.md) for advanced reconnection and [fetch-streaming.md](fetch-streaming.md) for fetch-based streaming.

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
import type { UseEventSourceOptions, UseEventSourceReturn, SSEStatus } from "../types/sse";

export function useEventSource(
  url: string | null,
  options: UseEventSourceOptions = {}
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

**Why good:** Hook encapsulates all EventSource complexity, typed options and return value, automatic cleanup on unmount, status exposed for UI feedback, reconnect function for manual recovery

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
import type { UseSSEOptions, UseSSEReturn, SSEEvent } from "../types/sse-advanced";

const DEFAULT_MAX_EVENTS = 100;

export function useSSE<T = unknown>(
  url: string | null,
  options: UseSSEOptions<T> = {}
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
    [parser, onEvent, maxEvents]
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
        handleEvent(eventType) as EventListener
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

**Why good:** Supports multiple custom event types, typed generic for message data, event history with configurable limit, callbacks for real-time reactions, proper cleanup

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

**Why good:** Single SSE connection shared across components, type-based message routing, automatic cleanup with unsubscribe function, context prevents prop drilling, status exposed for all consumers

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

**Why good:** Connection paused when not needed (saves server resources), responds to visibility changes, proper cleanup when disabled, simple API with enabled flag
