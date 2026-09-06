---
name: web-meta-framework-qwik
description: Qwik resumable framework - zero hydration, $ lazy boundaries, signals, Qwik City file-based routing, routeLoader$, routeAction$, server$ RPC, serialization rules
---

# Qwik Patterns

> **Quick Guide:** Qwik is resumable rather than hydrated — the server serializes application state into
> the HTML and the client picks it up without re-executing framework code. Every `$` suffix marks a
> lazy-loading boundary the optimizer splits into its own chunk, so only the code for the interaction a
> user actually triggers is downloaded. `component$` wraps every component, `useSignal`/`useStore` hold
> state, `routeLoader$` supplies server data, `routeAction$` handles mutations, and `server$` is ad-hoc
> RPC. The constraint everything else follows from: anything captured across a `$` boundary must be
> serializable.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — typed props, signals, stores, tasks, resources, events, scoped styles
- [examples/routing.md](examples/routing.md) — route files, nested layouts, loaders, actions, `server$`, endpoints, middleware, navigation
- [examples/serialization.md](examples/serialization.md) — what crosses the `$` boundary, `noSerialize`, lean closures, QRL props
- [reference.md](reference.md) — project layout, import cheat sheet, serializable-type table

---

## Which path applies

The two packages divide the surface, and mixing up which one an export comes from is the commonest
import error.

- **Component work** — components, state, lifecycle, events, slots, styles, all from
  `@builder.io/qwik`. Follow [examples/core.md](examples/core.md).
- **Route and server work** — routing, layouts, loaders, actions, `server$`, endpoints and middleware,
  all from `@builder.io/qwik-city`. Follow [examples/routing.md](examples/routing.md).

---

<critical_requirements>

## Before writing Qwik code

**Wrap every component in `component$()`.** A plain function cannot be lazy-loaded, cannot call hooks and
cannot host `<Slot />`.

**Keep everything captured in a `$` closure serializable.** A non-serializable capture type-checks and
then fails at runtime, which is why the compiler is no help here.

**Reach for `routeLoader$` for initial server data rather than fetching in `useTask$` or
`useResource$`.** Loaders run before render and integrate with SSR streaming, so there is no loading
state to show.

**Cancel default behaviour with the `preventdefault:click` JSX attribute rather than
`event.preventDefault()`.** Handlers load asynchronously, so the synchronous Event APIs have already
had their effect by the time the handler runs.

**Export `routeLoader$` and `routeAction$` from a route file** — `index.tsx` or `layout.tsx` under
`src/routes/`. Anywhere else, or unexported, they silently do nothing.

**Read and write store properties through the store reference — `store.name`.** Destructuring extracts
the value from the Proxy, and reactivity goes with it.

</critical_requirements>

---

**Auto-detection:** Qwik, component$, useSignal, useStore, useTask$, useVisibleTask$, useComputed$, useResource$, routeLoader$, routeAction$, server$, sync$, QRL, noSerialize, @builder.io/qwik, @builder.io/qwik-city, Qwik City, $(), onClick$, onInput$, Slot, q:slot, preventdefault, stoppropagation, useStylesScoped$, resumable, resumability

**Applies to:**

- Resumability, the `$` suffix, and what the optimizer does with it
- Components: `component$`, typed props, QRL callback props, `<Slot />` projection
- Reactive state: `useSignal`, `useStore`, `useComputed$`
- Lifecycle: `useTask$`, `useVisibleTask$`, `useResource$`
- Events: `on{Event}$`, `preventdefault:`/`stoppropagation:` attributes, `sync$`, global listeners
- Qwik City routing: file-based routes, nested and named layouts, dynamic params, route groups
- Server work: `routeLoader$`, `routeAction$`, `server$`, endpoint handlers, `onRequest` middleware
- Serialization rules and how to work around them

**Handled elsewhere:**

- Which CSS system fills a scoped style block — Qwik settles how styles attach to a component, not how they are authored.
- Validation schemas beyond the shape `zod$()` wraps — the action integration is Qwik's, the schema language is not.
- Databases, mail and other services called from inside `server$` or a loader — those functions are just server code.
- Statically-generated content sites with little interactivity — resumability buys nothing where there is nothing to resume.

---

<philosophy>

Qwik is built on **resumability**. A hydrating framework renders HTML on the server and then re-executes
every component on the client to reattach listeners and rebuild the tree. Qwik does not: the server
serializes the tree, the state and the listeners into the HTML, and the client resumes from there. When a
user clicks a button, that handler's chunk is what downloads — not the framework, not the tree, not the
other handlers.

