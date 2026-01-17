# Real-Time Communication Patterns Research

> Comprehensive patterns for WebSocket, SSE, and real-time features in TypeScript/React applications.

---

## Table of Contents

1. [Native WebSocket Patterns](#1-native-websocket-patterns)
2. [Socket.io Patterns](#2-socketio-patterns)
3. [Pusher/Ably Patterns](#3-pusherably-patterns)
4. [Server-Sent Events (SSE) Patterns](#4-server-sent-events-sse-patterns)
5. [Reconnection Strategies](#5-reconnection-strategies)
6. [Message Queuing Patterns](#6-message-queuing-patterns)
7. [Presence/Typing Indicators](#7-presencetyping-indicators)
8. [Optimistic Updates with Real-Time](#8-optimistic-updates-with-real-time)
9. [React Query + Real-Time Integration](#9-react-query--real-time-integration)
10. [Testing Real-Time Features](#10-testing-real-time-features)

---

## 1. Native WebSocket Patterns

### Core Pattern: WebSocket Manager Class

```typescript
// lib/websocket-manager.ts

// Constants - NO magic numbers
const HEARTBEAT_INTERVAL_MS = 30000;
const RECONNECT_BASE_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;
const EXPONENTIAL_BACKOFF_FACTOR = 2;

type WebSocketStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

type MessageHandler<T = unknown> = (data: T) => void;

interface WebSocketManagerConfig {
  url: string;
  protocols?: string[];
  heartbeatIntervalMs?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private status: WebSocketStatus = "disconnected";
  private reconnectAttempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private statusHandlers = new Set<(status: WebSocketStatus) => void>();

  constructor(private config: WebSocketManagerConfig) {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols);
      this.setupEventHandlers();
    } catch (error) {
      console.error("[WebSocket] Connection failed:", error);
      this.handleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.setStatus("connected");
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      console.info("[WebSocket] Connected");
    };

    this.ws.onclose = (event) => {
      console.info("[WebSocket] Closed:", event.code, event.reason);
      this.stopHeartbeat();
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as { type: string; payload: unknown };
        this.notifyHandlers(message.type, message.payload);
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    };
  }

  private startHeartbeat(): void {
    const interval = this.config.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "ping", payload: { timestamp: Date.now() } });
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleReconnect(): void {
    const maxAttempts = this.config.maxReconnectAttempts ?? MAX_RECONNECT_ATTEMPTS;

    if (this.reconnectAttempts >= maxAttempts) {
      this.setStatus("disconnected");
      console.error("[WebSocket] Max reconnection attempts reached");
      return;
    }

    this.setStatus("reconnecting");
    this.reconnectAttempts++;

    // Exponential backoff with jitter
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * EXPONENTIAL_BACKOFF_FACTOR ** this.reconnectAttempts,
      MAX_RECONNECT_DELAY_MS
    );
    const jitter = Math.random() * delay * 0.1; // 10% jitter

    console.info(`[WebSocket] Reconnecting in ${delay + jitter}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => this.connect(), delay + jitter);
  }

  send<T>(message: { type: string; payload: T }): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("[WebSocket] Cannot send - not connected");
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  subscribe<T>(eventType: string, handler: MessageHandler<T>): () => void {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, new Set());
    }

    this.messageHandlers.get(eventType)!.add(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(eventType)?.delete(handler as MessageHandler);
    };
  }

  onStatusChange(handler: (status: WebSocketStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  private setStatus(status: WebSocketStatus): void {
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }

  private notifyHandlers(eventType: string, payload: unknown): void {
    this.messageHandlers.get(eventType)?.forEach((handler) => handler(payload));
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
    this.setStatus("disconnected");
  }

  getStatus(): WebSocketStatus {
    return this.status;
  }
}

export { WebSocketManager };
```

### React Hook Pattern

```typescript
// hooks/use-websocket.ts
import { useEffect, useRef, useCallback, useState } from "react";
import { WebSocketManager } from "@/lib/websocket-manager";

interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
}

export function useWebSocket({ url, autoConnect = true }: UseWebSocketOptions) {
  const managerRef = useRef<WebSocketManager | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "reconnecting">("disconnected");

  useEffect(() => {
    managerRef.current = new WebSocketManager({ url });

    const unsubscribe = managerRef.current.onStatusChange(setStatus);

    if (autoConnect) {
      managerRef.current.connect();
    }

    return () => {
      unsubscribe();
      managerRef.current?.disconnect();
    };
  }, [url, autoConnect]);

  const subscribe = useCallback(<T>(eventType: string, handler: (data: T) => void) => {
    return managerRef.current?.subscribe(eventType, handler) ?? (() => {});
  }, []);

  const send = useCallback(<T>(type: string, payload: T) => {
    managerRef.current?.send({ type, payload });
  }, []);

  const connect = useCallback(() => {
    managerRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    managerRef.current?.disconnect();
  }, []);

  return { status, subscribe, send, connect, disconnect };
}

export { useWebSocket };
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Creating WebSocket in render
function BadComponent() {
  // Creates new connection on every render!
  const ws = new WebSocket("wss://api.example.com");
  // ...
}

// ANTI-PATTERN 2: No cleanup
function BadComponent() {
  useEffect(() => {
    const ws = new WebSocket(url);
    // Missing cleanup - connection leak!
  }, []);
}

// ANTI-PATTERN 3: Magic numbers
setTimeout(() => ws.close(), 30000); // What is 30000?

// ANTI-PATTERN 4: No error handling
ws.onmessage = (event) => {
  const data = JSON.parse(event.data); // Crashes on invalid JSON
};

// ANTI-PATTERN 5: Synchronous reconnect
ws.onclose = () => {
  new WebSocket(url); // Immediate reconnect causes thundering herd
};
```

### When to Use Native WebSocket

**Use when:**
- Need full control over connection lifecycle
- Simple message passing without complex event namespacing
- Bundle size is critical (no external dependencies)
- Building WebSocket wrapper for specific use case

**Do NOT use when:**
- Need automatic reconnection with fallbacks (use Socket.io)
- Need rooms/channels/presence out of the box (use Pusher/Ably)
- Team lacks WebSocket experience (use managed service)
- Need HTTP fallback for corporate proxies (use Socket.io)

---

## 2. Socket.io Patterns

### Core Pattern: Socket.io Client Setup

```typescript
// lib/socket-client.ts
import { io, Socket } from "socket.io-client";

// Constants
const RECONNECTION_DELAY_MS = 1000;
const RECONNECTION_DELAY_MAX_MS = 5000;
const RECONNECTION_ATTEMPTS = 10;
const TIMEOUT_MS = 20000;

interface ServerToClientEvents {
  "message:new": (data: { id: string; content: string; userId: string }) => void;
  "user:joined": (data: { userId: string; username: string }) => void;
  "user:left": (data: { userId: string }) => void;
  "typing:start": (data: { userId: string }) => void;
  "typing:stop": (data: { userId: string }) => void;
}

interface ClientToServerEvents {
  "message:send": (data: { content: string; roomId: string }, callback: (response: { success: boolean }) => void) => void;
  "room:join": (roomId: string) => void;
  "room:leave": (roomId: string) => void;
  "typing:start": (roomId: string) => void;
  "typing:stop": (roomId: string) => void;
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

    if (!SOCKET_URL) {
      throw new Error("NEXT_PUBLIC_SOCKET_URL environment variable is required");
    }

    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: RECONNECTION_DELAY_MS,
      reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
      reconnectionAttempts: RECONNECTION_ATTEMPTS,
      timeout: TIMEOUT_MS,
      transports: ["websocket", "polling"], // WebSocket first, polling fallback
    });

    // Global event handlers
    socket.on("connect", () => {
      console.info("[Socket.io] Connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.info("[Socket.io] Disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket.io] Connection error:", error.message);
    });
  }

  return socket;
}

export function connectSocket(): void {
  getSocket().connect();
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export { getSocket, connectSocket, disconnectSocket };
```

### React Hook with Type Safety

```typescript
// hooks/use-socket.ts
import { useEffect, useCallback } from "react";
import { getSocket, connectSocket, disconnectSocket } from "@/lib/socket-client";

export function useSocket() {
  useEffect(() => {
    connectSocket();

    return () => {
      disconnectSocket();
    };
  }, []);

  return getSocket();
}

// Typed event subscription hook
export function useSocketEvent<T>(
  event: string,
  handler: (data: T) => void,
  deps: React.DependencyList = []
) {
  const socket = getSocket();

  useEffect(() => {
    socket.on(event as keyof ServerToClientEvents, handler as never);

    return () => {
      socket.off(event as keyof ServerToClientEvents, handler as never);
    };
  }, [socket, event, ...deps]);
}

export { useSocket, useSocketEvent };
```

### Room/Channel Pattern

```typescript
// hooks/use-chat-room.ts
import { useEffect, useState, useCallback } from "react";
import { useSocket, useSocketEvent } from "./use-socket";

interface Message {
  id: string;
  content: string;
  userId: string;
}

interface UseChatRoomOptions {
  roomId: string;
  onMessage?: (message: Message) => void;
}

export function useChatRoom({ roomId, onMessage }: UseChatRoomOptions) {
  const socket = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Join room on mount
  useEffect(() => {
    socket.emit("room:join", roomId);
    setIsConnected(true);

    return () => {
      socket.emit("room:leave", roomId);
      setIsConnected(false);
    };
  }, [socket, roomId]);

  // Listen for new messages
  useSocketEvent<Message>(
    "message:new",
    (message) => {
      setMessages((prev) => [...prev, message]);
      onMessage?.(message);
    },
    [onMessage]
  );

  const sendMessage = useCallback(
    (content: string): Promise<boolean> => {
      return new Promise((resolve) => {
        socket.emit("message:send", { content, roomId }, (response) => {
          resolve(response.success);
        });
      });
    },
    [socket, roomId]
  );

  return { messages, sendMessage, isConnected };
}

export { useChatRoom };
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Creating multiple socket instances
function BadComponent() {
  // Creates new socket on every render!
  const socket = io("wss://api.example.com");
}

// ANTI-PATTERN 2: Not using acknowledgments for critical operations
socket.emit("payment:process", data); // No confirmation!

// ANTI-PATTERN 3: Not cleaning up listeners
useEffect(() => {
  socket.on("message", handler);
  // Missing socket.off() - memory leak!
}, []);

// ANTI-PATTERN 4: Hardcoded URLs
const socket = io("http://localhost:3001"); // Breaks in production

// ANTI-PATTERN 5: Not handling reconnection state
function ChatInput() {
  // Sends message even if disconnected - message lost!
  const send = () => socket.emit("message", { content });
}
```

### When to Use Socket.io

**Use when:**
- Need automatic reconnection with fallbacks
- Need rooms/namespaces for event isolation
- Need acknowledgments for delivery confirmation
- Corporate proxies may block WebSocket (HTTP long-polling fallback)
- Need binary data support out of the box

**Do NOT use when:**
- Bundle size is critical (~40KB gzipped)
- Need horizontal scaling (requires Redis adapter)
- Simple unidirectional updates (use SSE instead)
- Using managed real-time service (Pusher/Ably already handles this)

---

## 3. Pusher/Ably Patterns

### Core Pattern: Pusher Client Setup

```typescript
// lib/pusher-client.ts
import Pusher from "pusher-js";
import type { Channel, PresenceChannel } from "pusher-js";

// Constants
const ACTIVITY_TIMEOUT_MS = 120000;
const PONG_TIMEOUT_MS = 30000;

let pusherClient: Pusher | null = null;

interface PusherConfig {
  appKey: string;
  cluster: string;
  authEndpoint?: string;
}

export function getPusherClient(config?: PusherConfig): Pusher {
  if (!pusherClient) {
    const appKey = config?.appKey ?? process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = config?.cluster ?? process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!appKey || !cluster) {
      throw new Error("Pusher app key and cluster are required");
    }

    pusherClient = new Pusher(appKey, {
      cluster,
      authEndpoint: config?.authEndpoint ?? "/api/pusher/auth",
      activityTimeout: ACTIVITY_TIMEOUT_MS,
      pongTimeout: PONG_TIMEOUT_MS,
    });

    // Connection state logging
    pusherClient.connection.bind("state_change", (states: { current: string; previous: string }) => {
      console.info("[Pusher] State changed:", states.previous, "->", states.current);
    });

    pusherClient.connection.bind("error", (error: Error) => {
      console.error("[Pusher] Connection error:", error);
    });
  }

  return pusherClient;
}

export function subscribeToChannel(channelName: string): Channel {
  return getPusherClient().subscribe(channelName);
}

export function subscribeToPresenceChannel(channelName: string): PresenceChannel {
  return getPusherClient().subscribe(channelName) as PresenceChannel;
}

export function unsubscribeFromChannel(channelName: string): void {
  getPusherClient().unsubscribe(channelName);
}

export { getPusherClient, subscribeToChannel, subscribeToPresenceChannel, unsubscribeFromChannel };
```

### React Hook for Channels

```typescript
// hooks/use-pusher-channel.ts
import { useEffect, useRef, useCallback } from "react";
import type { Channel } from "pusher-js";
import { subscribeToChannel, unsubscribeFromChannel } from "@/lib/pusher-client";

interface UsePusherChannelOptions {
  channelName: string;
  eventHandlers: Record<string, (data: unknown) => void>;
  enabled?: boolean;
}

export function usePusherChannel({
  channelName,
  eventHandlers,
  enabled = true,
}: UsePusherChannelOptions) {
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channel = subscribeToChannel(channelName);
    channelRef.current = channel;

    // Bind all event handlers
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      channel.bind(event, handler);
    });

    return () => {
      // Unbind all handlers
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        channel.unbind(event, handler);
      });
      unsubscribeFromChannel(channelName);
      channelRef.current = null;
    };
  }, [channelName, enabled]); // eventHandlers intentionally omitted

  const trigger = useCallback(
    (eventName: string, data: unknown) => {
      channelRef.current?.trigger(`client-${eventName}`, data);
    },
    []
  );

  return { trigger };
}

