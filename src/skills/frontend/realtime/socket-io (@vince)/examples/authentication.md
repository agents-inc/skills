# Socket.IO Authentication Examples

> Patterns for authentication, authorization, token handling, and reconnection with credential refresh in Socket.IO v4.x.

---

## Authentication Approaches

| Approach | Security | Use Case |
|----------|----------|----------|
| `auth` option | High | Modern approach - token in handshake |
| First message | Medium | Legacy - token sent after connection |
| Query string | Low (avoid) | Tokens visible in logs |
| Cookies | High | Session-based authentication |

---

## Example 1: Token-Based Authentication

The recommended approach using the `auth` option.

### Constants

```typescript
const AUTH_ERROR_CODES = {
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;

const TOKEN_REFRESH_BUFFER_MS = 60000; // Refresh 1 minute before expiry
```

### Types

```typescript
// types/auth-events.ts

interface AuthServerEvents {
  "auth:success": (data: { userId: string; sessionId: string }) => void;
  "auth:error": (error: AuthError) => void;
  "auth:refresh_required": () => void;
}

interface AuthClientEvents {
  "auth:refresh": (
    token: string,
    callback: (result: RefreshResult) => void
  ) => void;
}

interface AuthError {
  code: string;
  message: string;
}

interface RefreshResult {
  success: boolean;
  error?: string;
}

interface JWTPayload {
  sub: string;
  exp: number;
  iat: number;
}

export type {
  AuthServerEvents,
  AuthClientEvents,
  AuthError,
  RefreshResult,
  JWTPayload,
};
```

### Implementation

```typescript
// lib/socket-auth.ts
import { io, Socket } from "socket.io-client";
import type {
  AuthServerEvents,
  AuthClientEvents,
  AuthError,
  JWTPayload,
} from "../types/auth-events";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";
const RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY_MS = 1000;

type AuthSocket = Socket<AuthServerEvents, AuthClientEvents>;

interface AuthConfig {
  getToken: () => string | null;
  refreshToken: () => Promise<string | null>;
  onAuthError: (error: AuthError) => void;
  onConnect: (data: { userId: string; sessionId: string }) => void;
}

export function createAuthenticatedSocket(config: AuthConfig): AuthSocket {
  const { getToken, refreshToken, onAuthError, onConnect } = config;

  const token = getToken();
  if (!token) {
    throw new Error("No authentication token available");
  }

  const socket: AuthSocket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: RECONNECTION_ATTEMPTS,
    reconnectionDelay: RECONNECTION_DELAY_MS,
    transports: ["websocket", "polling"],
  });

  // Handle successful authentication
  socket.on("auth:success", onConnect);

  // Handle authentication errors
  socket.on("auth:error", (error) => {
    onAuthError(error);
    socket.disconnect();
  });

  // Handle token refresh request from server
  socket.on("auth:refresh_required", async () => {
    const newToken = await refreshToken();
    if (newToken) {
      // Update auth and emit refresh
      socket.auth = { token: newToken };
      socket.emit("auth:refresh", newToken, (result) => {
        if (!result.success) {
          onAuthError({ code: "REFRESH_FAILED", message: result.error ?? "" });
          socket.disconnect();
        }
      });
    } else {
      onAuthError({ code: "REFRESH_FAILED", message: "Could not refresh token" });
      socket.disconnect();
    }
  });

  // Handle reconnection - update token before reconnecting
  socket.io.on("reconnect_attempt", async () => {
    const currentToken = getToken();
    if (currentToken) {
      socket.auth = { token: currentToken };
    }
  });

  return socket;
}

// Parse JWT to check expiration (without verification)
export function parseJWT(token: string): JWTPayload | null {
  try {
    const base64Payload = token.split(".")[1];
    const payload = JSON.parse(atob(base64Payload));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

// Check if token will expire soon
export function isTokenExpiringSoon(
  token: string,
  bufferMs: number = TOKEN_REFRESH_BUFFER_MS
): boolean {
  const payload = parseJWT(token);
  if (!payload) return true;

  const expiresAt = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();

  return now + bufferMs >= expiresAt;
}
```

---

## Example 2: Auth Hook for React

React hook that manages authentication lifecycle.

