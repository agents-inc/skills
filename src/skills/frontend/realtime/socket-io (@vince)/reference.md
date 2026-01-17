# Socket.IO Reference

> Decision frameworks, anti-patterns, and red flags for Socket.IO real-time communication. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Socket.IO vs Native WebSocket

```
Need real-time bidirectional communication?
├─ YES → Need rooms/namespaces for broadcast grouping?
│   ├─ YES → Socket.IO ✓
│   └─ NO → Need automatic reconnection out-of-the-box?
│       ├─ YES → Socket.IO ✓
│       └─ NO → Need acknowledgments (delivery confirmation)?
│           ├─ YES → Socket.IO ✓
│           └─ NO → Need to work in restrictive networks (fallback transports)?
│               ├─ YES → Socket.IO ✓
│               └─ NO → Native WebSocket (simpler, smaller bundle)
└─ NO → Use HTTP REST or Server-Sent Events
```

### Namespace vs Room Decision

```
Need to separate communication channels?
├─ Is it a distinct feature area (chat, admin, notifications)?
│   └─ YES → Use Namespaces
│       - Clients explicitly connect
│       - Can have different middleware/auth
│       - Example: /chat, /admin, /game
├─ Is it for grouping users within a feature?
│   └─ YES → Use Rooms (within a namespace)
│       - Server-side only
│       - For targeted broadcasting
│       - Example: chat rooms, game lobbies
└─ Single unified communication
    └─ Use default namespace ("/")
```

### Authentication Strategy

```
Implementing Socket.IO authentication?
├─ Need to pass token on initial connection?
│   └─ YES → Use `auth` option in io()
│       - Token sent in handshake
│       - Not visible in URL/logs
│       - Server validates in middleware
├─ Using session-based auth with cookies?
│   └─ YES → Set `withCredentials: true`
│       - Cookies sent automatically
│       - Server must allow credentials in CORS
├─ Need to authenticate per-namespace?
│   └─ YES → Use namespace middleware
│       - Different auth per namespace
│       - Example: basic auth for /chat, elevated for /admin
└─ NEVER put tokens in query strings (security risk)
```

### Connection State Recovery Decision

```
Implementing reconnection handling?
├─ Using Socket.IO v4.6.0+?
│   ├─ YES → Check socket.recovered after connect
│   │   ├─ true → Missed events delivered automatically
│   │   └─ false → Need full state refresh
│   └─ NO → Always do full state refresh on reconnect
├─ Have long-running sessions?
│   └─ YES → Implement message queuing
│       - Queue during disconnect
│       - Flush on reconnect
└─ Need exactly-once delivery?
    └─ YES → Implement acknowledgments + idempotency
```

### Binary Data Strategy

```
Sending binary data with Socket.IO?
├─ Small binary payloads?
│   └─ YES → Send directly in event
│       - Socket.IO handles serialization
│       - ArrayBuffer, Buffer, Blob all supported
├─ Large files?
│   └─ YES → Chunk the uploads
│       - Send metadata first
│       - Stream chunks with progress
│       - Acknowledge each chunk
├─ Frequent small updates (cursor, position)?
│   └─ YES → Use volatile events
│       - socket.volatile.emit()
│       - OK if some are dropped
└─ Mixed binary + JSON?
    └─ YES → Supported automatically
        - Objects with binary fields work
        - Socket.IO parses correctly
```

---

## RED FLAGS

### High Priority Issues

- **Token in query string** - Security risk: visible in server logs, browser history, proxy logs
- **No event type definitions** - Runtime errors, impossible to refactor safely, no autocomplete
- **Missing socket.off() cleanup** - Memory leaks, duplicate handlers, zombie listeners
- **No connection error handling** - Users see blank screens, no feedback on failures
- **Sending without connected check** - Silent failures when socket is disconnected
- **Using socket.id as user identifier** - Changes on every reconnection, not persistent

### Medium Priority Issues

