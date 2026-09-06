---
name: web-state-pinia
description: Pinia stores, Vue 3 state patterns. Use when managing client state in Vue applications, choosing between Options/Setup stores, composing stores, or implementing persistence.
---

# Pinia Patterns

> **Quick Guide:** Pinia holds shared client state in Vue 3, as flat independent stores with no modules and no mutations. Two syntaxes: Options stores read like the Options API and come with `$reset()`, Setup stores read like `<script setup>` and can call other composables. Two rules cause most of the bugs — destructure through `storeToRefs()` or reactivity is lost silently, and return every ref from a Setup store or SSR, DevTools and plugins each see a store with holes in it.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — Options stores, Setup stores, `storeToRefs`, composing stores
- [examples/persistence.md](examples/persistence.md) — selective persistence across sessions
- [examples/plugins.md](examples/plugins.md) — a logging plugin, and a `$reset` for Setup stores
- [examples/testing.md](examples/testing.md) — unit-testing stores, and mounting components with a testing store
- [examples/ssr.md](examples/ssr.md) — SSR-safe stores, hydration, client-only guards
- [reference.md](reference.md) — the syntax comparison table, anti-pattern code, TypeScript recipes, performance notes

---

## Which path applies

- **The store needs no other composable and wants `$reset()` for free** — an Options store; follow [examples/core.md](examples/core.md).
- **The store calls a composable, or needs a watcher inside it** — a Setup store, where every ref has to be returned; follow [examples/core.md](examples/core.md).
- **The app renders on the server** — the Pinia instance is per request rather than per module; follow [examples/ssr.md](examples/ssr.md).

---

<critical_requirements>

## Before writing Pinia code

**Destructure through `storeToRefs()`.** A store is reactive but its properties are not: pulling them out directly copies values, and the component then renders numbers that never change again — with nothing thrown and nothing logged.

**Return every ref a Setup store creates.** A ref kept private is invisible to serialisation, to hydration, to the DevTools panel and to every plugin, so the store works locally and fails on the server.

**Keep browser APIs out of state initialisation.** `localStorage` and `window` do not exist while the server renders, so reading one in a `state()` function fails the render rather than the feature.

**Create the Pinia instance per request when rendering on the server.** A module-level store is a singleton, and a singleton on a server is one user's state handed to the next.

</critical_requirements>

---

**Auto-detection:** `defineStore`, `storeToRefs`, `createPinia`, `setActivePinia`, `$patch`, `$reset`, `$subscribe`, `$onAction`, `pinia`, Options store, Setup store

**Applies to:**

- Choosing and writing Options or Setup stores
- Reading store state in components without losing reactivity
- Composing stores, and keeping the dependencies acyclic
- Persistence, plugins, testing and SSR for stores

**Handled elsewhere:**

- Server data — caching, invalidation and refetching belong to whatever owns the network; a store holds a copy nothing refreshes
- State one component reads — a plain `ref()` or `reactive()` is less machinery for the same behaviour
- Filters, search and pagination — those belong in the route's query, where they survive a reload and can be shared
- A configuration value or client fixed at startup — app-level `provide`/`inject` carries something that never changes; a store is for something that does

---

<philosophy>

Pinia is a flat set of independent stores. There are no nested modules and no mutation layer: an action changes state directly, and the type of everything is inferred rather than declared through a registry.

The design consequence worth knowing is that a store instance belongs to a Pinia instance, not to a module. That is what makes SSR workable — a fresh Pinia per request means no state crosses between users — and it is why `setActivePinia` exists for code that runs outside a component.

</philosophy>

---

<decision_framework>

### Options store or Setup store

```
Does the store need to call another composable, or watch something?
├─ YES → Setup store — it runs in a setup context, so composables work
└─ NO → Do you want $reset() without writing it?
    ├─ YES → Options store — $reset() is generated from the state function
    └─ NO → either; Setup store reads closest to <script setup>
```

A Setup store can be given `$reset()` by a plugin, which is the usual way to have both.

### What to persist

```
Would losing this on reload annoy the user?
├─ NO → do not persist it; transient UI restored from storage reads as a bug
└─ YES → Is it a copy of something the server owns?
    ├─ YES → refetch it instead; a stale copy outlives its correctness
    └─ NO → Is it a token, a credential or personal data?
        ├─ YES → do not persist it; web storage is readable by any script on the page
        └─ NO → persist that field by name, not the whole store
```

