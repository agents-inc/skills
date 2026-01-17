# WebSocket Examples

> Core code examples for WebSocket real-time communication in React. See [SKILL.md](../SKILL.md) for concepts.

**Extended patterns:** See [state-machine.md](state-machine.md), [binary.md](binary.md), and [presence.md](presence.md) for advanced patterns.

---

## Pattern 9: Custom React Hook (useWebSocket)

A comprehensive custom hook for WebSocket management in React applications.

### Type Definitions

```typescript
// types/websocket.ts
export type WebSocketStatus = "connecting" | "open" | "closing" | "closed";

export interface UseWebSocketOptions<TIn, TOut> {
  url: string;
  onMessage?: (message: TIn) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  heartbeatMessage?: TOut;
}

export interface UseWebSocketReturn<TOut> {
  status: WebSocketStatus;
  send: (message: TOut) => void;
  close: () => void;
  reconnect: () => void;
}
```

### Hook Implementation

```typescript
// hooks/use-websocket.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseWebSocketOptions, UseWebSocketReturn, WebSocketStatus } from "../types/websocket";

const DEFAULT_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_INTERVAL_MS = 1000;
const MAX_RECONNECT_INTERVAL_MS = 30000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 10000;
const JITTER_FACTOR = 0.5;

function calculateBackoff(attempt: number, baseInterval: number): number {
  const exponentialDelay = Math.min(
    baseInterval * Math.pow(2, attempt),
    MAX_RECONNECT_INTERVAL_MS
  );
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.floor(exponentialDelay + jitter);
}

export function useWebSocket<TIn, TOut>(
  options: UseWebSocketOptions<TIn, TOut>
): UseWebSocketReturn<TOut> {
  const {
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    reconnect: shouldReconnect = true,
    reconnectAttempts = DEFAULT_RECONNECT_ATTEMPTS,
    reconnectInterval = INITIAL_RECONNECT_INTERVAL_MS,
    heartbeatInterval = DEFAULT_HEARTBEAT_INTERVAL_MS,
    heartbeatMessage,
  } = options;

  const [status, setStatus] = useState<WebSocketStatus>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageQueueRef = useRef<TOut[]>([]);
  const mountedRef = useRef(true);
  const manualCloseRef = useRef(false);

  const clearHeartbeatTimeout = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    clearHeartbeatTimeout();
  }, [clearHeartbeatTimeout]);

  const startHeartbeat = useCallback(() => {
    if (!heartbeatMessage || heartbeatInterval <= 0) return;

    stopHeartbeat();

    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(heartbeatMessage));

        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn("Heartbeat timeout - closing connection");
          socketRef.current?.close();
        }, HEARTBEAT_TIMEOUT_MS);
      }
    }, heartbeatInterval);
  }, [heartbeatMessage, heartbeatInterval, stopHeartbeat]);

  const flushMessageQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0) {
      const message = messageQueueRef.current.shift();
      if (message && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(message));
      }
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    setStatus("connecting");
    manualCloseRef.current = false;

    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = (event: Event) => {
      if (!mountedRef.current) {
        socket.close();
        return;
      }

      setStatus("open");
      reconnectCountRef.current = 0;
      startHeartbeat();
      flushMessageQueue();
      onOpen?.(event);
    };

    socket.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data) as TIn;

        // Handle heartbeat response (clear timeout)
        if (heartbeatMessage && (data as unknown as { type?: string }).type === "pong") {
          clearHeartbeatTimeout();
          return;
        }

        onMessage?.(data);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    socket.onerror = (event: Event) => {
      if (!mountedRef.current) return;
      onError?.(event);
    };

    socket.onclose = (event: CloseEvent) => {
      if (!mountedRef.current) return;

      setStatus("closed");
      stopHeartbeat();
      onClose?.(event);

      // Attempt reconnection if enabled and not manually closed
      if (
        shouldReconnect &&
        !manualCloseRef.current &&
        reconnectCountRef.current < reconnectAttempts
      ) {
        const delay = calculateBackoff(reconnectCountRef.current, reconnectInterval);
        reconnectCountRef.current++;

        console.log(`WebSocket reconnecting in ${delay}ms (attempt ${reconnectCountRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };
  }, [
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    shouldReconnect,
    reconnectAttempts,
    reconnectInterval,
    heartbeatMessage,
    startHeartbeat,
    stopHeartbeat,
    clearHeartbeatTimeout,
    flushMessageQueue,
  ]);

  const send = useCallback((message: TOut) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      // Queue message for delivery on reconnect
      messageQueueRef.current.push(message);
    }
  }, []);

  const close = useCallback(() => {
    manualCloseRef.current = true;
    setStatus("closing");

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();
    socketRef.current?.close(1000, "Client closed");
  }, [stopHeartbeat]);

  const reconnectManual = useCallback(() => {
    close();
    reconnectCountRef.current = 0;
    manualCloseRef.current = false;

    // Small delay before reconnecting
    setTimeout(connect, 100);
  }, [close, connect]);

  // Initial connection
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      manualCloseRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      stopHeartbeat();
      socketRef.current?.close(1000, "Component unmounted");
    };
  }, [connect, stopHeartbeat]);

  return {
    status,
    send,
    close,
    reconnect: reconnectManual,
  };
}
```

### Usage Example

```typescript
// components/chat.tsx
import { useCallback, useState } from "react";
import { useWebSocket } from "../hooks/use-websocket";

