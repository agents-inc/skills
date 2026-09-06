---
name: web-realtime-websockets
description: Native WebSocket API patterns, connection lifecycle, reconnection strategies, heartbeat, message typing, binary data, custom hooks
---

# WebSocket Real-Time Communication Patterns

> **Quick Guide:** The native WebSocket API gives you a full-duplex channel and nothing else — reconnection, liveness detection, delivery during a drop and message typing are all yours to build, and this skill is the shape each of them takes. The facts that change the answer: the API accepts no custom headers, so authentication is a first message rather than a header; `onerror` is always followed by `onclose`, so recovery belongs in one place; an open connection blocks the browser's back/forward cache; and `readyState` changes are not synchronous with the calls that cause them.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — lifecycle, backoff with jitter, heartbeat, queuing, typed messages, binary protocol, auth, rooms, `useWebSocket`, shared connection, bfcache
- [examples/state-machine.md](examples/state-machine.md) — connection state as a reducer, where booleans stop being enough
- [examples/binary.md](examples/binary.md) — chunked file upload with progress
- [examples/presence.md](examples/presence.md) — presence and away detection
- [reference.md](reference.md) — close-code table with reconnect guidance, readyState values, anti-patterns with code, deployment checklist

---

## Which path applies

- **One component owns the connection** — a hook creates the socket, holds the backoff and heartbeat timers, and closes it on unmount. Start at [examples/core.md](examples/core.md).
- **Several components share one connection** — a provider owns the socket and routes by message type through a `subscribe(type, handler)` API that returns its own unsubscribe. Opening a socket per component multiplies handshakes and heartbeats against the same server. Also [examples/core.md](examples/core.md).

Once the connection has more than two or three states worth distinguishing — reconnecting-with-attempt-count, failed-permanently — the boolean flags stop composing and [examples/state-machine.md](examples/state-machine.md) is the shape that replaces them.

---

<critical_requirements>

## Before writing WebSocket code

**Back off exponentially, with jitter, and cap both the delay and the attempt count.** Every client dropped by one server restart tries to return at the same instant, and the jitter is what spreads them out instead of re-creating the outage.

**Give every message a `type` field and model the set as a discriminated union.** A `never` assignment in the default branch then turns a new server message into a compile error rather than a value that falls through.

**Queue sends attempted while the socket is not `OPEN`, and flush on reconnect.** `send()` on a closed socket throws or drops depending on the state, and a bounded queue is what turns a two-second drop into a delay rather than data loss.

**Run a heartbeat and treat a missing reply as a dead connection.** Proxies and NATs drop idle connections without a close frame, so a socket can read `OPEN` for minutes after it stopped carrying anything.

**Use `wss://` anywhere the page is served over HTTPS.** Browsers block the insecure scheme from a secure origin, localhost aside.

**Close on `pagehide` and reconnect on `pageshow` when `event.persisted`.** An open socket disqualifies the page from the back/forward cache, so this is what keeps instant back-navigation working.

</critical_requirements>

---

**Auto-detection:** new WebSocket, wss://, ws://, socket.onmessage, socket.onopen, socket.onclose, socket.onerror, readyState, WebSocket.OPEN, bufferedAmount, binaryType, CloseEvent, event.code, pagehide, pageshow, event.persisted, WebSocketStream

**Applies to:**

- Bidirectional messaging with low latency — chat, collaborative editing, live dashboards
- Reconnection with backoff, jitter and a retry ceiling
- Liveness detection through heartbeats and close-code interpretation
- Delivery across brief disconnections via a bounded queue
- Typed message contracts and exhaustive handling
- Binary frames, including chunked transfers with progress
- Connection sharing across a component tree

**Handled elsewhere:**

- Server push where the client never sends — a duplex channel and its whole reconnection apparatus buy nothing there, and a long-lived HTTP response is the lighter answer.
- Rooms, namespaces, acknowledgments and transport fallback supplied by a protocol layer — the room pattern here is hand-built on the raw API, and a library that provides them is a different subject with a different wire format.
- The server's connection registry, broadcast fan-out and room membership.
- Where received messages are stored and how they render.
- Issuing and refreshing the token the first message carries.

