# Socket.IO Reference

> Decision frameworks, quick reference tables, and checklists for Socket.IO. See [SKILL.md](SKILL.md) for core concepts and red flags, [examples/](examples/) for code examples.

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

## Quick Reference

### Socket.IO Client Options

| Option                 | Type               | Default                                  | Description                                                  |
| ---------------------- | ------------------ | ---------------------------------------- | ------------------------------------------------------------ |
| `auth`                 | object \| function | -                                        | Authentication payload (function called on each connection)  |
| `autoConnect`          | boolean            | true                                     | Connect on instantiation                                     |
| `reconnection`         | boolean            | true                                     | Enable automatic reconnection                                |
| `reconnectionAttempts` | number             | Infinity                                 | Max attempts                                                 |
| `reconnectionDelay`    | number             | 1000                                     | Initial delay (ms)                                           |
| `reconnectionDelayMax` | number             | 5000                                     | Maximum delay (ms)                                           |
| `timeout`              | number             | 20000                                    | Connection timeout (ms)                                      |
| `transports`           | string[]           | ["polling", "websocket", "webtransport"] | Transport priority                                           |
| `withCredentials`      | boolean            | false                                    | Send cookies cross-origin                                    |
| `ackTimeout`           | number             | -                                        | Default acknowledgment timeout (v4.6.0+, requires `retries`) |
| `retries`              | number             | -                                        | Max packet retransmission attempts (v4.6.0+)                 |
| `tryAllTransports`     | boolean            | false                                    | Test all transports if initial fails (v4.8.0+)               |
| `closeOnBeforeunload`  | boolean            | false                                    | Close silently on browser unload (v4.7.1+)                   |

### Socket Events

| Event           | Description                |
| --------------- | -------------------------- |
| `connect`       | Connection established     |
| `disconnect`    | Disconnected (with reason) |
| `connect_error` | Connection error           |

### Manager Events (socket.io)

| Event               | Description                                   |
| ------------------- | --------------------------------------------- |
| `reconnect_attempt` | Attempting to reconnect (with attempt number) |
| `reconnect`         | Successfully reconnected                      |
| `reconnect_error`   | Reconnection attempt failed                   |
| `reconnect_failed`  | All reconnection attempts exhausted           |

### Disconnect Reasons

| Reason                 | Description                       | Will Reconnect |
| ---------------------- | --------------------------------- | -------------- |
| `io server disconnect` | Server called socket.disconnect() | No             |
| `io client disconnect` | Client called socket.disconnect() | No             |
| `ping timeout`         | No pong response from server      | Yes            |
| `transport close`      | Connection closed (network issue) | Yes            |
| `transport error`      | Connection error                  | Yes            |

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