export { usePusherChannel };
```

### Ably Pattern (Alternative)

```typescript
// lib/ably-client.ts
import Ably from "ably";
import type { Types } from "ably";

let ablyClient: Types.RealtimePromise | null = null;

export function getAblyClient(): Types.RealtimePromise {
  if (!ablyClient) {
    const apiKey = process.env.NEXT_PUBLIC_ABLY_API_KEY;

    if (!apiKey) {
      throw new Error("NEXT_PUBLIC_ABLY_API_KEY is required");
    }

    ablyClient = new Ably.Realtime.Promise({
      key: apiKey,
      // Or use token auth for client-side
      // authUrl: "/api/ably/auth",
    });

    ablyClient.connection.on("connected", () => {
      console.info("[Ably] Connected");
    });

    ablyClient.connection.on("failed", (stateChange) => {
      console.error("[Ably] Connection failed:", stateChange.reason);
    });
  }

  return ablyClient;
}

// React Hook
export function useAblyChannel(channelName: string) {
  const channelRef = useRef<Types.RealtimeChannelPromise | null>(null);

  useEffect(() => {
    const ably = getAblyClient();
    const channel = ably.channels.get(channelName);
    channelRef.current = channel;

    return () => {
      channel.detach();
    };
  }, [channelName]);

  const subscribe = useCallback(
    async (eventName: string, callback: (message: Types.Message) => void) => {
      await channelRef.current?.subscribe(eventName, callback);
    },
    []
  );

  const publish = useCallback(
    async (eventName: string, data: unknown) => {
      await channelRef.current?.publish(eventName, data);
    },
    []
  );

  return { subscribe, publish };
}

export { getAblyClient, useAblyChannel };
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Subscribing without unsubscribing
useEffect(() => {
  const channel = pusher.subscribe("chat");
  channel.bind("message", handler);
  // Missing cleanup - channel stays subscribed!
}, []);

// ANTI-PATTERN 2: Client-side secret exposure
const pusher = new Pusher(process.env.PUSHER_SECRET); // Secret in client!

// ANTI-PATTERN 3: Not handling connection state
function SendButton() {
  // Tries to send even when disconnected
  const send = () => channel.trigger("client-message", data);
}

// ANTI-PATTERN 4: Subscribing to same channel multiple times
function Component() {
  // Each instance subscribes separately - duplicate events!
  const channel = pusher.subscribe("updates");
}
```

### When to Use Pusher/Ably

**Use when:**
- Need managed real-time infrastructure (no server maintenance)
- Need presence channels (who's online)
- Need guaranteed delivery and message history
- Need horizontal scaling without Redis complexity
- Team lacks real-time infrastructure expertise

**Do NOT use when:**
- High message volume (cost per message adds up)
- Need custom protocol or binary data
- Data sovereignty requirements (check provider regions)
- Simple use case where SSE suffices

---

## 4. Server-Sent Events (SSE) Patterns

### Core Pattern: SSE Client

```typescript
// lib/sse-client.ts

// Constants
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

type SSEStatus = "connecting" | "connected" | "disconnected" | "error";

