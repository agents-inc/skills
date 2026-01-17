# Socket.IO Rooms and Namespaces Examples

> Patterns for rooms (server-side grouping) and namespaces (protocol-level separation) in Socket.IO v4.x.

---

## Understanding Rooms vs Namespaces

**Rooms:** Server-side grouping mechanism. Clients are unaware of rooms - they're purely a server concept for organizing which sockets receive which broadcasts.

**Namespaces:** Protocol-level separation. Clients explicitly connect to namespaces. Each namespace is a distinct communication channel that can have its own event handlers and middleware.

| Feature | Rooms | Namespaces |
|---------|-------|------------|
| Client awareness | No | Yes |
| Join/Leave | Server-side only | Client connects to |
| Use case | Targeted broadcasting | Feature separation |
| Example | Chat rooms | `/chat`, `/admin`, `/notifications` |

---

## Room Patterns (Client Perspective)

### Example 1: Joining and Leaving Rooms

Rooms are joined server-side, but clients can request to join/leave.

#### Constants

```typescript
const JOIN_ROOM_TIMEOUT_MS = 5000;
```

#### Types

```typescript
// types/room-events.ts

interface RoomJoinResult {
  success: boolean;
  roomId: string;
  roomName?: string;
  members?: RoomMember[];
  error?: string;
}

interface RoomLeaveResult {
  success: boolean;
  roomId: string;
}

interface RoomMember {
  userId: string;
  username: string;
  joinedAt: number;
}

interface RoomUpdate {
  roomId: string;
  type: "member_joined" | "member_left";
  member: RoomMember;
  memberCount: number;
}

// Client-to-server events for rooms
interface RoomClientEvents {
  "room:join": (
    roomId: string,
    callback: (result: RoomJoinResult) => void
  ) => void;
  "room:leave": (
    roomId: string,
    callback: (result: RoomLeaveResult) => void
  ) => void;
}

// Server-to-client events for rooms
interface RoomServerEvents {
  "room:joined": (data: RoomJoinResult) => void;
  "room:left": (data: { roomId: string }) => void;
  "room:update": (update: RoomUpdate) => void;
  "room:message": (message: RoomMessage) => void;
}

interface RoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
}

export type {
  RoomJoinResult,
  RoomLeaveResult,
  RoomMember,
  RoomUpdate,
  RoomMessage,
  RoomClientEvents,
  RoomServerEvents,
};
```

#### Implementation

```typescript
// lib/room-manager.ts
import type { Socket } from "socket.io-client";
import type {
  RoomJoinResult,
  RoomLeaveResult,
  RoomMember,
  RoomUpdate,
  RoomMessage,
} from "../types/room-events";

interface RoomState {
  currentRooms: Map<string, RoomMember[]>;
}

type RoomEventHandler = {
  onJoined?: (result: RoomJoinResult) => void;
  onLeft?: (roomId: string) => void;
  onUpdate?: (update: RoomUpdate) => void;
  onMessage?: (message: RoomMessage) => void;
};

export class RoomManager {
  private socket: Socket;
  private state: RoomState = {
    currentRooms: new Map(),
  };

  constructor(socket: Socket) {
    this.socket = socket;
  }

  async joinRoom(roomId: string): Promise<RoomJoinResult> {
    if (!this.socket.connected) {
      return {
        success: false,
        roomId,
        error: "Not connected",
      };
    }

    try {
      const result = await this.socket
        .timeout(JOIN_ROOM_TIMEOUT_MS)
        .emitWithAck("room:join", roomId);

      if (result.success && result.members) {
        this.state.currentRooms.set(roomId, result.members);
      }

      return result as RoomJoinResult;
    } catch (error) {
      return {
        success: false,
        roomId,
        error: error instanceof Error ? error.message : "Join failed",
      };
    }
  }

  async leaveRoom(roomId: string): Promise<RoomLeaveResult> {
    if (!this.socket.connected) {
      return { success: false, roomId };
    }

    try {
      const result = await this.socket
        .timeout(JOIN_ROOM_TIMEOUT_MS)
        .emitWithAck("room:leave", roomId);

      if (result.success) {
        this.state.currentRooms.delete(roomId);
      }

      return result as RoomLeaveResult;
    } catch {
      return { success: false, roomId };
    }
  }

  leaveAllRooms(): void {
    for (const roomId of this.state.currentRooms.keys()) {
      this.socket.emit("room:leave", roomId);
    }
    this.state.currentRooms.clear();
  }

  isInRoom(roomId: string): boolean {
    return this.state.currentRooms.has(roomId);
  }

  getRoomMembers(roomId: string): RoomMember[] {
    return this.state.currentRooms.get(roomId) ?? [];
  }

  getCurrentRooms(): string[] {
    return Array.from(this.state.currentRooms.keys());
  }

  setupEventHandlers(handlers: RoomEventHandler): () => void {
    const handleUpdate = (update: RoomUpdate): void => {
      // Update local member list
      const members = this.state.currentRooms.get(update.roomId);
      if (members) {
        if (update.type === "member_joined") {
          members.push(update.member);
        } else {
          const index = members.findIndex(
            (m) => m.userId === update.member.userId
          );
          if (index !== -1) {
            members.splice(index, 1);
          }
        }
      }
      handlers.onUpdate?.(update);
    };

    const handleMessage = (message: RoomMessage): void => {
      handlers.onMessage?.(message);
    };

    this.socket.on("room:update", handleUpdate);
    this.socket.on("room:message", handleMessage);

    return () => {
      this.socket.off("room:update", handleUpdate);
      this.socket.off("room:message", handleMessage);
    };
  }
}
```

