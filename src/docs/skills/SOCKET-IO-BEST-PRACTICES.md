# Socket.IO Best Practices Research

> **Purpose**: Comprehensive research for creating Socket.IO v4.x skills covering server/client patterns, authentication, rooms/namespaces, scaling, React/Vue integration, and testing.
> **Status**: COMPLETE
> **Last Updated**: 2026-01-17
> **Socket.IO Version**: v4.8.x
> **Target Skills**: realtime/socket-io-server, realtime/socket-io-client, realtime/socket-io-react, realtime/socket-io-vue

---

## Table of Contents

1. [Core Concepts](#section-1-core-concepts)
2. [TypeScript Integration](#section-2-typescript-integration)
3. [Server Patterns](#section-3-server-patterns)
4. [Client Patterns](#section-4-client-patterns)
5. [Authentication and Middleware](#section-5-authentication-and-middleware)
6. [Rooms and Namespaces](#section-6-rooms-and-namespaces)
7. [Error Handling and Reconnection](#section-7-error-handling-and-reconnection)
8. [Acknowledgments and Callbacks](#section-8-acknowledgments-and-callbacks)
9. [Binary Data Transfer](#section-9-binary-data-transfer)
10. [React Integration](#section-10-react-integration)
11. [Vue 3 Integration](#section-11-vue-3-integration)
12. [Scaling with Redis Adapter](#section-12-scaling-with-redis-adapter)
13. [Testing Patterns](#section-13-testing-patterns)
14. [Anti-Patterns and Common Mistakes](#section-14-anti-patterns-and-common-mistakes)
15. [Performance Tuning](#section-15-performance-tuning)

---

## Section 1: Core Concepts

### What Socket.IO Is (and Isn't)

Socket.IO is a library that enables low-latency, bidirectional, and event-based communication between client and server. **It is NOT a WebSocket implementation** - although it uses WebSocket for transport when possible, it adds additional metadata to each packet.

**Key implications:**
- A WebSocket client cannot connect to a Socket.IO server
- A Socket.IO client cannot connect to a plain WebSocket server
- Socket.IO provides features not available in plain WebSockets (rooms, namespaces, automatic reconnection, acknowledgments)

### Core Components

```typescript
// Constants - NO magic numbers
const DEFAULT_PORT = 3000;
const PING_INTERVAL_MS = 25000;
const PING_TIMEOUT_MS = 20000;

// Server: The Socket.IO server attached to HTTP server
import { Server } from "socket.io";
import { createServer } from "http";

const httpServer = createServer();
const io = new Server(httpServer, {
  pingInterval: PING_INTERVAL_MS,
  pingTimeout: PING_TIMEOUT_MS,
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

// Socket: Individual connection instance
io.on("connection", (socket) => {
  // socket represents a single client connection
  // socket.id is a unique identifier
});

httpServer.listen(DEFAULT_PORT);
```

### Transport Mechanisms

Socket.IO supports multiple transports with automatic fallback:

1. **WebSocket** (preferred) - Bidirectional, full-duplex
2. **HTTP Long-Polling** - Fallback for restrictive networks

```typescript
// Server: Configure transports
const io = new Server(httpServer, {
  transports: ["websocket", "polling"], // Default order
  allowUpgrades: true, // Allow upgrading from polling to websocket
});

// Client: Configure transports
const socket = io("http://localhost:3000", {
  transports: ["websocket"], // Force WebSocket only (skip polling)
  upgrade: false,
});
```

---

## Section 2: TypeScript Integration

### Event Type Definitions

Socket.IO v4 has first-class TypeScript support. Define interfaces for type-safe communication:

```typescript
// types/socket.types.ts

// Events sent from server to client
interface ServerToClientEvents {
  noArg: () => void;
  basicEmit: (a: number, b: string, c: Buffer) => void;
  withAck: (d: string, callback: (e: number) => void) => void;

  // Real-world examples
  "user:joined": (user: User) => void;
  "user:left": (userId: string) => void;
  "message:received": (message: ChatMessage) => void;
  "room:updated": (room: Room) => void;
  "error": (error: SocketError) => void;
}

// Events sent from client to server
interface ClientToServerEvents {
  hello: () => void;

  // Real-world examples
  "message:send": (content: string, callback: (response: MessageResponse) => void) => void;
  "room:join": (roomId: string, callback: (result: JoinResult) => void) => void;
  "room:leave": (roomId: string) => void;
  "typing:start": (roomId: string) => void;
  "typing:stop": (roomId: string) => void;
}

// Inter-server events (for multi-server setups)
interface InterServerEvents {
  ping: () => void;
  "user:broadcast": (userId: string, data: unknown) => void;
}

// Socket data attached to each connection
interface SocketData {
  userId: string;
  username: string;
  roles: string[];
  connectedAt: Date;
}

// Supporting types
interface User {
  id: string;
  username: string;
  avatar?: string;
}

interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  roomId: string;
  createdAt: Date;
}

interface Room {
  id: string;
  name: string;
  members: string[];
}

interface SocketError {
  code: string;
  message: string;
}

interface MessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface JoinResult {
  success: boolean;
  room?: Room;
  error?: string;
}

export type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  User,
  ChatMessage,
  Room,
  SocketError,
  MessageResponse,
  JoinResult,
};
```

### Typed Server Setup

```typescript
// server/socket-server.ts
import { Server, Socket } from "socket.io";
import { createServer } from "http";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "../types/socket.types";

const httpServer = createServer();

// Fully typed server
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer);

// Type-safe connection handler
io.on("connection", (socket) => {
  // socket.data is typed as SocketData
  socket.data.userId = "user-123";
  socket.data.connectedAt = new Date();

  // Emit is type-checked - TypeScript will error if arguments don't match
  socket.emit("user:joined", { id: "123", username: "john" });

  // Event handlers have typed parameters
  socket.on("message:send", (content, callback) => {
    // content is inferred as string
    // callback is (response: MessageResponse) => void
    callback({ success: true, messageId: "msg-123" });
  });

  // TypeScript catches type errors
  // socket.emit("user:joined", "wrong type"); // Error!
});

// Inter-server communication is also typed
io.serverSideEmit("ping");
io.on("ping", () => {
  console.log("Received ping from another server");
});

export { io };
```

### Typed Client Setup

```typescript
// client/socket-client.ts
import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "../types/socket.types";

const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:3000";

// Note: Types are reversed on client side
// First generic = what client receives (ServerToClient)
// Second generic = what client sends (ClientToServer)
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL);

// Type-safe emit
socket.emit("message:send", "Hello world", (response) => {
  // response is typed as MessageResponse
  if (response.success) {
    console.log("Message sent:", response.messageId);
  }
});

// Type-safe event handlers
socket.on("user:joined", (user) => {
  // user is typed as User
  console.log(`${user.username} joined`);
});

socket.on("message:received", (message) => {
  // message is typed as ChatMessage
  console.log(`New message: ${message.content}`);
});

export { socket };
```

### Namespace-Specific Types

```typescript
// types/admin-socket.types.ts
interface AdminClientToServerEvents {
  "admin:ban-user": (userId: string, reason: string) => void;
  "admin:broadcast": (message: string) => void;
}

interface AdminServerToClientEvents {
  "admin:user-banned": (userId: string) => void;
  "admin:stats": (stats: AdminStats) => void;
}

interface AdminStats {
  activeConnections: number;
  totalRooms: number;
  memoryUsage: number;
}
```

```typescript
// server/namespaces/admin.ts
const adminNamespace = io.of("/admin");

// Namespace can have its own types
adminNamespace.on("connection", (socket) => {
  socket.on("admin:ban-user", (userId, reason) => {
    // Handle admin action
    adminNamespace.emit("admin:user-banned", userId);
  });
});
```

---

## Section 3: Server Patterns

### Application Structure - Modular Handlers

**Pattern 1: Decentralized Registration (Recommended for larger apps)**

```typescript
// server/handlers/chat.handler.ts
import type { Server, Socket } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "../../types/socket.types";

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function registerChatHandlers(io: TypedIO, socket: TypedSocket): void {
  socket.on("message:send", async (content, callback) => {
    try {
      const message = await saveMessage({
        content,
        senderId: socket.data.userId,
        roomId: getCurrentRoom(socket),
      });

      // Broadcast to room
      socket.to(message.roomId).emit("message:received", message);

      callback({ success: true, messageId: message.id });
    } catch (error) {
      callback({ success: false, error: "Failed to send message" });
    }
  });

  socket.on("typing:start", (roomId) => {
    socket.to(roomId).emit("user:typing", {
      userId: socket.data.userId,
      username: socket.data.username,
    });
  });

  socket.on("typing:stop", (roomId) => {
    socket.to(roomId).emit("user:stopped-typing", {
      userId: socket.data.userId,
    });
  });
}

function getCurrentRoom(socket: TypedSocket): string {
  // Get the first room that isn't the socket's own room
  const rooms = Array.from(socket.rooms);
  return rooms.find((room) => room !== socket.id) || "";
}
```

```typescript
// server/handlers/room.handler.ts
import type { Server, Socket } from "socket.io";

export function registerRoomHandlers(io: TypedIO, socket: TypedSocket): void {
  socket.on("room:join", async (roomId, callback) => {
    try {
      // Leave all other rooms first (except socket.id room)
      const currentRooms = Array.from(socket.rooms);
      for (const room of currentRooms) {
        if (room !== socket.id) {
          socket.leave(room);
        }
      }

      // Join new room
      await socket.join(roomId);

      // Notify room members
      socket.to(roomId).emit("user:joined", {
        id: socket.data.userId,
        username: socket.data.username,
      });

      const room = await getRoom(roomId);
      callback({ success: true, room });
    } catch (error) {
      callback({ success: false, error: "Failed to join room" });
    }
  });

  socket.on("room:leave", (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit("user:left", socket.data.userId);
  });
}
```

```typescript
// server/index.ts
import { Server } from "socket.io";
import { createServer } from "http";
import { registerChatHandlers } from "./handlers/chat.handler";
import { registerRoomHandlers } from "./handlers/room.handler";
import { authMiddleware } from "./middleware/auth.middleware";

const DEFAULT_PORT = 3000;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

// Register middleware
io.use(authMiddleware);

// Register handlers on connection
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.data.userId}`);

  // Modular handler registration
  registerChatHandlers(io, socket);
  registerRoomHandlers(io, socket);

  // Disconnect handler
  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.data.userId} - ${reason}`);
  });
});

httpServer.listen(DEFAULT_PORT, () => {
  console.log(`Socket.IO server running on port ${DEFAULT_PORT}`);
});
```

### Server Options Configuration

```typescript
// server/config/socket.config.ts

const PING_INTERVAL_MS = 25000;
const PING_TIMEOUT_MS = 20000;
const MAX_HTTP_BUFFER_SIZE = 1e6; // 1 MB
const CONNECTION_STATE_RECOVERY_MAX_MS = 2 * 60 * 1000; // 2 minutes

interface SocketServerConfig {
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  pingInterval: number;
  pingTimeout: number;
  maxHttpBufferSize: number;
  connectionStateRecovery?: {
    maxDisconnectionDuration: number;
    skipMiddlewares: boolean;
  };
}

export function getSocketConfig(): SocketServerConfig {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    cors: {
      origin: isProduction
        ? process.env.CLIENT_URL || "https://myapp.com"
        : ["http://localhost:3000", "http://localhost:5173"],
      credentials: true,
    },
    pingInterval: PING_INTERVAL_MS,
    pingTimeout: PING_TIMEOUT_MS,
    maxHttpBufferSize: MAX_HTTP_BUFFER_SIZE,
    // Connection state recovery (v4.6.0+)
    connectionStateRecovery: {
      maxDisconnectionDuration: CONNECTION_STATE_RECOVERY_MAX_MS,
      skipMiddlewares: true, // Skip middleware on reconnection
    },
  };
}
```

---

## Section 4: Client Patterns

### Client Configuration

```typescript
// client/lib/socket.ts
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "../types/socket.types";

const RECONNECTION_DELAY_MS = 1000;
const RECONNECTION_DELAY_MAX_MS = 5000;
const MAX_RECONNECTION_ATTEMPTS = 10;
const REQUEST_TIMEOUT_MS = 10000;

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketConfig {
  url: string;
  auth?: {
    token: string;
  };
  autoConnect?: boolean;
}

export function createSocket(config: SocketConfig): TypedSocket {
  const socket: TypedSocket = io(config.url, {
    // Authentication
    auth: config.auth,

    // Connection settings
    autoConnect: config.autoConnect ?? false,

    // Reconnection settings
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
    reconnectionDelay: RECONNECTION_DELAY_MS,
    reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,

    // Transport settings
    transports: ["websocket", "polling"],

    // Request timeout for emitWithAck
    timeout: REQUEST_TIMEOUT_MS,

    // Try other transports if first fails
    tryAllTransports: true,
  });

  return socket;
}

// Singleton instance for app-wide use
let socketInstance: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!socketInstance) {
    throw new Error("Socket not initialized. Call initializeSocket first.");
  }
  return socketInstance;
}

export function initializeSocket(token: string): TypedSocket {
  if (socketInstance) {
    socketInstance.disconnect();
  }

  socketInstance = createSocket({
    url: process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
    auth: { token },
    autoConnect: true,
  });

  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
```

### Connection Lifecycle Management

```typescript
// client/lib/socket-lifecycle.ts
import type { Socket } from "socket.io-client";

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  lastError: Error | null;
}

export function setupConnectionLifecycle(
  socket: Socket,
  onStateChange: (state: ConnectionState) => void
): () => void {
  const state: ConnectionState = {
    isConnected: socket.connected,
    isReconnecting: false,
    reconnectAttempts: 0,
    lastError: null,
  };

  const updateState = (updates: Partial<ConnectionState>) => {
    Object.assign(state, updates);
    onStateChange({ ...state });
  };

  // Connection established
  const handleConnect = () => {
    updateState({
      isConnected: true,
      isReconnecting: false,
      reconnectAttempts: 0,
      lastError: null,
    });
  };

  // Connection lost
  const handleDisconnect = (reason: string) => {
    const willReconnect = socket.active;
    updateState({
      isConnected: false,
      isReconnecting: willReconnect,
    });

    if (!willReconnect) {
      console.log("Connection closed permanently:", reason);
    }
  };

  // Connection error
  const handleConnectError = (error: Error) => {
    updateState({
      isConnected: false,
      lastError: error,
    });

    if (!socket.active) {
      console.error("Connection failed permanently:", error.message);
    }
  };

  // Manager-level events for reconnection tracking
  const handleReconnectAttempt = (attempt: number) => {
    updateState({
      isReconnecting: true,
      reconnectAttempts: attempt,
    });
  };

  const handleReconnect = () => {
    updateState({
      isConnected: true,
      isReconnecting: false,
      reconnectAttempts: 0,
    });
  };

  const handleReconnectFailed = () => {
    updateState({
      isReconnecting: false,
      lastError: new Error("Max reconnection attempts reached"),
    });
  };

  // Socket-level events
  socket.on("connect", handleConnect);
  socket.on("disconnect", handleDisconnect);
  socket.on("connect_error", handleConnectError);

  // Manager-level events (note: socket.io property is the Manager)
  socket.io.on("reconnect_attempt", handleReconnectAttempt);
  socket.io.on("reconnect", handleReconnect);
  socket.io.on("reconnect_failed", handleReconnectFailed);

  // Return cleanup function
  return () => {
    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
    socket.off("connect_error", handleConnectError);
    socket.io.off("reconnect_attempt", handleReconnectAttempt);
    socket.io.off("reconnect", handleReconnect);
    socket.io.off("reconnect_failed", handleReconnectFailed);
  };
}
```

---

## Section 5: Authentication and Middleware

### JWT Authentication Middleware

```typescript
// server/middleware/auth.middleware.ts
import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import type { SocketData } from "../../types/socket.types";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

interface JWTPayload {
  userId: string;
  username: string;
  roles: string[];
}

export function authMiddleware(
  socket: Socket<any, any, any, SocketData>,
  next: (err?: Error) => void
): void {
  const token = socket.handshake.auth.token;

  if (!token) {
    const error = new Error("Authentication required");
    // Attach additional data for client error handling
    (error as any).data = { code: "AUTH_REQUIRED" };
    return next(error);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Attach user data to socket
    socket.data.userId = decoded.userId;
    socket.data.username = decoded.username;
    socket.data.roles = decoded.roles;
    socket.data.connectedAt = new Date();

    next();
  } catch (err) {
    const error = new Error("Invalid or expired token");
    (error as any).data = { code: "AUTH_INVALID" };
    next(error);
  }
}
```

### Authorization Middleware (Namespace-level)

```typescript
// server/middleware/admin.middleware.ts
import type { Socket } from "socket.io";
import type { SocketData } from "../../types/socket.types";

export function adminAuthMiddleware(
  socket: Socket<any, any, any, SocketData>,
  next: (err?: Error) => void
): void {
  const roles = socket.data.roles || [];

  if (!roles.includes("admin")) {
    const error = new Error("Admin access required");
    (error as any).data = { code: "FORBIDDEN" };
    return next(error);
  }

  next();
}

// Usage with namespace
// const adminNamespace = io.of("/admin");
// adminNamespace.use(authMiddleware); // First authenticate
// adminNamespace.use(adminAuthMiddleware); // Then authorize
```

### Rate Limiting Middleware

```typescript
// server/middleware/rate-limit.middleware.ts
import type { Socket } from "socket.io";

const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_EVENTS_PER_WINDOW = 100;

// In-memory store (use Redis for multi-server)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimitMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): void {
  const key = socket.handshake.address;
  const now = Date.now();

  let record = rateLimitStore.get(key);

  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(key, record);
  }

  record.count++;

  if (record.count > MAX_EVENTS_PER_WINDOW) {
    const error = new Error("Too many connections");
    (error as any).data = { code: "RATE_LIMITED", retryAfter: record.resetAt - now };
    return next(error);
  }

  next();
}
```

### Client-Side Authentication

```typescript
// client/lib/socket-auth.ts
import { io, Socket } from "socket.io-client";

interface AuthSocket {
  socket: Socket;
  updateToken: (token: string) => void;
}

export function createAuthenticatedSocket(initialToken: string): AuthSocket {
  // Use function-based auth for dynamic token updates
  let currentToken = initialToken;

  const socket = io("http://localhost:3000", {
    auth: (callback) => {
      callback({ token: currentToken });
    },
    autoConnect: true,
  });

  // Handle auth errors
  socket.on("connect_error", (error) => {
    if ((error as any).data?.code === "AUTH_INVALID") {
      // Token expired - attempt refresh
      refreshToken().then((newToken) => {
        currentToken = newToken;
        socket.connect(); // Reconnect with new token
      });
    }
  });

  // Function to update token (e.g., after refresh)
  const updateToken = (token: string) => {
    currentToken = token;
  };

  return { socket, updateToken };
}

async function refreshToken(): Promise<string> {
  // Implement your token refresh logic
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  const data = await response.json();
  return data.token;
}
```

---

## Section 6: Rooms and Namespaces

### Rooms vs Namespaces

| Feature | Namespaces | Rooms |
|---------|------------|-------|
| Created by | Server, joined by client request | Server only |
| Client awareness | Knows which namespace it's connected to | No knowledge of rooms |
| Multiple connections | Separate connection per namespace | Same connection |
| Use case | Feature separation (chat, admin, notifications) | User grouping within features |

### Room Management Patterns

```typescript
// server/services/room.service.ts

interface RoomInfo {
  id: string;
  name: string;
  members: Set<string>;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

const rooms = new Map<string, RoomInfo>();

export class RoomService {
  async createRoom(name: string, creatorId: string): Promise<RoomInfo> {
    const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const room: RoomInfo = {
      id,
      name,
      members: new Set([creatorId]),
      createdAt: new Date(),
      metadata: {},
    };
    rooms.set(id, room);
    return room;
  }

  async joinRoom(io: Server, socket: Socket, roomId: string): Promise<RoomInfo | null> {
    const room = rooms.get(roomId);
    if (!room) {
      return null;
    }

    // Join Socket.IO room
    await socket.join(roomId);

    // Track member
    room.members.add(socket.data.userId);

    // Notify others
    socket.to(roomId).emit("user:joined", {
      id: socket.data.userId,
      username: socket.data.username,
    });

    return room;
  }

  async leaveRoom(socket: Socket, roomId: string): Promise<void> {
    const room = rooms.get(roomId);
    if (!room) return;

    // Leave Socket.IO room
    socket.leave(roomId);

    // Remove from tracking
    room.members.delete(socket.data.userId);

    // Notify others
    socket.to(roomId).emit("user:left", socket.data.userId);

    // Clean up empty rooms
    if (room.members.size === 0) {
      rooms.delete(roomId);
    }
  }

  async getRoomMembers(io: Server, roomId: string): Promise<string[]> {
    const sockets = await io.in(roomId).fetchSockets();
    return sockets.map((s) => s.data.userId);
  }

  async broadcastToRoom(io: Server, roomId: string, event: string, data: unknown): Promise<void> {
    io.to(roomId).emit(event, data);
  }
}

export const roomService = new RoomService();
```

### Namespace Patterns

```typescript
// server/namespaces/index.ts
import { Server } from "socket.io";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminAuthMiddleware } from "../middleware/admin.middleware";

export function setupNamespaces(io: Server): void {
  // Main namespace (default /)
  io.on("connection", (socket) => {
    // General application logic
  });

  // Chat namespace
  const chatNamespace = io.of("/chat");
  chatNamespace.use(authMiddleware);
  chatNamespace.on("connection", (socket) => {
    console.log("User connected to chat:", socket.data.userId);
    // Chat-specific handlers
  });

  // Admin namespace
  const adminNamespace = io.of("/admin");
  adminNamespace.use(authMiddleware);
  adminNamespace.use(adminAuthMiddleware);
  adminNamespace.on("connection", (socket) => {
    console.log("Admin connected:", socket.data.userId);
    // Admin-specific handlers
  });

  // Dynamic namespaces (use sparingly)
  const dynamicNsp = io.of(/^\/org-\w+$/);
  dynamicNsp.use(authMiddleware);
  dynamicNsp.on("connection", (socket) => {
    const orgId = socket.nsp.name.replace("/org-", "");
    console.log(`User connected to org ${orgId}:`, socket.data.userId);
  });
}
```

### Emitting to Rooms/Namespaces

```typescript
// Emitting patterns

// To all clients in a room
io.to("room1").emit("event", data);

// To all clients in multiple rooms
io.to("room1").to("room2").emit("event", data);

// To all clients except sender
socket.to("room1").emit("event", data);

// To all clients in a namespace
io.of("/chat").emit("event", data);

// To specific socket by ID
io.to(socketId).emit("event", data);

// To all connected clients
io.emit("event", data);

// Broadcast from socket (excludes sender)
socket.broadcast.emit("event", data);

// Excluding specific rooms
io.except("room1").emit("event", data);
socket.to("room2").except("room3").emit("event", data);
```

---

## Section 7: Error Handling and Reconnection

### Server-Side Error Handling

```typescript
// server/handlers/error.handler.ts

export function registerErrorHandler(io: Server, socket: Socket): void {
  // Catch errors in event handlers
  const safeHandler = <T extends unknown[]>(
    handler: (...args: T) => Promise<void> | void
  ) => {
    return async (...args: T) => {
      try {
        await handler(...args);
      } catch (error) {
        console.error("Socket handler error:", error);
        socket.emit("error", {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        });
      }
    };
  };

  // Wrap handlers with error catching
  socket.on("message:send", safeHandler(async (content, callback) => {
    // Handler logic...
    callback({ success: true });
  }));
}

// Global error event handler
io.engine.on("connection_error", (err) => {
  console.error("Connection error:", err.code, err.message, err.context);
});
```

### Client-Side Error Handling and Reconnection

```typescript
// client/lib/socket-error-handler.ts
import type { Socket } from "socket.io-client";

const AUTH_ERROR_CODES = ["AUTH_REQUIRED", "AUTH_INVALID", "AUTH_EXPIRED"];

interface ErrorHandler {
  onAuthError: (error: Error) => void;
  onConnectionError: (error: Error) => void;
  onServerError: (error: { code: string; message: string }) => void;
}

export function setupErrorHandlers(
  socket: Socket,
  handlers: ErrorHandler
): () => void {
  // Connection errors
  const handleConnectError = (error: Error & { data?: { code: string } }) => {
    const code = error.data?.code;

    if (code && AUTH_ERROR_CODES.includes(code)) {
      handlers.onAuthError(error);
    } else {
      handlers.onConnectionError(error);
    }
  };

  // Server-side errors
  const handleServerError = (error: { code: string; message: string }) => {
    handlers.onServerError(error);
  };

  // Disconnect handler
  const handleDisconnect = (reason: string) => {
    console.log("Disconnected:", reason);

    // Reasons that require manual reconnection
    const manualReconnectReasons = [
      "io server disconnect", // Server forced disconnect
      "io client disconnect", // Client called disconnect()
    ];

    if (manualReconnectReasons.includes(reason)) {
      // Don't auto-reconnect, handle manually
      console.log("Manual reconnection required");
    }
  };

  socket.on("connect_error", handleConnectError);
  socket.on("error", handleServerError);
  socket.on("disconnect", handleDisconnect);

  return () => {
    socket.off("connect_error", handleConnectError);
    socket.off("error", handleServerError);
    socket.off("disconnect", handleDisconnect);
  };
}
```

### Connection State Recovery (v4.6.0+)

```typescript
// Server-side: Enable connection state recovery
const io = new Server(httpServer, {
  connectionStateRecovery: {
    // Maximum duration of disconnection to attempt recovery
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    // Skip middlewares on recovery (user already authenticated)
    skipMiddlewares: true,
  },
});

// Client-side: Check if recovery succeeded
socket.on("connect", () => {
  if (socket.recovered) {
    // Connection recovered successfully
    // Missed events will be delivered automatically
    console.log("Connection recovered, syncing state...");
  } else {
    // New session or recovery failed
    // Need to re-sync state from server
    console.log("New session, fetching initial state...");
    fetchInitialState();
  }
});
```

---

## Section 8: Acknowledgments and Callbacks

### Basic Acknowledgments

```typescript
// Server-side
io.on("connection", (socket) => {
  socket.on("message:send", (content, callback) => {
    // Process message
    const messageId = saveMessage(content);

    // Acknowledge with response
    callback({ success: true, messageId });
  });
});

// Client-side
socket.emit("message:send", "Hello!", (response) => {
  if (response.success) {
    console.log("Message sent with ID:", response.messageId);
  }
});
```

### Acknowledgments with Timeout

```typescript
const ACK_TIMEOUT_MS = 5000;

// Using timeout() modifier
socket.timeout(ACK_TIMEOUT_MS).emit("message:send", "Hello!", (err, response) => {
  if (err) {
    // Server didn't acknowledge in time
    console.error("Message send timed out");
    // Implement retry logic
  } else {
    console.log("Message acknowledged:", response);
  }
});
```

### Promise-Based with emitWithAck

```typescript
// client/lib/socket-utils.ts
import type { Socket } from "socket.io-client";

const DEFAULT_TIMEOUT_MS = 10000;

export async function emitWithTimeout<T>(
  socket: Socket,
  event: string,
  data: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  try {
    const response = await socket.timeout(timeoutMs).emitWithAck(event, data);
    return response as T;
  } catch (error) {
    if ((error as Error).message.includes("timeout")) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Usage
async function sendMessage(content: string): Promise<MessageResponse> {
  try {
    const response = await emitWithTimeout<MessageResponse>(
      socket,
      "message:send",
      content
    );
    return response;
  } catch (error) {
    console.error("Failed to send message:", error);
    throw error;
  }
}
```

### Server-Side Acknowledgment from Broadcast

```typescript
// Broadcasting with acknowledgments (v4.5.0+)
const ackTimeoutMs = 5000;

io.timeout(ackTimeoutMs).to("room1").emit("important:update", data, (err, responses) => {
  if (err) {
    // Some clients did not acknowledge
    console.error("Some clients failed to acknowledge:", err);
  } else {
    // All clients acknowledged
    console.log("All acknowledged:", responses);
  }
});
```

---

## Section 9: Binary Data Transfer

### Sending Binary Data

Socket.IO automatically handles binary data including Buffer, ArrayBuffer, Blob, and File.

```typescript
// Server-side: Sending binary data
io.on("connection", (socket) => {
  // Send file as Buffer
  socket.on("file:request", async (fileId, callback) => {
    try {
      const fileBuffer = await readFile(fileId);
      callback({
        success: true,
        data: fileBuffer, // Sent as binary
        metadata: { name: "document.pdf", size: fileBuffer.length }
      });
    } catch (error) {
      callback({ success: false, error: "File not found" });
    }
  });

  // Receive file upload
  socket.on("file:upload", async (fileData: Buffer, metadata, callback) => {
    try {
      const fileId = await saveFile(fileData, metadata);
      callback({ success: true, fileId });
    } catch (error) {
      callback({ success: false, error: "Upload failed" });
    }
  });
});
```

```typescript
// Client-side: Sending and receiving binary
const fileInput = document.getElementById("fileInput") as HTMLInputElement;

fileInput.addEventListener("change", async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // Convert to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  // Send file
  socket.emit("file:upload", buffer, {
    name: file.name,
    type: file.type,
    size: file.size,
  }, (response) => {
    if (response.success) {
      console.log("File uploaded:", response.fileId);
    }
  });
});

// Receiving binary data
socket.on("file:downloaded", (data: ArrayBuffer, metadata) => {
  const blob = new Blob([data], { type: metadata.type });
  const url = URL.createObjectURL(blob);
  // Use URL for download or display
});
```

### Chunked Transfer for Large Files

```typescript
// server/handlers/file-transfer.handler.ts
const CHUNK_SIZE = 64 * 1024; // 64KB chunks

interface ChunkMetadata {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  checksum: string;
}

export function registerFileTransferHandlers(io: Server, socket: Socket): void {
  const fileChunks = new Map<string, Buffer[]>();

  socket.on("file:chunk", (chunk: Buffer, metadata: ChunkMetadata, callback) => {
    const { fileId, chunkIndex, totalChunks } = metadata;

    // Initialize or get existing chunks array
    if (!fileChunks.has(fileId)) {
      fileChunks.set(fileId, new Array(totalChunks).fill(null));
    }

    const chunks = fileChunks.get(fileId)!;
    chunks[chunkIndex] = chunk;

    // Acknowledge chunk receipt
    callback({ success: true, chunkIndex });

    // Check if all chunks received
    if (chunks.every((c) => c !== null)) {
      // Reassemble file
      const completeFile = Buffer.concat(chunks);
      processCompleteFile(fileId, completeFile);
      fileChunks.delete(fileId);

      socket.emit("file:complete", { fileId, size: completeFile.length });
    }
  });
}
```

---

## Section 10: React Integration

### Socket Context and Provider

```typescript
// context/socket-context.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { initializeSocket, disconnectSocket } from "../lib/socket";
import type { ServerToClientEvents, ClientToServerEvents } from "../types/socket.types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextValue {
  socket: TypedSocket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  error: Error | null;
}

const SocketContext = createContext<SocketContextValue | null>(null);

interface SocketProviderProps {
  children: ReactNode;
  authToken: string;
}

export function SocketProvider({ children, authToken }: SocketProviderProps): JSX.Element {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const socketInstance = initializeSocket(authToken);
    setSocket(socketInstance);

    // Connection handlers
    const handleConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      if (socketInstance.active) {
        setIsReconnecting(true);
      }
    };

    const handleConnectError = (err: Error) => {
      setError(err);
      if (!socketInstance.active) {
        setIsConnected(false);
        setIsReconnecting(false);
      }
    };

    socketInstance.on("connect", handleConnect);
    socketInstance.on("disconnect", handleDisconnect);
    socketInstance.on("connect_error", handleConnectError);

    // Cleanup on unmount
    return () => {
      socketInstance.off("connect", handleConnect);
      socketInstance.off("disconnect", handleDisconnect);
      socketInstance.off("connect_error", handleConnectError);
      disconnectSocket();
    };
  }, [authToken]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isReconnecting, error }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
```

### Custom Event Hooks

```typescript
// hooks/use-socket-event.ts
import { useEffect, useCallback, useRef } from "react";
import { useSocket } from "../context/socket-context";
import type { ServerToClientEvents } from "../types/socket.types";

type EventName = keyof ServerToClientEvents;
type EventHandler<E extends EventName> = ServerToClientEvents[E];

export function useSocketEvent<E extends EventName>(
  event: E,
  handler: EventHandler<E>
): void {
  const { socket } = useSocket();

  // Use ref to avoid re-subscribing on handler changes
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;

    // Wrapper to use latest handler ref
    const eventHandler = (...args: Parameters<EventHandler<E>>) => {
      (handlerRef.current as Function)(...args);
    };

    socket.on(event, eventHandler as any);

    return () => {
      socket.off(event, eventHandler as any);
    };
  }, [socket, event]);
}
```

```typescript
// hooks/use-socket-emit.ts
import { useCallback } from "react";
import { useSocket } from "../context/socket-context";
import type { ClientToServerEvents } from "../types/socket.types";

type EventName = keyof ClientToServerEvents;

export function useSocketEmit(): <E extends EventName>(
  event: E,
  ...args: Parameters<ClientToServerEvents[E]>
) => void {
  const { socket } = useSocket();

  return useCallback(
    <E extends EventName>(event: E, ...args: Parameters<ClientToServerEvents[E]>) => {
      if (!socket) {
        console.warn("Socket not connected, cannot emit event:", event);
        return;
      }
      socket.emit(event, ...args);
    },
    [socket]
  );
}
```

### Component Usage Example

```typescript
// components/chat-room.tsx
import { useState, useCallback } from "react";
import { useSocket, useSocketEvent, useSocketEmit } from "../hooks";
import type { ChatMessage, User } from "../types/socket.types";

interface ChatRoomProps {
  roomId: string;
}

export function ChatRoom({ roomId }: ChatRoomProps): JSX.Element {
  const { isConnected, isReconnecting } = useSocket();
  const emit = useSocketEmit();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<User[]>([]);

  // Handle incoming messages
  useSocketEvent("message:received", (message) => {
    setMessages((prev) => [...prev, message]);
  });

  // Handle user joined
  useSocketEvent("user:joined", (user) => {
    setMembers((prev) => [...prev, user]);
  });

  // Handle user left
  useSocketEvent("user:left", (userId) => {
    setMembers((prev) => prev.filter((m) => m.id !== userId));
  });

  // Send message handler
  const sendMessage = useCallback((content: string) => {
    emit("message:send", content, (response) => {
      if (!response.success) {
        console.error("Failed to send message:", response.error);
      }
    });
  }, [emit]);

  if (!isConnected) {
    return (
      <div className="chat-status">
        {isReconnecting ? "Reconnecting..." : "Disconnected"}
      </div>
    );
  }

  return (
    <div className="chat-room">
      <div className="members">
        {members.map((member) => (
          <span key={member.id}>{member.username}</span>
        ))}
      </div>
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            <strong>{msg.senderId}:</strong> {msg.content}
          </div>
        ))}
      </div>
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

### React Query Integration

```typescript
// hooks/use-messages-with-realtime.ts
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSocket } from "../context/socket-context";
import type { ChatMessage } from "../types/socket.types";

const MESSAGES_QUERY_KEY = "messages";
const STALE_TIME_MS = 60000;

interface UseMessagesOptions {
  roomId: string;
}

export function useMessagesWithRealtime({ roomId }: UseMessagesOptions) {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  // Initial data fetch with React Query
  const query = useQuery({
    queryKey: [MESSAGES_QUERY_KEY, roomId],
    queryFn: () => fetchMessages(roomId),
    staleTime: STALE_TIME_MS,
  });

  // Real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: ChatMessage) => {
      if (message.roomId !== roomId) return;

      // Update React Query cache
      queryClient.setQueryData<ChatMessage[]>(
        [MESSAGES_QUERY_KEY, roomId],
        (old = []) => [...old, message]
      );
    };

    socket.on("message:received", handleNewMessage);

    return () => {
      socket.off("message:received", handleNewMessage);
    };
  }, [socket, roomId, queryClient]);

  return query;
}

async function fetchMessages(roomId: string): Promise<ChatMessage[]> {
  const response = await fetch(`/api/rooms/${roomId}/messages`);
  return response.json();
}
```

---

## Section 11: Vue 3 Integration

### Socket Composable

```typescript
// composables/use-socket.ts
import { reactive, readonly, onUnmounted, type DeepReadonly } from "vue";
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "../types/socket.types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketState {
  isConnected: boolean;
  isReconnecting: boolean;
  error: Error | null;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

// Shared socket instance
let socket: TypedSocket | null = null;
const state = reactive<SocketState>({
  isConnected: false,
  isReconnecting: false,
  error: null,
});

export function useSocket(authToken?: string) {
  // Initialize socket if not exists
  if (!socket && authToken) {
    socket = io(SOCKET_URL, {
      auth: { token: authToken },
      autoConnect: true,
    });

    socket.on("connect", () => {
      state.isConnected = true;
      state.isReconnecting = false;
      state.error = null;
    });

    socket.on("disconnect", () => {
      state.isConnected = false;
      if (socket?.active) {
        state.isReconnecting = true;
      }
    });

    socket.on("connect_error", (err) => {
      state.error = err;
    });
  }

  // Emit wrapper
  const emit = <E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ) => {
    socket?.emit(event, ...args);
  };

  // Subscribe to events
  const on = <E extends keyof ServerToClientEvents>(
    event: E,
    handler: ServerToClientEvents[E]
  ) => {
    socket?.on(event, handler as any);

    // Return unsubscribe function
    return () => {
      socket?.off(event, handler as any);
    };
  };

  // Disconnect
  const disconnect = () => {
    socket?.disconnect();
    socket = null;
    state.isConnected = false;
    state.isReconnecting = false;
  };

  return {
    socket: readonly(socket) as DeepReadonly<TypedSocket> | null,
    state: readonly(state),
    emit,
    on,
    disconnect,
  };
}
```

### Vue Component Usage

```vue
<!-- components/ChatRoom.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useSocket } from "../composables/use-socket";
import type { ChatMessage, User } from "../types/socket.types";

const props = defineProps<{
  roomId: string;
}>();

const { state, emit, on } = useSocket();
const messages = ref<ChatMessage[]>([]);
const members = ref<User[]>([]);
const newMessage = ref("");

// Event handlers
let unsubscribes: Array<() => void> = [];

onMounted(() => {
  // Subscribe to events
  unsubscribes.push(
    on("message:received", (message) => {
      messages.value.push(message);
    })
  );

  unsubscribes.push(
    on("user:joined", (user) => {
      members.value.push(user);
    })
  );

  unsubscribes.push(
    on("user:left", (userId) => {
      members.value = members.value.filter((m) => m.id !== userId);
    })
  );

  // Join room
  emit("room:join", props.roomId, (result) => {
    if (result.success && result.room) {
      // Initialize members from room data
    }
  });
});

onUnmounted(() => {
  // Cleanup subscriptions
  unsubscribes.forEach((unsub) => unsub());

  // Leave room
  emit("room:leave", props.roomId);
});

function sendMessage() {
  if (!newMessage.value.trim()) return;

  emit("message:send", newMessage.value, (response) => {
    if (response.success) {
      newMessage.value = "";
    }
  });
}
</script>

<template>
  <div class="chat-room">
    <div v-if="!state.isConnected" class="status">
      {{ state.isReconnecting ? "Reconnecting..." : "Disconnected" }}
    </div>

    <div class="members">
      <span v-for="member in members" :key="member.id">
        {{ member.username }}
      </span>
    </div>

    <div class="messages">
      <div v-for="msg in messages" :key="msg.id" class="message">
        <strong>{{ msg.senderId }}:</strong> {{ msg.content }}
      </div>
    </div>

    <form @submit.prevent="sendMessage">
      <input v-model="newMessage" placeholder="Type a message..." />
      <button type="submit" :disabled="!state.isConnected">Send</button>
    </form>
  </div>
</template>
```

### Pinia Store Integration

```typescript
// stores/chat.store.ts
import { defineStore } from "pinia";
import { useSocket } from "../composables/use-socket";
import type { ChatMessage, Room } from "../types/socket.types";

interface ChatState {
  currentRoom: Room | null;
  messages: ChatMessage[];
  isJoiningRoom: boolean;
}

export const useChatStore = defineStore("chat", {
  state: (): ChatState => ({
    currentRoom: null,
    messages: [],
    isJoiningRoom: false,
  }),

  actions: {
    bindSocketEvents() {
      const { on } = useSocket();

      on("message:received", (message) => {
        if (message.roomId === this.currentRoom?.id) {
          this.messages.push(message);
        }
      });

      on("room:updated", (room) => {
        if (room.id === this.currentRoom?.id) {
          this.currentRoom = room;
        }
      });
    },

    async joinRoom(roomId: string) {
      const { emit } = useSocket();
      this.isJoiningRoom = true;

      return new Promise<void>((resolve, reject) => {
        emit("room:join", roomId, (result) => {
          this.isJoiningRoom = false;

          if (result.success && result.room) {
            this.currentRoom = result.room;
            this.messages = [];
            resolve();
          } else {
            reject(new Error(result.error || "Failed to join room"));
          }
        });
      });
    },

    async sendMessage(content: string) {
      const { emit } = useSocket();

      return new Promise<void>((resolve, reject) => {
        emit("message:send", content, (response) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || "Failed to send message"));
          }
        });
      });
    },
  },
});
```

---

## Section 12: Scaling with Redis Adapter

### Redis Adapter Setup

```typescript
// server/adapters/redis-adapter.ts
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export async function setupRedisAdapter(io: Server): Promise<void> {
  const pubClient = createClient({ url: REDIS_URL });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient));

  // Cleanup on shutdown
  process.on("SIGTERM", async () => {
    await pubClient.quit();
    await subClient.quit();
  });

  console.log("Redis adapter connected");
}
```

### Sharded Redis Adapter (Redis 7.0+, Recommended)

```typescript
// server/adapters/sharded-redis-adapter.ts
import { Server } from "socket.io";
import { createShardedAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export async function setupShardedRedisAdapter(io: Server): Promise<void> {
  const pubClient = createClient({ url: REDIS_URL });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  // Sharded adapter uses Redis 7.0+ sharded Pub/Sub
  // Better performance for large numbers of rooms
  io.adapter(createShardedAdapter(pubClient, subClient));

  console.log("Sharded Redis adapter connected");
}
```

### Emitting from External Process

```typescript
// services/notification-service.ts
import { Emitter } from "@socket.io/redis-emitter";
import { createClient } from "redis";
import type { ServerToClientEvents } from "../types/socket.types";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let emitter: Emitter<ServerToClientEvents> | null = null;

export async function initializeEmitter(): Promise<void> {
  const redisClient = createClient({ url: REDIS_URL });
  await redisClient.connect();

  emitter = new Emitter<ServerToClientEvents>(redisClient);
}

// Emit to room from external service (e.g., background job)
export function notifyRoom(roomId: string, message: string): void {
  if (!emitter) {
    throw new Error("Emitter not initialized");
  }

  emitter.to(roomId).emit("message:received", {
    id: `msg-${Date.now()}`,
    content: message,
    senderId: "system",
    roomId,
    createdAt: new Date(),
  });
}

// Emit to specific user
export function notifyUser(userId: string, event: keyof ServerToClientEvents, data: unknown): void {
  if (!emitter) {
    throw new Error("Emitter not initialized");
  }

  emitter.to(`user:${userId}`).emit(event, data as any);
}
```

### Nginx Load Balancer Configuration

```nginx
# nginx.conf
upstream socket_servers {
    # IP hash ensures clients stick to same server
    ip_hash;

    server socket-server-1:3000;
    server socket-server-2:3000;
    server socket-server-3:3000;
}

server {
    listen 80;
    server_name socketio.example.com;

    location / {
        proxy_pass http://socket_servers;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

---

## Section 13: Testing Patterns

### Server Testing with Vitest

```typescript
// __tests__/socket-server.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Server } from "socket.io";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";

describe("Socket.IO Server", () => {
  let io: Server;
  let httpServer: HttpServer;
  let clientSocket: ClientSocket;
  let serverUrl: string;

  beforeAll(() => {
    return new Promise<void>((resolve) => {
      httpServer = createServer();
      io = new Server(httpServer);

      httpServer.listen(() => {
        const port = (httpServer.address() as AddressInfo).port;
        serverUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  beforeEach(() => {
    return new Promise<void>((resolve) => {
      clientSocket = ioc(serverUrl);
      clientSocket.on("connect", resolve);
    });
  });

  afterEach(() => {
    clientSocket.disconnect();
  });

  it("should handle message:send event", async () => {
    // Setup server handler
    io.on("connection", (socket) => {
      socket.on("message:send", (content, callback) => {
        callback({ success: true, messageId: "test-123" });
      });
    });

    // Test from client
    const response = await clientSocket.emitWithAck("message:send", "Hello");

    expect(response).toEqual({
      success: true,
      messageId: "test-123",
    });
  });

  it("should broadcast to room members", async () => {
    const ROOM_ID = "test-room";

    // Create second client
    const client2 = ioc(serverUrl);
    await new Promise<void>((resolve) => client2.on("connect", resolve));

    // Setup server
    io.on("connection", (socket) => {
      socket.on("room:join", async (roomId) => {
        await socket.join(roomId);
      });
    });

    // Both clients join room
    clientSocket.emit("room:join", ROOM_ID);
    client2.emit("room:join", ROOM_ID);

    // Wait for joins to process
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Listen for broadcast on client2
    const messagePromise = new Promise<string>((resolve) => {
      client2.on("message:received", (msg) => resolve(msg.content));
    });

    // Broadcast from server
    io.to(ROOM_ID).emit("message:received", {
      id: "1",
      content: "Test broadcast",
      senderId: "system",
      roomId: ROOM_ID,
      createdAt: new Date(),
    });

    const receivedContent = await messagePromise;
    expect(receivedContent).toBe("Test broadcast");

    client2.disconnect();
  });
});
```

### Client Testing with Mock

```typescript
// __tests__/chat-component.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatRoom } from "../components/chat-room";
import { SocketProvider } from "../context/socket-context";

// Mock socket.io-client
vi.mock("socket.io-client", () => {
  const handlers: Record<string, Function[]> = {};

  const mockSocket = {
    connected: true,
    active: true,

    on: vi.fn((event: string, handler: Function) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),

    off: vi.fn((event: string, handler?: Function) => {
      if (handler && handlers[event]) {
        handlers[event] = handlers[event].filter((h) => h !== handler);
      }
    }),

    emit: vi.fn((event: string, ...args: unknown[]) => {
      // Simulate acknowledgment callback
      const callback = args[args.length - 1];
      if (typeof callback === "function") {
        callback({ success: true, messageId: "mock-123" });
      }
    }),

    disconnect: vi.fn(),
    connect: vi.fn(),

    io: {
      on: vi.fn(),
      off: vi.fn(),
    },

    // Helper for tests to trigger events
    __emit: (event: string, ...args: unknown[]) => {
      handlers[event]?.forEach((handler) => handler(...args));
    },
  };

  return {
    io: vi.fn(() => mockSocket),
    Socket: vi.fn(),
  };
});

describe("ChatRoom Component", () => {
  let mockSocket: any;

  beforeEach(async () => {
    const { io } = await import("socket.io-client");
    mockSocket = io();
    vi.clearAllMocks();
  });

  it("renders connection status", () => {
    render(
      <SocketProvider authToken="test-token">
        <ChatRoom roomId="room-1" />
      </SocketProvider>
    );

    // Trigger connect
    mockSocket.__emit("connect");

    expect(screen.queryByText("Disconnected")).not.toBeInTheDocument();
  });

  it("displays incoming messages", async () => {
    render(
      <SocketProvider authToken="test-token">
        <ChatRoom roomId="room-1" />
      </SocketProvider>
    );

    // Trigger connect and message
    mockSocket.__emit("connect");
    mockSocket.__emit("message:received", {
      id: "1",
      content: "Hello from server",
      senderId: "user-1",
      roomId: "room-1",
      createdAt: new Date(),
    });

    await waitFor(() => {
      expect(screen.getByText(/Hello from server/)).toBeInTheDocument();
    });
  });

  it("sends message on form submit", async () => {
    render(
      <SocketProvider authToken="test-token">
        <ChatRoom roomId="room-1" />
      </SocketProvider>
    );

    mockSocket.__emit("connect");

    const input = screen.getByPlaceholderText(/type a message/i);
    const submitButton = screen.getByRole("button", { name: /send/i });

    fireEvent.change(input, { target: { value: "Test message" } });
    fireEvent.click(submitButton);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "message:send",
      "Test message",
      expect.any(Function)
    );
  });
});
```

### Integration Testing Helper

```typescript
// __tests__/helpers/socket-test-helper.ts
import { Server, Socket as ServerSocket } from "socket.io";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { createServer, Server as HttpServer } from "http";
import { AddressInfo } from "net";

interface TestContext {
  io: Server;
  httpServer: HttpServer;
  serverUrl: string;
  createClient: (auth?: object) => Promise<ClientSocket>;
  cleanup: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const httpServer = createServer();
  const io = new Server(httpServer);
  const clients: ClientSocket[] = [];

  await new Promise<void>((resolve) => {
    httpServer.listen(() => resolve());
  });

  const port = (httpServer.address() as AddressInfo).port;
  const serverUrl = `http://localhost:${port}`;

  const createClient = async (auth?: object): Promise<ClientSocket> => {
    const client = ioc(serverUrl, { auth });
    clients.push(client);

    await new Promise<void>((resolve) => {
      client.on("connect", resolve);
    });

    return client;
  };

  const cleanup = async (): Promise<void> => {
    clients.forEach((client) => client.disconnect());
    io.close();
    httpServer.close();
  };

  return { io, httpServer, serverUrl, createClient, cleanup };
}

// Utility to wait for event
export function waitForEvent<T>(
  socket: ClientSocket | ServerSocket,
  event: string,
  timeoutMs = 5000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeoutMs);

    socket.once(event, (data: T) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}
```

---

## Section 14: Anti-Patterns and Common Mistakes

### Authentication Anti-Patterns

```typescript
// BAD: Token in query string (visible in logs, history)
const socket = io("http://localhost:3000?token=secret-jwt-token");

// GOOD: Token in auth object
const socket = io("http://localhost:3000", {
  auth: { token: "secret-jwt-token" },
});
```

### Event Listener Memory Leaks

```typescript
// BAD: Adding listeners without cleanup
useEffect(() => {
  socket.on("message", handleMessage);
  // Missing cleanup!
}, []);

// GOOD: Proper cleanup
useEffect(() => {
  socket.on("message", handleMessage);
  return () => {
    socket.off("message", handleMessage);
  };
}, []);

// BAD: Anonymous functions in on() prevent cleanup
socket.on("message", (data) => { /* ... */ }); // Cannot be removed!

// GOOD: Named functions for removal
const handleMessage = (data: Message) => { /* ... */ };
socket.on("message", handleMessage);
socket.off("message", handleMessage);
```

### Binary Data Mistakes

```typescript
// BAD: Sending regular array (treated as JSON, not binary)
const data = [255, 128, 0, 64]; // Regular array
socket.emit("binary", data); // Corrupted!

// GOOD: Use Buffer or TypedArray for binary
const data = new Uint8Array([255, 128, 0, 64]);
socket.emit("binary", data); // Correctly sent as binary
```

### Room Management Errors

```typescript
// BAD: Assuming client knows room membership
// Client-side (rooms are server-only concept!)
socket.rooms; // undefined - clients don't have this

// GOOD: Server tracks and sends room info to client
socket.on("room:join", async (roomId, callback) => {
  await socket.join(roomId);
  callback({ rooms: Array.from(socket.rooms) });
});
```

### Reconnection Handling Mistakes

```typescript
// BAD: Not handling state after reconnection
socket.on("connect", () => {
  console.log("Connected!");
  // Not checking if this is reconnection
});

// GOOD: Differentiate initial connect from reconnection
socket.on("connect", () => {
  if (socket.recovered) {
    // Reconnected and recovered - missed events will arrive
    console.log("Recovered session");
  } else {
    // New session - need to re-sync state
    console.log("New session, fetching state...");
    fetchInitialState();
  }
});
```

### CORS Configuration Errors

```typescript
// BAD: Using wrong property name
const io = new Server(httpServer, {
  cors: {
    origins: ["http://localhost:3000"], // Wrong! Should be 'origin'
  },
});

// GOOD: Correct CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000"], // Correct
    credentials: true,
  },
});
```

### Vue Hot Reload Issues

```typescript
// BAD: Socket persists across hot reloads
export const socket = io("http://localhost:3000"); // Creates duplicate connections on HMR

