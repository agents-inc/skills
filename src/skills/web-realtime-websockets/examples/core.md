# WebSocket - Core Examples

> Core code examples for WebSocket real-time communication. See [SKILL.md](../SKILL.md) for concepts and decision guidance.

**Extended patterns:** See [state-machine.md](state-machine.md), [binary.md](binary.md), and [presence.md](presence.md) for advanced patterns.

**Patterns covered:**

- Pattern 1: Basic WebSocket Connection
- Pattern 2: Exponential Backoff with Jitter
- Pattern 3: Heartbeat/Ping-Pong
- Pattern 4: Message Queuing During Disconnection
- Pattern 5: Type-Safe Messages with Discriminated Unions
- Pattern 6: Binary Data Handling
- Pattern 7: Authentication Over WebSocket
- Pattern 8: Room/Channel Pattern
- Pattern 9: Custom React Hook (useWebSocket)
- Pattern 10: Shared WebSocket Connection (Context Provider)
- Pattern 11: bfcache Compatibility (pagehide/pageshow)

---

## Pattern 1: Basic WebSocket Connection

The native WebSocket API provides four lifecycle events: `onopen`, `onmessage`, `onerror`, and `onclose`.

### Good Example - Complete Lifecycle

```typescript
const WS_URL = "wss://api.example.com/ws";

const socket = new WebSocket(WS_URL);

socket.onopen = (event: Event) => {
  console.log("Connected to WebSocket server");
  // Connection is ready - safe to send messages
};

socket.onmessage = (event: MessageEvent) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};

socket.onerror = (event: Event) => {
  console.error("WebSocket error:", event);
  // Note: onerror is always followed by onclose
};

socket.onclose = (event: CloseEvent) => {
  console.log(`Connection closed: code=${event.code}, reason=${event.reason}`);
  // Implement reconnection logic here
};
```

**Why good:** All four lifecycle events handled, typed event parameters, named constant for URL, comments explain behavior

### Bad Example - Missing Handlers

```typescript
// BAD - Missing error and close handling
const socket = new WebSocket("wss://api.example.com/ws");

socket.onmessage = (event) => {
  console.log(event.data);
};
```

**Why bad:** Missing onopen means messages could be sent before ready, missing onerror/onclose means connection failures are silent, hardcoded URL string

---

## Pattern 2: Exponential Backoff with Jitter

Reconnection attempts should use exponential backoff with jitter to prevent all clients from reconnecting simultaneously (thundering herd problem).

### Constants

```typescript
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_MULTIPLIER = 2;
const MAX_RETRY_ATTEMPTS = 10;
const JITTER_FACTOR = 0.5; // 50% randomness
```

### Good Example - Reconnecting WebSocket

```typescript
function calculateBackoff(attempt: number): number {
  const exponentialDelay = Math.min(
    INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt),
    MAX_BACKOFF_MS,
  );

  // Add jitter: random value between 50% and 150% of delay
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() * 2 - 1);

  return Math.floor(exponentialDelay + jitter);
}

class ReconnectingWebSocket {
  private socket: WebSocket | null = null;
  private url: string;
  private retryCount = 0;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect(): void {
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      this.retryCount = 0; // Reset on successful connection
    };

    this.socket.onclose = (event: CloseEvent) => {
      // Don't reconnect on intentional close (code 1000)
      if (event.code !== 1000 && this.retryCount < MAX_RETRY_ATTEMPTS) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    const delay = calculateBackoff(this.retryCount);
    this.retryCount++;

    console.log(`Reconnecting in ${delay}ms (attempt ${this.retryCount})`);

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public close(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }
    this.socket?.close(1000, "Client closed"); // Normal closure
  }
}
```

**Why good:** Jitter prevents thundering herd, capped maximum delay prevents excessive waits, retry limit prevents infinite loops, intentional close (code 1000) skips reconnect, timeout cleaned up on close

### Bad Example - No Backoff

```typescript
// BAD - Immediate reconnection overwhelms server
socket.onclose = () => {
  new WebSocket(url); // Thundering herd!
};
```