interface SSEClientConfig {
  url: string;
  withCredentials?: boolean;
  onMessage?: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
  onStatusChange?: (status: SSEStatus) => void;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private eventHandlers = new Map<string, Set<(data: unknown) => void>>();

  constructor(private config: SSEClientConfig) {}

  connect(): void {
    if (this.eventSource?.readyState === EventSource.OPEN) return;

    this.config.onStatusChange?.("connecting");

    try {
      this.eventSource = new EventSource(this.config.url, {
        withCredentials: this.config.withCredentials ?? false,
      });

      this.eventSource.onopen = () => {
        this.config.onStatusChange?.("connected");
        this.reconnectAttempts = 0;
        console.info("[SSE] Connected");
      };

      this.eventSource.onerror = (error) => {
        console.error("[SSE] Error:", error);
        this.config.onError?.(error);
        this.handleReconnect();
      };

      this.eventSource.onmessage = (event) => {
        this.config.onMessage?.(event);
        this.notifyHandlers("message", event.data);
      };
    } catch (error) {
      console.error("[SSE] Failed to connect:", error);
      this.handleReconnect();
    }
  }

  addEventListener(eventType: string, handler: (data: unknown) => void): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());

      // Add native listener for custom event types
      this.eventSource?.addEventListener(eventType, (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          this.notifyHandlers(eventType, data);
        } catch {
          this.notifyHandlers(eventType, (event as MessageEvent).data);
        }
      });
    }

    this.eventHandlers.get(eventType)!.add(handler);

    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
    };
  }

  private notifyHandlers(eventType: string, data: unknown): void {
    this.eventHandlers.get(eventType)?.forEach((handler) => handler(data));
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.config.onStatusChange?.("error");
      console.error("[SSE] Max reconnection attempts reached");
      return;
    }

    this.config.onStatusChange?.("disconnected");
    this.reconnectAttempts++;

    console.info(`[SSE] Reconnecting in ${RECONNECT_DELAY_MS}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.eventSource?.close();
    this.eventSource = null;
    this.config.onStatusChange?.("disconnected");
  }
}

export { SSEClient };
```

### React Hook Pattern

```typescript
// hooks/use-sse.ts
import { useEffect, useRef, useState, useCallback } from "react";
import { SSEClient } from "@/lib/sse-client";

interface UseSSEOptions {
  url: string;
  autoConnect?: boolean;
}

export function useSSE({ url, autoConnect = true }: UseSSEOptions) {
  const clientRef = useRef<SSEClient | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");

  useEffect(() => {
    clientRef.current = new SSEClient({
      url,
      onStatusChange: setStatus,
    });

    if (autoConnect) {
      clientRef.current.connect();
    }

    return () => {
      clientRef.current?.disconnect();
    };
  }, [url, autoConnect]);

  const subscribe = useCallback(<T>(eventType: string, handler: (data: T) => void) => {
    return clientRef.current?.addEventListener(eventType, handler as (data: unknown) => void) ?? (() => {});
  }, []);

  return { status, subscribe };
}

export { useSSE };
```

### Server-Side Handler (Hono)

```typescript
// api/routes/events.ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const HEARTBEAT_INTERVAL_MS = 30000;

const app = new Hono();

app.get("/events", async (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial connection event
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ timestamp: Date.now() }),
    });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(async () => {
      await stream.writeSSE({
        event: "heartbeat",
        data: JSON.stringify({ timestamp: Date.now() }),
      });
    }, HEARTBEAT_INTERVAL_MS);

    // Listen for events from your message queue/pubsub
    const unsubscribe = eventEmitter.on("update", async (data) => {
      await stream.writeSSE({
        event: "update",
        data: JSON.stringify(data),
        id: data.id, // For client-side event deduplication
      });
    });

    // Cleanup on disconnect
    stream.onAbort(() => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
});

export { app };
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Using SSE for bidirectional communication
// SSE is server-to-client only! Use WebSocket for bidirectional.

// ANTI-PATTERN 2: Not handling reconnection
const eventSource = new EventSource(url);
eventSource.onerror = () => {
  // No reconnection logic - stream dies permanently
};

// ANTI-PATTERN 3: Large payloads
stream.writeSSE({
  data: JSON.stringify(hugeArray), // SSE not designed for large data
});

// ANTI-PATTERN 4: Missing event IDs for resumption
stream.writeSSE({
  event: "update",
  data: JSON.stringify(data),
  // Missing id - client can't resume from last event
});

// ANTI-PATTERN 5: No heartbeat
// Connection may be silently dropped by proxies without activity
```

### When to Use SSE

**Use when:**
- Unidirectional server-to-client updates (notifications, feeds)
- Need automatic reconnection built into browser
- Need event IDs for resumption after disconnect
- HTTP/2 available (multiplexed connections)
- Simpler than WebSocket for read-only streams

**Do NOT use when:**
- Need bidirectional communication (use WebSocket)
- Need binary data (SSE is text-only)
- High-frequency updates (WebSocket more efficient)
- Need to support IE11 (no SSE support)

---

## 5. Reconnection Strategies

### Core Pattern: Exponential Backoff with Jitter

```typescript
// lib/reconnection-strategy.ts

// Constants
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const MAX_ATTEMPTS = 10;
const JITTER_FACTOR = 0.1; // 10% jitter
const EXPONENTIAL_BASE = 2;

interface ReconnectionConfig {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  jitterFactor?: number;
}

export class ReconnectionStrategy {
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private config: Required<ReconnectionConfig>;

  constructor(config: ReconnectionConfig = {}) {
    this.config = {
      baseDelayMs: config.baseDelayMs ?? BASE_DELAY_MS,
      maxDelayMs: config.maxDelayMs ?? MAX_DELAY_MS,
      maxAttempts: config.maxAttempts ?? MAX_ATTEMPTS,
      jitterFactor: config.jitterFactor ?? JITTER_FACTOR,
    };
  }

  // Calculate delay with exponential backoff and jitter
  private calculateDelay(): number {
    const exponentialDelay =
      this.config.baseDelayMs * EXPONENTIAL_BASE ** this.attempts;
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.config.jitterFactor * Math.random();

    return cappedDelay + jitter;
  }

  scheduleReconnect(reconnectFn: () => void): boolean {
    if (this.attempts >= this.config.maxAttempts) {
      console.error("[Reconnection] Max attempts reached");
      return false;
    }

    this.attempts++;
    const delay = this.calculateDelay();

    console.info(`[Reconnection] Attempt ${this.attempts} in ${Math.round(delay)}ms`);

    this.timer = setTimeout(reconnectFn, delay);
    return true;
  }

  reset(): void {
    this.attempts = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getAttempts(): number {
    return this.attempts;
  }

  hasReachedMax(): boolean {
    return this.attempts >= this.config.maxAttempts;
  }
}

export { ReconnectionStrategy };
```

### Connection State Machine

```typescript
// lib/connection-state-machine.ts

type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting" | "failed";

type ConnectionEvent = "CONNECT" | "CONNECTED" | "DISCONNECT" | "ERROR" | "RETRY" | "MAX_RETRIES";

interface StateTransition {
  from: ConnectionState;
  event: ConnectionEvent;
  to: ConnectionState;
  action?: () => void;
}

const transitions: StateTransition[] = [
  { from: "disconnected", event: "CONNECT", to: "connecting" },
  { from: "connecting", event: "CONNECTED", to: "connected" },
  { from: "connecting", event: "ERROR", to: "reconnecting" },
  { from: "connected", event: "DISCONNECT", to: "disconnected" },
  { from: "connected", event: "ERROR", to: "reconnecting" },
  { from: "reconnecting", event: "RETRY", to: "connecting" },
  { from: "reconnecting", event: "MAX_RETRIES", to: "failed" },
  { from: "failed", event: "CONNECT", to: "connecting" },
];

export class ConnectionStateMachine {
  private state: ConnectionState = "disconnected";
  private listeners = new Set<(state: ConnectionState) => void>();

  getState(): ConnectionState {
    return this.state;
  }

  transition(event: ConnectionEvent): boolean {
    const transition = transitions.find(
      (t) => t.from === this.state && t.event === event
    );

    if (!transition) {
      console.warn(`[StateMachine] Invalid transition: ${this.state} + ${event}`);
      return false;
    }

    const previousState = this.state;
    this.state = transition.to;
    transition.action?.();

    console.info(`[StateMachine] ${previousState} -> ${this.state} (${event})`);
    this.notifyListeners();

    return true;
  }

  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export { ConnectionStateMachine };
```

### Network-Aware Reconnection

```typescript
// lib/network-aware-reconnection.ts
import { ReconnectionStrategy } from "./reconnection-strategy";

export class NetworkAwareReconnection {
  private strategy = new ReconnectionStrategy();
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  constructor(private reconnectFn: () => void) {
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
  }

  private handleOnline = (): void => {
    console.info("[Network] Back online, attempting reconnection");
    this.isOnline = true;
    this.strategy.reset();
    this.reconnectFn();
  };

  private handleOffline = (): void => {
    console.info("[Network] Went offline, pausing reconnection");
    this.isOnline = false;
    this.strategy.reset();
  };

  scheduleReconnect(): boolean {
    if (!this.isOnline) {
      console.info("[Network] Offline, waiting for network");
      return false;
    }

    return this.strategy.scheduleReconnect(this.reconnectFn);
  }

  cleanup(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
    this.strategy.reset();
  }
}

export { NetworkAwareReconnection };
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Immediate reconnection (thundering herd)
ws.onclose = () => {
  new WebSocket(url); // All clients reconnect simultaneously
};

// ANTI-PATTERN 2: Fixed delay without backoff
const RECONNECT_DELAY = 5000;
ws.onclose = () => {
  setTimeout(() => connect(), RECONNECT_DELAY); // Never backs off
};

// ANTI-PATTERN 3: No maximum attempts
function reconnect() {
  setTimeout(() => {
    if (!connected) reconnect(); // Infinite loop if server is down
  }, delay);
}

// ANTI-PATTERN 4: No jitter
const delay = BASE_DELAY * 2 ** attempts; // All clients sync up

// ANTI-PATTERN 5: Not checking network status
ws.onclose = () => {
  reconnect(); // Pointless if offline
};
```

### When to Use Each Strategy

**Exponential Backoff:**
- Server overload protection
- Rate limit handling
- General-purpose reconnection

**Jitter:**
- Multiple clients connecting to same server
- Preventing synchronized reconnection storms
- High-availability systems

**Network-Aware:**
- Mobile applications
- Flaky network environments
- Reducing battery usage

---

## 6. Message Queuing Patterns

### Core Pattern: Client-Side Message Queue

```typescript
// lib/message-queue.ts

// Constants
const DEFAULT_MAX_QUEUE_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;

interface QueuedMessage<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  retries: number;
}

interface MessageQueueConfig {
  maxSize?: number;
  flushIntervalMs?: number;
  onFlush?: (messages: QueuedMessage[]) => Promise<void>;
  persistKey?: string;
}

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private config: Required<Omit<MessageQueueConfig, "onFlush" | "persistKey">> & MessageQueueConfig;

  constructor(config: MessageQueueConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? DEFAULT_MAX_QUEUE_SIZE,
      flushIntervalMs: config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
      onFlush: config.onFlush,
      persistKey: config.persistKey,
    };

    this.loadFromStorage();
    this.startFlushTimer();
  }

  enqueue<T>(type: string, payload: T): string {
    const message: QueuedMessage<T> = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
    };

    // Enforce max size (FIFO eviction)
    if (this.queue.length >= this.config.maxSize) {
      this.queue.shift();
      console.warn("[MessageQueue] Queue full, dropping oldest message");
    }

    this.queue.push(message as QueuedMessage);
    this.persistToStorage();

    return message.id;
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const messagesToSend = [...this.queue];

    try {
      await this.config.onFlush?.(messagesToSend);

      // Remove successfully sent messages
      this.queue = this.queue.filter(
        (msg) => !messagesToSend.some((sent) => sent.id === msg.id)
      );
      this.persistToStorage();

      console.info(`[MessageQueue] Flushed ${messagesToSend.length} messages`);
    } catch (error) {
      console.error("[MessageQueue] Flush failed:", error);

      // Increment retry count
      this.queue.forEach((msg) => {
        if (messagesToSend.some((sent) => sent.id === msg.id)) {
          msg.retries++;
        }
      });
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  private persistToStorage(): void {
    if (!this.config.persistKey || typeof localStorage === "undefined") return;

    try {
      localStorage.setItem(this.config.persistKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error("[MessageQueue] Failed to persist:", error);
    }
  }

  private loadFromStorage(): void {
    if (!this.config.persistKey || typeof localStorage === "undefined") return;

    try {
      const stored = localStorage.getItem(this.config.persistKey);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.info(`[MessageQueue] Loaded ${this.queue.length} messages from storage`);
      }
    } catch (error) {
      console.error("[MessageQueue] Failed to load from storage:", error);
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
    this.persistToStorage();
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

export { MessageQueue };
```

### Offline-First Queue with Sync

```typescript
// lib/offline-sync-queue.ts
import { MessageQueue } from "./message-queue";

type SyncStatus = "idle" | "syncing" | "offline" | "error";

interface OfflineSyncConfig {
  sendFn: (messages: unknown[]) => Promise<void>;
  persistKey: string;
}

export class OfflineSyncQueue {
  private queue: MessageQueue;
  private status: SyncStatus = "idle";
  private statusListeners = new Set<(status: SyncStatus) => void>();

  constructor(private config: OfflineSyncConfig) {
    this.queue = new MessageQueue({
      persistKey: config.persistKey,
      onFlush: this.handleFlush.bind(this),
    });

    // Listen for online/offline
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
  }

  private handleFlush = async (messages: unknown[]): Promise<void> => {
    if (!navigator.onLine) {
      this.setStatus("offline");
      throw new Error("Offline");
    }

    this.setStatus("syncing");

    try {
      await this.config.sendFn(messages);
      this.setStatus("idle");
    } catch (error) {
      this.setStatus("error");
      throw error;
    }
  };

  private handleOnline = (): void => {
    console.info("[OfflineSync] Back online, syncing...");
    this.setStatus("idle");
    this.queue.flush();
  };

  private handleOffline = (): void => {
    console.info("[OfflineSync] Went offline");
    this.setStatus("offline");
  };

  enqueue<T>(type: string, payload: T): string {
    return this.queue.enqueue(type, payload);
  }

  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
    this.queue.destroy();
  }
}

export { OfflineSyncQueue };
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Unbounded queue
const queue: Message[] = [];
function enqueue(msg: Message) {
  queue.push(msg); // No limit - memory exhaustion
}

// ANTI-PATTERN 2: No persistence
class Queue {
  private messages: Message[] = [];
  // Lost on page refresh!
}

// ANTI-PATTERN 3: Blocking on send
async function sendMessage(msg: Message) {
  await fetch("/api/messages", { body: JSON.stringify(msg) });
  // Blocks UI until server responds
}

// ANTI-PATTERN 4: No deduplication
function enqueue(msg: Message) {
  queue.push(msg); // Duplicate messages if retry
}

// ANTI-PATTERN 5: Synchronous storage operations
function persist() {
  localStorage.setItem("queue", JSON.stringify(largeQueue)); // Blocks main thread
}
```

### When to Use Message Queuing

**Use when:**
- Offline-first applications
- Unreliable network conditions
- Fire-and-forget analytics/tracking
- Batching requests for efficiency
- Guaranteed delivery requirements

**Do NOT use when:**
- Real-time UI updates needed (use optimistic updates)
- Message order is critical (use sequence numbers)
- Large payloads (queue in IndexedDB instead)
- Short-lived sessions (persistence overhead)

---

## 7. Presence/Typing Indicators

### Core Pattern: Presence Manager

```typescript
// lib/presence-manager.ts

// Constants
const PRESENCE_UPDATE_INTERVAL_MS = 30000;
const PRESENCE_TIMEOUT_MS = 60000;
const TYPING_DEBOUNCE_MS = 1000;
const TYPING_TIMEOUT_MS = 5000;

interface PresenceUser {
  userId: string;
  username: string;
  status: "online" | "away" | "offline";
  lastSeen: number;
  metadata?: Record<string, unknown>;
}

interface PresenceManagerConfig {
  userId: string;
  username: string;
  channel: {
    subscribe: (event: string, callback: (data: unknown) => void) => void;
    unsubscribe: (event: string) => void;
    send: (event: string, data: unknown) => void;
  };
}

export class PresenceManager {
  private users = new Map<string, PresenceUser>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(users: PresenceUser[]) => void>();

  constructor(private config: PresenceManagerConfig) {
    this.setupListeners();
    this.startHeartbeat();
    this.announcePresence();
  }

  private setupListeners(): void {
    this.config.channel.subscribe("presence:join", (data) => {
      const user = data as PresenceUser;
      this.users.set(user.userId, user);
      this.notifyListeners();
    });

    this.config.channel.subscribe("presence:leave", (data) => {
      const { userId } = data as { userId: string };
      this.users.delete(userId);
      this.notifyListeners();
    });

    this.config.channel.subscribe("presence:heartbeat", (data) => {
      const user = data as PresenceUser;
      this.users.set(user.userId, { ...user, lastSeen: Date.now() });
      this.cleanupStaleUsers();
    });
  }

  private announcePresence(): void {
    this.config.channel.send("presence:join", {
      userId: this.config.userId,
      username: this.config.username,
      status: "online",
      lastSeen: Date.now(),
    });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.config.channel.send("presence:heartbeat", {
        userId: this.config.userId,
        username: this.config.username,
        status: "online",
        lastSeen: Date.now(),
      });
      this.cleanupStaleUsers();
    }, PRESENCE_UPDATE_INTERVAL_MS);
  }

  private cleanupStaleUsers(): void {
    const now = Date.now();
    let changed = false;

    this.users.forEach((user, id) => {
      if (now - user.lastSeen > PRESENCE_TIMEOUT_MS) {
        this.users.delete(id);
        changed = true;
      }
    });

    if (changed) {
      this.notifyListeners();
    }
  }

  getOnlineUsers(): PresenceUser[] {
    return Array.from(this.users.values());
  }

  onUsersChange(listener: (users: PresenceUser[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getOnlineUsers()); // Initial state
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const users = this.getOnlineUsers();
    this.listeners.forEach((listener) => listener(users));
  }

  leave(): void {
    this.config.channel.send("presence:leave", {
      userId: this.config.userId,
    });
  }

  destroy(): void {
    this.leave();
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.config.channel.unsubscribe("presence:join");
    this.config.channel.unsubscribe("presence:leave");
    this.config.channel.unsubscribe("presence:heartbeat");
  }
}

export { PresenceManager };
```

### Typing Indicator Pattern

```typescript
// lib/typing-indicator.ts

const TYPING_DEBOUNCE_MS = 300;
const TYPING_TIMEOUT_MS = 3000;

interface TypingUser {
  userId: string;
  username: string;
  startedAt: number;
}

interface TypingIndicatorConfig {
  userId: string;
  username: string;
  channel: {
    subscribe: (event: string, callback: (data: unknown) => void) => void;
    unsubscribe: (event: string) => void;
    send: (event: string, data: unknown) => void;
  };
}

export class TypingIndicator {
  private typingUsers = new Map<string, TypingUser>();
  private isTyping = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(users: TypingUser[]) => void>();

  constructor(private config: TypingIndicatorConfig) {
    this.setupListeners();
    this.startCleanupTimer();
  }

  private setupListeners(): void {
    this.config.channel.subscribe("typing:start", (data) => {
      const { userId, username } = data as { userId: string; username: string };

      // Don't show self
      if (userId === this.config.userId) return;

      this.typingUsers.set(userId, {
        userId,
        username,
        startedAt: Date.now(),
      });
      this.notifyListeners();
    });

    this.config.channel.subscribe("typing:stop", (data) => {
      const { userId } = data as { userId: string };
      this.typingUsers.delete(userId);
      this.notifyListeners();
    });
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;

      this.typingUsers.forEach((user, id) => {
        if (now - user.startedAt > TYPING_TIMEOUT_MS) {
          this.typingUsers.delete(id);
          changed = true;
        }
      });

      if (changed) {
        this.notifyListeners();
      }
    }, TYPING_TIMEOUT_MS);
  }

  // Call this on every keystroke
  startTyping(): void {
    // Debounce to avoid flooding
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (!this.isTyping) {
      this.isTyping = true;
      this.config.channel.send("typing:start", {
        userId: this.config.userId,
        username: this.config.username,
      });
    }

    // Auto-stop after debounce
    this.debounceTimer = setTimeout(() => {
      this.stopTyping();
    }, TYPING_DEBOUNCE_MS);
  }

  stopTyping(): void {
    if (this.isTyping) {
      this.isTyping = false;
      this.config.channel.send("typing:stop", {
        userId: this.config.userId,
      });
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  getTypingUsers(): TypingUser[] {
    return Array.from(this.typingUsers.values());
  }

  onTypingChange(listener: (users: TypingUser[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const users = this.getTypingUsers();
    this.listeners.forEach((listener) => listener(users));
  }

  destroy(): void {
    this.stopTyping();
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.config.channel.unsubscribe("typing:start");
    this.config.channel.unsubscribe("typing:stop");
  }
}

export { TypingIndicator };
```

### React Hook for Typing

```typescript
// hooks/use-typing-indicator.ts
import { useEffect, useState, useCallback } from "react";
import { TypingIndicator } from "@/lib/typing-indicator";

interface UseTypingIndicatorOptions {
  userId: string;
  username: string;
  channel: {
    subscribe: (event: string, callback: (data: unknown) => void) => void;
    unsubscribe: (event: string) => void;
    send: (event: string, data: unknown) => void;
  };
}

export function useTypingIndicator(options: UseTypingIndicatorOptions) {
  const [typingUsers, setTypingUsers] = useState<{ userId: string; username: string }[]>([]);
  const [indicator, setIndicator] = useState<TypingIndicator | null>(null);

  useEffect(() => {
    const typingIndicator = new TypingIndicator(options);
    setIndicator(typingIndicator);

    const unsubscribe = typingIndicator.onTypingChange(setTypingUsers);

    return () => {
      unsubscribe();
      typingIndicator.destroy();
    };
  }, [options.userId, options.channel]);

  const startTyping = useCallback(() => {
    indicator?.startTyping();
  }, [indicator]);

  const stopTyping = useCallback(() => {
    indicator?.stopTyping();
  }, [indicator]);

  return { typingUsers, startTyping, stopTyping };
}

export { useTypingIndicator };
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: No debounce on typing
input.addEventListener("keydown", () => {
  socket.emit("typing:start"); // Floods server on fast typing
});

// ANTI-PATTERN 2: No timeout cleanup
typingUsers.set(userId, { username }); // Never removed if stop event missed

// ANTI-PATTERN 3: Showing self in typing list
channel.on("typing:start", (user) => {
  setTypingUsers([...typingUsers, user]); // Shows "You are typing"
});

// ANTI-PATTERN 4: No heartbeat for presence
users.set(userId, user); // Never cleaned up if user closes tab

// ANTI-PATTERN 5: Presence on every action
function handleClick() {
  socket.emit("presence:update"); // Too frequent, wastes bandwidth
}
```

### When to Use Presence/Typing

**Use presence when:**
- Chat/collaboration applications
- Showing "X users online" counters
- User availability status (Slack-like)
- Collaborative document editing

**Use typing indicators when:**
- Real-time chat applications
- Collaborative editing (show who's editing)
- Form collaboration (show who's filling what field)

**Do NOT use when:**
- High user count (100+ concurrent) without aggregation
- Privacy-sensitive applications
- Low-engagement features (not worth bandwidth)

---

## 8. Optimistic Updates with Real-Time

### Core Pattern: Optimistic Update Manager

```typescript
// lib/optimistic-update-manager.ts

// Constants
const ROLLBACK_TIMEOUT_MS = 10000;

interface OptimisticUpdate<T = unknown> {
  id: string;
  type: string;
  optimisticData: T;
  previousData: T;
  timestamp: number;
  confirmed: boolean;
}

interface OptimisticConfig {
  onRollback?: (update: OptimisticUpdate) => void;
  rollbackTimeoutMs?: number;
}

export class OptimisticUpdateManager {
  private pendingUpdates = new Map<string, OptimisticUpdate>();
  private config: Required<Pick<OptimisticConfig, "rollbackTimeoutMs">> & OptimisticConfig;

  constructor(config: OptimisticConfig = {}) {
    this.config = {
      rollbackTimeoutMs: config.rollbackTimeoutMs ?? ROLLBACK_TIMEOUT_MS,
      onRollback: config.onRollback,
    };
  }

  // Apply optimistic update, return rollback function
  apply<T>(id: string, type: string, optimisticData: T, previousData: T): () => void {
    const update: OptimisticUpdate<T> = {
      id,
      type,
      optimisticData,
      previousData,
      timestamp: Date.now(),
      confirmed: false,
    };

    this.pendingUpdates.set(id, update as OptimisticUpdate);

    // Auto-rollback after timeout
    const timeoutId = setTimeout(() => {
      if (!this.pendingUpdates.get(id)?.confirmed) {
        this.rollback(id);
      }
    }, this.config.rollbackTimeoutMs);

    // Return manual rollback function
    return () => {
      clearTimeout(timeoutId);
      this.rollback(id);
    };
  }

  // Confirm update was persisted
  confirm(id: string): void {
    const update = this.pendingUpdates.get(id);
    if (update) {
      update.confirmed = true;
      this.pendingUpdates.delete(id);
      console.info(`[Optimistic] Confirmed: ${id}`);
    }
  }

  // Rollback to previous state
  rollback(id: string): void {
    const update = this.pendingUpdates.get(id);
    if (update && !update.confirmed) {
      this.config.onRollback?.(update);
      this.pendingUpdates.delete(id);
      console.warn(`[Optimistic] Rolled back: ${id}`);
    }
  }

  // Get all pending updates
  getPending(): OptimisticUpdate[] {
    return Array.from(this.pendingUpdates.values());
  }

  // Check if update is pending
  isPending(id: string): boolean {
    return this.pendingUpdates.has(id) && !this.pendingUpdates.get(id)?.confirmed;
  }
}

export { OptimisticUpdateManager };
```

### React Hook with Zustand Integration

```typescript
// hooks/use-optimistic-message.ts
import { useCallback } from "react";
import { useMessageStore } from "@/stores/message-store";
import { useSocket } from "@/hooks/use-socket";

interface Message {
  id: string;
  content: string;
  userId: string;
  status: "pending" | "sent" | "failed";
  createdAt: number;
}

export function useOptimisticMessage() {
  const socket = useSocket();
  const { addMessage, updateMessage, removeMessage } = useMessageStore();

  const sendMessage = useCallback(
    async (content: string, userId: string) => {
      const tempId = `temp-${Date.now()}`;

      // 1. Optimistically add message
      const optimisticMessage: Message = {
        id: tempId,
        content,
        userId,
        status: "pending",
        createdAt: Date.now(),
      };

      addMessage(optimisticMessage);

      try {
        // 2. Send to server via socket with acknowledgment
        const response = await new Promise<{ id: string }>((resolve, reject) => {
          socket.emit(
            "message:send",
            { content },
            (ack: { success: boolean; id?: string; error?: string }) => {
              if (ack.success && ack.id) {
                resolve({ id: ack.id });
              } else {
                reject(new Error(ack.error ?? "Failed to send"));
              }
            }
          );
        });

        // 3. Update with real ID from server
        removeMessage(tempId);
        addMessage({
          ...optimisticMessage,
          id: response.id,
          status: "sent",
        });
      } catch (error) {
        // 4. Mark as failed on error
        updateMessage(tempId, { status: "failed" });
        console.error("[Message] Send failed:", error);
      }
    },
    [socket, addMessage, updateMessage, removeMessage]
  );

  const retryMessage = useCallback(
    (messageId: string) => {
      const store = useMessageStore.getState();
      const message = store.messages.find((m) => m.id === messageId);

      if (message && message.status === "failed") {
        // Remove failed message and resend
        removeMessage(messageId);
        sendMessage(message.content, message.userId);
      }
    },
    [sendMessage, removeMessage]
  );

  return { sendMessage, retryMessage };
}

export { useOptimisticMessage };
```

### Zustand Store with Optimistic Support

```typescript
// stores/message-store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface Message {
  id: string;
  content: string;
  userId: string;
  status: "pending" | "sent" | "failed";
  createdAt: number;
}

interface MessageState {
  messages: Message[];
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  removeMessage: (id: string) => void;
  reconcileWithServer: (serverMessages: Message[]) => void;
}

export const useMessageStore = create<MessageState>()(
  immer((set) => ({
    messages: [],

    addMessage: (message) =>
      set((state) => {
        state.messages.push(message);
        // Sort by createdAt
        state.messages.sort((a, b) => a.createdAt - b.createdAt);
      }),

    updateMessage: (id, updates) =>
      set((state) => {
        const index = state.messages.findIndex((m) => m.id === id);
        if (index !== -1) {
          Object.assign(state.messages[index], updates);
        }
      }),

    removeMessage: (id) =>
      set((state) => {
        state.messages = state.messages.filter((m) => m.id !== id);
      }),

    // Reconcile optimistic updates with server state
    reconcileWithServer: (serverMessages) =>
      set((state) => {
        // Keep pending/failed messages, merge with server confirmed
        const pendingMessages = state.messages.filter(
          (m) => m.status === "pending" || m.status === "failed"
        );

        // Server messages are source of truth for "sent"
        const confirmedMessages = serverMessages.map((m) => ({
          ...m,
          status: "sent" as const,
        }));

        // Merge, avoiding duplicates
        const serverIds = new Set(serverMessages.map((m) => m.id));
        const uniquePending = pendingMessages.filter((m) => !serverIds.has(m.id));

        state.messages = [...confirmedMessages, ...uniquePending].sort(
          (a, b) => a.createdAt - b.createdAt
        );
      }),
  }))
);

export { useMessageStore };
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: No rollback on failure
async function sendMessage(content: string) {
  addMessage({ id: tempId, content }); // Added optimistically
  await api.sendMessage(content); // If this fails, message stays!
}

// ANTI-PATTERN 2: No status indicator
const message = { id, content }; // User can't tell if sent or pending

// ANTI-PATTERN 3: No timeout on pending
addMessage({ status: "pending" }); // Stays pending forever if no response

// ANTI-PATTERN 4: Duplicate on reconcile
socket.on("message:new", (msg) => {
  addMessage(msg); // Duplicates optimistic message
});

// ANTI-PATTERN 5: Race condition with server
// Client sends A, B, C
// Server responds C, A, B
// Messages appear out of order
```

### When to Use Optimistic Updates

**Use when:**
- Low-latency feel is critical (chat, reactions, likes)
- High success rate for operations
- Easy to rollback visually
- Offline-first applications

**Do NOT use when:**
- Operations have complex side effects
- Failures are common (payment, inventory)
- Order-dependent operations (must sequence)
- Multi-step transactions

---

## 9. React Query + Real-Time Integration

### Core Pattern: Query Invalidation on Real-Time Events

```typescript
// lib/realtime-query-sync.ts
import { QueryClient } from "@tanstack/react-query";

type InvalidationRule = {
  events: string[];
  queryKeys: readonly unknown[][];
  exact?: boolean;
};

interface RealtimeQuerySyncConfig {
  queryClient: QueryClient;
  rules: InvalidationRule[];
}

export class RealtimeQuerySync {
  private unsubscribers: (() => void)[] = [];

  constructor(
    private config: RealtimeQuerySyncConfig,
    private subscribe: (event: string, handler: (data: unknown) => void) => () => void
  ) {
    this.setupListeners();
  }

  private setupListeners(): void {
    this.config.rules.forEach((rule) => {
      rule.events.forEach((event) => {
        const unsubscribe = this.subscribe(event, () => {
          rule.queryKeys.forEach((queryKey) => {
            this.config.queryClient.invalidateQueries({
              queryKey,
              exact: rule.exact ?? false,
            });
          });

          console.info(`[RealtimeSync] Invalidated queries for event: ${event}`);
        });

        this.unsubscribers.push(unsubscribe);
      });
    });
  }

  destroy(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
  }
}

export { RealtimeQuerySync };
```

### React Hook Pattern

```typescript
// hooks/use-realtime-query.ts
import { useEffect } from "react";
import { useQueryClient, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { useSocket } from "./use-socket";

interface UseRealtimeQueryOptions<TData> extends Omit<UseQueryOptions<TData>, "queryKey" | "queryFn"> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<TData>;
  realtimeEvents: string[];
  onRealtimeUpdate?: (data: unknown) => void;
}

export function useRealtimeQuery<TData>({
  queryKey,
  queryFn,
  realtimeEvents,
  onRealtimeUpdate,
  ...options
}: UseRealtimeQueryOptions<TData>) {
  const queryClient = useQueryClient();
  const socket = useSocket();

  // Standard React Query
  const query = useQuery({
    queryKey,
    queryFn,
    ...options,
  });

  // Subscribe to real-time events
  useEffect(() => {
    const handlers = realtimeEvents.map((event) => {
      const handler = (data: unknown) => {
        // Option 1: Invalidate and refetch
        queryClient.invalidateQueries({ queryKey });

        // Option 2: Call custom handler
        onRealtimeUpdate?.(data);
      };

      socket.on(event, handler);
      return { event, handler };
    });

    return () => {
      handlers.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
    };
  }, [queryClient, socket, queryKey, realtimeEvents, onRealtimeUpdate]);

  return query;
}

export { useRealtimeQuery };
```

### Direct Cache Updates Pattern

```typescript
// hooks/use-messages-realtime.ts
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./use-socket";

interface Message {
  id: string;
  content: string;
  userId: string;
  createdAt: string;
}

const MESSAGES_QUERY_KEY = ["messages"] as const;

export function useMessagesRealtime(roomId: string) {
  const queryClient = useQueryClient();
  const socket = useSocket();

  const query = useQuery({
    queryKey: [...MESSAGES_QUERY_KEY, roomId],
    queryFn: () => fetchMessages(roomId),
  });

  useEffect(() => {
    // Direct cache update instead of refetch
    const handleNewMessage = (message: Message) => {
      queryClient.setQueryData<Message[]>(
        [...MESSAGES_QUERY_KEY, roomId],
        (oldMessages = []) => {
          // Avoid duplicates
          if (oldMessages.some((m) => m.id === message.id)) {
            return oldMessages;
          }
          return [...oldMessages, message];
        }
      );
    };

    const handleMessageDeleted = (data: { id: string }) => {
      queryClient.setQueryData<Message[]>(
        [...MESSAGES_QUERY_KEY, roomId],
        (oldMessages = []) => oldMessages.filter((m) => m.id !== data.id)
      );
    };

    const handleMessageUpdated = (message: Message) => {
      queryClient.setQueryData<Message[]>(
        [...MESSAGES_QUERY_KEY, roomId],
        (oldMessages = []) =>
          oldMessages.map((m) => (m.id === message.id ? message : m))
      );
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("message:updated", handleMessageUpdated);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("message:updated", handleMessageUpdated);
    };
  }, [queryClient, socket, roomId]);

  return query;
}

async function fetchMessages(roomId: string): Promise<Message[]> {
  const response = await fetch(`/api/rooms/${roomId}/messages`);
  return response.json();
}

export { useMessagesRealtime };
```

### Mutation with Real-Time Confirmation

```typescript
// hooks/use-send-message.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./use-socket";

interface Message {
  id: string;
  content: string;
  userId: string;
  status: "pending" | "sent" | "failed";
}

const MESSAGES_QUERY_KEY = ["messages"] as const;

export function useSendMessage(roomId: string) {
  const queryClient = useQueryClient();
  const socket = useSocket();

  return useMutation({
    mutationFn: async (content: string) => {
      // Use socket with acknowledgment
      return new Promise<Message>((resolve, reject) => {
        socket.emit(
          "message:send",
          { roomId, content },
          (response: { success: boolean; message?: Message; error?: string }) => {
            if (response.success && response.message) {
              resolve(response.message);
            } else {
              reject(new Error(response.error ?? "Failed to send message"));
            }
          }
        );
      });
    },

    // Optimistic update
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: [...MESSAGES_QUERY_KEY, roomId] });

      const previousMessages = queryClient.getQueryData<Message[]>([
        ...MESSAGES_QUERY_KEY,
        roomId,
      ]);

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content,
        userId: "current-user", // Get from auth context
        status: "pending",
      };

      queryClient.setQueryData<Message[]>(
        [...MESSAGES_QUERY_KEY, roomId],
        (old = []) => [...old, optimisticMessage]
      );

      return { previousMessages, optimisticMessage };
    },

    // On success, replace optimistic with real message
    onSuccess: (message, _, context) => {
      queryClient.setQueryData<Message[]>(
        [...MESSAGES_QUERY_KEY, roomId],
        (old = []) =>
          old.map((m) =>
            m.id === context?.optimisticMessage.id ? { ...message, status: "sent" } : m
          )
      );
    },

    // On error, rollback
    onError: (_, __, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          [...MESSAGES_QUERY_KEY, roomId],
          context.previousMessages
        );
      }
    },
  });
}

export { useSendMessage };
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Refetching on every event
socket.on("any-event", () => {
  queryClient.invalidateQueries(); // Refetches EVERYTHING
});

// ANTI-PATTERN 2: Not canceling queries on optimistic update
onMutate: async () => {
  // Missing cancelQueries - race condition with background refetch
  const previous = queryClient.getQueryData(key);
  queryClient.setQueryData(key, optimisticData);
  return { previous };
};

// ANTI-PATTERN 3: Direct state mutation
queryClient.setQueryData(key, (old) => {
  old.push(newItem); // Mutates in place!
  return old;
});

// ANTI-PATTERN 4: Not handling stale closures
useEffect(() => {
  socket.on("update", () => {
    queryClient.setQueryData(key, (old) => [...old, newItem]); // newItem is stale
  });
}, []); // Missing dependencies

// ANTI-PATTERN 5: Duplicate updates
socket.on("message:new", (msg) => {
  queryClient.setQueryData(key, (old) => [...old, msg]); // Already added by mutation
});
```

### When to Use React Query + Real-Time

**Use query invalidation when:**
- Real-time events indicate data may have changed
- Multiple queries affected by same event
- Simple invalidation rules

**Use direct cache updates when:**
- Need immediate UI update without refetch
- Bandwidth/latency sensitive
- Known data shape from event

**Do NOT combine when:**
- Simple REST API without real-time needs (just React Query)
- Full real-time state (just Zustand/Redux + socket)
- Conflicts cause more bugs than benefits

---

## 10. Testing Real-Time Features

### Core Pattern: WebSocket Mock

```typescript
// tests/mocks/websocket-mock.ts

type MessageHandler = (event: MessageEvent) => void;

export class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readyState = WebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: MessageHandler | null = null;

  private messageQueue: string[] = [];

  constructor(public url: string, public protocols?: string | string[]) {
    MockWebSocket.instances.push(this);

    // Simulate async connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  send(data: string): void {
    this.messageQueue.push(data);
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code: code ?? 1000, reason: reason ?? "" } as CloseEvent);
  }

  // Test helpers
  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateError(): void {
    this.onerror?.({ type: "error" } as Event);
  }

  simulateClose(code = 1000, reason = ""): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.({ code, reason } as CloseEvent);
  }

  getSentMessages(): unknown[] {
    return this.messageQueue.map((msg) => JSON.parse(msg));
  }

  getLastSentMessage(): unknown {
    const messages = this.getSentMessages();
    return messages[messages.length - 1];
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

// Setup for tests
export function setupWebSocketMock(): void {
  (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
}

export function teardownWebSocketMock(): void {
  MockWebSocket.reset();
}

export { MockWebSocket, setupWebSocketMock, teardownWebSocketMock };
```

### Socket.io Test Utilities

```typescript
// tests/mocks/socket-io-mock.ts
import { vi } from "vitest";

type EventHandler = (...args: unknown[]) => void;

export function createMockSocket() {
  const handlers = new Map<string, Set<EventHandler>>();
  let connected = false;

  const socket = {
    id: "mock-socket-id",
    connected: false,

    connect: vi.fn(() => {
      connected = true;
      socket.connected = true;
      // Trigger connect handlers
      setTimeout(() => {
        handlers.get("connect")?.forEach((h) => h());
      }, 0);
    }),

    disconnect: vi.fn(() => {
      connected = false;
      socket.connected = false;
      handlers.get("disconnect")?.forEach((h) => h("io client disconnect"));
    }),

    emit: vi.fn((event: string, ...args: unknown[]) => {
      // Handle acknowledgment callback
      const lastArg = args[args.length - 1];
      if (typeof lastArg === "function") {
        // Return ack callback for testing
        return lastArg;
      }
    }),

    on: vi.fn((event: string, handler: EventHandler) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)!.add(handler);
    }),

    off: vi.fn((event: string, handler: EventHandler) => {
      handlers.get(event)?.delete(handler);
    }),

    // Test helpers
    simulateEvent: (event: string, ...args: unknown[]) => {
      handlers.get(event)?.forEach((h) => h(...args));
    },

    simulateConnect: () => {
      connected = true;
      socket.connected = true;
      handlers.get("connect")?.forEach((h) => h());
    },

    simulateDisconnect: (reason = "io server disconnect") => {
      connected = false;
      socket.connected = false;
      handlers.get("disconnect")?.forEach((h) => h(reason));
    },

    simulateError: (error: Error) => {
      handlers.get("connect_error")?.forEach((h) => h(error));
    },

    getEmittedEvents: () => socket.emit.mock.calls,

    reset: () => {
      handlers.clear();
      socket.emit.mockClear();
      socket.on.mockClear();
      socket.off.mockClear();
      connected = false;
      socket.connected = false;
    },
  };

  return socket;
}

export type MockSocket = ReturnType<typeof createMockSocket>;

export { createMockSocket };
```

### Component Testing with Real-Time

```typescript
// tests/components/chat.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatRoom } from "@/components/chat-room";
import { createMockSocket, type MockSocket } from "../mocks/socket-io-mock";

// Mock the socket module
vi.mock("@/lib/socket-client", () => ({
  getSocket: vi.fn(),
}));

import { getSocket } from "@/lib/socket-client";

describe("ChatRoom", () => {
  let mockSocket: MockSocket;
  let queryClient: QueryClient;

  beforeEach(() => {
    mockSocket = createMockSocket();
    vi.mocked(getSocket).mockReturnValue(mockSocket as never);

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  afterEach(() => {
    mockSocket.reset();
    queryClient.clear();
  });

  const renderChat = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ChatRoom roomId="test-room" userId="user-1" />
      </QueryClientProvider>
    );
  };

  it("displays incoming messages from socket", async () => {
    renderChat();

    // Simulate receiving a message
    act(() => {
      mockSocket.simulateEvent("message:new", {
        id: "msg-1",
        content: "Hello from socket!",
        userId: "user-2",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Hello from socket!")).toBeInTheDocument();
    });
  });

  it("sends message via socket with acknowledgment", async () => {
    const user = userEvent.setup();
    renderChat();

    const input = screen.getByPlaceholderText("Type a message...");
    const sendButton = screen.getByRole("button", { name: /send/i });

    await user.type(input, "Hello world!");
    await user.click(sendButton);

    // Check emit was called
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "message:send",
      { content: "Hello world!", roomId: "test-room" },
      expect.any(Function) // Ack callback
    );

    // Simulate server acknowledgment
    const ackCallback = mockSocket.emit.mock.calls[0][2] as (response: unknown) => void;
    act(() => {
      ackCallback({ success: true, id: "server-msg-id" });
    });

    // Verify optimistic update shows "sent"
    await waitFor(() => {
      expect(screen.getByText("Hello world!")).toBeInTheDocument();
    });
  });

  it("handles connection errors gracefully", async () => {
    renderChat();

    act(() => {
      mockSocket.simulateError(new Error("Connection refused"));
    });

    await waitFor(() => {
      expect(screen.getByText(/connection error/i)).toBeInTheDocument();
    });
  });

  it("shows typing indicator when other user is typing", async () => {
    renderChat();

    act(() => {
      mockSocket.simulateEvent("typing:start", {
        userId: "user-2",
        username: "Jane",
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/jane is typing/i)).toBeInTheDocument();
    });

    // Typing stops
    act(() => {
      mockSocket.simulateEvent("typing:stop", { userId: "user-2" });
    });

    await waitFor(() => {
      expect(screen.queryByText(/jane is typing/i)).not.toBeInTheDocument();
    });
  });
});
```

### Integration Testing with MSW + WebSocket

```typescript
// tests/integration/realtime-sync.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { QueryClient } from "@tanstack/react-query";
import { MockWebSocket, setupWebSocketMock, teardownWebSocketMock } from "../mocks/websocket-mock";

const server = setupServer(
  http.get("/api/messages", () => {
    return HttpResponse.json([
      { id: "1", content: "Initial message", userId: "user-1" },
    ]);
  })
);

describe("Real-time + REST sync", () => {
  let queryClient: QueryClient;

  beforeAll(() => {
    server.listen();
    setupWebSocketMock();
  });

  afterAll(() => {
    server.close();
    teardownWebSocketMock();
  });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    MockWebSocket.reset();
  });

  it("invalidates query on websocket event", async () => {
    // Initial fetch
    const result = await queryClient.fetchQuery({
      queryKey: ["messages"],
      queryFn: () => fetch("/api/messages").then((r) => r.json()),
    });

    expect(result).toHaveLength(1);

    // Update server response
    server.use(
      http.get("/api/messages", () => {
        return HttpResponse.json([
          { id: "1", content: "Initial message", userId: "user-1" },
          { id: "2", content: "New message", userId: "user-2" },
        ]);
      })
    );

    // Simulate WebSocket event triggering invalidation
    const ws = MockWebSocket.getLastInstance();
    ws?.simulateMessage({ type: "message:new", payload: { id: "2" } });

    // Invalidate and refetch
    await queryClient.invalidateQueries({ queryKey: ["messages"] });

    const updated = queryClient.getQueryData(["messages"]) as unknown[];
    expect(updated).toHaveLength(2);
  });
});
```

### E2E Testing with Playwright

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Real-time Chat", () => {
  test("sends and receives messages in real-time", async ({ browser }) => {
    // Open two browser contexts (simulating two users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Both users join the same room
    await page1.goto("/chat/room-1?user=alice");
    await page2.goto("/chat/room-1?user=bob");

    // Wait for connection
    await expect(page1.getByTestId("connection-status")).toHaveText("Connected");
    await expect(page2.getByTestId("connection-status")).toHaveText("Connected");

    // Alice sends a message
    await page1.getByPlaceholder("Type a message...").fill("Hello Bob!");
    await page1.getByRole("button", { name: /send/i }).click();

    // Bob should see the message
    await expect(page2.getByText("Hello Bob!")).toBeVisible();

    // Bob replies
    await page2.getByPlaceholder("Type a message...").fill("Hi Alice!");
    await page2.getByRole("button", { name: /send/i }).click();

    // Alice should see the reply
    await expect(page1.getByText("Hi Alice!")).toBeVisible();

    // Cleanup
    await context1.close();
    await context2.close();
  });

  test("shows typing indicator", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto("/chat/room-1?user=alice");
    await page2.goto("/chat/room-1?user=bob");

    // Alice starts typing
    await page1.getByPlaceholder("Type a message...").focus();
    await page1.keyboard.type("H", { delay: 100 });

    // Bob should see typing indicator
    await expect(page2.getByTestId("typing-indicator")).toContainText("alice is typing");

    // Alice stops typing (wait for debounce)
    await page1.waitForTimeout(2000);

    // Typing indicator should disappear
    await expect(page2.getByTestId("typing-indicator")).not.toBeVisible();

    await context1.close();
    await context2.close();
  });

  test("handles reconnection gracefully", async ({ page }) => {
    await page.goto("/chat/room-1?user=alice");

    await expect(page.getByTestId("connection-status")).toHaveText("Connected");

    // Simulate network disconnect
    await page.context().setOffline(true);

    await expect(page.getByTestId("connection-status")).toHaveText("Disconnected");

    // Reconnect
    await page.context().setOffline(false);

    await expect(page.getByTestId("connection-status")).toHaveText("Connected");

    // Messages should still work
    await page.getByPlaceholder("Type a message...").fill("Back online!");
    await page.getByRole("button", { name: /send/i }).click();

    await expect(page.getByText("Back online!")).toBeVisible();
  });
});
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN 1: Using real WebSocket in unit tests
const ws = new WebSocket("ws://localhost:3001"); // Requires running server

