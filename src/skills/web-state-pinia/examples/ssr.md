# Pinia - SSR Examples

> Extended examples for server-side rendering considerations with Pinia. See [core.md](core.md) for core patterns.

**Prerequisites**: Understand [Pattern 1: Options Store](core.md#pattern-1-options-store) and [Pattern 2: Setup Store](core.md#pattern-2-setup-store) from core examples first.

---

## A Pinia Instance Per Request

A store instance belongs to a Pinia instance rather than to a module, so one module-level Pinia on a server is a singleton every request shares. Create one per request, serialise its state into the page, and restore it on the client before any `useStore()` call.

### Good Example - Fresh Instance, Serialised State

```typescript
// entry-server.ts
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import { createPinia } from "pinia";
import devalue from "@nuxt/devalue";
import App from "./App.vue";

export async function render() {
  // A fresh Pinia per request - a module-level one hands one user's
  // state to the next
  const app = createSSRApp(App);
  const pinia = createPinia();
  app.use(pinia);

  const html = await renderToString(app);

  // devalue rather than JSON.stringify: the payload is injected into a
  // <script> tag, and user-controlled state could otherwise close it
  return { html, state: devalue(pinia.state.value) };
}
```

### Good Example - Restoring It on the Client

```typescript
// entry-client.ts
import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import type { StateTree } from "pinia";
import App from "./App.vue";

declare global {
  interface Window {
    __pinia: Record<string, StateTree>;
  }
}

const app = createSSRApp(App);
const pinia = createPinia();
app.use(pinia);

// Restore before any useStore() call, or the store initialises empty and
// overwrites what the server already rendered. devalue emits a live value
// so no parse is needed; a JSON.stringify payload would need JSON.parse.
pinia.state.value = window.__pinia;

app.mount("#app");
```

**Why good:** the instance is per request so no state crosses between users, `pinia.state.value` is the whole serialisable surface in one place, and escaping the payload keeps user-authored state from breaking out of the script tag.

---

## SSR-Safe Store

> **Note:** This pattern builds on [Pattern 1: Options Store](core.md#pattern-1-options-store).

### Good Example - SSR-Safe Store

```typescript
// stores/auth-store.ts
import { defineStore } from "pinia";

const DEFAULT_USER = null;
const DEFAULT_TOKEN = "";
const TOKEN_STORAGE_KEY = "auth-token";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string;
}

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    // SSR-safe defaults - no browser APIs!
    user: DEFAULT_USER,
    token: DEFAULT_TOKEN,
  }),

  getters: {
    isLoggedIn: (state): boolean => state.user !== null,
  },

  actions: {
    // Client-only action for hydration
    hydrateFromStorage(): void {
      // Guard against SSR - only run on client
      if (typeof window === "undefined") return;

      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        this.token = storedToken;
        // Fetch user data with your data fetching solution
      }
    },

    setUser(user: User, token: string): void {
      this.user = user;
      this.token = token;

      // Only access localStorage on client
      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
    },

    logout(): void {
      this.user = DEFAULT_USER;
      this.token = DEFAULT_TOKEN;

      if (typeof window !== "undefined") {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    },
  },

  // Called when the store is hydrated from the serialised state, for
  // values the server could not produce. Browser-only reads stay guarded.
  hydrate(storeState) {
    if (typeof window === "undefined") return;

    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) {
      storeState.token = storedToken;
    }
  },
});
```

**Why good:** the state function holds SSR-safe defaults and no browser API, every `localStorage` read is guarded, and `hydrate` is where a value that only exists on the client gets restored — copying `pinia.state.value` across cannot produce one.

---

## Anti-Patterns

### Bad Example - Browser API in State Initialization

```typescript
// Bad Example - Breaks SSR
export const useBrokenAuthStore = defineStore("auth", {
  state: () => ({
    // BAD: localStorage doesn't exist on server!
    token: localStorage.getItem("token") ?? "",
    theme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
  }),
});
```

**Why bad:** Uses `localStorage` and `window` directly in state initialization, crashes on server where these APIs don't exist

---

## Client-Only Guards in Setup Stores

### Good Example - Client-Only Logic in Setup Store

```typescript
// stores/persisted-counter-store.ts
import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";

export const usePersistedCounterStore = defineStore("persisted-counter", () => {
  const count = ref(0);
  const doubled = computed(() => count.value * 2);

  function increment(): void {
    count.value++;
  }

  // Client-only logic - guard against SSR
  if (typeof window !== "undefined") {
    // Safe to use browser APIs here
    const savedCount = localStorage.getItem("count");
    if (savedCount) {
      count.value = parseInt(savedCount, 10);
    }

    watch(count, (newCount) => {
      localStorage.setItem("count", newCount.toString());
    });
  }

  return {
    count,
    doubled,
    increment,
  };
});
```

**Why good:** browser APIs are guarded by `typeof window`, the watcher persists only on the client, and every ref is returned.

> **Setup-store counterpart to `hydrate`:** wrap any ref whose value only makes sense on the client in `skipHydrate()`, so the serialised server value does not overwrite what the client just read.

> **Note:** Some SSR frameworks provide their own client-only guards (e.g. `import.meta.client`). Use your framework's idiom when available.