**Why bad:** Immediate reconnection overwhelms server during outages, all clients reconnect at exact same time, no retry limit causes infinite loops

---

## Pattern 3: Heartbeat/Ping-Pong

Heartbeats detect dead connections and prevent intermediate infrastructure from closing idle connections.

### Good Example - Client-Side Heartbeat

```typescript
const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 10000;

class HeartbeatWebSocket {
  private socket: WebSocket;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private onConnectionLost: () => void;

  constructor(url: string, onConnectionLost: () => void) {
    this.socket = new WebSocket(url);
    this.onConnectionLost = onConnectionLost;

    this.socket.onopen = () => {
      this.startHeartbeat();
    };

    this.socket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === "pong") {
        this.clearHeartbeatTimeout();
        return;
      }

      // Handle other messages...
    };

    this.socket.onclose = () => {
      this.stopHeartbeat();
    };
  }

  private startHeartbeat(): void {
    this.heartbeatIntervalId = setInterval(() => {
      this.sendPing();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private sendPing(): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "ping" }));

      // Set timeout for pong response
      this.heartbeatTimeoutId = setTimeout(() => {
        console.error("Heartbeat timeout - connection lost");
        this.socket.close();
        this.onConnectionLost();
      }, HEARTBEAT_TIMEOUT_MS);
    }
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }
    this.clearHeartbeatTimeout();
  }
}
```

**Why good:** Named constants for intervals, timeout detects dead connections, cleanup prevents memory leaks, pong handler clears timeout, readyState check prevents sending on closed socket

---

## Pattern 4: Message Queuing During Disconnection

Messages sent during disconnection are lost. Queue them and flush when connection is restored.

### Good Example - Queue with Size Limit

```typescript
const MAX_QUEUE_SIZE = 100;

interface QueuedMessage {
  data: unknown;
  timestamp: number;
}

class QueuedWebSocket {
  private socket: WebSocket | null = null;
  private messageQueue: QueuedMessage[] = [];
  private url: string;

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect(): void {
    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      this.flushQueue();
    };

    // ... other handlers
  }

  public send(data: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      this.queueMessage(data);
    }
  }

  private queueMessage(data: unknown): void {
    if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
      // Remove oldest message to make room
      this.messageQueue.shift();
      console.warn("Message queue full - dropping oldest message");
    }

    this.messageQueue.push({
      data,
      timestamp: Date.now(),
    });
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(message.data));
      }
    }
  }
}
```

**Why good:** Queue has size limit to prevent memory issues, oldest messages dropped when full, flush happens on successful reconnect, readyState check before sending, timestamp allows message expiration if needed

---

## Pattern 5: Type-Safe Messages with Discriminated Unions

Use discriminated unions with a shared `type` field for compile-time type safety and exhaustive handling.

### Good Example - Discriminated Unions

```typescript
// Outgoing messages (client to server)
type ClientMessage =
  | { type: "subscribe"; channel: string }
  | { type: "unsubscribe"; channel: string }
  | { type: "message"; channel: string; content: string }
  | { type: "ping" };

// Incoming messages (server to client)
type ServerMessage =
  | { type: "subscribed"; channel: string; members: string[] }
  | { type: "unsubscribed"; channel: string }
  | { type: "message"; channel: string; content: string; sender: string }
  | { type: "pong" }
  | { type: "error"; code: number; message: string };

function handleServerMessage(message: ServerMessage): void {
  // TypeScript narrows the type based on the `type` field
  switch (message.type) {
    case "subscribed":
      console.log(
        `Joined ${message.channel} with ${message.members.length} members`,
      );
      break;
    case "unsubscribed":
      console.log(`Left ${message.channel}`);
      break;
    case "message":
      console.log(`${message.sender}: ${message.content}`);
      break;
    case "pong":
      // Heartbeat response - handled elsewhere
      break;
    case "error":
      console.error(`Error ${message.code}: ${message.message}`);
      break;
    default:
      // Exhaustiveness check - TypeScript error if case missing
      const exhaustiveCheck: never = message;
      console.warn("Unknown message type:", exhaustiveCheck);
  }
}

function sendMessage(socket: WebSocket, message: ClientMessage): void {
  socket.send(JSON.stringify(message));
}

// Usage - TypeScript enforces correct structure
sendMessage(socket, { type: "subscribe", channel: "general" });
sendMessage(socket, { type: "message", channel: "general", content: "Hello!" });
```

