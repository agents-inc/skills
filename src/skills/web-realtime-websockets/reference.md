# WebSocket Reference

> Decision frameworks, anti-patterns, and quick-reference tables for WebSocket real-time communication. See [SKILL.md](SKILL.md) for core concepts and red flags, [examples/](examples/) for code examples.

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
├─ Need library-managed features (rooms, namespaces, auto-transport fallback)?
│   └─ YES → Use a WebSocket wrapper library (not this skill's scope)
├─ Need simple bidirectional communication?
│   └─ YES → Native WebSocket API
├─ Need to support legacy browsers without WebSocket?
│   └─ YES → Use a library with fallback transports
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
│   └─ YES → Use state machine pattern (Pattern 12)
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
│   └─ YES → Consider chunked uploads (Pattern 13)
├─ Need protocol with headers?
│   └─ YES → DataView for parsing binary headers
└─ Default → binaryType = 'arraybuffer' for performance
```

---

## Anti-Patterns

These anti-patterns cover scenarios not fully illustrated with code in the core examples.

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

### Ignoring bufferedAmount (Backpressure)

Sending data faster than the network can handle causes memory issues.

```typescript
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB

// WRONG - No backpressure check
function sendLargeData(data: ArrayBuffer) {
  socket.send(data); // May queue unbounded data
}

// CORRECT - Check bufferedAmount before sending
function sendLargeData(data: ArrayBuffer): boolean {
  if (socket.bufferedAmount > MAX_BUFFER_SIZE) {
    console.warn("Buffer full, try again later");
    return false;
  }
  socket.send(data);
  return true;
}
```

---

## Close Event Codes Reference

| Code | Name              | Description                                | Reconnect?                |
| ---- | ----------------- | ------------------------------------------ | ------------------------- |
| 1000 | Normal Closure    | Clean close, intentional                   | No                        |
| 1001 | Going Away        | Server shutting down, page navigating away | Yes                       |
| 1002 | Protocol Error    | Protocol violation                         | No - fix client           |
| 1003 | Unsupported Data  | Received data type not supported           | No - fix client           |
| 1006 | Abnormal Closure  | No close frame received (network issue)    | Yes                       |
| 1007 | Invalid Data      | Message data inconsistent with type        | No - fix client           |
| 1008 | Policy Violation  | Generic policy violation                   | Maybe - check reason      |
| 1009 | Message Too Big   | Message size exceeds limit                 | No - fix client           |
| 1010 | Missing Extension | Expected extension not negotiated          | No - fix client           |
| 1011 | Internal Error    | Server encountered unexpected condition    | Yes                       |
| 1012 | Service Restart   | Server restarting                          | Yes (with backoff)        |
| 1013 | Try Again Later   | Server overloaded                          | Yes (with longer backoff) |
| 1014 | Bad Gateway       | Proxy/gateway error                        | Yes                       |
| 1015 | TLS Handshake     | TLS handshake failure                      | No - fix certificates     |

---

## Quick Reference

### WebSocket ReadyState Values

| Value | Constant               | Description                                  |
| ----- | ---------------------- | -------------------------------------------- |
| 0     | `WebSocket.CONNECTING` | Connection not yet established               |
| 1     | `WebSocket.OPEN`       | Connection established, ready to communicate |
| 2     | `WebSocket.CLOSING`    | Connection closing                           |
| 3     | `WebSocket.CLOSED`     | Connection closed                            |

### Connection Checklist

- [ ] Implements exponential backoff with jitter
- [ ] Has maximum retry limit
- [ ] Has heartbeat/ping-pong mechanism (20-30s intervals recommended)
- [ ] Queues messages during disconnection
- [ ] Flushes queue on reconnect
- [ ] Checks readyState before sending
- [ ] Cleans up on component unmount
- [ ] Distinguishes intentional vs unintentional close
- [ ] Handles bfcache (pagehide/pageshow events)

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
- [ ] Monitors bufferedAmount for backpressure on large sends