---

### Example 2: Room Hook for React

React hook for managing room membership.

```typescript
// hooks/use-room.ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import type {
  RoomJoinResult,
  RoomMember,
  RoomUpdate,
  RoomMessage,
} from "../types/room-events";
import { RoomManager } from "../lib/room-manager";

interface UseRoomOptions {
  socket: Socket | null;
  roomId: string;
  autoJoin?: boolean;
  onMessage?: (message: RoomMessage) => void;
  onMemberUpdate?: (update: RoomUpdate) => void;
}

interface UseRoomResult {
  isJoined: boolean;
  isJoining: boolean;
  members: RoomMember[];
  error: string | null;
  join: () => Promise<void>;
  leave: () => Promise<void>;
  sendMessage: (content: string) => void;
}

export function useRoom(options: UseRoomOptions): UseRoomResult {
  const { socket, roomId, autoJoin = false, onMessage, onMemberUpdate } = options;

  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const managerRef = useRef<RoomManager | null>(null);

  // Initialize room manager
  useEffect(() => {
    if (!socket) return;

    managerRef.current = new RoomManager(socket);

    const cleanup = managerRef.current.setupEventHandlers({
      onUpdate: (update) => {
        if (update.roomId === roomId) {
          setMembers(managerRef.current?.getRoomMembers(roomId) ?? []);
          onMemberUpdate?.(update);
        }
      },
      onMessage: (message) => {
        if (message.roomId === roomId) {
          onMessage?.(message);
        }
      },
    });

    return () => {
      cleanup();
      managerRef.current = null;
    };
  }, [socket, roomId, onMessage, onMemberUpdate]);

  // Auto-join if enabled
  useEffect(() => {
    if (autoJoin && socket?.connected && managerRef.current && !isJoined) {
      join();
    }
  }, [autoJoin, socket?.connected, isJoined]);

  // Leave room on unmount or roomId change
  useEffect(() => {
    return () => {
      if (isJoined && managerRef.current) {
        managerRef.current.leaveRoom(roomId);
      }
    };
  }, [roomId, isJoined]);

  const join = useCallback(async () => {
    if (!managerRef.current || isJoined || isJoining) return;

    setIsJoining(true);
    setError(null);

    const result = await managerRef.current.joinRoom(roomId);

    setIsJoining(false);
    if (result.success) {
      setIsJoined(true);
      setMembers(result.members ?? []);
    } else {
      setError(result.error ?? "Failed to join room");
    }
  }, [roomId, isJoined, isJoining]);

  const leave = useCallback(async () => {
    if (!managerRef.current || !isJoined) return;

    await managerRef.current.leaveRoom(roomId);
    setIsJoined(false);
    setMembers([]);
  }, [roomId, isJoined]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!socket?.connected || !isJoined) return;
      socket.emit("room:message", { roomId, content });
    },
    [socket, roomId, isJoined]
  );

  return {
    isJoined,
    isJoining,
    members,
    error,
    join,
    leave,
    sendMessage,
  };
}
```

---

### Example 3: Multi-Room Chat Component