- **No message queuing during disconnect** - Messages lost during brief disconnections
- **Immediate reconnection without backoff** - Server overwhelm after outages
- **Not distinguishing recovered vs new session** - Unnecessary state refetch
- **Single global socket without cleanup** - Memory leaks across page navigations
- **Not handling auth:refresh_required** - Users forced to re-login unnecessarily

### Common Mistakes

- **Parsing JSON when Socket.IO does it automatically** - Double-parsing errors
- **Using first message for auth when auth option exists** - Race conditions possible
- **Not updating auth before reconnection** - Reconnects with expired token
- **Forgetting to call socket.connect()** - Socket created but never connects
- **Calling socket.emit() in useEffect without cleanup** - Race conditions on unmount

### Gotchas & Edge Cases

- **Socket.IO is NOT compatible with plain WebSocket** - Different protocol
- **socket.id changes on every reconnection** - Don't use as permanent identifier
- **Namespaces share one WebSocket connection** - Efficient, but failure affects all
- **Rooms are server-side only** - Client never knows which room it's in
- **Volatile events may be dropped** - Only use for expendable data
- **Manager reconnection vs Socket reconnection** - Manager handles transport, Socket handles namespace
- **auth option can be a function** - Called on each connection attempt
- **Connection state recovery has 2-minute default** - Server-configurable

---

## Anti-Patterns

### Token in Query String

Tokens in URLs are logged by servers, cached by browsers, and visible to proxies.

```typescript
// WRONG - Token visible everywhere
const socket = io(`http://localhost:3001?token=${token}`);

// CORRECT - Token in auth object (not logged)
const socket = io("http://localhost:3001", {
  auth: { token },
});
```

### Missing Type Definitions

Without types, message handling is error-prone and impossible to refactor safely.

```typescript
// WRONG - No types, typos not caught
socket.on("mesage", (data) => {
  // Typo! Event never fires
  console.log(data.contnet); // Another typo
});

// CORRECT - Typed events catch errors at compile time
interface ServerEvents {
  "message": (data: { content: string }) => void;
}

const socket: Socket<ServerEvents> = io(url);
socket.on("message", (data) => {
  console.log(data.content); // Type-safe
});
```

### No Event Listener Cleanup

Failing to remove listeners causes memory leaks and duplicate handlers.

```typescript
// WRONG - Memory leak, handlers accumulate
useEffect(() => {
  socket.on("message", handleMessage);
  // Missing cleanup!
}, []);

// CORRECT - Cleanup on unmount
useEffect(() => {
  socket.on("message", handleMessage);
  return () => {
    socket.off("message", handleMessage);
  };
}, []);
```

### No Connection State Handling

Users need feedback when connection fails or reconnects.

```typescript
// WRONG - No feedback on connection issues
const socket = io(url);
// User has no idea if connected or not

// CORRECT - Track and display connection state
const [isConnected, setIsConnected] = useState(false);

useEffect(() => {
  socket.on("connect", () => setIsConnected(true));
  socket.on("disconnect", () => setIsConnected(false));
  socket.on("connect_error", (error) => {
    console.error("Connection failed:", error);
    // Show error to user
  });

  return () => {
    socket.off("connect");
    socket.off("disconnect");
    socket.off("connect_error");
  };
}, []);
```

### Using socket.id as User Identifier

The socket.id changes on every reconnection - it's not a stable identifier.

```typescript
// WRONG - ID changes on reconnect
const userId = socket.id; // This will change!

// CORRECT - Use server-provided user ID
socket.on("auth:success", ({ userId }) => {
  setUserId(userId); // Stable across reconnects
});
```

### Sending Without Connection Check

Emitting to a disconnected socket fails silently.

```typescript
// WRONG - May fail silently
function sendMessage(content: string) {
  socket.emit("message", content);
}

