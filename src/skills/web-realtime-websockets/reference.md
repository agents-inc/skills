# WebSocket Reference

> Close codes, readyState values and the anti-patterns whose code is not in the examples. The decisions and the red flags are in [SKILL.md](SKILL.md); the implementations are in [examples/](examples/).

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

### Deployment Checklist

Items beyond what SKILL.md's requirements and red flags already cover.

- [ ] Heartbeat interval short enough for the shortest proxy idle timeout in the path (20–30s is the usual safe range)
- [ ] Retry ceiling and backoff cap both set, so a permanently unreachable server stops being polled
- [ ] Intentional closes tracked separately from close code `1000`
- [ ] Inbound messages validated before use — a discriminated union is a compile-time claim, not a runtime one
- [ ] Auth expiry handled: the server closes the connection, and the reconnect path fetches a fresh token
- [ ] Queue size bounded, and the drop policy chosen deliberately (oldest or newest)
- [ ] `bufferedAmount` consulted before large sends