**The `$` suffix is the mechanism.** Each `$` is a split point the optimizer turns into a separately
loadable chunk: `component$()` for a render function, `onClick$()` for a handler, `useTask$()` for a
tracked effect, `routeLoader$()` for server-only code.

**The price is serialization.** A chunk that loads later needs its captured scope restored from the
HTML, so a `$` closure can only close over values Qwik knows how to write down. Class instances,
functions and DOM nodes are not among them, and that single constraint explains most of the API's
unfamiliar corners — `QRL` props, `noSerialize`, the advice to keep closures lean.

</philosophy>

---

<decision_framework>

**Which state primitive?** A single primitive is `useSignal`, read and written through `.value`. An
object or array is `useStore`, mutated property by property with deep tracking on by default. A value
derived synchronously from others is `useComputed$`. A value derived asynchronously is `useResource$`.
Data that comes from the server is `routeLoader$`.

**Which lifecycle hook?** `useTask$` is the default; the table in Pattern 4 has the rest.
`useVisibleTask$` defeats resumability, so it is for DOM measurement, browser-only APIs and canvas
work and nothing else.

**Where should data loading live?** Needed before the page renders: `routeLoader$`. Reactive to client
state: `useResource$`, calling `server$` when the work belongs on the server. Triggered by the user:
`routeAction$` for anything form-shaped, `server$` called from a handler when there is no form.

**Does the handler need a synchronous Event API?** `preventDefault` becomes the
`preventdefault:eventname` attribute, `stopPropagation` becomes `stoppropagation:eventname`, and
`currentTarget` becomes the handler's second parameter. Everything else is an ordinary `on{Event}$`,
extracted with `$()` and typed as `QRL` when it is reused.

**Which styling attachment?** `useStylesScoped$` scopes styles to the component and lazy-loads them with
it, with `:global()` as the escape hatch for projected `<Slot />` content. `useStyles$` attaches
unscoped styles the same way. Anything site-wide is imported in the root layout. Runtime CSS-in-JS that
injects styles during render is incompatible with SSR streaming here; zero-runtime approaches are not.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Components with `component$`

Every component is wrapped, and the wrapper is what gives it lazy loading, hooks and `<Slot />`.

```tsx
export const Counter = component$<{ initial?: number; label: string }>(
  ({ initial = 0, label }) => {
    const count = useSignal(initial);
    return (
      <button onClick$={() => count.value++}>
        {label}: {count.value}
      </button>
    );
  },
);
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: `useSignal` and `useStore`

`useSignal` holds one value behind `.value`. `useStore` holds an object and tracks it deeply, mutated in
place — but only through the store reference.

```tsx
const isEditing = useSignal(false);
const user = useStore({ name: "Alice", preferences: { theme: "dark" } });

user.name = "Bob"; // reactive
const { name } = user; // plain string — reactivity lost
```

Full code: [examples/core.md](examples/core.md)

### Pattern 3: Derived values with `useComputed$`

Synchronous derivation with automatic dependency tracking and no dependency array. The result is a
read-only signal.

```tsx
const subtotal = useSignal(85);
const tax = useComputed$(() => subtotal.value * TAX_RATE);
const total = useComputed$(() => subtotal.value + tax.value);
```

Full code: [examples/core.md](examples/core.md)

### Pattern 4: Tasks and lifecycle

`track()` declares what re-runs the task; `cleanup()` runs before each re-run and on teardown.

```tsx
useTask$(({ track, cleanup }) => {
  const term = track(() => query.value);
  const timer = setTimeout(() => search(term), DEBOUNCE_MS);
  cleanup(() => clearTimeout(timer));
});
```

| Hook              | Runs                           | Use for                                    |
| ----------------- | ------------------------------ | ------------------------------------------ |
| `useTask$`        | Server + client, before render | Data init, side effects on state change    |
| `useVisibleTask$` | Browser only, after render     | DOM manipulation, browser APIs, animations |
| `useComputed$`    | Synchronous, auto-tracked      | Derived values (formatting, filtering)     |
| `useResource$`    | Server + client, non-blocking  | Async data that should not block render    |

A `useTask$` that tracks nothing runs once, as an initialization hook rather than a reactive effect.

Full code: [examples/core.md](examples/core.md)

### Pattern 5: Event handling

Handlers are `on{Event}$` and load asynchronously, so default-behaviour control is declarative and the
element arrives as the second parameter instead of through `currentTarget`.

```tsx
<form preventdefault:submit onSubmit$={handleSubmit}>
  <input value={email.value} onInput$={(_, el) => (email.value = el.value)} />
