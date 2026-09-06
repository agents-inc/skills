---
name: web-realtime-sse
description: Server-Sent Events for unidirectional server-to-client streaming, EventSource API, fetch streaming, reconnection patterns, message parsing
---

# Server-Sent Events (SSE) Patterns

> **Quick Guide:** SSE pushes text from server to client over an ordinary HTTP response, so it crosses proxies and firewalls that block anything more exotic. `EventSource` gives reconnection and `Last-Event-ID` replay for free but is GET-only and cannot set headers; fetch streaming gives up both and buys custom headers, POST bodies and an `AbortController`. The facts that change the answer: `EventSource` retries network errors but gives up permanently on an HTTP error status, `retry:` is milliseconds, and `Connection: keep-alive` is prohibited on HTTP/2+.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — EventSource lifecycle, named events, credentials, a state-tracking wrapper, typed messages, and the React hooks built on them
- [examples/fetch-streaming.md](examples/fetch-streaming.md) — stream reader with buffer handling, field parser, auth headers, POST streaming, token-by-token UI
- [examples/reconnection.md](examples/reconnection.md) — `Last-Event-ID` recovery, exponential backoff, health checks, visibility-aware pausing
- [reference.md](reference.md) — message format, field behaviour, readyState values, required response headers, EventSource behaviour table

---

## Which path applies

- **`EventSource`** — the browser reconnects, replays through `Last-Event-ID` and parses the wire format for you. It sends GET only, sets no headers, and authenticates by cookie (`withCredentials: true`). Start at [examples/core.md](examples/core.md).
- **Fetch streaming** — reach for it when the stream needs an `Authorization` header, a POST body, or cancellation you control. You then own reconnection, backoff, `Last-Event-ID` and the field parsing. See [examples/fetch-streaming.md](examples/fetch-streaming.md).

Both consume the same wire format, so the parser and the message types are shared between them.

---

<critical_requirements>

## Before writing SSE code

**Call `eventSource.close()` when the consumer goes away.** An open stream holds a connection against the browser's per-domain limit and keeps delivering into a handler nothing is watching.

**Branch on `readyState` inside `onerror`.** `CONNECTING` means the browser is already retrying and the right action is to wait; `CLOSED` means it has given up and reconnecting is yours to do.

**Emit an `id:` on each message from the server.** The browser returns the last one as `Last-Event-ID` on the next connection, which is what lets the server resume rather than restart.

**Respond with `Content-Type: text/event-stream` and `Cache-Control: no-cache`.** Leave `Connection: keep-alive` off — it is prohibited on HTTP/2 and above, and Safari rejects a response carrying it.

**Send a comment line (`: keep-alive`) on an interval.** Proxies close streams they read as idle, typically after 60–120 seconds, and a comment resets that clock without reaching any handler.

</critical_requirements>

---

**Auto-detection:** EventSource, text/event-stream, Last-Event-ID, eventSource.onmessage, eventSource.readyState, EventSource.CONNECTING, withCredentials, addEventListener("message"), retry:, data:, event:, id:, ReadableStream, TextDecoder, response.body.getReader

**Applies to:**

- Server-to-client push over plain HTTP — notifications, feeds, dashboards
- Token-by-token streaming of generated text
- Live data feeds where the client only listens
- Resumable streams via `Last-Event-ID`
- Parsing the SSE wire format by hand when `EventSource` cannot be used

**Handled elsewhere:**

- Frequent client-to-server messaging — SSE carries no upstream channel, so a client that needs one either pairs the stream with ordinary requests or wants a bidirectional transport instead of this.
- Binary payloads — the wire format is UTF-8 text; binary has to be encoded, which costs about a third in size.
- The server's own stream implementation and its replay store.
- Where messages are kept once received, and how they render.
- Issuing and refreshing the token the stream authenticates with.

---

<philosophy>

SSE is an HTTP response that never ends. That is the whole design, and everything follows from it: it works through the infrastructure that already carries HTTP, it is readable on the wire, and the browser can own reconnection because there is no handshake to redo.

- **The browser reconnects, not you** — `EventSource` retries on its own schedule, adjustable by the server through `retry:`.
- **Replay is a header** — the server sees `Last-Event-ID` and decides what to resend.
- **The format is five fields** — `data:`, `event:`, `id:`, `retry:` and a bare `:` comment.

```
CONNECTING (0) → OPEN (1) → messages… → CLOSED (2)
                    ↓                       ↓
                (error) ← auto-reconnect ← (connection lost)
```

</philosophy>

---

<decision_framework>

## Authenticating the stream

A cookie on a same-origin or credentialed cross-origin request is the only mechanism `EventSource` offers — set `withCredentials: true` and have the server allow credentials in CORS. A bearer token needs fetch streaming, because the token belongs in an `Authorization` header rather than the URL. Short-lived tokens additionally need the reconnect path to fetch a fresh one, which is another reason that case lands on fetch streaming.

## Deploying behind infrastructure

