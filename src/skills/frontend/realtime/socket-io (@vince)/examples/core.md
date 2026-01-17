# Socket.IO Core Examples

> Complete, copy-paste ready examples for Socket.IO client fundamentals. All examples use TypeScript with proper typing.

---

## Example 1: Type-Safe Socket Factory

Create a typed socket instance with proper configuration.

### Constants

```typescript
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
const RECONNECTION_ATTEMPTS = 10;
const RECONNECTION_DELAY_MS = 1000;
const RECONNECTION_DELAY_MAX_MS = 5000;
const ACK_TIMEOUT_MS = 10000;
```

### Event Types

```typescript
// types/socket-events.ts

export interface ServerToClientEvents {
  "chat:message": (message: Message) => void;
  "chat:typing": (data: TypingIndicator) => void;
  "user:status": (data: UserStatus) => void;
  "notification": (notification: Notification) => void;
  "error": (error: ServerError) => void;
}

export interface ClientToServerEvents {
  "chat:send": (
    content: string,
    roomId: string,
    ack: (result: SendResult) => void
  ) => void;
  "chat:typing": (roomId: string) => void;
  "room:join": (roomId: string, ack: (result: JoinResult) => void) => void;
  "room:leave": (roomId: string) => void;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  roomId: string;
  timestamp: number;
}

export interface TypingIndicator {
  userId: string;
  username: string;
  roomId: string;
}

export interface UserStatus {
  userId: string;
  status: "online" | "offline" | "away";
}

export interface Notification {
  id: string;
  type: "info" | "warning" | "error";
  message: string;
}

export interface ServerError {
  code: string;
  message: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface JoinResult {
  success: boolean;
  roomName?: string;
  members?: string[];
  error?: string;
}
```

### Socket Factory

```typescript
// lib/socket.ts
import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../types/socket-events";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function createSocket(authToken: string): TypedSocket {
  // Disconnect existing socket if any
  if (socket?.connected) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token: authToken },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: RECONNECTION_ATTEMPTS,
    reconnectionDelay: RECONNECTION_DELAY_MS,
    reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
    timeout: ACK_TIMEOUT_MS,
    transports: ["websocket", "polling"],
  });

  return socket;
}

export function getSocket(): TypedSocket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export { SOCKET_URL, ACK_TIMEOUT_MS };
```

---

## Example 2: React Integration Hook

Custom hook for managing Socket.IO connection in React components.

### Constants

```typescript
const SOCKET_CONTEXT_ERROR = "useSocket must be used within SocketProvider";
```

### Connection Hook

```typescript
// hooks/use-socket-connection.ts
import { useEffect, useState, useCallback } from "react";
import type { TypedSocket } from "../lib/socket";
import { createSocket, disconnectSocket, getSocket } from "../lib/socket";

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  error: Error | null;
}

interface UseSocketConnectionOptions {
  token: string;
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
}

interface UseSocketConnectionResult extends ConnectionState {
  socket: TypedSocket | null;
  connect: () => void;
  disconnect: () => void;
}

export function useSocketConnection(
  options: UseSocketConnectionOptions
): UseSocketConnectionResult {
  const { token, autoConnect = true, onConnect, onDisconnect, onError } = options;

  const [state, setState] = useState<ConnectionState>({
    isConnected: false,
    isReconnecting: false,
    error: null,
  });
  const [socket, setSocket] = useState<TypedSocket | null>(null);

  // Initialize socket
  useEffect(() => {
    if (!token) return;

    const newSocket = createSocket(token);
    setSocket(newSocket);

    // Connection event handlers
    const handleConnect = (): void => {
      setState((prev) => ({
        ...prev,
        isConnected: true,
        isReconnecting: false,
        error: null,
      }));
      onConnect?.();
    };

    const handleDisconnect = (reason: string): void => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        isReconnecting: newSocket.active,
      }));
      onDisconnect?.(reason);
    };

    const handleConnectError = (error: Error): void => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        error,
      }));
      onError?.(error);
    };

    const handleReconnectAttempt = (): void => {
      setState((prev) => ({
        ...prev,
        isReconnecting: true,
      }));
    };

    // Attach listeners
    newSocket.on("connect", handleConnect);
    newSocket.on("disconnect", handleDisconnect);
    newSocket.on("connect_error", handleConnectError);
    newSocket.io.on("reconnect_attempt", handleReconnectAttempt);

    // Auto connect if enabled
    if (autoConnect) {
      newSocket.connect();
    }

    // Cleanup
    return () => {
      newSocket.off("connect", handleConnect);
      newSocket.off("disconnect", handleDisconnect);
      newSocket.off("connect_error", handleConnectError);
      newSocket.io.off("reconnect_attempt", handleReconnectAttempt);
      disconnectSocket();
    };
  }, [token, autoConnect, onConnect, onDisconnect, onError]);

  const connect = useCallback(() => {
    socket?.connect();
  }, [socket]);

  const disconnect = useCallback(() => {
    socket?.disconnect();
  }, [socket]);

  return {
    socket,
    isConnected: state.isConnected,
    isReconnecting: state.isReconnecting,
    error: state.error,
    connect,
    disconnect,
  };
}
```