Component that supports joining multiple rooms simultaneously.

```typescript
// components/multi-room-chat.tsx
import { useState, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { RoomMessage } from "../types/room-events";
import { useRoom } from "../hooks/use-room";

interface MultiRoomChatProps {
  socket: Socket | null;
  availableRooms: Array<{ id: string; name: string }>;
  className?: string;
}

export function MultiRoomChat({
  socket,
  availableRooms,
  className,
}: MultiRoomChatProps): JSX.Element {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Map<string, RoomMessage[]>>(
    new Map()
  );

  const handleMessage = useCallback((message: RoomMessage) => {
    setMessages((prev) => {
      const next = new Map(prev);
      const roomMessages = next.get(message.roomId) ?? [];
      next.set(message.roomId, [...roomMessages, message]);
      return next;
    });
  }, []);

  const activeRoom = useRoom({
    socket,
    roomId: activeRoomId ?? "",
    autoJoin: true,
    onMessage: handleMessage,
  });

  const handleRoomSelect = useCallback(
    async (roomId: string) => {
      if (activeRoomId) {
        await activeRoom.leave();
      }
      setActiveRoomId(roomId);
    },
    [activeRoomId, activeRoom]
  );

  return (
    <div className={className}>
      <div data-role="room-list">
        {availableRooms.map((room) => (
          <button
            key={room.id}
            data-active={room.id === activeRoomId}
            onClick={() => handleRoomSelect(room.id)}
          >
            {room.name}
          </button>
        ))}
      </div>

      {activeRoomId && (
        <div data-role="chat-area">
          <div data-role="members">
            {activeRoom.members.map((member) => (
              <span key={member.userId}>{member.username}</span>
            ))}
          </div>

          <div data-role="messages">
            {(messages.get(activeRoomId) ?? []).map((msg) => (
              <div key={msg.id}>
                <strong>{msg.senderName}:</strong> {msg.content}
              </div>
            ))}
          </div>

          <MessageInput
            onSend={activeRoom.sendMessage}
            disabled={!activeRoom.isJoined}
          />
        </div>
      )}
    </div>
  );
}

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

function MessageInput({ onSend, disabled }: MessageInputProps): JSX.Element {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="Type a message..."
      />
      <button type="submit" disabled={disabled || !value.trim()}>
        Send
      </button>
    </form>
  );
}
```

---

## Namespace Patterns

### Example 4: Multiple Namespaces

Connect to multiple namespaces for feature separation.

#### Constants

```typescript
const NAMESPACE_RECONNECTION_DELAY_MS = 1000;
const NAMESPACE_RECONNECTION_DELAY_MAX_MS = 5000;
```

#### Types

```typescript
// types/namespace-events.ts

// Chat namespace events
interface ChatServerEvents {
  "message": (message: ChatMessage) => void;
  "typing": (data: { userId: string; username: string }) => void;
}

interface ChatClientEvents {
  "send": (content: string, roomId: string) => void;
  "typing": (roomId: string) => void;
}

// Notification namespace events
interface NotificationServerEvents {
  "notification": (notification: AppNotification) => void;
  "notification:read": (notificationId: string) => void;
}

interface NotificationClientEvents {
  "markRead": (notificationId: string) => void;
  "markAllRead": () => void;
}

// Admin namespace events
interface AdminServerEvents {
  "stats": (stats: SystemStats) => void;
  "alert": (alert: SystemAlert) => void;
}

interface AdminClientEvents {
  "requestStats": () => void;
  "clearAlert": (alertId: string) => void;
}

interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  roomId: string;
  timestamp: number;
}

interface AppNotification {
  id: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
}

interface SystemStats {
  connectedUsers: number;
  activeRooms: number;
  messageRate: number;
}

interface SystemAlert {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: number;
}

export type {
  ChatServerEvents,
  ChatClientEvents,
  NotificationServerEvents,
  NotificationClientEvents,
  AdminServerEvents,
  AdminClientEvents,
  ChatMessage,
  AppNotification,
  SystemStats,
  SystemAlert,
};
```

#### Implementation

