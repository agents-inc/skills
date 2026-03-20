# Svelte 5 Advanced Patterns

> Advanced code examples for Svelte 5 — $inspect, context API, shared state modules, class-based state. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: $inspect — Development Debugging

`$inspect` is a dev-only rune (no-op in production) that logs reactive values when they change.

### Good Example — Debugging State Changes

```svelte
<script lang="ts">
  let count = $state(0);
  let items = $state<string[]>([]);

  // Logs on init and every change (dev only)
  $inspect(count, items);

  // Custom callback with .with()
  $inspect(count).with((type, value) => {
    if (type === 'update') {
      console.trace('Count changed to:', value);
    }
  });

  function addItem(text: string) {
    items.push(text);
  }
</script>
```

**Why good:** Dev-only (no-op in production), tracks deep changes in arrays/objects, `.with()` allows custom handlers like `debugger` statements

### Good Example — $inspect.trace for Effect Debugging

```svelte
<script lang="ts">
  import { doSomeWork } from './utils';

  let a = $state(0);
  let b = $state(0);

  $effect(() => {
    $inspect.trace('my-effect'); // Must be first statement
    doSomeWork(a, b);
  });
</script>
```

**Why good:** Identifies which dependency triggered the effect re-run, custom label for identification, critical debugging tool for complex reactive chains

---

## Pattern 2: Context API with createContext

Use `createContext` for type-safe context that avoids string key collisions.

### Good Example — Theme Context

```ts
// theme-context.svelte.ts
import { createContext } from "svelte";

export type Theme = "light" | "dark" | "system";

interface ThemeContext {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const [getThemeContext, setThemeContext] = createContext<ThemeContext>();
```

```svelte
<!-- theme-provider.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { setThemeContext, type Theme } from './theme-context.svelte';

  interface Props {
    initial?: Theme;
    children: Snippet;
  }

  let { initial = 'system', children }: Props = $props();

  let theme = $state<Theme>(initial);

  setThemeContext({
    get theme() { return theme; },
    setTheme: (t: Theme) => { theme = t; },
  });
</script>

<div class="theme-{theme}">
  {@render children()}
</div>
```

```svelte
<!-- theme-toggle.svelte -->
<script lang="ts">
  import { getThemeContext } from './theme-context.svelte';

  const { theme, setTheme } = getThemeContext();

  const THEMES = ['light', 'dark', 'system'] as const;
</script>

<div class="theme-toggle">
  {#each THEMES as t}
    <button
      onclick={() => setTheme(t)}
      class={{ active: theme === t }}
    >
      {t}
    </button>
  {/each}
</div>
```

**Why good:** `createContext` returns typed getter/setter pair, no string key collisions, getter uses `get` accessor to maintain reactivity through context, file extension `.svelte.ts` enables runes

### Bad Example — String Keys Without Types

```svelte
<script>
  import { setContext, getContext } from 'svelte';

  // BAD: String key, no type safety
  setContext('theme', { theme: 'dark' });

  // In child:
  const ctx = getContext('theme'); // Type is unknown
</script>
```

**Why bad:** String keys can collide, no TypeScript type inference, easy to misspell key names

---

## Pattern 3: Reactive Context with $state

When context needs to be reactive, wrap values in objects with getters.

### Good Example — Auth Context

```ts
// auth-context.svelte.ts
import { createContext } from "svelte";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContext {
  readonly user: User | null;
  readonly isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const [getAuthContext, setAuthContext] = createContext<AuthContext>();

export function createAuthContext(
  initialUser: User | null = null,
): AuthContext {
  let user = $state<User | null>(initialUser);

  return {
    get user() {
      return user;
    },
    get isAuthenticated() {
      return user !== null;
    },
    login: (u: User) => {
      user = u;
    },
    logout: () => {
      user = null;
    },
  };
}
```

```svelte
<!-- app.svelte (root) -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { setAuthContext, createAuthContext } from './auth-context.svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  setAuthContext(createAuthContext());
</script>

{@render children()}
```

```svelte
<!-- user-menu.svelte (deeply nested) -->
<script lang="ts">
  import { getAuthContext } from './auth-context.svelte';

  const auth = getAuthContext();
</script>

{#if auth.isAuthenticated}
  <p>Welcome, {auth.user?.name}</p>
  <button onclick={auth.logout}>Log out</button>
{:else}
  <button onclick={() => auth.login({ id: '1', name: 'Alice', email: 'alice@example.com' })}>
    Log in
  </button>
{/if}
```

**Why good:** `get` accessors maintain reactivity through context, factory function creates reactive state, type-safe throughout component tree

---

## Pattern 4: Shared State Modules (.svelte.ts)

For state shared across unrelated components, use `.svelte.ts` files with exported reactive objects.

### Good Example — Shopping Cart Store