---

## Example 3: Event Listener Hook

Reusable hook for subscribing to Socket.IO events with automatic cleanup.

```typescript
// hooks/use-socket-event.ts
import { useEffect, useRef, useCallback } from "react";
import type { TypedSocket } from "../lib/socket";
import type { ServerToClientEvents } from "../types/socket-events";

type EventName = keyof ServerToClientEvents;
type EventHandler<E extends EventName> = ServerToClientEvents[E];

export function useSocketEvent<E extends EventName>(
  socket: TypedSocket | null,
  event: E,
  handler: EventHandler<E>
): void {
  // Use ref to avoid re-subscribing on handler changes
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;

    // Wrapper that uses current handler ref
    const eventHandler = ((...args: unknown[]) => {
      (handlerRef.current as (...args: unknown[]) => void)(...args);
    }) as EventHandler<E>;

    socket.on(event, eventHandler);

    return () => {
      socket.off(event, eventHandler);
    };
  }, [socket, event]);
}

// Usage example:
// useSocketEvent(socket, "chat:message", (message) => {
//   addMessage(message); // Type-safe: message is Message
// });
```

---

## Example 4: Emit with Acknowledgment Hook

Hook for sending messages with acknowledgment handling.

### Constants

```typescript
const EMIT_TIMEOUT_MS = 5000;
```

### Implementation

```typescript
// hooks/use-socket-emit.ts
import { useCallback, useState } from "react";
import type { TypedSocket } from "../lib/socket";
import type { ClientToServerEvents } from "../types/socket-events";

interface EmitState<T> {
  isLoading: boolean;
  error: Error | null;
  data: T | null;
}

type EventName = keyof ClientToServerEvents;

export function useSocketEmit<T>(socket: TypedSocket | null) {
  const [state, setState] = useState<EmitState<T>>({
    isLoading: false,
    error: null,
    data: null,
  });

  const emit = useCallback(
    async (event: EventName, ...args: unknown[]): Promise<T | null> => {
      if (!socket?.connected) {
        const error = new Error("Socket not connected");
        setState({ isLoading: false, error, data: null });
        return null;
      }

      setState({ isLoading: true, error: null, data: null });

      try {
        const response = await socket
          .timeout(EMIT_TIMEOUT_MS)
          .emitWithAck(event, ...args);

        setState({ isLoading: false, error: null, data: response as T });
        return response as T;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Emit failed");
        setState({ isLoading: false, error: err, data: null });
        return null;
      }
    },
    [socket]
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, data: null });
  }, []);

  return { ...state, emit, reset };
}
```

---

## Example 5: Connection Status Component

Display connection state to users with reconnection feedback.

