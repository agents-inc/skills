---
name: web-utilities-vueuse
description: VueUse composable utility collection for Vue 3 - browser, sensor, network, state, animation, and component utilities
---

# VueUse Composable Patterns

> **Quick Guide:** VueUse wraps browser APIs, sensors, network transports and small state utilities
> as composables that return refs and clean themselves up on scope disposal. Import each function by
> name from `@vueuse/core` — the library is large and entirely tree-shakeable. Two things decide
> whether a call works: it must run synchronously during setup, because teardown binds to the
> effect scope that is current at call time; and browser-API composables behave differently on a
> server, some returning a safe default and some needing client-only rendering.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — storage, event listeners, media queries, small state utilities
- [examples/sensors.md](examples/sensors.md) — mouse, scroll, intersection, resize, element visibility
- [examples/network.md](examples/network.md) — `useFetch`, `createFetch`, `useWebSocket`, `useEventSource`
- [examples/state.md](examples/state.md) — `createGlobalState`, `useRefHistory`, `syncRef`, persistence
- [examples/component.md](examples/component.md) — `useVModel`, `useVirtualList`, `onClickOutside`, `onKeyStroke`, animation
- [reference.md](reference.md) — composable index by category, the SSR table, gotchas, deprecations

---

## Which path applies

Server rendering is the branch, because it changes which composables are usable at all.

- **Client-rendered only** — every composable is available; call it and read the ref.
- **Server-rendered** — storage, media-query and preference composables return their declared default on the server and hydrate on the client. Sensor and transport composables (`useMouse`, `useScroll`, `useIntersectionObserver`, `useWebSocket`, `useClipboard`) need a DOM and belong inside a client-only boundary. The table in [reference.md](reference.md) says which is which.
- **The composable wraps an API not every browser has** — read its `isSupported` ref and render a fallback, rather than assuming the call worked.

---

<critical_requirements>

## Before writing VueUse code

**Call composables synchronously during setup.** Teardown registers against the effect scope that
is current when the composable runs, so a call inside an `await`, a `setTimeout` or an event
handler has no scope to attach to and its listeners are never removed.

**Import each composable by name from `@vueuse/core`.** A namespace import pulls the whole library
past the bundler's tree-shaker, and the library is several hundred functions.

**Read `isSupported` where the composable wraps an optional browser API** — clipboard, share,
geolocation, battery, wake lock. It exists because the API can be absent or permission-gated, and
the fallback path is what the user sees when it is.

**Decide the server behaviour before the composable ships.** Each one either returns a declared
default on the server or needs a client-only boundary; guessing produces a hydration mismatch,
which reports as a rendering bug far from its cause.

</critical_requirements>

---

**Auto-detection:** VueUse, vueuse, @vueuse/core, @vueuse/integrations, useLocalStorage,
useSessionStorage, useClipboard, useFetch, createFetch, useMouse, useMouseInElement, useScroll,
useIntersectionObserver, useResizeObserver, useElementVisibility, useElementSize, useMediaQuery,
usePreferredDark, useDark, useToggle, useCounter, useCycleList, useWebSocket, useEventSource,
useEventListener, useTransition, useRafFn, createGlobalState, useRefHistory, useManualRefHistory,
syncRef, useVModel, useVirtualList, onClickOutside, onKeyStroke, useDebounceFn, watchDebounced

**Applies to:**

- Browser APIs as reactive refs — storage, clipboard, media queries, preferences
- Sensor readings — pointer position, scroll, intersection, element size and visibility
- Reactive HTTP, WebSocket and server-sent-event transports
- Small shared state, undo history, and ref synchronisation
- Component helpers — two-way binding, virtual lists, outside clicks, key strokes, value animation

**Handled elsewhere:**

- Server-state caching, invalidation and optimistic updates — a distinct problem that a reactive request wrapper does not solve
- Application state architecture — actions, modules and devtools belong to whatever owns the store
- The reactivity primitives themselves — `ref`, `computed`, `watch` and effect scopes are the framework's, and these composables are built on top of them
- Routing, forms and validation — none of these composables model any of it

---

<philosophy>

Each composable owns one concern and its own teardown. That is the whole contract: it returns refs,
it registers whatever listener or observer it needs, and it disposes of them when the surrounding
effect scope ends. Nothing is registered globally and nothing needs a plugin.

The consequence is that the _call site_ owns the lifetime. Two
components calling `useMouse()` get two independent listeners, both cleaned up separately — which
is why sharing one instance is an explicit act (`createGlobalState`, or a composable of your own)
rather than something the library does for you.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Reactive storage

```typescript
import { useLocalStorage } from "@vueuse/core";

const settings = useLocalStorage("app-settings", DEFAULTS, {
  mergeDefaults: true, // stored data gains fields added to DEFAULTS since it was written
});

settings.value.theme = "dark"; // persists, and other tabs see it
settings.value = null; // removes the key entirely — it does not store null
```