```ts
// cart.svelte.ts
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

const TAX_RATE = 0.08;

function createCart() {
  let items = $state<CartItem[]>([]);

  // Derived values as getters
  const itemCount = $derived(
    items.reduce((sum, item) => sum + item.quantity, 0),
  );

  const subtotal = $derived(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  );

  const tax = $derived(subtotal * TAX_RATE);
  const total = $derived(subtotal + tax);

  function addItem(product: Omit<CartItem, "quantity">) {
    const existing = items.find((i) => i.id === product.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      items.push({ ...product, quantity: 1 });
    }
  }

  function removeItem(id: string) {
    const index = items.findIndex((i) => i.id === id);
    if (index !== -1) {
      items.splice(index, 1);
    }
  }

  function clear() {
    items.length = 0;
  }

  return {
    get items() {
      return items;
    },
    get itemCount() {
      return itemCount;
    },
    get subtotal() {
      return subtotal;
    },
    get tax() {
      return tax;
    },
    get total() {
      return total;
    },
    addItem,
    removeItem,
    clear,
  };
}

// Module-level singleton
export const cart = createCart();
```

```svelte
<!-- cart-badge.svelte -->
<script lang="ts">
  import { cart } from './cart.svelte';
</script>

<span class="cart-badge">
  Cart ({cart.itemCount})
</span>
```

```svelte
<!-- cart-summary.svelte -->
<script lang="ts">
  import { cart } from './cart.svelte';
</script>

<div class="cart-summary">
  {#each cart.items as item (item.id)}
    <div>
      {item.name} x{item.quantity} — ${(item.price * item.quantity).toFixed(2)}
      <button onclick={() => cart.removeItem(item.id)}>Remove</button>
    </div>
  {/each}

  <p>Subtotal: ${cart.subtotal.toFixed(2)}</p>
  <p>Tax: ${cart.tax.toFixed(2)}</p>
  <p><strong>Total: ${cart.total.toFixed(2)}</strong></p>
  <button onclick={cart.clear}>Clear Cart</button>
</div>
```

**Why good:** `.svelte.ts` file enables runes outside components, factory pattern with closure, getters maintain reactivity, named constant for tax rate, module singleton for global state

**When to use:** Global state needed across unrelated components (cart, notifications, user preferences)

**When not to use:** Component-local state (use `$state`), component-tree state (use context API)

---

## Pattern 5: Class-Based Reactive State

Classes can use `$state` and `$derived` directly on fields.

### Good Example — Timer Class

```ts
// timer.svelte.ts
const INTERVAL_MS = 1000;

export class Timer {
  #seconds = $state(0);
  #running = $state(false);
  #interval: ReturnType<typeof setInterval> | null = null;

  readonly formatted = $derived.by(() => {
    const minutes = Math.floor(this.#seconds / 60);
    const secs = this.#seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  });

  get seconds() {
    return this.#seconds;
  }
  get running() {
    return this.#running;
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#interval = setInterval(() => {
      this.#seconds += 1;
    }, INTERVAL_MS);
  }

  stop() {
    this.#running = false;
    if (this.#interval) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
  }

  reset() {
    this.stop();
    this.#seconds = 0;
  }
}
```

```svelte
<!-- stopwatch.svelte -->
<script lang="ts">
  import { Timer } from './timer.svelte';

  const timer = new Timer();
</script>

<div class="stopwatch">
  <p class="time">{timer.formatted}</p>

  {#if timer.running}
    <button onclick={() => timer.stop()}>Stop</button>
  {:else}
    <button onclick={() => timer.start()}>Start</button>
  {/if}

  <button onclick={() => timer.reset()} disabled={timer.running}>
    Reset
  </button>
</div>
```

**Why good:** Private `$state` fields with `#`, `$derived` for formatted display, clean class API, named constant for interval, cleanup in `stop()`

---

## Pattern 6: $state.snapshot — Getting Plain Objects

Use `$state.snapshot()` to get a plain (non-proxy) copy of reactive state.

### Good Example — Serialization

```svelte
<script lang="ts">
  interface FormData {
    name: string;
    email: string;
    preferences: string[];
  }

  let formData = $state<FormData>({
    name: '',
    email: '',
    preferences: [],
  });

  async function submitForm() {
    // $state.snapshot returns a plain object (no Proxy)
    const data = $state.snapshot(formData);

    // Safe to pass to external libraries, JSON.stringify, structuredClone, etc.
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
</script>
```

**Why good:** External libraries and `JSON.stringify` may not handle Proxy objects correctly, `$state.snapshot` creates a clean copy, necessary when passing state outside Svelte's reactive system

**When to use:** Passing reactive state to external libraries, serialization (`JSON.stringify`), logging, or any API that doesn't expect Proxy objects.

---

## Pattern 7: $state.eager — Immediate UI Updates (5.41+)

`$state.eager()` updates the UI immediately instead of waiting for dependent `await` expressions to resolve. Use sparingly — only for providing visual feedback during async operations.

### Good Example — Active Link Highlighting During Navigation

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    href: string;
    pathname: string;
    children: Snippet;
  }

  let { href, pathname, children }: Props = $props();
</script>

<!-- Updates aria-current immediately, even while page content is loading -->
<a {href} aria-current={$state.eager(pathname) === href ? 'page' : null}>
  {@render children()}
</a>
```

**Why good:** Provides instant visual feedback during navigation, `$state.eager` bypasses Svelte's batched update coordination for this specific value

**When to use:** Loading indicators, active state highlighting, progress feedback — only where delayed UI creates poor UX

**When not to use:** Critical state that must stay in sync with async results — let Svelte coordinate those updates normally

---

_For snippet patterns, see [snippets.md](snippets.md). For event patterns, see [events.md](events.md)._
