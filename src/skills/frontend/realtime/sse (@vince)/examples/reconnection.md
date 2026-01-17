# SSE Examples - Reconnection Patterns

> Advanced reconnection patterns for Server-Sent Events. See [SKILL.md](../SKILL.md) for concepts and [core.md](core.md) for basic patterns.

---

## Pattern 11: Message Recovery with Last-Event-ID

Recover missed messages after reconnection using event IDs.

### Server-Side Requirements

The server must:
1. Include `id:` field in events
2. Read `Last-Event-ID` header on reconnection
3. Replay missed events before continuing

### Client Implementation

```typescript
// ✅ Good Example - Message recovery aware client
const SSE_URL = "/api/events";

interface RecoverableMessage {
  id: string;
  type: string;
  data: unknown;
  sequence: number;
}

class RecoverableSSEClient {
  private eventSource: EventSource | null = null;
  private lastEventId: string | null = null;
  private messageBuffer: RecoverableMessage[] = [];
  private onMessage: (message: RecoverableMessage) => void;

  constructor(onMessage: (message: RecoverableMessage) => void) {
    this.onMessage = onMessage;
  }

  connect(): void {
    // EventSource automatically sends Last-Event-ID header
    // based on the last received id: field
    this.eventSource = new EventSource(SSE_URL);

    this.eventSource.onopen = () => {
      console.log("Connected. Last-Event-ID:", this.lastEventId);
    };

    this.eventSource.onmessage = (event: MessageEvent) => {
      // Track the event ID
      if (event.lastEventId) {
        this.lastEventId = event.lastEventId;
      }

      const message: RecoverableMessage = {
        id: event.lastEventId || `local-${Date.now()}`,
        ...JSON.parse(event.data),
      };

      // Deduplicate (server might replay on reconnect)
      if (!this.messageBuffer.some((m) => m.id === message.id)) {
        this.messageBuffer.push(message);
        this.onMessage(message);
      }
    };

    this.eventSource.onerror = () => {
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        console.log("Connection closed. Will reconnect with Last-Event-ID:", this.lastEventId);
        // EventSource will auto-reconnect and send Last-Event-ID header
      }
    };
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }
}

export { RecoverableSSEClient };
```

**Why good:** Tracks lastEventId for recovery awareness, deduplicates replayed messages, EventSource automatically handles Last-Event-ID header, buffer prevents duplicates

---

## Pattern 12: Manual Reconnection with Exponential Backoff

For scenarios where EventSource auto-reconnection isn't sufficient (HTTP errors, custom logic).

### Constants

```typescript
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const BACKOFF_MULTIPLIER = 2;
const JITTER_FACTOR = 0.5;
const MAX_RETRY_ATTEMPTS = 10;
```

### Implementation

```typescript
// ✅ Good Example - Manual reconnection with backoff
function calculateBackoffWithJitter(attempt: number): number {
  const exponentialDelay = Math.min(
    INITIAL_RETRY_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt),
    MAX_RETRY_DELAY_MS
  );

  // Add jitter: random value between 50% and 150% of delay
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() * 2 - 1);

  return Math.floor(exponentialDelay + jitter);
}

class RobustSSEClient {
  private eventSource: EventSource | null = null;
  private retryCount = 0;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private url: string;
  private onMessage: (data: unknown) => void;
  private onStatusChange?: (status: string) => void;

  constructor(
    url: string,
    onMessage: (data: unknown) => void,
    onStatusChange?: (status: string) => void
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  connect(): void {
    if (this.eventSource) {
      return;
    }

    this.intentionalClose = false;
    this.onStatusChange?.("connecting");

    this.eventSource = new EventSource(this.url);

    this.eventSource.onopen = () => {
      this.retryCount = 0;
      this.onStatusChange?.("connected");
    };

    this.eventSource.onmessage = (event) => {
      this.onMessage(JSON.parse(event.data));
    };

    this.eventSource.onerror = () => {
      // EventSource auto-closes on HTTP errors (4xx, 5xx)
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.eventSource = null;

        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.retryCount >= MAX_RETRY_ATTEMPTS) {
      this.onStatusChange?.("failed");
      console.error("Max retry attempts reached");
      return;
    }

    const delay = calculateBackoffWithJitter(this.retryCount);
    this.retryCount++;

    this.onStatusChange?.(`reconnecting in ${Math.round(delay / 1000)}s`);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.retryCount})`);

    this.retryTimeoutId = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.intentionalClose = true;

    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.onStatusChange?.("disconnected");
  }

  resetRetryCount(): void {
    this.retryCount = 0;
  }
}

