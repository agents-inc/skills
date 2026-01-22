# Vue 3 Composition API - Lifecycle Examples

> Resource cleanup and lifecycle hook patterns. See [SKILL.md](../SKILL.md) for concepts.

---

## WebSocket with Reconnection

### Good Example - Complete WebSocket lifecycle management

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

const messages = ref<string[]>([]);
const isConnected = ref(false);
const reconnectAttempts = ref(0);

let ws: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

function connect() {
  ws = new WebSocket("wss://api.example.com/ws");

  ws.onopen = () => {
    isConnected.value = true;
    reconnectAttempts.value = 0;
  };

  ws.onmessage = (event) => {
    messages.value.push(event.data);
  };

  ws.onclose = () => {
    isConnected.value = false;
    attemptReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function attemptReconnect() {
  if (reconnectAttempts.value >= MAX_RECONNECT_ATTEMPTS) {
    console.error("Max reconnect attempts reached");
    return;
  }

  reconnectAttempts.value++;
  reconnectTimeout = setTimeout(connect, RECONNECT_DELAY_MS);
}

function cleanup() {
  // Clear timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Close WebSocket
  if (ws) {
    ws.onclose = null; // Prevent reconnect on intentional close
    ws.close();
    ws = null;
  }
}

onMounted(() => {
  connect();
});

onUnmounted(() => {
  cleanup();
});
</script>
```

**Why good:** Complete cleanup of WebSocket and timeout, prevents reconnect on intentional close, named constants for configuration, proper null checks before cleanup

---

## Cleanup Pattern Summary

### Resource Cleanup Checklist

```typescript
// Pattern for any external resource
let resource: SomeResource | null = null;

function cleanup() {
  if (resource) {
    resource.dispose(); // Or .close(), .disconnect(), etc.
    resource = null;
  }
}

onMounted(() => {
  resource = createResource();
});

onUnmounted(() => {
  cleanup();
});
```

### Common Resources to Clean Up

| Resource             | Cleanup Method                 |
| -------------------- | ------------------------------ |
| WebSocket            | `ws.close()`                   |
| setTimeout           | `clearTimeout(id)`             |
| setInterval          | `clearInterval(id)`            |
| IntersectionObserver | `observer.disconnect()`        |
| MutationObserver     | `observer.disconnect()`        |
| ResizeObserver       | `observer.disconnect()`        |
| EventListener        | `target.removeEventListener()` |
| AbortController      | `controller.abort()`           |

---

## Event Listener Cleanup

### Good Example - Event listener with cleanup

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const SCROLL_THRESHOLD = 100;

const isScrolled = ref(false);

function handleScroll() {
  isScrolled.value = window.scrollY > SCROLL_THRESHOLD;
}

onMounted(() => {
  window.addEventListener("scroll", handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>

<template>
  <header :class="{ 'header--scrolled': isScrolled }">
    <!-- content -->
  </header>
</template>
```

**Why good:** Passive listener for performance, cleanup removes listener, named constant for threshold

---

## Timer Cleanup

### Good Example - Interval with cleanup

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const POLL_INTERVAL_MS = 5000;

const data = ref<unknown>(null);
let intervalId: ReturnType<typeof setInterval> | null = null;

async function fetchData() {
  const response = await fetch("/api/data");
  data.value = await response.json();
}

onMounted(() => {
  fetchData();
  intervalId = setInterval(fetchData, POLL_INTERVAL_MS);
});

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
});
</script>
```

**Why good:** Initial fetch plus polling, proper cleanup prevents memory leaks, named constant for interval

---

## See Also

- [composables.md](composables.md) - Cleanup in composables
- [async.md](async.md) - Async component patterns