// GOOD: Handle HMR cleanup
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io("http://localhost:3000");
  }
  return socket;
}

// In Vue, handle hot module replacement
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    socket?.disconnect();
    socket = null;
  });
}
```

### React Child Component Event Listeners

```typescript
// BAD: Registering listeners in child components
function ChatMessage({ roomId }: Props) {
  useEffect(() => {
    // This listener might miss events if component unmounts/remounts
    socket.on("message:received", handleMessage);
    return () => socket.off("message:received", handleMessage);
  }, []);
}

// GOOD: Register listeners in parent, pass data via props
function ChatRoom({ roomId }: Props) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Parent handles all socket events
    socket.on("message:received", (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    return () => socket.off("message:received");
  }, []);

  return (
    <div>
      {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
    </div>
  );
}
```

---

## Section 15: Performance Tuning

### Server Performance Optimizations

```typescript
// Install binary add-ons for performance
// npm install bufferutil utf-8-validate

// server/config/performance.ts
import { Server } from "socket.io";

const PING_INTERVAL_MS = 25000;
const PING_TIMEOUT_MS = 20000;
const MAX_HTTP_BUFFER_SIZE = 1e7; // 10 MB

export function configurePerformance(io: Server): void {
  // Use binary parser for better performance
  // Requires: npm install @socket.io/msgpack-parser
  // io.parser = require("@socket.io/msgpack-parser");

  // Server options
  io.engine.opts.pingInterval = PING_INTERVAL_MS;
  io.engine.opts.pingTimeout = PING_TIMEOUT_MS;
  io.engine.opts.maxHttpBufferSize = MAX_HTTP_BUFFER_SIZE;
}
```

### System-Level Tuning

```bash
# Increase max open files (Linux)
# /etc/security/limits.conf
* soft nofile 65535
* hard nofile 65535

