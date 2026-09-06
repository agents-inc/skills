---
name: web-realtime-socket-io
description: Socket.IO v4.x client patterns, connection lifecycle, reconnection, authentication, rooms, namespaces, acknowledgments, binary data, TypeScript integration
---

# Socket.IO Real-Time Communication Patterns

> **Quick Guide:** Socket.IO is a protocol layered over WebSocket, not an implementation of it — its client and a plain WebSocket server cannot talk to each other in either direction. What the layer buys is transport fallback, automatic reconnection, rooms, namespaces and acknowledgments, for about 14.5KB gzipped. The facts that change the answer: `auth` accepts a function that re-runs on every reconnection, `timeout` and `ackTimeout` are different clocks, and `socket.recovered` (v4.6.0+) tells you whether missed events were replayed or a full state refresh is owed.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — typed socket factory, connection and event hooks, emit-with-ack, offline queue, volatile events, Manager multiplexing
- [examples/authentication.md](examples/authentication.md) — token auth, refresh on reconnect, per-namespace auth, cookie auth, auth state machine
- [examples/rooms.md](examples/rooms.md) — room manager and hooks, multi-room chat, namespace sockets, conditional namespace access
- [reference.md](reference.md) — client options, socket and manager events, disconnect reasons, comparison table, checklists

---

## Which path applies

- **One connection to the default namespace** — `io(url, options)` creates the socket and its Manager together. This is the shape in [examples/core.md](examples/core.md) and covers most apps.
- **Several namespaces over one connection** — construct `new Manager(url)` yourself and call `manager.socket("/chat")` per namespace. The namespaces share a single transport and can each carry their own `auth`, which is what makes per-namespace authorization possible. See [examples/rooms.md](examples/rooms.md).

Calling `io()` more than once against the same URL opens a second transport rather than multiplexing — the Manager is what shares one.

---

<critical_requirements>

## Before writing Socket.IO code

**Declare `ServerToClientEvents` and `ClientToServerEvents` and type the socket with them.** Event names are strings at runtime, so this is what turns `"mesage"` from a listener that never fires into a compile error.

**Pass tokens through the `auth` option.** They travel in the handshake rather than the URL, so they stay out of server logs, browser history and proxy logs — and the function form of `auth` is re-evaluated on every reconnection, which keeps a refreshed token from going stale.

**Remove every listener you add, with the same function reference.** `socket.off(event, handler)` in a `useEffect` cleanup is what stops handlers stacking up across re-renders and processing each message once per mount.

**Handle `connect_error` and the manager's `reconnect_failed`.** Between them they cover the two failures a user would otherwise experience as a screen that simply stopped updating.

**Check `socket.recovered` after `connect` (v4.6.0+).** It answers whether the server replayed what was missed or the client owes itself a full state refresh.

</critical_requirements>

---

**Auto-detection:** socket.io-client, io(), Manager, manager.socket(), socket.emit, socket.on, socket.off, emitWithAck, socket.timeout(), ackTimeout, socket.volatile, socket.recovered, socket.active, connect_error, reconnect_attempt, reconnect_failed, ServerToClientEvents, ClientToServerEvents, autoConnect, reconnectionDelayMax

**Applies to:**

- Bidirectional messaging where delivery confirmation matters
- Rooms and namespaces for targeted broadcast
- Reconnection with credential refresh and connection state recovery
- Restrictive networks that need a polling fallback
- Typed event contracts between client and server

**Handled elsewhere:**

- Where the token came from and how it is refreshed — the socket sends whatever `auth` yields.
- Where received data is stored and how it renders — a socket hook hands back messages and connection state, and nothing beyond that is its concern.
- The server's own room membership, namespace middleware and connection-state-recovery configuration; this skill covers the client half and names what it needs enabled server-side.
- A bidirectional channel without rooms, acknowledgments or fallback — that is the native WebSocket API underneath, which this protocol layer wraps rather than exposes.

---

<philosophy>

Socket.IO trades bundle size and protocol compatibility for four things that are otherwise hand-written: transport fallback, reconnection, server-side grouping and acknowledgments.

- **Transport is abstract.** The client opens with HTTP long-polling and upgrades to WebSocket once one is available, so a network that blocks the upgrade degrades instead of failing.
- **Rooms are a server concept.** A client asks to join and the server decides; the client is never told which rooms it is in.
- **Namespaces are protocol-level.** A client connects to `/chat` or `/admin` explicitly, each with its own middleware and its own `auth`, and all of them share one transport.
- **Connection state recovery (v4.6.0+)** replays events missed during a brief drop, within a server-configured window that defaults to two minutes.

```
CONNECTING -> CONNECTED <-> (events) -> DISCONNECTING -> DISCONNECTED
                 |                           |
             (error) <- reconnect <- (disconnect)
```

</philosophy>

---

<decision_framework>

## Namespace or room

```
What is being separated?
  +-- A distinct feature area, with its own auth or middleware?
  |     -> namespace — the client connects to it, e.g. /chat, /admin
  +-- A set of users inside one feature, for targeted broadcast?
  |     -> room — server-side only, joined on request
  +-- Neither — one channel for everything?
        -> the default namespace "/"
```

## How to authenticate