const WS_URL = "wss://api.example.com/ws";

// Discriminated union message types
type ServerMessage =
  | { type: "message"; content: string; sender: string; timestamp: number }
  | { type: "user_joined"; username: string }
  | { type: "user_left"; username: string }
  | { type: "pong" };

type ClientMessage =
  | { type: "message"; content: string }
  | { type: "ping" };

interface Message {
  content: string;
  sender: string;
  timestamp: number;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case "message":
        setMessages((prev) => [
          ...prev,
          {
            content: message.content,
            sender: message.sender,
            timestamp: message.timestamp,
          },
        ]);
        break;
      case "user_joined":
        console.log(`${message.username} joined`);
        break;
      case "user_left":
        console.log(`${message.username} left`);
        break;
      case "pong":
        // Handled by hook internally
        break;
    }
  }, []);

  const { status, send } = useWebSocket<ServerMessage, ClientMessage>({
    url: WS_URL,
    onMessage: handleMessage,
    reconnect: true,
    heartbeatInterval: 30000,
    heartbeatMessage: { type: "ping" },
  });

  const handleSend = () => {
    if (inputValue.trim()) {
      send({ type: "message", content: inputValue });
      setInputValue("");
    }
  };

  return (
    <div>
      <div>Status: {status}</div>

      <ul>
        {messages.map((msg, idx) => (
          <li key={idx}>
            <strong>{msg.sender}:</strong> {msg.content}
          </li>
        ))}
      </ul>

      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
        disabled={status !== "open"}
        placeholder={status === "open" ? "Type a message..." : "Connecting..."}
      />

      <button onClick={handleSend} disabled={status !== "open"}>
        Send
      </button>
    </div>
  );
}
```

**Why good:** Hook encapsulates all WebSocket complexity, typed message generics, automatic reconnection with backoff, heartbeat included, message queueing, proper cleanup on unmount, status exposed for UI feedback

---

## Pattern 10: Shared WebSocket Connection

When multiple components need the same WebSocket, use a context provider to share a single connection.

```typescript
// context/websocket-context.tsx
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const WS_URL = "wss://api.example.com/ws";

interface WebSocketContextValue {
  status: "connecting" | "open" | "closed";
  send: (message: unknown) => void;
  subscribe: (type: string, handler: (data: unknown) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const subscribersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => setStatus("open");
    socket.onclose = () => setStatus("closed");

    socket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      const messageType = data.type as string;

      // Notify all subscribers for this message type
      const handlers = subscribersRef.current.get(messageType);
      handlers?.forEach((handler) => handler(data));
    };

    return () => {
      socket.close(1000, "Provider unmounted");
    };
  }, []);

  const send = (message: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  const subscribe = (type: string, handler: (data: unknown) => void) => {
    if (!subscribersRef.current.has(type)) {
      subscribersRef.current.set(type, new Set());
    }
    subscribersRef.current.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      subscribersRef.current.get(type)?.delete(handler);
    };
  };

  return (
    <WebSocketContext.Provider value={{ status, send, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocketContext must be used within WebSocketProvider");
  }
  return context;
}
```

### Component Using Shared Connection

```typescript
// components/notifications.tsx
import { useEffect, useState } from "react";
import { useWebSocketContext } from "../context/websocket-context";

interface Notification {
  id: string;
  title: string;
  message: string;
}

export function Notifications() {
  const { subscribe } = useWebSocketContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Subscribe to notification messages
    const unsubscribe = subscribe("notification", (data) => {
      const notification = data as { type: "notification" } & Notification;
      setNotifications((prev) => [...prev, notification]);
    });

    return unsubscribe;
  }, [subscribe]);

  return (
    <ul>
      {notifications.map((n) => (
        <li key={n.id}>
          <strong>{n.title}</strong>: {n.message}
        </li>
      ))}
    </ul>
  );
}
```

**Why good:** Single WebSocket connection shared across components, type-based message routing, automatic cleanup with unsubscribe function, context prevents prop drilling