```typescript
// components/connection-status.tsx
import { useSocketConnection } from "../hooks/use-socket-connection";

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({
  className,
}: ConnectionStatusProps): JSX.Element {
  const { isConnected, isReconnecting, error } = useSocketConnection({
    token: "...", // Get from auth context
  });

  if (error) {
    return (
      <div className={className} data-status="error">
        <span>Connection failed</span>
        <span>{error.message}</span>
      </div>
    );
  }

  if (isReconnecting) {
    return (
      <div className={className} data-status="reconnecting">
        <span>Reconnecting...</span>
      </div>
    );
  }

  return (
    <div className={className} data-status={isConnected ? "connected" : "disconnected"}>
      <span>{isConnected ? "Connected" : "Disconnected"}</span>
    </div>
  );
}
```

---

## Example 6: Message Queue for Offline Support

Queue messages when disconnected and flush on reconnection.

### Constants

```typescript
const MAX_QUEUE_SIZE = 100;
```

### Implementation

```typescript
// lib/message-queue.ts

interface QueuedMessage {
  event: string;
  data: unknown;
  timestamp: number;
}

export class MessageQueue {
  private queue: QueuedMessage[] = [];
  private maxSize: number;

  constructor(maxSize: number = MAX_QUEUE_SIZE) {
    this.maxSize = maxSize;
  }

  enqueue(event: string, data: unknown): void {
    if (this.queue.length >= this.maxSize) {
      // Remove oldest message
      this.queue.shift();
    }

    this.queue.push({
      event,
      data,
      timestamp: Date.now(),
    });
  }

  flush(
    emitFn: (event: string, data: unknown) => void
  ): number {
    const count = this.queue.length;

    while (this.queue.length > 0) {
      const message = this.queue.shift();
      if (message) {
        emitFn(message.event, message.data);
      }
    }

    return count;
  }

  clear(): void {
    this.queue = [];
  }

  get size(): number {
    return this.queue.length;
  }
}

// Usage with socket
// const queue = new MessageQueue();
//
// function send(event: string, data: unknown) {
//   if (socket.connected) {
//     socket.emit(event, data);
//   } else {
//     queue.enqueue(event, data);
//   }
// }
//
// socket.on("connect", () => {
//   queue.flush((event, data) => socket.emit(event, data));
// });
```

---

## Example 7: Typing Indicator

Implement typing indicators with debouncing.

### Constants

```typescript
const TYPING_DEBOUNCE_MS = 300;
const TYPING_TIMEOUT_MS = 2000;
```

### Implementation

```typescript
// hooks/use-typing-indicator.ts
import { useCallback, useRef, useEffect } from "react";
import type { TypedSocket } from "../lib/socket";

interface UseTypingIndicatorOptions {
  socket: TypedSocket | null;
  roomId: string;
}

export function useTypingIndicator({
  socket,
  roomId,
}: UseTypingIndicatorOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startTyping = useCallback(() => {
    if (!socket?.connected) return;

    // Emit typing:start only if not already typing
    if (!isTypingRef.current) {
      socket.emit("chat:typing", roomId);
      isTypingRef.current = true;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set timeout to stop typing indicator
    timeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, TYPING_TIMEOUT_MS);
  }, [socket, roomId]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    isTypingRef.current = false;
  }, []);

  return { startTyping, stopTyping };
}
```

---

## Example 8: Heartbeat Implementation

Keep connection alive through proxy timeouts with ping/pong.

### Constants

```typescript
const HEARTBEAT_INTERVAL_MS = 25000;
const HEARTBEAT_TIMEOUT_MS = 5000;
```

### Implementation