</form>
```

Full code: [examples/core.md](examples/core.md)

### Pattern 6: Content projection with `<Slot />`

`<Slot />` takes children; `q:slot` on a direct child of the usage site routes into a named slot. Both
work only inside `component$()`.

```tsx
<div class="card">
  <header>
    <Slot name="header" />
  </header>
  <div class="body">
    <Slot />
  </div>
</div>
```

Wrapping slotted content in an intermediate element breaks the projection — `q:slot` must sit on a
direct child.

Full code: [examples/core.md](examples/core.md)

### Pattern 7: `routeLoader$` for server data

Exported from a route file, runs server-side before render, and returns a read-only signal. `fail()`
returns a typed error rather than throwing.

```tsx
export const useProduct = routeLoader$(async (requestEvent) => {
  const product = await db.products.findById(requestEvent.params.id);
  return product ?? requestEvent.fail(404, { errorMessage: "Not found" });
});

export default component$(() => {
  const product = useProduct();
  return <h1>{product.value.name}</h1>;
});
```

Full code: [examples/routing.md](examples/routing.md)

### Pattern 8: `routeAction$` for mutations

Handles form submissions server-side, with `zod$()` for validation and per-field errors. `<Form>` works
without JavaScript, so the page degrades to a plain POST.

```tsx
export const useContactAction = routeAction$(
  async (data) => {
    await sendEmail(data);
    return { success: true };
  },
  zod$({ email: z.string().email(), message: z.string().min(10) }),
);
```

```tsx
<Form action={action}>
  {action.value?.fieldErrors?.email && <p>{action.value.fieldErrors.email}</p>}
  <button type="submit" disabled={action.isRunning}>
    Send
  </button>
</Form>
```

Full code: [examples/routing.md](examples/routing.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A component written as a plain function — hooks throw, `<Slot />` silently fails, and the optimizer cannot split it.
- A class instance, function or DOM node captured in a `$` closure — type-checks, then throws a serialization error.
- A destructured store — `const { name } = store` yields a plain value, and every later write is invisible to the UI.
- `event.preventDefault()` or `event.stopPropagation()` inside a handler — a no-op, because the handler ran too late. Use the `preventdefault:` / `stoppropagation:` attributes.
- `event.currentTarget` inside a handler — null in an async handler; take the element from the second parameter.
- `routeLoader$` or `routeAction$` outside `src/routes/**/index.tsx` or `layout.tsx`, or defined but not exported — no error, and no execution either.
- A plain function type on a callback prop — callback props are `QRL<() => void>` and their values are wrapped in `$()`.
- An import taken from the wrong package — components, signals and tasks are `@builder.io/qwik`; routing, loaders, actions and `server$` are `@builder.io/qwik-city`.

**Surprising behaviour:**

- `useVisibleTask$` where `useTask$` would do gives up SSR and resumability for that component.
- `useTask$` blocks the render until it settles, so long async work belongs in `useResource$`.
- Fetching in `useTask$` instead of `routeLoader$` costs SSR streaming and adds a loading state the user should never have seen.
- Closing over a whole store to reach one property makes Qwik serialize the whole store.
- Islands-style thinking does not apply — every component is already lazy at the interaction level, so there is nothing to choose to hydrate.
- `useStore({ deep: true })` is the default written out; `{ deep: false }` is the option that changes anything.
- An arrow function as a store method loses `this` — use `function () {}`.
- An inline `<style>` tag in a component double-loads, once from SSR and once from the client.
- `useStylesScoped$` scopes through emoji-based class selectors, which some CSS parsers and test tools mishandle; `:global()` is how you reach `<Slot />` content through it.
- Middleware in `layout.tsx` does not run for `server$` calls — put checks a `server$` call must pass in `plugin.ts` or inside the function.
- `server$` needs client and server on the same deployed version; a stale client calling a moved function is undefined behaviour.
- Props are shallowly immutable, so a child reassigning a primitive prop does nothing — pass a `Signal` when the child must write back.
- Deep store tracking follows the property you read, so tracking `store[key]` does not track `store[key].nested`.

</red_flags>