// CORRECT - Check connection and queue
function sendMessage(content: string) {
  if (socket.connected) {
    socket.emit("message", content);
  } else {
    messageQueue.push(content);
  }
}
```

### Not Updating Auth on Reconnection

Reconnecting with an expired token will fail authentication.

```typescript
// WRONG - Uses stale token
const socket = io(url, {
  auth: { token: getToken() }, // Called once, never updated
});

// CORRECT - Function called on each connection
const socket = io(url, {
  auth: () => ({ token: getToken() }), // Fresh token each time
});

// OR update before reconnection
socket.io.on("reconnect_attempt", () => {
  socket.auth = { token: getToken() };
});
```

### Magic Numbers

Hardcoded values make configuration unclear and hard to maintain.

```typescript
// WRONG - What do these mean?
const socket = io(url, {
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  timeout: 10000,
});

// CORRECT - Named constants
const RECONNECTION_DELAY_MS = 1000;
const RECONNECTION_DELAY_MAX_MS = 5000;
const MAX_RECONNECTION_ATTEMPTS = 10;
const REQUEST_TIMEOUT_MS = 10000;

const socket = io(url, {
  reconnectionDelay: RECONNECTION_DELAY_MS,
  reconnectionDelayMax: RECONNECTION_DELAY_MAX_MS,
  reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
  timeout: REQUEST_TIMEOUT_MS,
});
```

---

## Quick Reference

### Socket.IO Client Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `auth` | object \| function | - | Authentication payload |
| `autoConnect` | boolean | true | Connect on instantiation |
| `reconnection` | boolean | true | Enable automatic reconnection |
| `reconnectionAttempts` | number | Infinity | Max attempts |
| `reconnectionDelay` | number | 1000 | Initial delay (ms) |
| `reconnectionDelayMax` | number | 5000 | Maximum delay (ms) |
| `timeout` | number | 20000 | Connection timeout (ms) |
| `transports` | string[] | ["polling", "websocket"] | Transport priority |
| `withCredentials` | boolean | false | Send cookies cross-origin |

### Socket Events

| Event | Description |
|-------|-------------|
| `connect` | Connection established |
| `disconnect` | Disconnected (with reason) |
| `connect_error` | Connection error |

### Manager Events (socket.io)

| Event | Description |
|-------|-------------|
| `reconnect_attempt` | Attempting to reconnect (with attempt number) |
| `reconnect` | Successfully reconnected |
| `reconnect_error` | Reconnection attempt failed |
| `reconnect_failed` | All reconnection attempts exhausted |

### Disconnect Reasons

| Reason | Description | Will Reconnect |
|--------|-------------|----------------|
| `io server disconnect` | Server called socket.disconnect() | No |
| `io client disconnect` | Client called socket.disconnect() | No |
| `ping timeout` | No pong response from server | Yes |
| `transport close` | Connection closed (network issue) | Yes |
| `transport error` | Connection error | Yes |

### Connection Checklist

- [ ] Types defined for ServerToClientEvents and ClientToServerEvents
- [ ] Token in `auth` option (NOT query string)
- [ ] Named constants for all timing values
- [ ] Connection state tracking with UI feedback
- [ ] Error handling for connect_error
- [ ] Event listener cleanup in useEffect return
- [ ] Check socket.connected before emitting
- [ ] Message queue for offline support
- [ ] Token refresh before reconnection
- [ ] Cleanup on component unmount

### Security Checklist

- [ ] Uses HTTPS/WSS in production
- [ ] Token in auth option (not query string)
- [ ] Token refresh mechanism implemented
- [ ] No sensitive data in events without validation
- [ ] CORS properly configured on server
- [ ] Rate limiting on server side

### Performance Checklist

- [ ] Single socket instance shared across app
- [ ] Volatile events for expendable data
- [ ] Binary data chunked for large files
- [ ] Event listeners removed when not needed
- [ ] Connection state recovery utilized (v4.6.0+)
- [ ] Namespaces share single connection