**Why good:** Discriminated union enables type narrowing in switch, exhaustiveness check catches missing cases at compile time, separate types for client/server messages, type-safe send function

### Bad Example - Untyped Messages

```typescript
// BAD - No type safety
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "message") {
    // No type safety - data.content could be anything
    console.log(data.content);
  }
};
```

**Why bad:** No compile-time type checking, typos in type strings not caught, missing fields cause runtime errors

---

## Pattern 6: Binary Data Handling

WebSockets support binary data via ArrayBuffer or Blob. Use ArrayBuffer for synchronous processing.

### Good Example - Binary Protocol with Headers

```typescript
const BINARY_HEADER_SIZE = 8; // 4 bytes type + 4 bytes length

type BinaryMessageType = 0x01 | 0x02 | 0x03;

const BinaryMessageTypes = {
  IMAGE: 0x01 as BinaryMessageType,
  AUDIO: 0x02 as BinaryMessageType,
  FILE: 0x03 as BinaryMessageType,
} as const;

class BinaryWebSocket {
  private socket: WebSocket;

  constructor(url: string) {
    this.socket = new WebSocket(url);

    // Set binaryType to arraybuffer for synchronous processing
    this.socket.binaryType = "arraybuffer";

    this.socket.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        this.handleBinaryMessage(event.data);
      } else {
        this.handleTextMessage(event.data);
      }
    };
  }

  private handleBinaryMessage(buffer: ArrayBuffer): void {
    const view = new DataView(buffer);

    // Read header (big-endian by default)
    const messageType = view.getUint32(0);
    const payloadLength = view.getUint32(4);

    // Extract payload
    const payload = buffer.slice(
      BINARY_HEADER_SIZE,
      BINARY_HEADER_SIZE + payloadLength,
    );

    switch (messageType) {
      case BinaryMessageTypes.IMAGE:
        this.handleImage(payload);
        break;
      case BinaryMessageTypes.AUDIO:
        this.handleAudio(payload);
        break;
      case BinaryMessageTypes.FILE:
        this.handleFile(payload);
        break;
    }
  }

  public sendBinary(type: BinaryMessageType, data: ArrayBuffer): void {
    const header = new ArrayBuffer(BINARY_HEADER_SIZE);
    const headerView = new DataView(header);

    headerView.setUint32(0, type);
    headerView.setUint32(4, data.byteLength);

    // Combine header and payload
    const message = new Uint8Array(BINARY_HEADER_SIZE + data.byteLength);
    message.set(new Uint8Array(header), 0);
    message.set(new Uint8Array(data), BINARY_HEADER_SIZE);

    this.socket.send(message);
  }

  private handleTextMessage(data: string): void {
    const message = JSON.parse(data);
    // ...
  }

  private handleImage(payload: ArrayBuffer): void {
    /* ... */
  }
  private handleAudio(payload: ArrayBuffer): void {
    /* ... */
  }
  private handleFile(payload: ArrayBuffer): void {
    /* ... */
  }
}
```

**Why good:** binaryType set to arraybuffer for synchronous DataView access, header with type and length for protocol parsing, typed message types, instanceof check distinguishes binary from text

### Bad Example - Using Blob

```typescript
// BAD - Blob forces async handling
socket.binaryType = "blob"; // Default, but forces async
socket.onmessage = async (event) => {
  if (event.data instanceof Blob) {
    const buffer = await event.data.arrayBuffer(); // Async overhead
  }
};
```

**Why bad:** Blob requires async processing, adds latency to message handling, ArrayBuffer is synchronous and faster

---

## Pattern 7: Authentication Over WebSocket

WebSocket doesn't support custom HTTP headers. Authenticate via first message after connection.