```typescript
// hooks/use-socket-auth.ts
import { useEffect, useState, useCallback, useRef } from "react";
import type { Socket } from "socket.io-client";
import {
  createAuthenticatedSocket,
  isTokenExpiringSoon,
} from "../lib/socket-auth";
import type { AuthError } from "../types/auth-events";

const TOKEN_CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

interface UseSocketAuthOptions {
  getToken: () => string | null;
  refreshToken: () => Promise<string | null>;
  onAuthError?: (error: AuthError) => void;
}

interface UseSocketAuthResult {
  socket: Socket | null;
  isAuthenticated: boolean;
  isConnecting: boolean;
  error: AuthError | null;
  connect: () => void;
  disconnect: () => void;
}

export function useSocketAuth(options: UseSocketAuthOptions): UseSocketAuthResult {
  const { getToken, refreshToken, onAuthError } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const tokenCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Proactive token refresh
  useEffect(() => {
    if (!isAuthenticated) return;

    tokenCheckInterval.current = setInterval(async () => {
      const token = getToken();
      if (token && isTokenExpiringSoon(token)) {
        const newToken = await refreshToken();
        if (newToken && socket) {
          socket.auth = { token: newToken };
        }
      }
    }, TOKEN_CHECK_INTERVAL_MS);

    return () => {
      if (tokenCheckInterval.current) {
        clearInterval(tokenCheckInterval.current);
      }
    };
  }, [isAuthenticated, socket, getToken, refreshToken]);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) {
      setError({ code: "NO_TOKEN", message: "No authentication token" });
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const newSocket = createAuthenticatedSocket({
        getToken,
        refreshToken,
        onAuthError: (err) => {
          setError(err);
          setIsAuthenticated(false);
          setIsConnecting(false);
          onAuthError?.(err);
        },
        onConnect: () => {
          setIsAuthenticated(true);
          setIsConnecting(false);
        },
      });

      // Handle connection events
      newSocket.on("connect", () => {
        setIsConnecting(false);
      });

      newSocket.on("disconnect", () => {
        setIsAuthenticated(false);
      });

      newSocket.on("connect_error", () => {
        setIsConnecting(false);
      });

      setSocket(newSocket);
      newSocket.connect();
    } catch (err) {
      setError({
        code: "CONNECT_ERROR",
        message: err instanceof Error ? err.message : "Connection failed",
      });
      setIsConnecting(false);
    }
  }, [getToken, refreshToken, onAuthError]);

  const disconnect = useCallback(() => {
    socket?.disconnect();
    setSocket(null);
    setIsAuthenticated(false);
    setError(null);
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socket?.disconnect();
      if (tokenCheckInterval.current) {
        clearInterval(tokenCheckInterval.current);
      }
    };
  }, [socket]);

  return {
    socket,
    isAuthenticated,
    isConnecting,
    error,
    connect,
    disconnect,
  };
}
```

---

## Example 3: Auth Context Provider

Context provider for app-wide socket authentication.

```typescript
// contexts/socket-auth-context.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import { useSocketAuth } from "../hooks/use-socket-auth";

interface SocketAuthContextValue {
  socket: Socket | null;
  isAuthenticated: boolean;
  isConnecting: boolean;
  error: { code: string; message: string } | null;
  connect: () => void;
  disconnect: () => void;
}

const SocketAuthContext = createContext<SocketAuthContextValue | null>(null);

const SOCKET_AUTH_CONTEXT_ERROR =
  "useSocketAuthContext must be used within SocketAuthProvider";

interface SocketAuthProviderProps {
  children: ReactNode;
  getToken: () => string | null;
  refreshToken: () => Promise<string | null>;
  autoConnect?: boolean;
}

export function SocketAuthProvider({
  children,
  getToken,
  refreshToken,
  autoConnect = false,
}: SocketAuthProviderProps): JSX.Element {
  const auth = useSocketAuth({
    getToken,
    refreshToken,
    onAuthError: (error) => {
      console.error("Socket auth error:", error);
    },
  });

  // Auto-connect when token is available
  useEffect(() => {
    if (autoConnect && getToken() && !auth.socket) {
      auth.connect();
    }
  }, [autoConnect, getToken, auth]);

  return (
    <SocketAuthContext.Provider value={auth}>
      {children}
    </SocketAuthContext.Provider>
  );
}

export function useSocketAuthContext(): SocketAuthContextValue {
  const context = useContext(SocketAuthContext);
  if (!context) {
    throw new Error(SOCKET_AUTH_CONTEXT_ERROR);
  }
  return context;
}
```

---

## Example 4: Reconnection with Credential Refresh

Handle reconnection when token changes during disconnect.

### Constants

```typescript
const MAX_RECONNECT_ATTEMPTS = 10;
const AUTH_RETRY_DELAY_MS = 2000;
```

### Implementation