```typescript
// lib/namespace-sockets.ts
import { Manager, Socket } from "socket.io-client";
import type {
  ChatServerEvents,
  ChatClientEvents,
  NotificationServerEvents,
  NotificationClientEvents,
  AdminServerEvents,
  AdminClientEvents,
} from "../types/namespace-events";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

// Typed socket types
type ChatSocket = Socket<ChatServerEvents, ChatClientEvents>;
type NotificationSocket = Socket<NotificationServerEvents, NotificationClientEvents>;
type AdminSocket = Socket<AdminServerEvents, AdminClientEvents>;

// Single Manager - shares one connection
let manager: Manager | null = null;

// Namespace sockets
let chatSocket: ChatSocket | null = null;
let notificationSocket: NotificationSocket | null = null;
let adminSocket: AdminSocket | null = null;

interface NamespaceOptions {
  token: string;
  onConnectionError?: (namespace: string, error: Error) => void;
}

export function initializeNamespaces(options: NamespaceOptions): void {
  const { token, onConnectionError } = options;

  // Create manager if not exists
  if (!manager) {
    manager = new Manager(SOCKET_URL, {
      autoConnect: false,
      reconnectionDelay: NAMESPACE_RECONNECTION_DELAY_MS,
      reconnectionDelayMax: NAMESPACE_RECONNECTION_DELAY_MAX_MS,
    });
  }

  // Set auth
  manager.opts.auth = { token };

  // Create namespace sockets
  chatSocket = manager.socket("/chat") as ChatSocket;
  notificationSocket = manager.socket("/notifications") as NotificationSocket;
  adminSocket = manager.socket("/admin") as AdminSocket;

  // Setup error handlers
  const sockets = [
    { socket: chatSocket, name: "chat" },
    { socket: notificationSocket, name: "notifications" },
    { socket: adminSocket, name: "admin" },
  ];

  sockets.forEach(({ socket, name }) => {
    socket.on("connect_error", (error) => {
      console.error(`[${name}] Connection error:`, error.message);
      onConnectionError?.(name, error);
    });
  });
}

export function connectNamespace(namespace: "chat" | "notifications" | "admin"): void {
  const socket = getNamespaceSocket(namespace);
  socket?.connect();
}

export function disconnectNamespace(namespace: "chat" | "notifications" | "admin"): void {
  const socket = getNamespaceSocket(namespace);
  socket?.disconnect();
}

export function connectAllNamespaces(): void {
  manager?.connect();
}

export function disconnectAllNamespaces(): void {
  manager?.disconnect();
}

function getNamespaceSocket(
  namespace: "chat" | "notifications" | "admin"
): Socket | null {
  switch (namespace) {
    case "chat":
      return chatSocket;
    case "notifications":
      return notificationSocket;
    case "admin":
      return adminSocket;
    default:
      return null;
  }
}

export function getChatSocket(): ChatSocket {
  if (!chatSocket) throw new Error("Chat socket not initialized");
  return chatSocket;
}

export function getNotificationSocket(): NotificationSocket {
  if (!notificationSocket) throw new Error("Notification socket not initialized");
  return notificationSocket;
}

export function getAdminSocket(): AdminSocket {
  if (!adminSocket) throw new Error("Admin socket not initialized");
  return adminSocket;
}

export function cleanupNamespaces(): void {
  chatSocket?.disconnect();
  notificationSocket?.disconnect();
  adminSocket?.disconnect();
  manager?.disconnect();

  chatSocket = null;
  notificationSocket = null;
  adminSocket = null;
  manager = null;
}
```

---

### Example 5: Namespace Hook

React hook for namespace-specific connections.

```typescript
// hooks/use-namespace.ts
import { useEffect, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { Manager } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

interface UseNamespaceOptions {
  namespace: string;
  token: string;
  autoConnect?: boolean;
}

interface UseNamespaceResult<S, C> {
  socket: Socket<S, C> | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

// Singleton manager for connection sharing
let sharedManager: Manager | null = null;

function getManager(token: string): Manager {
  if (!sharedManager) {
    sharedManager = new Manager(SOCKET_URL, {
      autoConnect: false,
    });
  }
  sharedManager.opts.auth = { token };
  return sharedManager;
}

export function useNamespace<
  ServerEvents = Record<string, unknown>,
  ClientEvents = Record<string, unknown>
>(
  options: UseNamespaceOptions
): UseNamespaceResult<ServerEvents, ClientEvents> {
  const { namespace, token, autoConnect = true } = options;

  const [socket, setSocket] = useState<Socket<ServerEvents, ClientEvents> | null>(
    null
  );
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const manager = getManager(token);
    const nsSocket = manager.socket(namespace) as Socket<ServerEvents, ClientEvents>;
    setSocket(nsSocket);

    const handleConnect = (): void => setIsConnected(true);
    const handleDisconnect = (): void => setIsConnected(false);

    nsSocket.on("connect", handleConnect);
    nsSocket.on("disconnect", handleDisconnect);

    if (autoConnect) {
      nsSocket.connect();
    }

    return () => {
      nsSocket.off("connect", handleConnect);
      nsSocket.off("disconnect", handleDisconnect);
      nsSocket.disconnect();
    };
  }, [namespace, token, autoConnect]);

  const connect = useCallback(() => socket?.connect(), [socket]);
  const disconnect = useCallback(() => socket?.disconnect(), [socket]);

  return { socket, isConnected, connect, disconnect };
}
```