---

<philosophy>

A WebSocket is one TCP connection held open, with framing on top. Everything HTTP gave you for free is gone, and what you now own is what this skill is about.

- **Networks drop connections.** Reconnection is not an edge case, so backoff and jitter belong in the first version rather than a later one.
- **A dead connection looks like a quiet one.** Only a heartbeat distinguishes them, because a connection killed by an intermediary sends no close frame.
- **Messages sent during a drop are gone.** A bounded queue turns that into latency.
- **Frames are untyped strings.** The type safety is whatever you model on top.
- **An open connection has a cost beyond bandwidth.** It disqualifies the page from bfcache, which shows up as slow back-navigation rather than as an error.

```
CONNECTING -> OPEN <-> (messages) -> CLOSING -> CLOSED
                 |                      |
             (error) <- reconnect <- (close)
```

</philosophy>

---

<decision_framework>

## Reading a close event

`event.code` says whether reconnecting is sensible: `1000` is a clean, intentional close and reconnecting fights the user; `1006` is an abnormal close with no frame, which is the ordinary network drop and the case backoff exists for; `1012` and `1013` are the server asking for a longer wait; the `100x` protocol and data errors mean the client is wrong and retrying reproduces it. The full table with a reconnect column is in [reference.md](reference.md).

Track intentional closes separately from the code — a user pressing disconnect and a server sending `1000` both arrive as `1000`, but only one of them should stop the retry loop for good.

## Choosing a message format

JSON with a discriminated union is the default, and being readable on the wire is most of why. Reach for binary frames when payload size actually shows up in a measurement, and keep the mixed shape — JSON for control messages, binary for the payload — rather than encoding everything one way.

## Sending large payloads

`send()` accepts anything and buffers what the network has not taken, so a fast producer grows `bufferedAmount` without bound. Check it before a large send and chunk the payload, which also makes progress reportable. There is no built-in backpressure signal beyond that number.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Basic connection

Four handlers, and all four earn their place: `onerror` carries no useful detail and is always followed by `onclose`, so recovery goes in `onclose` alone.

```typescript
const socket = new WebSocket(WS_URL);

socket.onopen = () => flushQueue();
socket.onmessage = (event: MessageEvent) => handle(event.data);
socket.onerror = () => markUnhealthy(); // no detail available, onclose follows
socket.onclose = (event: CloseEvent) => maybeReconnect(event.code);
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Exponential backoff with jitter

The jitter is the part that matters: without it every client dropped together returns together.

```typescript
function calculateBackoff(attempt: number): number {
  const exponential = Math.min(
    INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt),
    MAX_BACKOFF_MS,
  );
  const jitter = exponential * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.floor(exponential + jitter);
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Heartbeat and ping-pong

Send on an interval, arm a shorter timeout, and let the reply disarm it. A timeout that fires means the connection is dead however healthy `readyState` looks.