# Increase available local ports
# /etc/sysctl.conf
net.ipv4.ip_local_port_range = 1024 65535
net.core.somaxconn = 65535
```

### Connection Limits Reference

| Limit | Cause | Solution |
|-------|-------|----------|
| ~1000 connections | Max open files limit | Increase `ulimit -n` |
| ~28000 connections | Available local ports | Increase port range |
| ~65535 per IP | Port exhaustion | Add more server IPs |

### Monitoring Connections

```typescript
// server/monitoring/socket-metrics.ts
import { Server } from "socket.io";

interface SocketMetrics {
  totalConnections: number;
  connectionsByNamespace: Record<string, number>;
  connectionsByRoom: Record<string, number>;
}

export function collectMetrics(io: Server): SocketMetrics {
  const metrics: SocketMetrics = {
    totalConnections: 0,
    connectionsByNamespace: {},
    connectionsByRoom: {},
  };

  // Count connections per namespace
  for (const [name, nsp] of io._nsps) {
    const count = nsp.sockets.size;
    metrics.connectionsByNamespace[name] = count;
    metrics.totalConnections += count;
  }

  // Count room memberships
  const mainNsp = io.of("/");
  mainNsp.adapter.rooms.forEach((sockets, room) => {
    // Exclude socket ID rooms (each socket auto-joins room with its ID)
    if (!mainNsp.sockets.has(room)) {
      metrics.connectionsByRoom[room] = sockets.size;
    }
  });

  return metrics;
}

