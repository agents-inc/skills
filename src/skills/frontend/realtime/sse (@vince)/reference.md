# SSE Reference

> Decision frameworks, anti-patterns, and red flags for Server-Sent Events. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use SSE vs Alternatives

```
Need real-time server-to-client updates?
├─ YES → Does client need to send messages?
│   ├─ YES (frequent messages) → WebSocket (bidirectional)
│   ├─ YES (occasional messages) → SSE + REST for client→server
│   └─ NO → SSE ✓
├─ NO → Need request-response pattern?
│   └─ YES → HTTP REST
└─ Special case: Binary data needed?
    └─ YES → WebSocket (SSE is text-only)
```

### EventSource vs Fetch Streaming

```
Choosing SSE implementation?
├─ Need custom HTTP headers (Authorization)?
│   └─ YES → Fetch streaming ✓
├─ Need POST request or request body?
│   └─ YES → Fetch streaming ✓
├─ Need automatic reconnection?
│   └─ YES → EventSource API ✓ (built-in)
├─ Need Last-Event-ID recovery built-in?
│   └─ YES → EventSource API ✓ (automatic)
└─ Default → EventSource API for simplicity
```

### SSE in Different Architectures

```
Server architecture?
├─ HTTP/1.1 → One connection per SSE stream (watch limits)
├─ HTTP/2 → Multiple SSE streams multiplexed ✓
├─ Behind reverse proxy (nginx/cloudflare)?
│   ├─ YES → Configure proxy buffering OFF
│   │        └─ X-Accel-Buffering: no (nginx)
│   │        └─ Cache-Control: no-transform
│   └─ NO → Standard setup
└─ Serverless (Lambda/Edge)?
    └─ Verify SSE/streaming support (timeout limits)
```

### Authentication Strategy

```
Authenticating SSE connections?
├─ Cookies available (same-origin)?
│   └─ YES → EventSource with withCredentials: true ✓
├─ Need Bearer token authentication?
│   ├─ Token in URL query string? → NO (security risk)
│   └─ Use fetch streaming with Authorization header ✓
├─ Short-lived tokens?
│   └─ Implement refresh + reconnect logic
└─ No authentication → EventSource with default options
```

---

## RED FLAGS

### High Priority Issues

- **No cleanup on component unmount** - EventSource stays open, memory leaks, duplicate handlers
- **Ignoring onerror event** - Connection failures are silent, users see stale data
- **Not checking readyState in onerror** - Can't distinguish reconnection from permanent failure
- **Token in URL query string** - Security risk: visible in server logs, browser history
- **No message validation** - Malformed JSON crashes handlers, XSS if rendered

### Medium Priority Issues

- **Not using event IDs** - Can't recover missed messages after reconnection
- **Missing keep-alive comments** - Proxies may close "idle" connections
- **EventSource for POST requests** - EventSource only supports GET, use fetch streaming
- **Blocking the main thread** - Large message processing should be chunked or offloaded
- **Not handling retry field** - Server can't control reconnection interval

### Common Mistakes

- **JSON.parse without try-catch** - Malformed messages crash the entire handler
- **Forgetting TextDecoder for fetch streaming** - Partial UTF-8 sequences cause garbled text
- **Not handling buffer boundaries** - Messages split across chunks are missed or duplicated
- **Creating new EventSource without closing old one** - Multiple connections, duplicate messages
- **Not resetting state on reconnection** - Stale data persists, inconsistent UI

### Gotchas & Edge Cases

- **EventSource has no timeout** - Dead connections may not fire onerror for minutes
- **CORS requires explicit headers** - Server must send Access-Control-Allow-Origin
- **HTTP/1.1 browser connection limits** - 6 connections per domain (SSE counts against this)
- **Comments (`:`) are for keep-alive only** - Don't send data in comments
- **Empty data field is valid** - `data:\n\n` sends empty string, not undefined
- **Multi-line data uses multiple data fields** - Not escaped newlines
- **Retry field is in milliseconds** - Not seconds
- **Last-Event-ID persists until new ID** - Blank `id:` field clears it

---

## Anti-Patterns

### No Cleanup on Unmount

Leaving EventSource open causes memory leaks and zombie connections.

```typescript
// WRONG - No cleanup
function LiveFeed() {
  useEffect(() => {
    const eventSource = new EventSource("/api/feed");
    eventSource.onmessage = handleMessage;
    // Missing cleanup - connection stays open forever
  }, []);
}

// CORRECT - Cleanup on unmount
function LiveFeed() {
  useEffect(() => {
    const eventSource = new EventSource("/api/feed");
    eventSource.onmessage = handleMessage;

    return () => {
      eventSource.close(); // Clean up
    };
  }, []);
}
```

### Ignoring readyState in onerror

Without checking readyState, you can't tell if EventSource is reconnecting or dead.

```typescript
// WRONG - No readyState check
eventSource.onerror = () => {
  console.log("Error!"); // Is it reconnecting or dead?
};

// CORRECT - Check readyState
eventSource.onerror = () => {
  if (eventSource.readyState === EventSource.CLOSED) {
    console.log("Connection closed permanently");
    // Manual reconnection needed
  } else if (eventSource.readyState === EventSource.CONNECTING) {
    console.log("Auto-reconnecting...");
    // EventSource is handling it
  }
};
```

