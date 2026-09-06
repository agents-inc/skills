# VueUse Network Examples

> `useFetch`, `createFetch`, `useWebSocket` and `useEventSource`. See [SKILL.md](../SKILL.md) for
> the decisions and [core.md](core.md) for the calling conventions.

---

## useFetch

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

// Fires on mount, and again whenever `url` changes — aborting the previous request
const { data, isFetching, error, statusCode } = useFetch(url, {
  refetch: true,
}).json<User>();
// data: Ref<User | null>
</script>

<template>
  <p v-if="isFetching">Loading…</p>
  <p v-else-if="error">{{ error }}</p>
  <template v-else-if="data">
    <h2>{{ data.name }}</h2>
    <p>{{ data.email }}</p>
  </template>
</template>
```

`.json<T>()` is what parses and types the body — without it `data` is `Ref<string | null>`.
`.text()` and `.blob()` are the alternatives.

There is no cache. Two components fetching the same URL make two requests, and re-mounting refetches.
Where that matters, hoist the call into a shared composable.

### Manual and non-GET

```vue
<script setup lang="ts">
import { useFetch } from "@vueuse/core";
import { ref } from "vue";

const form = ref({ name: "", email: "" });

const { data, execute, isFetching, error } = useFetch("/api/users", {
  immediate: false, // nothing happens until execute()
})
  .post(form) // a ref body is read at request time
  .json<{ id: number }>();

async function submit(): Promise<void> {
  await execute();
  if (!error.value && data.value) onCreated(data.value.id);
}
</script>
```

`execute()` resolves when the request settles, but it does not reject — the outcome is in `error`,
so the check after the `await` is what branches.

### createFetch for a configured client

```typescript
// api.ts
import { createFetch } from "@vueuse/core";

export const useApi = createFetch({
  baseUrl: "/api",
  options: {
    timeout: 10_000,
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
    async onFetchError(ctx) {
      if (ctx.response?.status === 401) redirectToLogin();
      return ctx; // returning the context lets the caller's own error path still run
    },
  },
});
```

```vue
<script setup lang="ts">
import { useApi } from "./api";

const { data } = useApi("/users").json<User[]>();
</script>
```

The three hooks — `beforeFetch`, `afterFetch` and `onFetchError` — are all `async`, so
`beforeFetch` can await a token refresh before the request goes out. Each must return its context
object; returning nothing drops the request's options.

---

## useWebSocket

```vue
<script setup lang="ts">
import { useWebSocket } from "@vueuse/core";
import { computed, ref } from "vue";

interface ChatMessage {
  user: string;
  text: string;
  timestamp: number;
}

const messages = ref<ChatMessage[]>([]);

const { status, send, open, close } = useWebSocket(
  "wss://chat.example.com/ws",
  {
    autoReconnect: {
      retries: 5, // bounded — the default retries indefinitely
      delay: 3000,
      onFailed: () => showOfflineBanner(),
    },
    heartbeat: {
      message: "ping",
      interval: 30_000,
      pongTimeout: 5000, // treat a missing pong as a dead connection
    },
    onMessage(_ws, event) {
      messages.value.push(JSON.parse(event.data) as ChatMessage);
    },
  },
);

const isConnected = computed(() => status.value === "OPEN");

const sendMessage = (text: string) =>
  send(JSON.stringify({ text, timestamp: Date.now() }));
</script>
```

Two settings decide whether this behaves in production. Unbounded `autoReconnect` against a server
that is rejecting connections is a retry loop, so give it `retries` and an `onFailed`. And a
`heartbeat` without a `pongTimeout` detects a closed socket but not a hung one — the case where TCP
stays open and nothing arrives.

`send` buffers by default while the socket is connecting; pass `false` as its second argument to
drop instead.

---

## useEventSource

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

// The second argument names the server's custom events; [] means the default
// "message" event only
const { data, status, error } = useEventSource(
  "/api/notifications/stream",
  [],
  {
    withCredentials: true,
  },
);

watch(data, (raw) => {
  if (raw) notifications.value.push(JSON.parse(raw) as Notification);
});
</script>
```

Server-sent events reconnect on their own and are one-directional, which makes them the simpler
choice than a WebSocket wherever the client has nothing to send. The trade is that `EventSource`
carries no custom headers — authentication travels by cookie, which is what `withCredentials`
enables.
