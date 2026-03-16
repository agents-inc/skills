---
name: web-realtime-websockets
description: Native WebSocket API patterns, connection lifecycle, reconnection strategies, heartbeat, message typing, binary data, custom hooks
---

# WebSocket Real-Time Communication Patterns

> **Quick Guide:** Use native WebSocket API for real-time bidirectional communication. Implement exponential backoff with jitter for reconnection. Use discriminated unions for type-safe message handling. Queue messages during disconnection for delivery on reconnect. Close connections on `pagehide` to allow bfcache.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST implement exponential backoff with jitter for ALL reconnection logic)**

**(You MUST use discriminated unions with a `type` field for ALL WebSocket message types)**

**(You MUST queue messages during disconnection and flush on reconnect)**

**(You MUST implement heartbeat/ping-pong to detect dead connections)**

**(You MUST set `binaryType` to 'arraybuffer' when handling binary data)**

**(You MUST use wss:// for secure origins - browsers block ws:// on HTTPS pages except localhost)**

**(You MUST handle bfcache with pagehide/pageshow events)**

</critical_requirements>

---

**Auto-detection:** WebSocket, ws://, wss://, onmessage, onopen, onclose, onerror, reconnect, heartbeat, ping, pong, real-time, bidirectional

**When to use:**

- Building real-time features (chat, notifications, live updates)
- Implementing bidirectional communication between client and server
- Creating live dashboards or collaborative editing features
- Streaming data updates with low latency requirements

**When NOT to use:**

- One-way server-to-client streaming only (use SSE instead)
- Simple request-response patterns (use HTTP/REST instead)
- When library abstractions are required (use a WebSocket wrapper library)
- When automatic backpressure handling is critical (consider WebSocketStream when widely supported)

**Key patterns covered:**

- WebSocket connection lifecycle management
- Reconnection with exponential backoff and jitter
- Heartbeat/ping-pong for connection health
- Message queuing during disconnection
- Type-safe message handling with discriminated unions
- Binary data handling (ArrayBuffer, Blob)
- Custom React hooks (useWebSocket)
- Authentication patterns
- Room/channel subscriptions
- bfcache compatibility

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Connection lifecycle, reconnection, heartbeat, queuing, auth, rooms, hooks
- [examples/state-machine.md](examples/state-machine.md) - Connection state machine pattern
- [examples/binary.md](examples/binary.md) - Binary data and file upload
- [examples/presence.md](examples/presence.md) - User presence detection
- [reference.md](reference.md) - Decision frameworks, close codes, anti-patterns

---

<philosophy>

## Philosophy

WebSockets provide full-duplex communication channels over a single TCP connection, enabling real-time bidirectional data flow between client and server. Unlike HTTP, WebSocket connections remain open, eliminating the overhead of repeated handshakes.

**The native WebSocket API is simple but requires careful handling:**

1. **Connection Resilience:** Networks are unreliable. Always implement reconnection with exponential backoff and jitter to prevent thundering herd problems.

2. **Connection Health:** Intermediate proxies and firewalls can silently drop idle connections. Heartbeats detect dead connections and keep connections alive.

3. **Message Integrity:** Messages sent during disconnection are lost. Queue them and flush on reconnect for reliable delivery.

4. **Type Safety:** WebSocket messages are untyped strings. Use discriminated unions with a shared `type` field for compile-time safety.

5. **bfcache Compatibility:** Open WebSocket connections prevent pages from using the browser's back/forward cache, degrading navigation performance. Close connections on `pagehide` and reconnect on `pageshow` when `event.persisted`.

**Connection Lifecycle:**

```
CONNECTING -> OPEN <-> (messages) -> CLOSING -> CLOSED
                 |                      |
             (error) <- reconnect <- (close)
```

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Basic WebSocket Connection

The native WebSocket API provides four lifecycle events: `onopen`, `onmessage`, `onerror`, and `onclose`. Always handle all four.

```typescript
const WS_URL = "wss://api.example.com/ws";
const socket = new WebSocket(WS_URL);

socket.onopen = () => {
  /* connection ready - safe to send */
};
socket.onmessage = (event: MessageEvent) => {
  /* JSON.parse(event.data) */
};
socket.onerror = (event: Event) => {
  /* always followed by onclose */
};
socket.onclose = (event: CloseEvent) => {
  /* reconnect here */
};
```

**Why good:** All four lifecycle events handled, typed event parameters, named constant for URL

> Full implementation: [examples/core.md](examples/core.md) Pattern 1

---

### Pattern 2: Exponential Backoff with Jitter

Reconnection attempts must use exponential backoff with jitter to prevent all clients from reconnecting simultaneously (thundering herd problem). Cap delay at a maximum and limit total retry attempts.

```typescript
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_MULTIPLIER = 2;
const JITTER_FACTOR = 0.5;

function calculateBackoff(attempt: number): number {
  const exponential = Math.min(
    INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt),
    MAX_BACKOFF_MS,
  );
  const jitter = exponential * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.floor(exponential + jitter);
}
```

**Why good:** Jitter prevents thundering herd, capped maximum delay, retry limit prevents infinite loops

> Full reconnecting class: [examples/core.md](examples/core.md) Pattern 2

---

### Pattern 3: Heartbeat/Ping-Pong

Heartbeats detect dead connections and prevent intermediate infrastructure from closing idle connections. Send a `ping` on an interval; if `pong` is not received within a timeout, consider the connection dead.

```typescript
const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 10000;

// Send ping -> start timeout -> if pong received, clear timeout
// If timeout fires without pong -> connection is dead, close and reconnect
```

**When to use:** All WebSocket connections, especially those that may be idle for extended periods or pass through NATs/proxies.

> Full implementation: [examples/core.md](examples/core.md) Pattern 3

---

### Pattern 4: Message Queuing During Disconnection

Messages sent during disconnection are lost. Queue them and flush when connection is restored. Limit queue size to prevent unbounded memory growth.

```typescript
const MAX_QUEUE_SIZE = 100;

public send(data: unknown): void {
  if (this.socket?.readyState === WebSocket.OPEN) {
    this.socket.send(JSON.stringify(data));
  } else {
    this.queueMessage(data); // Queue with size limit
  }
}
```

**Why good:** Queue has size limit, oldest messages dropped when full, flush on reconnect, readyState check before sending

> Full implementation: [examples/core.md](examples/core.md) Pattern 4

---

### Pattern 5: Type-Safe Messages with Discriminated Unions

Use discriminated unions with a shared `type` field for compile-time type safety and exhaustive handling. Define separate types for client-to-server and server-to-client messages.

```typescript
type ServerMessage =
  | { type: "subscribed"; channel: string; members: string[] }
  | { type: "message"; channel: string; content: string; sender: string }
  | { type: "error"; code: number; message: string };

function handleServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case "subscribed":
      /* ... */ break;
    case "message":
      /* ... */ break;
    case "error":
      /* ... */ break;
    default:
      const exhaustiveCheck: never = message; // Compile error if case missing
  }
}
```

**Why good:** Discriminated union enables type narrowing, exhaustiveness check catches missing cases at compile time, separate types for client/server messages

> Full implementation: [examples/core.md](examples/core.md) Pattern 5

---

### Pattern 6: Binary Data Handling

WebSockets support binary data via ArrayBuffer or Blob. Set `binaryType` to `'arraybuffer'` for synchronous processing with DataView. Use `instanceof ArrayBuffer` to distinguish binary from text messages.

```typescript
socket.binaryType = "arraybuffer";

socket.onmessage = (event: MessageEvent) => {
  if (event.data instanceof ArrayBuffer) {
    const view = new DataView(event.data); // Synchronous
  } else {
    JSON.parse(event.data); // Text message
  }
};
```

**Why good:** ArrayBuffer enables synchronous DataView access, instanceof check distinguishes binary from text

> Full implementation with binary protocol: [examples/core.md](examples/core.md) Pattern 6

---

### Pattern 7: Authentication Over WebSocket

WebSocket doesn't support custom HTTP headers. Authenticate via the first message after connection (not query string, which leaks tokens to logs). Queue application messages until auth is confirmed.

```typescript
socket.onopen = () => {
  socket.send(JSON.stringify({ type: "auth", token })); // First message
};
// Queue all other messages until auth_result.success received
```

**Why good:** Token not in URL (avoids server logs), messages queued until authenticated, explicit auth state

> Full implementation: [examples/core.md](examples/core.md) Pattern 7

---

### Pattern 8: Room/Channel Pattern

Organize connections into logical channels for targeted message delivery. Track local room state (membership, joined status) and guard against sending to unjoined rooms.

> Full implementation: [examples/core.md](examples/core.md) Pattern 8

---

### Pattern 9: Custom React Hook (useWebSocket)

A comprehensive custom hook encapsulating connection lifecycle, reconnection with backoff, heartbeat, message queuing, and cleanup. Exposes `status`, `send`, `close`, and `reconnect`.

> Full implementation: [examples/core.md](examples/core.md) Pattern 9

---

### Pattern 10: Shared WebSocket Connection (Context Provider)

When multiple components need the same WebSocket, use a context provider with type-based message routing via a `subscribe(type, handler)` API.

> Full implementation: [examples/core.md](examples/core.md) Pattern 10

---

### Pattern 11: bfcache Compatibility

Open WebSocket connections prevent pages from entering the browser's back/forward cache. Close on `pagehide` and reconnect on `pageshow` when `event.persisted`.

```typescript
window.addEventListener("pagehide", () => {
  socket?.close(1000, "Page hidden");
});

window.addEventListener("pageshow", (event: PageTransitionEvent) => {
  if (event.persisted) {
    // Page restored from bfcache - reconnect
    connect();
  }
});
```

> Full implementation: [examples/core.md](examples/core.md) Pattern 11

</patterns>

---

<red_flags>

## RED FLAGS

### High Priority Issues

- **No reconnection logic** - Connection drops are inevitable, users see permanent disconnection
- **Immediate reconnection without backoff** - Causes thundering herd, overwhelming server during recovery
- **No heartbeat/ping-pong** - Dead connections go undetected, users think they're connected
- **Untyped message handling** - Runtime errors when message shapes change, impossible to refactor safely
- **Sending messages without readyState check** - Messages silently fail when connection is not open
- **Missing cleanup on component unmount** - Memory leaks, zombie connections, duplicate handlers
- **Using ws:// on HTTPS pages** - Browsers block insecure WebSocket on secure origins (except localhost)
- **Not handling bfcache** - Open connections prevent back/forward cache, degrading navigation performance

### Medium Priority Issues

- **No message queuing during disconnection** - Messages lost during brief disconnects
- **Token in WebSocket URL query string** - Security risk: token visible in server logs
- **Using Blob binaryType for frequent binary messages** - Performance penalty from async processing
- **Not handling all close event codes** - Missing opportunities for smart reconnection decisions
- **Single retry interval without randomization** - All clients reconnect at same time after outage
- **Not monitoring bufferedAmount** - Sending faster than network can handle causes memory issues

### Gotchas & Edge Cases

- **Close code 1000 is normal closure** - Don't reconnect for code 1000
- **onerror is always followed by onclose** - Don't duplicate error handling logic
- **WebSocket doesn't support custom HTTP headers** - Use first message for auth, not query string
- **Use `pagehide` for cleanup, not `beforeunload`** - beforeunload prevents bfcache
- **Some proxies have WebSocket idle timeouts** - Heartbeats prevent proxy disconnects (20-30s intervals)
- **readyState changes are not synchronous** - Check readyState before every send
- **Binary messages need `instanceof ArrayBuffer` check** - Don't assume message type
- **JSON.parse can throw** - Always wrap in try-catch for incoming messages
- **No built-in backpressure** - Check `bufferedAmount` before sending large data
- **WebSocketStream is experimental** - Chrome/Edge 124+ only, no Firefox/Safari support

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST implement exponential backoff with jitter for ALL reconnection logic)**

**(You MUST use discriminated unions with a `type` field for ALL WebSocket message types)**

**(You MUST queue messages during disconnection and flush on reconnect)**

**(You MUST implement heartbeat/ping-pong to detect dead connections)**

**(You MUST set `binaryType` to 'arraybuffer' when handling binary data)**

**(You MUST use wss:// for secure origins - browsers block ws:// on HTTPS pages except localhost)**

**(You MUST handle bfcache with pagehide/pageshow events)**

**Failure to follow these rules will result in connection storms, lost messages, blocked connections, and degraded navigation performance.**

</critical_reminders>