```typescript
// lib/heartbeat.ts
import type { Socket } from "socket.io-client";

export function setupHeartbeat(
  socket: Socket,
  onTimeout?: () => void
): () => void {
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = (): void => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    }
  };

  const handleConnect = (): void => {
    clearTimers();

    heartbeatInterval = setInterval(() => {
      // Send ping
      socket.emit("ping");

      // Set timeout for pong response
      heartbeatTimeout = setTimeout(() => {
        console.warn("Heartbeat timeout - connection may be dead");
        onTimeout?.();
        socket.disconnect();
      }, HEARTBEAT_TIMEOUT_MS);
    }, HEARTBEAT_INTERVAL_MS);
  };

  const handlePong = (): void => {
    if (heartbeatTimeout) {
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = null;
    }
  };

  const handleDisconnect = (): void => {
    clearTimers();
  };

  socket.on("connect", handleConnect);
  socket.on("pong", handlePong);
  socket.on("disconnect", handleDisconnect);

  // If already connected, start heartbeat
  if (socket.connected) {
    handleConnect();
  }

  // Return cleanup function
  return () => {
    clearTimers();
    socket.off("connect", handleConnect);
    socket.off("pong", handlePong);
    socket.off("disconnect", handleDisconnect);
  };
}
```

---

## Example 9: Volatile Events

Use volatile events for data that can be safely dropped (e.g., cursor positions, live updates).

```typescript
// lib/volatile-events.ts
import type { Socket } from "socket.io-client";

interface CursorPosition {
  x: number;
  y: number;
  userId: string;
}

// Volatile: OK if some updates are dropped during congestion
export function emitCursorPosition(
  socket: Socket,
  position: CursorPosition
): void {
  socket.volatile.emit("cursor:move", position);
}

// Regular: Every update must be delivered
export function emitImportantUpdate(
  socket: Socket,
  data: unknown
): void {
  socket.emit("update:important", data);
}
```

---

## Example 10: Multiplexing with Manager

Share a single connection across multiple namespace sockets.

```typescript
// lib/socket-manager.ts
import { Manager, Socket } from "socket.io-client";

const MANAGER_RECONNECTION_DELAY_MS = 1000;
const MANAGER_RECONNECTION_DELAY_MAX_MS = 5000;

// Single Manager for connection sharing
const manager = new Manager("http://localhost:3001", {
  autoConnect: false,
  reconnectionDelay: MANAGER_RECONNECTION_DELAY_MS,
  reconnectionDelayMax: MANAGER_RECONNECTION_DELAY_MAX_MS,
});

// Multiple namespace sockets share one connection
export const chatSocket = manager.socket("/chat");
export const notificationSocket = manager.socket("/notifications");
export const adminSocket = manager.socket("/admin");

export function connectAll(token: string): void {
  // Set auth for all sockets
  manager.opts.auth = { token };

  // Connect the manager (connects all sockets)
  manager.connect();
}

export function disconnectAll(): void {
  manager.disconnect();
}

// Individual namespace control
export function connectNamespace(socket: Socket): void {
  socket.connect();
}

export function disconnectNamespace(socket: Socket): void {
  socket.disconnect();
}
```

---

## Anti-Pattern Examples

### WRONG: Token in Query String

```typescript
// WRONG - Token visible in server logs and browser history
const socket = io(`http://localhost:3001?token=${token}`);
```

### WRONG: No Event Listener Cleanup

```typescript
// WRONG - Memory leak, duplicate handlers on re-render
useEffect(() => {
  socket.on("message", handleMessage);
  // Missing cleanup!
}, []);
```

### WRONG: Magic Numbers

```typescript
// WRONG - What do these numbers mean?
const socket = io(url, {
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});
```

### WRONG: No readyState Check

```typescript
// WRONG - Fails silently if not connected
function sendMessage(data: unknown) {
  socket.emit("message", data);
}
```

### CORRECT Versions

```typescript
// CORRECT - Token in auth object
const socket = io(url, {
  auth: { token },
});

// CORRECT - Cleanup listeners
useEffect(() => {
  socket.on("message", handleMessage);
  return () => {
    socket.off("message", handleMessage);
  };
}, []);

// CORRECT - Named constants
const socket = io(url, {
  reconnectionDelay: RECONNECTION_DELAY_MS,
  reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
  timeout: REQUEST_TIMEOUT_MS,
});

// CORRECT - Check connection status
function sendMessage(data: unknown) {
  if (socket.connected) {
    socket.emit("message", data);
  } else {
    messageQueue.enqueue(data);
  }
}
```
