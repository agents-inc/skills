# Socket.IO Reference

> Option tables, event names and checklists. See [SKILL.md](SKILL.md) for the decisions and red flags, and [examples/](examples/) for code.

---

## What the Protocol Layer Adds

Measured against the native WebSocket API Socket.IO runs on top of.

| Feature            | Socket.IO             | Native WebSocket          |
| ------------------ | --------------------- | ------------------------- |
| Transport fallback | Automatic             | Hand-written              |
| Reconnection       | Built-in              | Hand-written              |
| Rooms              | Built-in              | Hand-written, server-side |
| Namespaces         | Built-in              | Not available             |
| Acknowledgments    | Built-in              | Hand-written              |
| Protocol           | Custom (incompatible) | Standard WebSocket        |
| Bundle cost        | ~14.5KB gzipped       | None                      |

---

## Rooms vs Namespaces

| Feature          | Rooms                 | Namespaces                          |
| ---------------- | --------------------- | ----------------------------------- |
| Client awareness | No                    | Yes                                 |
| Join / leave     | Server-side only      | Client connects to it               |
| Own middleware   | No                    | Yes, including its own `auth`       |
| Use case         | Targeted broadcasting | Feature separation                  |
| Example          | Chat rooms, lobbies   | `/chat`, `/admin`, `/notifications` |

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

### Deployment Checklist

Items beyond what SKILL.md's requirements and red flags already cover.

- [ ] Secure origin in production (`https://` / `wss://`)
- [ ] Server CORS allows the app's origin, and `credentials` where cookie auth is used
- [ ] Server-side rate limiting on inbound events
- [ ] Inbound event payloads validated before use — a typed interface is a compile-time claim, not a runtime one
- [ ] One socket instance shared across the app rather than one per component
- [ ] Message queue in place for sends attempted while disconnected
