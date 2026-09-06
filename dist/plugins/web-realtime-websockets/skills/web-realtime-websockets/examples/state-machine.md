# WebSocket - State Machine Pattern

> Connection state machine for managing complex WebSocket states. See [core.md](core.md) for basic patterns.

---

## Pattern 12: Connection State Machine

A robust state machine for managing complex WebSocket connection states.

```typescript
// lib/websocket-state-machine.ts

type ConnectionState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "connected"; connectedAt: number }
  | { status: "reconnecting"; attempt: number; nextRetryAt: number }
  | { status: "disconnected"; reason: string }
  | { status: "failed"; error: string; attempts: number };

type ConnectionEvent =
  | { type: "CONNECT" }
  | { type: "CONNECTED" }
  | { type: "DISCONNECT"; reason: string }
  | { type: "ERROR"; error: string }
  | { type: "RETRY_SCHEDULED"; attempt: number; delay: number }
  | { type: "MAX_RETRIES_REACHED" };

const MAX_RETRY_ATTEMPTS = 10;

function connectionReducer(
  state: ConnectionState,
  event: ConnectionEvent,
): ConnectionState {
  switch (event.type) {
    case "CONNECT":
      if (
        state.status === "idle" ||
        state.status === "disconnected" ||
        state.status === "failed"
      ) {
        return { status: "connecting" };
      }
      return state;

    case "CONNECTED":
      return { status: "connected", connectedAt: Date.now() };

    case "DISCONNECT":
      if (state.status === "connected" || state.status === "connecting") {
        return { status: "disconnected", reason: event.reason };
      }
      return state;

    case "ERROR":
      return { status: "disconnected", reason: event.error };

    case "RETRY_SCHEDULED":
      return {
        status: "reconnecting",
        attempt: event.attempt,
        nextRetryAt: Date.now() + event.delay,
      };

    case "MAX_RETRIES_REACHED":
      if (state.status === "reconnecting") {
        return {
          status: "failed",
          error: "Maximum retry attempts reached",
          attempts: MAX_RETRY_ATTEMPTS,
        };
      }
      return state;

    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

// Usage with React useReducer
import { useReducer } from "react";

function useConnectionState() {
  const [state, dispatch] = useReducer(connectionReducer, { status: "idle" });

  const connect = () => dispatch({ type: "CONNECT" });
  const connected = () => dispatch({ type: "CONNECTED" });
  const disconnect = (reason: string) =>
    dispatch({ type: "DISCONNECT", reason });
  const error = (err: string) => dispatch({ type: "ERROR", error: err });
  const scheduleRetry = (attempt: number, delay: number) =>
    dispatch({ type: "RETRY_SCHEDULED", attempt, delay });
  const maxRetriesReached = () => dispatch({ type: "MAX_RETRIES_REACHED" });

  return {
    state,
    connect,
    connected,
    disconnect,
    error,
    scheduleRetry,
    maxRetriesReached,
  };
}
```

**Why good:** Each status carries only the data that status has — an attempt count exists on `reconnecting` and nowhere else, so there is no state to represent "reconnecting, attempt undefined". The `never` in the default branch makes a new event type a compile error, and a reducer is testable without a socket.