### Token in URL Query String

Tokens in URLs are logged by servers and may be cached or shared.

```typescript
// WRONG - Token visible in logs
const eventSource = new EventSource(`/api/events?token=${authToken}`);

// CORRECT - Use cookies
const eventSource = new EventSource("/api/events", {
  withCredentials: true, // Sends cookies
});

// CORRECT - Use fetch streaming with Authorization header
const response = await fetch("/api/events", {
  headers: { Authorization: `Bearer ${authToken}` },
});
```

### No JSON Parse Error Handling

Malformed messages crash the handler.

```typescript
// WRONG - No error handling
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data); // Crashes on malformed JSON
  handleData(data);
};

// CORRECT - Handle parse errors
eventSource.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    handleData(data);
  } catch (error) {
    console.error("Failed to parse SSE message:", event.data);
  }
};
```

### Not Handling Buffer Boundaries in Fetch Streaming

Messages can be split across chunks, causing missed or garbled data.

```typescript
// WRONG - Assumes complete messages
for await (const chunk of response.body) {
  const text = new TextDecoder().decode(chunk);
  handleMessage(text); // May be incomplete!
}

// CORRECT - Buffer and split on message boundaries
const decoder = new TextDecoder();
let buffer = "";

for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true });
  const parts = buffer.split("\n\n");
  buffer = parts.pop() || ""; // Keep incomplete message

  for (const part of parts) {
    if (part.trim()) handleMessage(part);
  }
}
```

### Missing Server Headers

Incorrect headers cause connection failures or unexpected behavior.

```typescript
// WRONG - Missing required headers
res.write("data: hello\n\n"); // May be buffered by proxy

// CORRECT - Set all required headers
res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.setHeader("X-Accel-Buffering", "no"); // For nginx
res.write("data: hello\n\n");
```

### Creating Multiple EventSources

Creating new EventSource without closing old one causes duplicate connections.

```typescript
// WRONG - Multiple connections
function reconnect() {
  const newEventSource = new EventSource(url);
  // Old one still open!
}

// CORRECT - Close old before creating new
function reconnect() {
  if (eventSourceRef.current) {
    eventSourceRef.current.close();
  }
  eventSourceRef.current = new EventSource(url);
}
```

---

## SSE Message Format Reference

### Field Types

| Field | Purpose | Example |
|-------|---------|---------|
| `data:` | Message payload | `data: {"type": "update"}` |
| `event:` | Named event type | `event: notification` |
| `id:` | Event ID for recovery | `id: msg-12345` |
| `retry:` | Reconnect interval (ms) | `retry: 5000` |
| `:` | Comment (keep-alive) | `: heartbeat` |

### Message Examples

```
: Simple comment (keep-alive)

data: Simple text message

data: {"json": "message", "value": 42}
id: 1

event: notification
data: {"title": "Alert", "body": "Something happened"}
id: 2

data: Line 1
data: Line 2
data: Line 3
id: 3

event: done
data: [DONE]

retry: 10000
data: Server requested 10s reconnect interval
```

### Key Behaviors

| Behavior | Description |
|----------|-------------|
| Message separator | Double newline (`\n\n`) |
| Multi-line data | Multiple `data:` fields joined with `\n` |
| ID persistence | Last `id:` persists until changed or cleared |
| Retry persistence | Last `retry:` used for all reconnections |
| Comments ignored | Lines starting with `:` are not delivered |

---

## Quick Reference

### EventSource ReadyState Values

| Value | Constant | Description |
|-------|----------|-------------|
| 0 | `EventSource.CONNECTING` | Connecting or reconnecting |
| 1 | `EventSource.OPEN` | Connected, receiving events |
| 2 | `EventSource.CLOSED` | Connection closed, no reconnect |

### Required Server Response Headers

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no        # For nginx proxy
```

### EventSource Behavior Summary

| Scenario | EventSource Behavior |
|----------|---------------------|
| Network error | Auto-reconnects with retry interval |
| HTTP 200 + close | Auto-reconnects |
| HTTP 4xx/5xx | CLOSED state, no auto-reconnect |
| Server sends `retry:` | Updates reconnection interval |
| Server sends `id:` | Sends `Last-Event-ID` on reconnect |

### Connection Checklist

- [ ] Cleanup on unmount (`eventSource.close()`)
- [ ] Handle onerror with readyState check
- [ ] Use event IDs for message recovery
- [ ] Send keep-alive comments to prevent proxy timeout
- [ ] Set all required server headers
- [ ] Handle JSON parse errors

### Security Checklist

- [ ] Use HTTPS in production
- [ ] Token via cookies or fetch headers (not URL)
- [ ] Validate incoming message data
- [ ] Set proper CORS headers on server

### Performance Checklist

- [ ] Use HTTP/2 for multiple streams
- [ ] Configure proxy buffering off
- [ ] Send keep-alive every 15-30 seconds
- [ ] Limit message size (< 100KB recommended)
- [ ] Consider message batching for high-frequency updates