Serialisation, cross-tab sync via the `storage` event, and a server-side default all come with it.
Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Listeners that remove themselves

```typescript
import { useEventListener } from "@vueuse/core";
import { useTemplateRef } from "vue";

const dropZone = useTemplateRef("drop-zone");

useEventListener(window, "resize", onResize);
useEventListener(dropZone, "drop", onDrop); // waits for the ref to be populated
```

Passing a ref rather than an element is the point: the composable attaches once the element exists
and re-attaches if it changes, so there is no mount-order problem to solve by hand.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Media queries and colour scheme

```typescript
import {
  useMediaQuery,
  usePreferredDark,
  useDark,
  useToggle,
} from "@vueuse/core";

const isMobile = useMediaQuery("(max-width: 768px)");
const prefersDark = usePreferredDark(); // reads the OS setting
const isDark = useDark(); // reads it, persists an override, toggles a class
const toggleDark = useToggle(isDark);
```

`usePreferredDark` observes; `useDark` also writes — it persists the choice and toggles a class on
the root element, so the class name it uses has to match what the stylesheet expects.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Sensors

```typescript
import { useScroll, useIntersectionObserver } from "@vueuse/core";

const { y, directions, arrivedState } = useScroll(container);

useIntersectionObserver(
  sentinel,
  ([entry]) => {
    if (entry?.isIntersecting) loadMore();
  },
  { rootMargin: "200px" },
); // fire before it reaches the viewport
```

`arrivedState` and `directions` are the parts worth knowing — they replace the offset arithmetic
that scroll handlers usually get wrong at the edges.

Full code: [examples/sensors.md](examples/sensors.md)

---

### Pattern 5: Reactive fetch

```typescript
import { useFetch } from "@vueuse/core";

const url = computed(() => `/api/users/${userId.value}`);

// Re-runs whenever `url` changes, and aborts the previous request
const { data, isFetching, error, abort } = useFetch(url, {
  refetch: true,
}).json<User>();

// Manual: no request until execute() is called
const { execute } = useFetch("/api/users", { immediate: false })
  .post(body)
  .json();
```

The chained `.json<T>()` is what types `data`; without it you hold a `Ref<string | null>`.

Full code: [examples/network.md](examples/network.md)

---

### Pattern 6: Shared state without a store library

```typescript
import { createGlobalState } from "@vueuse/core";

export const useGlobalCounter = createGlobalState(() => {
  const count = shallowRef(0);
  const double = computed(() => count.value * 2);
  const increment = () => count.value++;

  return { count, double, increment };
});
```

The factory runs once and every caller gets the same refs. Returning actions rather than the bare
writable refs is what keeps the mutation points countable.

Full code: [examples/state.md](examples/state.md)

---

### Pattern 7: Two-way binding

```typescript
import { useVModel } from "@vueuse/core";

const value = useVModel(props, "modelValue", emit);
const count = useVModel(props, "count", emit); // named v-model

value.value = next; // emits update:modelValue
```

One line where the get/set computed is five, and the event name is derived rather than typed out —
which is where the typo used to live.

Full code: [examples/component.md](examples/component.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A composable called inside `await`, `setTimeout` or an event handler binds to no effect scope: its listeners and observers are never disposed of, and the component leaks them on every mount.
- A sensor or transport composable called during server rendering touches `window` or `document` and throws. Move it behind a client-only boundary.
- Using a browser-API composable without checking `isSupported` fails on the browsers and contexts where the API is missing or permission-gated — clipboard write outside a user gesture is the usual first case.
- A namespace import of `@vueuse/core` defeats tree-shaking and ships the whole library.

**Surprising behaviour:**

- `useLocalStorage(...).value = null` deletes the key rather than storing `null`. Store an explicit empty value where the key must survive.
- `createGlobalState` is a singleton for the module's lifetime — it survives every component unmounting and is cleared only by a reload, which makes it a poor fit for per-user state that must reset on sign-out.
- `useIntersectionObserver` invokes its callback once on registration with the element's current state, so "became visible" needs comparing against the previous value rather than trusting the first call.
- `useFetch` fires on mount by default; `refetch: true` adds re-firing on URL change without removing the initial one. `immediate: false` is what makes it fully manual.
- `useWebSocket` reconnects by default, so a server rejecting the connection produces a retry loop until `autoReconnect: false` or a bounded `retries` says otherwise.
- `useRefHistory` snapshots every change, which on a text input is one entry per keystroke. Give it a `capacity`, or use `useManualRefHistory` and commit at save points.
- `shallowRef` avoids deep-reactivity cost on large objects, but a composable that persists or watches nested changes — `useLocalStorage` among them — needs the deep tracking to see them at all. Choose per composable rather than as a blanket rule.

</red_flags>