// ANTI-PATTERN 2: Not resetting mocks between tests
afterEach(() => {
  // Missing: mockSocket.reset()
});

// ANTI-PATTERN 3: Synchronous event simulation
mockSocket.simulateEvent("message", data);
expect(screen.getByText(data.content)).toBeInTheDocument(); // May fail - not wrapped in act

// ANTI-PATTERN 4: Testing implementation details
expect(mockSocket.on).toHaveBeenCalledWith("message", expect.any(Function));
// Instead, test behavior: expect message to appear in UI

// ANTI-PATTERN 5: Not testing error paths
it("sends message", async () => {
  // Only tests happy path, no error handling tests
});
```

### Testing Best Practices Summary

| Test Type | What to Test | Tools |
|-----------|--------------|-------|
| Unit | Event handlers, state updates | Vitest + Mock WebSocket |
| Integration | Query + real-time sync | MSW + Mock WebSocket + React Testing Library |
| E2E | Full user flows | Playwright with real server |

**Test Priority:**
1. E2E for critical paths (send/receive messages)
2. Integration for sync logic (cache + events)
3. Unit for edge cases (reconnection, error handling)

---

## Summary: Decision Matrix

| Use Case | Recommended | Why |
|----------|-------------|-----|
| Simple notification stream | SSE | Unidirectional, auto-reconnect, simple |
| Chat application | Socket.io or Native WS | Bidirectional, rooms support |
| Collaborative editing | Pusher/Ably | Presence, history, managed infrastructure |
| Gaming/low latency | Native WebSocket | Full control, no overhead |
| Offline-first with sync | Message Queue + WS | Persist offline, sync on reconnect |
| Enterprise/corporate | Socket.io | HTTP fallback for proxies |

---

## File References

This research document covers patterns applicable to the project's existing architecture:

- React Query integration: `/home/vince/dev/claude-subagents/.claude/skills/frontend-server-state-react-query (@vince)/SKILL.md`
- Zustand patterns: Check `frontend-state-zustand` skill for client state patterns
- Testing patterns: Reference `frontend-testing-vitest` skill for test setup

---

*Generated: 2026-01-15*
*Research conducted for atomic skill development*
