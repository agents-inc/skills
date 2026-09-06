# SSE Reference

> Wire format, field behaviour and lookup tables for Server-Sent Events. The decisions and the red flags are in [SKILL.md](SKILL.md); the code is in [examples/](examples/).

---

## SSE Message Format Reference

### Field Types

| Field    | Purpose                 | Example                    |
| -------- | ----------------------- | -------------------------- |
| `data:`  | Message payload         | `data: {"type": "update"}` |
| `event:` | Named event type        | `event: notification`      |
| `id:`    | Event ID for recovery   | `id: msg-12345`            |
| `retry:` | Reconnect interval (ms) | `retry: 5000`              |
| `:`      | Comment (keep-alive)    | `: heartbeat`              |

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

| Behavior          | Description                                  |
| ----------------- | -------------------------------------------- |
| Message separator | Double newline (`\n\n`)                      |
| Multi-line data   | Multiple `data:` fields joined with `\n`     |
| ID persistence    | Last `id:` persists until changed or cleared |
| Retry persistence | Last `retry:` used for all reconnections     |
| Comments ignored  | Lines starting with `:` are not delivered    |

---

## Quick Reference

### EventSource ReadyState Values

| Value | Constant                 | Description                     |
| ----- | ------------------------ | ------------------------------- |
| 0     | `EventSource.CONNECTING` | Connecting or reconnecting      |
| 1     | `EventSource.OPEN`       | Connected, receiving events     |
| 2     | `EventSource.CLOSED`     | Connection closed, no reconnect |

### Required Server Response Headers

```http
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no        # For nginx proxy
```

**Note:** `Connection: keep-alive` is **prohibited in HTTP/2 and HTTP/3** (Safari rejects responses containing it). Only set it if you are certain clients use HTTP/1.1.

### EventSource Behavior Summary

| Scenario              | EventSource Behavior                |
| --------------------- | ----------------------------------- |
| Network error         | Auto-reconnects with retry interval |
| HTTP 200 + close      | Auto-reconnects                     |
| HTTP 4xx/5xx          | CLOSED state, no auto-reconnect     |
| Server sends `retry:` | Updates reconnection interval       |
| Server sends `id:`    | Sends `Last-Event-ID` on reconnect  |

### Deployment Checklist

Items beyond what SKILL.md's requirements and red flags already cover.

- [ ] HTTPS in production
- [ ] `Access-Control-Allow-Origin` set, plus `Access-Control-Allow-Credentials` where `withCredentials` is used
- [ ] Reverse-proxy buffering disabled for the stream route
- [ ] HTTP/2 available where a page opens more than one stream
- [ ] Keep-alive comment every 15–30 seconds
- [ ] Message size kept small (under ~100KB) and high-frequency updates batched
