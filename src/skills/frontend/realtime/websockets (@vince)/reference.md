# WebSocket Reference

> Decision frameworks, anti-patterns, and red flags for WebSocket real-time communication. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use WebSocket vs Alternatives

```
Need real-time communication?
├─ YES → Is it bidirectional (client sends to server)?
│   ├─ YES → Is low latency critical?
│   │   ├─ YES → WebSocket ✓
│   │   └─ NO → WebSocket or polling (depending on complexity)
│   └─ NO → Server-Sent Events (SSE) for one-way server→client
└─ NO → Use HTTP REST for request-response patterns
```

### Native WebSocket vs Libraries

```
Building WebSocket features?
├─ Need Socket.IO-specific features (rooms, namespaces, auto-transport)?
│   └─ YES → Use Socket.IO (defer to socket-io skill)
├─ Need simple bidirectional communication?
│   └─ YES → Native WebSocket API ✓
├─ Need to support legacy browsers without WebSocket?
│   └─ YES → Use library with fallback transports
└─ Default → Native WebSocket API for simplicity
```

### Connection Management Strategy

```
Managing WebSocket connections?
├─ Multiple components need same connection?
│   └─ YES → Use Context Provider (Pattern 10)
├─ Single component needs connection?
│   └─ YES → Use custom hook in component
├─ Complex state transitions?
│   └─ YES → Use state machine pattern (Pattern 11)
└─ Simple connection → Basic WebSocket class
```

### Message Serialization Strategy

```
Choosing message format?
├─ Need human-readable debugging?
│   └─ YES → JSON with discriminated unions
├─ Bandwidth/performance critical?
│   └─ YES → Binary with ArrayBuffer (Pattern 6)
├─ Mixed text and binary data?
│   └─ YES → JSON for control, binary for data
└─ Default → JSON with discriminated unions
```

### Reconnection Strategy

```
Implementing reconnection?
├─ Server might be temporarily down?
│   └─ YES → Exponential backoff with jitter ✓
├─ Connection drops are expected?
│   └─ YES → Message queuing + flush on reconnect ✓
├─ Need to limit server load after outage?
│   └─ YES → Max retry limit + backoff cap ✓
└─ All WebSocket connections → Always implement reconnection
```

### Binary Data Strategy

```
Handling binary data?
├─ Need synchronous processing?
│   └─ YES → binaryType = 'arraybuffer' ✓
├─ Working with files/blobs?
│   └─ YES → Consider chunked uploads (Pattern 12)
├─ Need protocol with headers?
│   └─ YES → DataView for parsing binary headers
└─ Default → binaryType = 'arraybuffer' for performance
```

---

## RED FLAGS

### High Priority Issues

- **No reconnection logic** - Connection drops are inevitable, users will see permanent disconnection
- **Immediate reconnection without backoff** - Causes thundering herd, overwhelming server during recovery
- **No heartbeat/ping-pong** - Dead connections go undetected, users think they're connected when they're not
- **Untyped message handling** - Runtime errors when message shapes change, impossible to refactor safely
- **Sending messages without readyState check** - Messages silently fail when connection is not open
- **Missing cleanup on component unmount** - Memory leaks, zombie connections, duplicate handlers

### Medium Priority Issues

- **No message queuing during disconnection** - Messages lost during brief disconnects
- **Token in WebSocket URL query string** - Security risk: token visible in server logs
- **Using Blob binaryType for frequent binary messages** - Performance penalty from async processing
- **Not handling all close event codes** - Missing opportunities for smart reconnection decisions
- **Single retry interval without randomization** - All clients reconnect at same time after outage

### Common Mistakes

- **Parsing JSON without try-catch** - Malformed messages crash the handler
- **Not resetting retry count on successful connection** - Retry limits hit prematurely
- **Forgetting to clear intervals/timeouts on close** - Memory leaks, phantom operations
- **Sending before onopen fires** - Messages are lost or cause errors
- **Not distinguishing intentional vs unintentional close** - Reconnecting when user explicitly disconnected

### Gotchas & Edge Cases

- **Close code 1000 is normal closure** - Don't reconnect for code 1000
- **onerror is always followed by onclose** - Don't duplicate error handling logic
- **WebSocket doesn't support custom HTTP headers** - Use query string or first message for auth
- **Browser may not fire close event on page unload** - Use `beforeunload` for cleanup
- **Some proxies have WebSocket idle timeouts** - Heartbeats prevent proxy disconnects
- **readyState changes are not synchronous** - Check readyState before every send
- **Binary messages need `instanceof ArrayBuffer` check** - Don't assume message type
- **JSON.parse can throw** - Always wrap in try-catch for incoming messages

---

## Anti-Patterns

### No Reconnection Logic

WebSocket connections will drop. Without reconnection, users experience permanent disconnection until page refresh.

```typescript
// WRONG - No reconnection
const socket = new WebSocket(url);
socket.onclose = () => {
  console.log("Disconnected"); // User is stuck
};

// CORRECT - Reconnection with backoff
socket.onclose = (event) => {
  if (event.code !== 1000 && retryCount < MAX_RETRIES) {
    const delay = calculateBackoffWithJitter(retryCount);
    setTimeout(() => connect(), delay);
  }
};
```

### Immediate Reconnection (Thundering Herd)

When a server restarts, all clients reconnecting immediately overwhelms the server.

```typescript
// WRONG - All clients reconnect at same time
socket.onclose = () => {
  new WebSocket(url); // Thundering herd!
};

// CORRECT - Exponential backoff with jitter
socket.onclose = () => {
  const delay = baseDelay * Math.pow(2, attempt);
  const jitter = delay * 0.5 * (Math.random() * 2 - 1);
  setTimeout(() => connect(), delay + jitter);
};
```

