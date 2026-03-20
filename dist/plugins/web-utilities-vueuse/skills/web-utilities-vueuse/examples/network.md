# VueUse Network Examples

> useFetch, useWebSocket, useEventSource patterns. See [core.md](core.md) for basics.

**Prerequisites**: Understand VueUse composable calling conventions from core examples first.

---

## useFetch - Reactive HTTP Requests

### Good Example - Basic Fetch with Type Safety

```vue
<script setup lang="ts">
import { useFetch } from "@vueuse/core";
import { computed, ref } from "vue";

interface User {
  id: number;
  name: string;
  email: string;
}

const userId = ref(1);
const url = computed(() => `/api/users/${userId.value}`);

// Auto-fetches on mount and when URL changes
const { data, isFetching, error, statusCode } = useFetch(url, {
  refetch: true,
}).json<User>();

// data is Ref<User | null>
</script>

<template>
  <div v-if="isFetching">Loading...</div>
  <div v-else-if="error">Error: {{ error }}</div>
  <div v-else-if="data">
    <h2>{{ data.name }}</h2>
    <p>{{ data.email }}</p>
  </div>
</template>
```

**Why good:** reactive URL triggers refetch, `.json<User>()` provides typed response, loading/error states built-in

---

### Good Example - Manual Fetch with POST

```vue
<script setup lang="ts">
import { useFetch } from "@vueuse/core";
import { ref } from "vue";

interface CreateUserPayload {
  name: string;
  email: string;
}

interface CreateUserResponse {
  id: number;
  name: string;
}

const formData = ref<CreateUserPayload>({ name: "", email: "" });

const { data, execute, isFetching, error } = useFetch("/api/users", {
  immediate: false, // don't fetch on mount
})
  .post(formData)
  .json<CreateUserResponse>();

async function handleSubmit(): Promise<void> {
  await execute();
  if (!error.value && data.value) {
    console.log("Created user:", data.value.id);
  }
}
</script>
```

**Why good:** `immediate: false` prevents auto-fetch, `execute()` for manual trigger, reactive body updates automatically

---

### Good Example - createFetch for Reusable API Client

```typescript
// composables/api.ts
import { createFetch } from "@vueuse/core";

const API_TIMEOUT_MS = 10000;

export const useApi = createFetch({
  baseUrl: "/api",
  options: {
    timeout: API_TIMEOUT_MS,
    async beforeFetch({ options }) {
      const token = getAuthToken();
      if (token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      return { options };
    },
    async afterFetch(ctx) {
      // Transform response if needed
      return ctx;
    },
    async onFetchError(ctx) {
      if (ctx.response?.status === 401) {
        redirectToLogin();
      }
      return ctx;
    },
  },
});
```

```vue
<!-- Usage in component -->
<script setup lang="ts">
import { useApi } from "@/composables/api";

// Inherits base URL, auth headers, error handling
const { data } = useApi("/users").json<User[]>();
</script>
```

**Why good:** centralized auth, error handling, and timeouts; all components inherit the configuration; interceptor pattern matches industry standards

---

## useWebSocket - Real-Time Communication

### Good Example - WebSocket with Auto-Reconnect

```vue
<script setup lang="ts">
import { useWebSocket } from "@vueuse/core";
import { watch, computed, ref } from "vue";

interface ChatMessage {
  user: string;
  text: string;
  timestamp: number;
}

const WS_HEARTBEAT_MS = 30000;
const MAX_RECONNECT_RETRIES = 5;
const RECONNECT_DELAY_MS = 3000;

const messages = ref<ChatMessage[]>([]);

const { data, status, send, open, close } = useWebSocket(
  "wss://chat.example.com/ws",
  {
    autoReconnect: {
      retries: MAX_RECONNECT_RETRIES,
      delay: RECONNECT_DELAY_MS,
    },
    heartbeat: {
      message: "ping",
      interval: WS_HEARTBEAT_MS,
    },
    onMessage(_ws, event) {
      const msg = JSON.parse(event.data) as ChatMessage;
      messages.value.push(msg);
    },
  },
);

const isConnected = computed(() => status.value === "OPEN");

function sendMessage(text: string): void {
  send(JSON.stringify({ text, timestamp: Date.now() }));
}
</script>
```

**Why good:** auto-reconnect with configurable retries, heartbeat keeps connection alive, reactive `status` for connection state, typed messages

---

## useEventSource - Server-Sent Events

### Good Example - Live Notifications

```vue
<script setup lang="ts">
import { useEventSource } from "@vueuse/core";
import { ref, watch } from "vue";

interface Notification {
  id: string;
  message: string;
  type: "info" | "warning" | "error";
}

const notifications = ref<Notification[]>([]);

const { data, status, error, eventSource } = useEventSource(
  "/api/notifications/stream",
  [],
  {
    withCredentials: true,
  },
);

// data updates with each SSE message
watch(data, (raw) => {
  if (raw) {
    const notification = JSON.parse(raw) as Notification;
    notifications.value.push(notification);
  }
});
</script>

<template>
  <div>
    <span :class="status === 'OPEN' ? 'connected' : 'disconnected'">
      {{ status }}
    </span>
    <ul>
      <li v-for="n in notifications" :key="n.id">
        [{{ n.type }}] {{ n.message }}
      </li>
    </ul>
  </div>
</template>
```

**Why good:** reactive SSE data, connection status tracking, auto-reconnect built-in, `withCredentials` for authenticated streams