### Good Example - Token via First Message

```typescript
interface AuthMessage {
  type: "auth";
  token: string;
}

interface AuthResponse {
  type: "auth_result";
  success: boolean;
  error?: string;
}

class AuthenticatedWebSocket {
  private socket: WebSocket;
  private authenticated = false;
  private pendingMessages: unknown[] = [];
  private onAuthenticated: () => void;
  private onAuthError: (error: string) => void;

  constructor(
    url: string,
    token: string,
    onAuthenticated: () => void,
    onAuthError: (error: string) => void,
  ) {
    this.socket = new WebSocket(url);
    this.onAuthenticated = onAuthenticated;
    this.onAuthError = onAuthError;

    this.socket.onopen = () => {
      // Send auth token as first message
      const authMessage: AuthMessage = { type: "auth", token };
      this.socket.send(JSON.stringify(authMessage));
    };

    this.socket.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === "auth_result") {
        this.handleAuthResult(data as AuthResponse);
        return;
      }

      if (!this.authenticated) {
        console.warn("Received message before authentication");
        return;
      }

      // Handle authenticated messages...
    };
  }

  private handleAuthResult(response: AuthResponse): void {
    if (response.success) {
      this.authenticated = true;
      this.flushPendingMessages();
      this.onAuthenticated();
    } else {
      this.onAuthError(response.error || "Authentication failed");
      this.socket.close();
    }
  }

  public send(data: unknown): void {
    if (!this.authenticated) {
      this.pendingMessages.push(data);
      return;
    }

    this.socket.send(JSON.stringify(data));
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      this.socket.send(JSON.stringify(message));
    }
  }
}
```

**Why good:** Token sent as first message (not in URL - avoids server logs), messages queued until authenticated, auth response handled before other messages, explicit authenticated state, callbacks for success/error

### Bad Example - Token in URL

```typescript
// BAD - Token visible in server access logs
const socket = new WebSocket(`wss://api.example.com/ws?token=${token}`);
```

**Why bad:** Token visible in server access logs, may be cached by proxies, URL length limits, harder to refresh token

---

## Pattern 8: Room/Channel Pattern

Organize connections into logical channels for targeted message delivery.

### Good Example - Room Subscriptions

```typescript
interface RoomState {
  id: string;
  members: Set<string>;
  joined: boolean;
}

type RoomServerMessage =
  | { type: "room_joined"; roomId: string; members: string[] }
  | { type: "room_message"; roomId: string; payload: unknown }
  | { type: "member_joined"; roomId: string; memberId: string }
  | { type: "member_left"; roomId: string; memberId: string };

class RoomWebSocket {
  private socket: WebSocket;
  private rooms: Map<string, RoomState> = new Map();
  private onRoomMessage: (roomId: string, message: unknown) => void;

