# Pinia - SSR Examples

> Extended examples for server-side rendering considerations with Pinia. See [core.md](core.md) for core patterns.

**Prerequisites**: Understand Pattern 3 (Setup Store Definition) from core examples first.

---

## SSR-Safe Store

> **Note:** This pattern builds on [Pattern 3: Setup Store Definition](core.md#pattern-3-setup-store-definition).

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

  // Hydrate function for SSR
  hydrate(storeState) {
    // Called during client-side hydration
    // Can access browser APIs here safely
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        storeState.token = storedToken;
      }
    }
  },
});
```

**Why good:** SSR-safe defaults (no browser APIs in state init), guards localStorage access with `typeof window`, provides hydrate function for client-side initialization

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

## Nuxt Integration

### Nuxt Integration Example

```typescript
// stores/nuxt-store.ts
import { ref, computed, watch } from "vue";
import { defineStore } from "pinia";

export const useNuxtStore = defineStore("nuxt", () => {
  const count = ref(0);
  const doubled = computed(() => count.value * 2);

  function increment(): void {
    count.value++;
  }

  // Client-only logic
  if (import.meta.client) {
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

**Why good:** Uses `import.meta.client` guard for browser-only code, watch persists changes only on client