// Expose metrics endpoint
export function setupMetricsEndpoint(io: Server): void {
  setInterval(() => {
    const metrics = collectMetrics(io);
    console.log("Socket.IO Metrics:", JSON.stringify(metrics));
  }, 60000); // Log every minute
}
```

---

## Sources

- [Socket.IO Official Documentation](https://socket.io/docs/v4/)
- [Socket.IO TypeScript Guide](https://socket.io/docs/v4/typescript/)
- [Socket.IO Performance Tuning](https://socket.io/docs/v4/performance-tuning/)
- [Socket.IO Application Structure](https://socket.io/docs/v4/server-application-structure/)
- [Socket.IO Testing Guide](https://socket.io/docs/v4/testing/)
- [Socket.IO Middlewares](https://socket.io/docs/v4/middlewares/)
- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [Socket.IO Rooms](https://socket.io/docs/v3/rooms/)
- [Socket.IO Namespaces](https://socket.io/docs/v4/namespaces/)
- [Socket.IO Connection State Recovery](https://socket.io/docs/v4/connection-state-recovery)
- [Socket.IO Handling Disconnections Tutorial](https://socket.io/docs/v4/tutorial/handling-disconnections)
- [Socket.IO Scaling Guide](https://socket.io/docs/v4/tutorial/step-9)
- [Socket.IO How to Use with React](https://socket.io/how-to/use-with-react)
- [Socket.IO How to Use with Vue](https://socket.io/how-to/use-with-vue)
- [Socket.IO How to Use with JWT](https://socket.io/how-to/use-with-jwt)
- [Socket.IO Client API](https://socket.io/docs/v4/client-api/)
- [Socket.IO Server API](https://socket.io/docs/v4/server-api/)
- [Ably: Scaling Socket.IO](https://ably.com/topic/scaling-socketio)
- [Ably: What is Socket.IO](https://ably.com/topic/socketio)
- [socket.io-react-hook NPM](https://www.npmjs.com/package/socket.io-react-hook)
- [Common Socket.IO Pitfalls](https://moldstud.com/articles/p-common-pitfalls-when-using-socketio-and-how-to-avoid-them-essential-tips-for-developers)