export { RobustSSEClient };
```

**Why good:** Exponential backoff prevents server overload, jitter prevents thundering herd, retry limit prevents infinite loops, intentional close flag prevents unwanted reconnection, status callbacks for UI updates

---

## Pattern 13: Reconnection with Health Check

Verify server health before attempting reconnection.

### Constants

```typescript
const HEALTH_CHECK_URL = "/api/health";
const HEALTH_CHECK_TIMEOUT_MS = 5000;
const HEALTH_CHECK_INTERVAL_MS = 10000;
```

### Implementation

```typescript
// ✅ Good Example - Health check before reconnection
async function checkServerHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      HEALTH_CHECK_TIMEOUT_MS
    );

    const response = await fetch(HEALTH_CHECK_URL, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

class HealthAwareSSEClient {
  private eventSource: EventSource | null = null;
  private healthCheckIntervalId: ReturnType<typeof setInterval> | null = null;
  private url: string;
  private onMessage: (data: unknown) => void;
  private onHealthStatus?: (healthy: boolean) => void;

  constructor(
    url: string,
    onMessage: (data: unknown) => void,
    onHealthStatus?: (healthy: boolean) => void
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onHealthStatus = onHealthStatus;
  }

  async connect(): Promise<void> {
    // Check server health before connecting
    const healthy = await checkServerHealth();
    this.onHealthStatus?.(healthy);

    if (!healthy) {
      console.log("Server unhealthy, scheduling health check");
      this.startHealthCheck();
      return;
    }

    this.stopHealthCheck();
    this.eventSource = new EventSource(this.url);

    this.eventSource.onmessage = (event) => {
      this.onMessage(JSON.parse(event.data));
    };

    this.eventSource.onerror = () => {
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.eventSource = null;
        this.onHealthStatus?.(false);
        this.startHealthCheck();
      }
    };
  }

  private startHealthCheck(): void {
    if (this.healthCheckIntervalId) return;

    this.healthCheckIntervalId = setInterval(async () => {
      const healthy = await checkServerHealth();
      this.onHealthStatus?.(healthy);

      if (healthy) {
        this.connect();
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }
  }

  disconnect(): void {
    this.stopHealthCheck();
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export { HealthAwareSSEClient };
```

**Why good:** Health check prevents futile reconnection attempts, interval-based retry while server is down, stops health check once connected, proper cleanup of all timers

---

## Pattern 14: Connection with Visibility-Based Pause

Pause/resume SSE based on page visibility to save resources.

```typescript
// ✅ Good Example - Visibility-aware SSE connection
const RECONNECT_DELAY_ON_VISIBLE_MS = 500;

class VisibilityAwareSSE {
  private eventSource: EventSource | null = null;
  private lastEventId: string | null = null;
  private url: string;
  private onMessage: (data: unknown) => void;

  constructor(url: string, onMessage: (data: unknown) => void) {
    this.url = url;
    this.onMessage = onMessage;
    this.setupVisibilityListener();
  }

  private setupVisibilityListener(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    });
  }

  connect(): void {
    if (document.hidden) {
      console.log("Page hidden, deferring connection");
      return;
    }

    this.eventSource = new EventSource(this.url);

    this.eventSource.onmessage = (event) => {
      this.lastEventId = event.lastEventId || null;
      this.onMessage(JSON.parse(event.data));
    };

    this.eventSource.onerror = () => {
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.eventSource = null;
      }
    };
  }

  private pause(): void {
    if (this.eventSource) {
      console.log("Pausing SSE connection (page hidden)");
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private resume(): void {
    if (!this.eventSource) {
      console.log("Resuming SSE connection (page visible)");
      // Small delay to avoid rapid pause/resume cycles
      setTimeout(() => {
        if (!document.hidden) {
          this.connect();
        }
      }, RECONNECT_DELAY_ON_VISIBLE_MS);
    }
  }

  disconnect(): void {
    document.removeEventListener("visibilitychange", this.setupVisibilityListener);
    this.eventSource?.close();
    this.eventSource = null;
  }
}

export { VisibilityAwareSSE };
```

**Why good:** Saves server resources when tab is hidden, auto-reconnects when tab becomes visible, tracks lastEventId for potential recovery, debounce prevents rapid reconnect cycles

---

## Pattern 15: React Hook with Auto-Reconnection

A React hook with built-in reconnection logic.

### Constants

```typescript
const DEFAULT_RECONNECT_ATTEMPTS = 5;
const DEFAULT_RECONNECT_INTERVAL_MS = 3000;
```

### Hook Implementation

```typescript
// hooks/use-sse-with-reconnect.ts
import { useCallback, useEffect, useRef, useState } from "react";

type SSEStatus = "connecting" | "connected" | "reconnecting" | "failed" | "disconnected";

interface UseSSEReconnectOptions {
  url: string;
  maxReconnectAttempts?: number;
  reconnectIntervalMs?: number;
  onMessage?: (data: unknown) => void;
  enabled?: boolean;
}

interface UseSSEReconnectReturn {
  status: SSEStatus;
  reconnectAttempt: number;
  disconnect: () => void;
  reconnect: () => void;
}

export function useSSEWithReconnect(
  options: UseSSEReconnectOptions
): UseSSEReconnectReturn {
  const {
    url,
    maxReconnectAttempts = DEFAULT_RECONNECT_ATTEMPTS,
    reconnectIntervalMs = DEFAULT_RECONNECT_INTERVAL_MS,
    onMessage,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<SSEStatus>("disconnected");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalDisconnectRef = useRef(false);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    setStatus("connecting");
    intentionalDisconnectRef.current = false;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus("connected");
      setReconnectAttempt(0);
    };

    eventSource.onmessage = (event) => {
      onMessage?.(JSON.parse(event.data));
    };

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null;

        if (intentionalDisconnectRef.current) {
          setStatus("disconnected");
          return;
        }

        setReconnectAttempt((prev) => {
          const nextAttempt = prev + 1;

          if (nextAttempt > maxReconnectAttempts) {
            setStatus("failed");
            return prev;
          }

          setStatus("reconnecting");
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectIntervalMs);

          return nextAttempt;
        });
      }
    };
  }, [url, enabled, maxReconnectAttempts, reconnectIntervalMs, onMessage]);

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true;
    clearReconnectTimeout();

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setStatus("disconnected");
    setReconnectAttempt(0);
  }, [clearReconnectTimeout]);

  const reconnect = useCallback(() => {
    disconnect();
    setReconnectAttempt(0);
    // Small delay before reconnecting
    setTimeout(() => {
      intentionalDisconnectRef.current = false;
      connect();
    }, 100);
  }, [disconnect, connect]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      clearReconnectTimeout();
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [enabled, connect, clearReconnectTimeout]);

  return { status, reconnectAttempt, disconnect, reconnect };
}
```

### Usage

```typescript
// components/live-dashboard.tsx
import { useSSEWithReconnect } from "../hooks/use-sse-with-reconnect";

const SSE_URL = "/api/dashboard/stream";

export function LiveDashboard() {
  const { status, reconnectAttempt, disconnect, reconnect } = useSSEWithReconnect({
    url: SSE_URL,
    maxReconnectAttempts: 5,
    reconnectIntervalMs: 3000,
    onMessage: (data) => {
      console.log("Dashboard update:", data);
    },
  });

  return (
    <div>
      <header>
        Status: {status}
        {status === "reconnecting" && ` (attempt ${reconnectAttempt})`}
      </header>

      {status === "failed" && (
        <button onClick={reconnect}>Retry Connection</button>
      )}

      {status === "connected" && (
        <button onClick={disconnect}>Disconnect</button>
      )}
    </div>
  );
}
```

**Why good:** Configurable retry limits and intervals, status tracking includes reconnect attempts, manual reconnect resets attempt counter, intentional disconnect flag prevents unwanted reconnection, proper cleanup on unmount