```typescript
// lib/socket-reconnection.ts
import type { Socket } from "socket.io-client";

interface ReconnectionConfig {
  socket: Socket;
  getToken: () => string | null;
  refreshToken: () => Promise<string | null>;
  onReconnected: () => void;
  onReconnectFailed: (reason: string) => void;
}

export function setupReconnectionWithAuth(config: ReconnectionConfig): () => void {
  const {
    socket,
    getToken,
    refreshToken,
    onReconnected,
    onReconnectFailed,
  } = config;

  let reconnectAttempts = 0;

  // Before each reconnection attempt, refresh the token if needed
  const handleReconnectAttempt = async (attempt: number): Promise<void> => {
    reconnectAttempts = attempt;

    // Get current token
    let token = getToken();

    // Try to refresh if token is missing or might be expired
    if (!token) {
      token = await refreshToken();
    }

    if (token) {
      // Update socket auth before reconnection
      socket.auth = { token };
    } else {
      // No valid token - stop reconnection
      socket.io.engine?.close();
      onReconnectFailed("Could not refresh authentication token");
    }
  };

  // Successful reconnection
  const handleReconnect = (): void => {
    reconnectAttempts = 0;
    onReconnected();
  };

  // Failed to reconnect after all attempts
  const handleReconnectFailed = (): void => {
    onReconnectFailed(
      `Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`
    );
  };

  // Connection error during reconnection
  const handleReconnectError = async (error: Error): Promise<void> => {
    // If auth error, try refreshing token
    if (error.message.includes("auth") || error.message.includes("unauthorized")) {
      const newToken = await refreshToken();
      if (newToken) {
        socket.auth = { token: newToken };
        // Let Socket.IO continue with reconnection
      }
    }
  };

  // Attach handlers
  socket.io.on("reconnect_attempt", handleReconnectAttempt);
  socket.io.on("reconnect", handleReconnect);
  socket.io.on("reconnect_failed", handleReconnectFailed);
  socket.io.on("reconnect_error", handleReconnectError);

  // Return cleanup
  return () => {
    socket.io.off("reconnect_attempt", handleReconnectAttempt);
    socket.io.off("reconnect", handleReconnect);
    socket.io.off("reconnect_failed", handleReconnectFailed);
    socket.io.off("reconnect_error", handleReconnectError);
  };
}
```

---

## Example 5: Namespace-Level Authentication

Different authentication per namespace (e.g., admin requires elevated permissions).

```typescript
// lib/namespace-auth.ts
import { Manager, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

interface NamespaceAuthConfig {
  userToken: string;
  adminToken?: string;
}

interface AuthenticatedNamespaces {
  main: Socket;
  admin: Socket | null;
  manager: Manager;
}

export function createAuthenticatedNamespaces(
  config: NamespaceAuthConfig
): AuthenticatedNamespaces {
  const { userToken, adminToken } = config;

  // Create manager with base auth
  const manager = new Manager(SOCKET_URL, {
    autoConnect: false,
  });

  // Main namespace - user-level auth
  const mainSocket = manager.socket("/", {
    auth: { token: userToken },
  });

  // Admin namespace - elevated auth (only if admin token provided)
  let adminSocket: Socket | null = null;
  if (adminToken) {
    adminSocket = manager.socket("/admin", {
      auth: { token: adminToken, elevated: true },
    });
  }

  return {
    main: mainSocket,
    admin: adminSocket,
    manager,
  };
}

// Usage
// const { main, admin, manager } = createAuthenticatedNamespaces({
//   userToken: "user-jwt-token",
//   adminToken: hasAdminAccess ? "admin-jwt-token" : undefined,
// });
//
// manager.connect(); // Connect all namespaces
```

---

## Example 6: Cookie-Based Authentication

For session-based auth where cookies are automatically sent.

```typescript
// lib/socket-cookie-auth.ts
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

export function createCookieAuthSocket(): Socket {
  const socket = io(SOCKET_URL, {
    // Enable credentials for cross-origin cookie sending
    withCredentials: true,
    // Transports that support cookies
    transports: ["websocket", "polling"],
    // No auth option needed - cookies are sent automatically
    autoConnect: false,
  });

  return socket;
}

// Server must be configured with:
// const io = new Server(httpServer, {
//   cors: {
//     origin: "http://your-frontend.com",
//     credentials: true
//   }
// });
```

---

## Example 7: Auth State Machine

Manage complex auth states with clear transitions.