  constructor(
    url: string,
    onRoomMessage: (roomId: string, message: unknown) => void,
  ) {
    this.socket = new WebSocket(url);
    this.onRoomMessage = onRoomMessage;

    this.socket.onmessage = (event: MessageEvent) => {
      const data: RoomServerMessage = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }

  public joinRoom(roomId: string): void {
    if (this.rooms.has(roomId)) {
      return; // Already in room
    }

    this.rooms.set(roomId, {
      id: roomId,
      members: new Set(),
      joined: false,
    });

    this.socket.send(
      JSON.stringify({
        type: "join_room",
        roomId,
      }),
    );
  }

  public leaveRoom(roomId: string): void {
    if (!this.rooms.has(roomId)) {
      return;
    }

    this.socket.send(
      JSON.stringify({
        type: "leave_room",
        roomId,
      }),
    );

    this.rooms.delete(roomId);
  }

  public sendToRoom(roomId: string, message: unknown): void {
    const room = this.rooms.get(roomId);
    if (!room?.joined) {
      console.warn(`Cannot send to room ${roomId} - not joined`);
      return;
    }

    this.socket.send(
      JSON.stringify({
        type: "room_message",
        roomId,
        payload: message,
      }),
    );
  }

  private handleMessage(message: RoomServerMessage): void {
    switch (message.type) {
      case "room_joined": {
        const room = this.rooms.get(message.roomId);
        if (room) {
          room.joined = true;
          room.members = new Set(message.members);
        }
        break;
      }
      case "room_message": {
        this.onRoomMessage(message.roomId, message.payload);
        break;
      }
      case "member_joined": {
        const room = this.rooms.get(message.roomId);
        room?.members.add(message.memberId);
        break;
      }
      case "member_left": {
        const room = this.rooms.get(message.roomId);
        room?.members.delete(message.memberId);
        break;
      }
    }
  }
}
```

**Why good:** Local room state tracks membership, guards against sending to unjoined rooms, typed discriminated union for server messages, clean subscription API

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
import type {
  UseWebSocketOptions,
  UseWebSocketReturn,
  WebSocketStatus,
} from "../types/websocket";

const DEFAULT_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_INTERVAL_MS = 1000;
const MAX_RECONNECT_INTERVAL_MS = 30000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 10000;
const JITTER_FACTOR = 0.5;

function calculateBackoff(attempt: number, baseInterval: number): number {
  const exponentialDelay = Math.min(
    baseInterval * Math.pow(2, attempt),
    MAX_RECONNECT_INTERVAL_MS,
  );
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.floor(exponentialDelay + jitter);
}

export function useWebSocket<TIn, TOut>(
  options: UseWebSocketOptions<TIn, TOut>,
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
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
        if (
          heartbeatMessage &&
          (data as unknown as { type?: string }).type === "pong"
        ) {
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
        const delay = calculateBackoff(
          reconnectCountRef.current,
          reconnectInterval,
        );
        reconnectCountRef.current++;

        console.log(
          `WebSocket reconnecting in ${delay}ms (attempt ${reconnectCountRef.current})`,
        );

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

---

## Pattern 11: bfcache Compatibility

Open WebSocket connections can prevent pages from entering the browser's back/forward cache, degrading navigation performance. Handle `pagehide` and `pageshow` events to manage connections properly.

```typescript
// hooks/use-bfcache-websocket.ts
import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = "wss://api.example.com/ws";

interface UseBfcacheWebSocketReturn {
  status: "connecting" | "open" | "closed";
  send: (message: unknown) => void;
}

export function useBfcacheWebSocket(): UseBfcacheWebSocketReturn {
  const [status, setStatus] = useState<"connecting" | "open" | "closed">(
    "connecting",
  );
  const socketRef = useRef<WebSocket | null>(null);
  const messageQueueRef = useRef<unknown[]>([]);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus("connecting");
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("open");
      // Flush queued messages on reconnect
      while (messageQueueRef.current.length > 0) {
        const msg = messageQueueRef.current.shift();
        socket.send(JSON.stringify(msg));
      }
    };

    socket.onclose = () => {
      setStatus("closed");
    };

    socket.onmessage = (event) => {
      // Handle incoming messages
      console.log("Received:", event.data);
    };
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.close(1000, "Page hidden");
    socketRef.current = null;
    setStatus("closed");
  }, []);

  const send = useCallback((message: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    } else {
      messageQueueRef.current.push(message);
    }
  }, []);

  useEffect(() => {
    connect();

    // Close WebSocket on pagehide to allow bfcache
    const handlePageHide = () => {
      disconnect();
    };

    // Reconnect on pageshow if page was restored from bfcache
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page restored from bfcache - reconnect
        connect();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      disconnect();
    };
  }, [connect, disconnect]);

  return { status, send };
}
```

**Why good:** Closes WebSocket on pagehide allowing bfcache, reconnects on pageshow when persisted (restored from cache), queues messages during disconnection, clean event listener management

### Bad Example - Blocks bfcache

```typescript
// BAD - No pagehide handling, blocks bfcache
useEffect(() => {
  const socket = new WebSocket(WS_URL);
  return () => socket.close();
}, []);
```

**Why bad:** Open WebSocket connections prevent bfcache, users experience slower back/forward navigation, connection stays open when page is hidden wasting resources