The `auth` option covers the token case, and its function form is what keeps the token fresh across reconnections. For session cookies, set `withCredentials: true` and leave `auth` alone — the server's CORS config has to allow credentials for this to work. Where one namespace needs elevated rights, give that namespace its own `auth` on `manager.socket("/admin", { auth })` rather than gating in application code.

## Which delivery guarantee

A plain `emit` is fire-and-forget. Add an acknowledgment when the sender needs to know it arrived: `socket.timeout(ms).emitWithAck(...)` for one call, or `ackTimeout` with `retries` (v4.6.0+) to have the client retransmit on its own — which makes the server's handler responsible for being idempotent, since the same packet can arrive twice. For data whose next update supersedes it — cursor positions, presence pings — `socket.volatile.emit()` drops rather than queues.

## Sending binary

Binary payloads go directly in an event; the protocol serialises `ArrayBuffer`, `Buffer` and `Blob`, including inside objects mixed with JSON. Chunk large files yourself — send metadata first, then acknowledged chunks, so progress is reportable and a failure resumes.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Typed event interfaces

v4 enforces both directions at compile time.

```typescript
interface ServerToClientEvents {
  "message:received": (message: ChatMessage) => void;
  error: (error: SocketError) => void;
}

interface ClientToServerEvents {
  "message:send": (content: string, ack: (res: SendResult) => void) => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Client configuration

`timeout` is the connection timeout, default 20000ms. `ackTimeout` is the per-emit acknowledgment clock and needs `retries` beside it — the two are unrelated despite the names.

```typescript
const socket: TypedSocket = io(url, {
  auth: { token },
  reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
  reconnectionDelay: RECONNECTION_DELAY_MS,
  timeout: CONNECTION_TIMEOUT_MS,
  transports: ["websocket", "polling"],
});
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Connection lifecycle

Socket-level events describe the socket; manager-level events (`socket.io`) describe the underlying connection. Reconnection progress only shows up on the second set.

```typescript
socket.on("connect", () => {
  if (!socket.recovered) refetchState();
});
socket.on("disconnect", (reason) => {
  // socket.active === true means a reconnect is already scheduled
});
socket.on("connect_error", (error) => showError(error));

socket.io.on("reconnect_attempt", (attempt) => showReconnecting(attempt));
socket.io.on("reconnect_failed", () => showPermanentFailure());
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Acknowledgments

Two forms, one guarantee. `emitWithAck` awaits a single response; `ackTimeout` with `retries` retransmits automatically.

```typescript
const response = await socket
  .timeout(ACK_TIMEOUT_MS)
  .emitWithAck("message:send", content);

// or: let the client retry, and make the server handler idempotent
const socket = io(url, { ackTimeout: ACK_TIMEOUT_MS, retries: MAX_RETRIES });
socket.emit("message:send", content, (response) => confirm(response));
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Auth token handling

An `auth` object is read once, at construction. An `auth` function is called before every connection attempt, including reconnections — which is the difference between a session that survives a token refresh and one that does not.

```typescript
const socket = io(url, {
  auth: (cb) => {
    cb({ token: getToken() });
  },
});

// or update it just before the retry
socket.io.on("reconnect_attempt", () => {
  socket.auth = { token: getToken() };
});
```

Full code: [examples/authentication.md](examples/authentication.md)

---

### Pattern 6: Namespaces over one connection

A Manager owns the transport; each namespace socket rides it and can carry its own credentials.

```typescript
const manager = new Manager(url, { autoConnect: false });
const chatSocket = manager.socket("/chat");
const adminSocket = manager.socket("/admin", { auth: { token: adminToken } });
manager.connect();
```

Full code: [examples/rooms.md](examples/rooms.md)

---

### Pattern 7: Listener cleanup

`off` matches on the function reference, so the handler has to be a stable binding rather than an inline arrow.

```typescript
useEffect(() => {
  const handler = (msg: Message) => setMessages((prev) => [...prev, msg]);
  socket.on("message", handler);
  return () => {
    socket.off("message", handler);
  };
}, [socket]);
```

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A token in the connection URL's query string — it lands in server logs, browser history and every proxy in between — put it in `auth`.
- `socket.on(...)` with no matching `off` — handlers accumulate per mount and each message is processed once per accumulation.
- An inline arrow passed to `off` — it is a different reference from the one registered, so nothing is removed.
- `socket.emit()` on a disconnected socket — it is dropped silently — check `socket.connected` or queue.
- `socket.id` used as a user identifier — it is regenerated on every reconnection — key on a server-issued user id.
- A static `auth` object on a long session — the token expires and every reconnection is refused — use the function form.
- `ackTimeout` without `retries` — the retransmission behaviour it belongs to is never switched on.

**Surprising behaviour:**

- The protocol is incompatible with a plain WebSocket client in both directions; a non-Socket.IO server cannot be reached with this library.
- The default transport order is polling first, then upgrade — not socket first.
- `socket.recovered` is only ever true when the server has connection state recovery enabled.
- Namespaces share one transport, so a transport failure takes all of them down together.
- Rooms are invisible to the client — there is no client API that reports which rooms it is in.
- `volatile.emit()` drops messages under congestion by design; anything that must arrive does not belong on it.
- With `retries` enabled the same packet can be delivered more than once, so server handlers have to be idempotent.

</red_flags>