Session-scoped state — a cart, a form draft — belongs in `sessionStorage` rather than `localStorage`, so closing the tab ends it.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Options Store

State, getters and actions as three declared sections. Getters take `state`; actions use `this`.

```typescript
export const useCounterStore = defineStore("counter", {
  state: (): CounterState => ({ count: 0, name: "Counter" }),
  getters: {
    doubleCount: (state): number => state.count * 2,
  },
  actions: {
    increment(): void {
      this.count++;
    },
  },
});
```

Full code: [examples/core.md](examples/core.md#pattern-1-options-store)

### Pattern 2: Setup Store

`ref()` is state, `computed()` is a getter, a function is an action — and the returned object is the store.

```typescript
export const useCounterStore = defineStore("counter", () => {
  const count = ref(0);
  const doubleCount = computed(() => count.value * 2);

  function increment(): void {
    count.value++;
  }

  return { count, doubleCount, increment };
});
```

Everything created here is returned. A ref left out is not private — it is broken for anything that reads the store from outside.

Full code: [examples/core.md](examples/core.md#pattern-2-setup-store)

### Pattern 3: Reading a Store in a Component

```typescript
const store = useCounterStore();

// state and getters — through storeToRefs
const { count, doubleCount } = storeToRefs(store);

// actions — destructured directly; they are functions and need no ref
const { increment } = store;
```

`storeToRefs` covers state and getters only. Passing it actions is what the direct destructure on the second line is for.

Full code: [examples/core.md](examples/core.md#pattern-3-accessing-store-state)

### Pattern 4: Composing Stores

One store calls another at the top of its body, so the dependency is resolved once rather than on each access.

```typescript
export const useCartStore = defineStore("cart", () => {
  const userStore = useUserStore();
  const discount = computed(() => (userStore.isPremium ? PREMIUM_DISCOUNT : 0));
  return { discount };
});
```

Two stores reading each other's getters is where this deadlocks; keep the dependency one-directional.

Full code: [examples/core.md](examples/core.md#pattern-4-composing-stores)

### Pattern 5: Persistence

A plugin syncs chosen fields to storage. Naming the fields is what keeps a transient flag or a cached response out of it.

Full code: [examples/persistence.md](examples/persistence.md)

### Pattern 6: Plugins

A plugin receives every store and can add a property, wrap an action, or read a custom option declared on the store.

```typescript
pinia.use(({ store, options }) => {
  store.$onAction(({ name, after }) => {
    after(() => {
      /* record the call */
    });
  });
});
```

This is the mechanism behind `$reset()` for Setup stores and behind persistence alike.

Full code: [examples/plugins.md](examples/plugins.md)

### Pattern 7: Testing Stores

`setActivePinia(createPinia())` gives a unit test a store with no component around it. A testing Pinia stubs actions by default, so a component test asserts that an action was called rather than what it did.

Full code: [examples/testing.md](examples/testing.md)

### Pattern 8: SSR

A fresh Pinia per request, no browser API in the initial state, and serialised state sanitised before it reaches the page.

Full code: [examples/ssr.md](examples/ssr.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- **`const { count } = useStore()`** — the value is copied out of the reactive proxy and never updates again. Nothing errors; the UI simply stops. `storeToRefs()` is the fix.
- **A Setup store returning only part of its refs** — hydration, DevTools and plugins all read the returned object, so an omitted ref is missing everywhere but inside the store.
- **`localStorage` or `window` in a `state()` function** — undefined during a server render, so the render fails.
- **One Pinia instance shared across server requests** — stores are singletons per instance, so one user's state is handed to the next.
- **Two stores reading each other's getters** — the cycle resolves to an incomplete store or hangs, depending on which is instantiated first.

**Surprising behaviour:**

- Options stores have `$reset()`; Setup stores do not, because there is no state function to re-run. A plugin supplies one.
- An arrow function in an Options store getter has no `this`, so a getter written that way reads the `state` parameter or nothing at all.
- `$patch` takes an object or a function; the function form receives the current state, which is what makes an array push or a conditional update expressible.
- A store called outside a component needs an active Pinia — `setActivePinia` in tests and in scripts, or the call throws.
- Persisting the whole store persists whatever gets added to it later, including the field somebody adds next month that should never have been on disk.

</red_flags>