### Missing readyState Check

Sending to a closed socket fails silently or throws errors.

```typescript
// WRONG - No readyState check
function send(message: unknown) {
  socket.send(JSON.stringify(message)); // May fail silently
}

// CORRECT - Check readyState
function send(message: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    messageQueue.push(message); // Queue for later
  }
}
```

### Untyped Message Handling

Without types, message handling is error-prone and impossible to refactor safely.

```typescript
// WRONG - Untyped, unsafe
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "mesage") { // Typo! Never caught
    console.log(data.content); // Could be undefined
  }
};

// CORRECT - Discriminated union with exhaustive switch
type ServerMessage =
  | { type: "message"; content: string }
  | { type: "error"; code: number };

socket.onmessage = (event) => {
  const data: ServerMessage = JSON.parse(event.data);
  switch (data.type) {
    case "message":
      console.log(data.content); // TypeScript knows content exists
      break;
    case "error":
      console.error(`Error ${data.code}`);
      break;
    default:
      const exhaustive: never = data; // Compile error if case missing
  }
};
```

### Token in URL Query String

Tokens in URLs are logged by servers and may be cached.

```typescript
// WRONG - Token visible in logs
const socket = new WebSocket(`wss://api.example.com/ws?token=${token}`);

// CORRECT - Token as first message
const socket = new WebSocket("wss://api.example.com/ws");
socket.onopen = () => {
  socket.send(JSON.stringify({ type: "auth", token }));
};
```

### No Cleanup on Unmount

React components must clean up WebSocket connections to prevent memory leaks.

```typescript
// WRONG - No cleanup
useEffect(() => {
  const socket = new WebSocket(url);
  // ... handlers
}, []); // Memory leak! Socket stays open

// CORRECT - Cleanup on unmount
useEffect(() => {
  const socket = new WebSocket(url);
  // ... handlers

  return () => {
    socket.close(1000, "Component unmounted");
  };
}, []);
```

### Using Blob for Performance-Critical Binary Data

Blob requires async processing, adding latency.

```typescript
// WRONG - Async Blob processing
socket.binaryType = "blob"; // Default
socket.onmessage = async (event) => {
  if (event.data instanceof Blob) {
    const buffer = await event.data.arrayBuffer(); // Async overhead
    processBuffer(buffer);
  }
};

// CORRECT - Synchronous ArrayBuffer processing
socket.binaryType = "arraybuffer";
socket.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    const view = new DataView(event.data); // Synchronous
    processData(view);
  }
};
```

### Not Handling Intentional Close

Reconnecting after intentional close wastes resources and confuses users.

```typescript
// WRONG - Reconnects even on intentional close
socket.onclose = () => {
  reconnect(); // Even when user clicked "disconnect"
};

// CORRECT - Track intentional close
let intentionalClose = false;

function close() {
  intentionalClose = true;
  socket.close(1000, "User requested");
}

socket.onclose = (event) => {
  if (!intentionalClose && event.code !== 1000) {
    reconnect();
  }
};
```

---

## Close Event Codes Reference

| Code | Name | Description | Reconnect? |
|------|------|-------------|------------|
| 1000 | Normal Closure | Clean close, intentional | No |
| 1001 | Going Away | Server shutting down, page navigating away | Yes |
| 1002 | Protocol Error | Protocol violation | No - fix client |
| 1003 | Unsupported Data | Received data type not supported | No - fix client |
| 1006 | Abnormal Closure | No close frame received (network issue) | Yes |
| 1007 | Invalid Data | Message data inconsistent with type | No - fix client |
| 1008 | Policy Violation | Generic policy violation | Maybe - check reason |
| 1009 | Message Too Big | Message size exceeds limit | No - fix client |
| 1010 | Missing Extension | Expected extension not negotiated | No - fix client |
| 1011 | Internal Error | Server encountered unexpected condition | Yes |
| 1012 | Service Restart | Server restarting | Yes (with backoff) |
| 1013 | Try Again Later | Server overloaded | Yes (with longer backoff) |
| 1014 | Bad Gateway | Proxy/gateway error | Yes |
| 1015 | TLS Handshake | TLS handshake failure | No - fix certificates |

---

## Quick Reference

### WebSocket ReadyState Values

| Value | Constant | Description |
|-------|----------|-------------|
| 0 | `WebSocket.CONNECTING` | Connection not yet established |
| 1 | `WebSocket.OPEN` | Connection established, ready to communicate |
| 2 | `WebSocket.CLOSING` | Connection closing |
| 3 | `WebSocket.CLOSED` | Connection closed |

### Connection Checklist

- [ ] Implements exponential backoff with jitter
- [ ] Has maximum retry limit
- [ ] Has heartbeat/ping-pong mechanism
- [ ] Queues messages during disconnection
- [ ] Flushes queue on reconnect
- [ ] Checks readyState before sending
- [ ] Cleans up on component unmount
- [ ] Distinguishes intentional vs unintentional close

### Message Handling Checklist

- [ ] Uses discriminated unions for message types
- [ ] Has exhaustive switch with never check
- [ ] Wraps JSON.parse in try-catch
- [ ] Checks instanceof for binary vs text
- [ ] Uses ArrayBuffer for binary data (not Blob)

### Security Checklist

- [ ] Uses wss:// (not ws://) in production
- [ ] Token sent as first message (not in URL)
- [ ] Validates server messages before using
- [ ] Handles authentication expiry/refresh

### Performance Checklist

- [ ] Uses binaryType = 'arraybuffer' for binary data
- [ ] Chunks large file uploads
- [ ] Limits message queue size
- [ ] Uses shared connection when multiple components need same socket