On HTTP/1.1 a stream occupies one of roughly six connections per domain, so several concurrent streams starve the rest of the page; HTTP/2 multiplexes them and removes the ceiling. Reverse proxies buffer responses by default and will hold messages until the buffer fills — turn buffering off for the route (`X-Accel-Buffering: no` on nginx) and avoid transformations with `Cache-Control: no-transform`. On a serverless platform, check the response timeout before relying on a long-lived stream at all.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: EventSource lifecycle

Three handlers cover the whole surface, and `readyState` in `onerror` is what separates a retry in progress from a dead stream.

```typescript
const eventSource = new EventSource(SSE_URL);

eventSource.onopen = () => setStatus("open");
eventSource.onmessage = (event: MessageEvent) =>
  handle(event.data, event.lastEventId);
eventSource.onerror = () => {
  if (eventSource.readyState === EventSource.CLOSED) reconnectManually();
};
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Named event types

A message carrying an `event:` field is delivered to a listener of that name rather than to `onmessage`.

```typescript
eventSource.addEventListener("notification", (event: MessageEvent) => {
  show(JSON.parse(event.data));
});

// messages with no event: field still arrive here
eventSource.onmessage = (event: MessageEvent) => handleDefault(event.data);
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Credentials and cross-origin

`withCredentials` sends cookies to another origin; a CORS misconfiguration surfaces as `onerror` with nothing more specific.

```typescript
const eventSource = new EventSource(SSE_URL, { withCredentials: true });
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Connection state and manual retry

`EventSource` retries network failures by itself but stops permanently on an HTTP error status. Tracking status gives the UI something to show and gives that case somewhere to hook a retry.

```typescript
eventSource.onerror = () => {
  if (eventSource.readyState === EventSource.CLOSED) {
    setStatus("closed");
    scheduleRetry(); // the browser will not do this one
  } else {
    setStatus("error"); // CONNECTING — the browser is already on it
  }
};
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: SSE message format

Fields are `\n`-separated and a message ends at `\n\n`. Five field types: `data:` payload, `event:` name, `id:` recovery point, `retry:` reconnect interval in milliseconds, and a bare `:` comment.

```
event: notification
data: {"title": "New message"}
id: msg-002

: keep-alive comment (never delivered to a handler)
```

Repeated `data:` lines join with `\n`; `id:` persists until a later message changes it; `retry:` is remembered for every subsequent reconnection.

Full field and behaviour tables: [reference.md](reference.md)

---

### Pattern 6: Typed message handling

A discriminated union over the payload turns the switch into an exhaustive one, so a new server message type becomes a compile error rather than a silently ignored branch.

```typescript
type SSEMessage =
  | { type: "notification"; title: string; body: string }
  | { type: "user-update"; userId: string; action: "joined" | "left" }
  | { type: "heartbeat"; serverTime: number };

function handle(message: SSEMessage): void {
  switch (message.type) {
    case "notification":
      return show(message.title, message.body);
    case "user-update":
      return updatePresence(message.userId, message.action);
    case "heartbeat":
      return updateServerTime(message.serverTime);
    default: {
      const exhaustive: never = message;
      return exhaustive;
    }
  }
}
```

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- No `close()` when the consumer unmounts — the stream stays open, counts against the per-domain connection limit and keeps firing into a dead handler.
- A new `EventSource` created without closing the previous one — both stay live and every message arrives twice.
- `onerror` left unhandled — a failed stream is indistinguishable from a quiet one, and the UI shows stale data indefinitely.
- `JSON.parse` on `event.data` without a `try` — one malformed message takes down the handler for every message after it.
- A token in the URL query string — it is logged by the server, kept in history and visible to proxies — use a cookie, or fetch streaming with an `Authorization` header.
- `EventSource` where a POST is needed — it issues GET and nothing else.
- Fetch streaming that treats each chunk as a whole message — chunk boundaries fall mid-message, so buffer and split on `\n\n`.
- `TextDecoder` used without `{ stream: true }` — a multi-byte character split across chunks decodes as garbage.
- Rendering message content without validating it — the payload is attacker-influenced text, and a typed interface is a compile-time claim rather than a runtime one.

**Surprising behaviour:**

- `EventSource` has no timeout — a connection dead at the network level can stay `OPEN` for minutes before `onerror` fires, which is what keep-alive comments and a client-side health check exist to catch.
- It retries network errors but treats an HTTP 4xx or 5xx as final, so the case most likely to need a retry is the one it will not perform.
- `retry:` is milliseconds. A server sending `retry: 5` reconnects every 5ms.
- `data:\n\n` delivers an empty string rather than nothing — a falsy check treats a real message as absent.
- Multi-line payloads are several `data:` lines, not escaped newlines in one.
- A blank `id:` clears `Last-Event-ID` rather than leaving the previous value in place.
- On reconnection the stream resumes but component state does not reset itself, so anything accumulated before the drop needs reconciling against what the replay delivers.

</red_flags>