---

### Example 6: Conditional Namespace Access

Connect to admin namespace only for authorized users.

```typescript
// hooks/use-admin-namespace.ts
import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type {
  AdminServerEvents,
  AdminClientEvents,
  SystemStats,
  SystemAlert,
} from "../types/namespace-events";
import { useNamespace } from "./use-namespace";

interface UseAdminNamespaceOptions {
  token: string;
  isAdmin: boolean;
  onAlert?: (alert: SystemAlert) => void;
}

interface UseAdminNamespaceResult {
  isConnected: boolean;
  stats: SystemStats | null;
  requestStats: () => void;
}

const INITIAL_STATS: SystemStats | null = null;

export function useAdminNamespace(
  options: UseAdminNamespaceOptions
): UseAdminNamespaceResult {
  const { token, isAdmin, onAlert } = options;

  const [stats, setStats] = useState<SystemStats | null>(INITIAL_STATS);

  // Only connect if user is admin
  const { socket, isConnected } = useNamespace<
    AdminServerEvents,
    AdminClientEvents
  >({
    namespace: "/admin",
    token,
    autoConnect: isAdmin,
  });

  // Listen for stats updates
  useEffect(() => {
    if (!socket) return;

    const handleStats = (data: SystemStats): void => {
      setStats(data);
    };

    const handleAlert = (alert: SystemAlert): void => {
      onAlert?.(alert);
    };

    socket.on("stats", handleStats);
    socket.on("alert", handleAlert);

    return () => {
      socket.off("stats", handleStats);
      socket.off("alert", handleAlert);
    };
  }, [socket, onAlert]);

  const requestStats = (): void => {
    socket?.emit("requestStats");
  };

  return {
    isConnected: isAdmin && isConnected,
    stats,
    requestStats,
  };
}
```

---

## Room + Namespace Combined

### Example 7: Chat Application with Rooms per Namespace

```typescript
// lib/chat-namespaces.ts
import type { Socket } from "socket.io-client";
import type {
  ChatServerEvents,
  ChatClientEvents,
  ChatMessage,
} from "../types/namespace-events";

interface ChatRoom {
  id: string;
  name: string;
  memberCount: number;
}

interface ChatNamespaceState {
  rooms: ChatRoom[];
  currentRoomId: string | null;
  messages: Map<string, ChatMessage[]>;
}

export class ChatNamespaceManager {
  private socket: Socket<ChatServerEvents, ChatClientEvents>;
  private state: ChatNamespaceState = {
    rooms: [],
    currentRoomId: null,
    messages: new Map(),
  };

  constructor(socket: Socket<ChatServerEvents, ChatClientEvents>) {
    this.socket = socket;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.socket.on("message", (message) => {
      const messages = this.state.messages.get(message.roomId) ?? [];
      messages.push(message);
      this.state.messages.set(message.roomId, messages);
    });
  }

  async joinRoom(roomId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.socket.emit("room:join", roomId, (result) => {
        if (result.success) {
          this.state.currentRoomId = roomId;
        }
        resolve(result.success);
      });
    });
  }

  sendMessage(content: string): void {
    if (!this.state.currentRoomId) return;
    this.socket.emit("send", content, this.state.currentRoomId);
  }

  getMessages(roomId: string): ChatMessage[] {
    return this.state.messages.get(roomId) ?? [];
  }

  getCurrentRoom(): string | null {
    return this.state.currentRoomId;
  }

  cleanup(): void {
    this.socket.off("message");
  }
}
```