```typescript
// lib/auth-state-machine.ts
import type { Socket } from "socket.io-client";

type AuthState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "authenticated"
  | "refreshing"
  | "error";

type AuthEvent =
  | { type: "CONNECT" }
  | { type: "CONNECTED" }
  | { type: "AUTH_SUCCESS" }
  | { type: "AUTH_ERROR"; error: string }
  | { type: "REFRESH_REQUIRED" }
  | { type: "REFRESH_SUCCESS" }
  | { type: "REFRESH_FAILED"; error: string }
  | { type: "DISCONNECT" }
  | { type: "DISCONNECTED" };

interface AuthStateContext {
  error: string | null;
  userId: string | null;
  sessionId: string | null;
}

type AuthStateListener = (
  state: AuthState,
  context: AuthStateContext
) => void;

export class AuthStateMachine {
  private state: AuthState = "disconnected";
  private context: AuthStateContext = {
    error: null,
    userId: null,
    sessionId: null,
  };
  private listeners: Set<AuthStateListener> = new Set();

  private transition(event: AuthEvent): void {
    const prevState = this.state;

    switch (this.state) {
      case "disconnected":
        if (event.type === "CONNECT") {
          this.state = "connecting";
        }
        break;

      case "connecting":
        if (event.type === "CONNECTED") {
          this.state = "authenticating";
        } else if (event.type === "DISCONNECT" || event.type === "DISCONNECTED") {
          this.state = "disconnected";
        }
        break;

      case "authenticating":
        if (event.type === "AUTH_SUCCESS") {
          this.state = "authenticated";
          this.context.error = null;
        } else if (event.type === "AUTH_ERROR") {
          this.state = "error";
          this.context.error = event.error;
        } else if (event.type === "DISCONNECTED") {
          this.state = "disconnected";
        }
        break;

      case "authenticated":
        if (event.type === "REFRESH_REQUIRED") {
          this.state = "refreshing";
        } else if (event.type === "DISCONNECTED") {
          this.state = "disconnected";
        } else if (event.type === "DISCONNECT") {
          this.state = "disconnected";
        }
        break;

      case "refreshing":
        if (event.type === "REFRESH_SUCCESS") {
          this.state = "authenticated";
        } else if (event.type === "REFRESH_FAILED") {
          this.state = "error";
          this.context.error = event.error;
        } else if (event.type === "DISCONNECTED") {
          this.state = "disconnected";
        }
        break;

      case "error":
        if (event.type === "CONNECT") {
          this.state = "connecting";
          this.context.error = null;
        } else if (event.type === "DISCONNECT") {
          this.state = "disconnected";
        }
        break;
    }

    if (this.state !== prevState) {
      this.notifyListeners();
    }
  }

  send(event: AuthEvent): void {
    this.transition(event);
  }

  getState(): AuthState {
    return this.state;
  }

  getContext(): AuthStateContext {
    return { ...this.context };
  }

  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.state, this.context);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.state, this.context);
    });
  }
}

// Hook socket events to state machine
export function connectStateMachine(
  socket: Socket,
  machine: AuthStateMachine
): () => void {
  const handleConnect = (): void => machine.send({ type: "CONNECTED" });
  const handleDisconnect = (): void => machine.send({ type: "DISCONNECTED" });
  const handleAuthSuccess = (): void => machine.send({ type: "AUTH_SUCCESS" });
  const handleAuthError = (err: { message: string }): void => {
    machine.send({ type: "AUTH_ERROR", error: err.message });
  };
  const handleRefreshRequired = (): void => {
    machine.send({ type: "REFRESH_REQUIRED" });
  };

  socket.on("connect", handleConnect);
  socket.on("disconnect", handleDisconnect);
  socket.on("auth:success", handleAuthSuccess);
  socket.on("auth:error", handleAuthError);
  socket.on("auth:refresh_required", handleRefreshRequired);

  return () => {
    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
    socket.off("auth:success", handleAuthSuccess);
    socket.off("auth:error", handleAuthError);
    socket.off("auth:refresh_required", handleRefreshRequired);
  };
}
```

---

## Anti-Pattern Examples

### WRONG: Token in Query String

```typescript
// WRONG - Token visible in server logs, browser history, and proxy logs
const socket = io(`http://localhost:3001?token=${token}`);
```

### WRONG: No Token Refresh Handling

```typescript
// WRONG - Token expires, connection fails, no recovery
const socket = io(url, {
  auth: { token: getToken() },
});
socket.connect();
// Token expires... connection lost forever
```

### WRONG: Hardcoded Token

```typescript
// WRONG - Stale token after expiration
const socket = io(url, {
  auth: { token: "some-static-token" },
});
```

### CORRECT Versions

```typescript
// CORRECT - Token in auth option
const socket = io(url, {
  auth: { token },
});

// CORRECT - Token refresh before reconnection
socket.io.on("reconnect_attempt", async () => {
  const freshToken = await refreshToken();
  socket.auth = { token: freshToken };
});

// CORRECT - Dynamic token from storage/state
const socket = io(url, {
  auth: () => ({ token: getToken() }), // Function called on each connection
});
```