```typescript
const ping = setInterval(() => {
  socket.send(JSON.stringify({ type: "ping" }));
  pongTimer = setTimeout(
    () => socket.close(4000, "heartbeat timeout"),
    HEARTBEAT_TIMEOUT_MS,
  );
}, HEARTBEAT_INTERVAL_MS);

// on receiving { type: "pong" }: clearTimeout(pongTimer)
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Message queuing during disconnection

Check `readyState` before every send, because it changes independently of the calls around it.

```typescript
public send(data: unknown): void {
  if (this.socket?.readyState === WebSocket.OPEN) {
    this.socket.send(JSON.stringify(data));
  } else {
    this.queueMessage(data); // bounded — oldest dropped at MAX_QUEUE_SIZE
  }
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Type-safe messages with discriminated unions

Separate unions per direction, and an exhaustiveness check on the receiving one.

```typescript
type ServerMessage =
  | { type: "subscribed"; channel: string; members: string[] }
  | { type: "message"; channel: string; content: string; sender: string }
  | { type: "error"; code: number; message: string };

function handleServerMessage(message: ServerMessage): void {
  switch (message.type) {
    case "subscribed":
      return onSubscribed(message);
    case "message":
      return onMessage(message);
    case "error":
      return onError(message);
    default: {
      const exhaustive: never = message;
      return exhaustive;
    }
  }
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Binary data handling

`binaryType = "arraybuffer"` makes a frame readable synchronously through a `DataView`; the default `Blob` forces an async read for every message.

```typescript
socket.binaryType = "arraybuffer";

socket.onmessage = (event: MessageEvent) => {
  if (event.data instanceof ArrayBuffer) {
    const view = new DataView(event.data);
    const messageType = view.getUint8(0);
  } else {
    handleJson(JSON.parse(event.data));
  }
};
```

Full code: [examples/core.md](examples/core.md) · chunked uploads: [examples/binary.md](examples/binary.md)

---

### Pattern 7: Authentication over WebSocket

The API sets no custom headers, so the token goes in the first frame — not the URL, which is logged. Everything else waits behind the result.

```typescript
socket.onopen = () => {
  socket.send(JSON.stringify({ type: "auth", token }));
};
// queue all other sends until { type: "auth_result", success: true } arrives
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 8: Rooms and channels

There is no room concept in the protocol — it is a message convention plus local membership state, and the guard against sending to an unjoined room is what makes the state worth keeping.

```typescript
public joinRoom(roomId: string): void {
  if (this.rooms.has(roomId)) return;
  this.rooms.set(roomId, { id: roomId, members: new Set(), joined: false });
  this.send({ type: "join_room", roomId });
}
// the server's room_joined reply flips joined to true and seeds members
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 9: Custom React hook

One hook owning the socket, the backoff timer, the heartbeat and the queue, exposing status and the actions.

```typescript
const { status, send, close, reconnect } = useWebSocket(WS_URL, {
  onMessage: handleServerMessage,
  heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
});
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 10: Shared connection via context

The provider owns the socket and dispatches by message type; each subscriber gets back its own unsubscribe to return from an effect.

```typescript
const { status, send, subscribe } = useWebSocketContext();

useEffect(() => subscribe("notification", handleNotification), [subscribe]);
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 11: bfcache compatibility

Close on `pagehide` so the page stays eligible for the cache, and reconnect on `pageshow` only when it was actually restored from it.

```typescript
window.addEventListener("pagehide", () => socket?.close(1000, "Page hidden"));

window.addEventListener("pageshow", (event: PageTransitionEvent) => {
  if (event.persisted) connect();
});
```

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `ws://` on an HTTPS page — browsers refuse it outside localhost.
- `send()` without a `readyState` check — the state moves independently of the surrounding code, so the message is lost or throws.
- No cleanup on unmount — the socket, its heartbeat interval and its retry timer all outlive the component.
- Reconnecting with no backoff — the clients dropped by one restart return together and repeat the outage.
- `JSON.parse` on `event.data` with no `try` — one malformed frame takes the handler down for every frame after it.
- Assuming `event.data` is text — check `instanceof ArrayBuffer` first once any binary is in play.
- A token in the connection URL — it lands in server and proxy logs — send it as the first frame.
- `beforeunload` used for cleanup — registering it is itself enough to disqualify the page from bfcache — use `pagehide`.
- Reconnecting on close code `1000` — that is the clean, intentional close, including the one the user asked for.

**Surprising behaviour:**

- `onerror` carries no diagnostic detail and is always followed by `onclose`; recovery written in both places runs twice.
- A connection killed by an intermediary sends no close frame, so `readyState` can read `OPEN` for minutes — only a heartbeat notices.
- `bufferedAmount` is the only backpressure signal there is; nothing throws when a fast producer outruns the network.
- The default `binaryType` is `Blob`, which forces an async read per message — set `arraybuffer` before the first binary frame arrives.
- Close code `1006` never appears on the wire; the browser synthesises it for an abnormal close, so it carries no server reason.
- `WebSocketStream`, which would give real backpressure, is Chromium-only.

</red_flags>
