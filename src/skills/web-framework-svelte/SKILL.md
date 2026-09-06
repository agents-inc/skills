---
name: web-framework-svelte
description: Svelte 5 runes — $state, $derived, $effect, $props, $bindable, snippets, callback props, context. Load when writing Svelte 5 components or reactive modules.
---

# Svelte 5 Patterns

> **Quick Guide:** Runes make reactivity explicit and portable out of `.svelte` files. `$state` for values that change, `$derived` for everything computed from them, `$effect` only for reaching outside the component. Snippets replace slots, callback props replace `createEventDispatcher`, and `onclick` replaces `on:click`. The Svelte 4 forms still compile, so nothing flags them.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — `$state`, `$state.raw`, `$derived`, `$props`, `$bindable`, `$effect`, `$effect.pre`
- [examples/snippets.md](examples/snippets.md) — children, named snippets as props, parameters, optional and recursive snippets
- [examples/events.md](examples/events.md) — element events, callback props, forwarding, window events, composing handlers
- [examples/advanced.md](examples/advanced.md) — `$inspect`, context, shared state modules, class-based state, `$state.snapshot`, `$state.eager`
- [reference.md](reference.md) — rune cheat sheet, Svelte 4 → 5 migration table, decision trees, component template

---

## Which path applies

- **Inside a `.svelte` component** — every rune is available, props arrive through `$props()`, and teardown belongs in the function an `$effect` returns.
- **Inside a `.svelte.ts` or `.svelte.js` module** — `$state` and `$derived` work, but a reassigned export does not propagate to importers, because the binding is copied at import. Export an object or a class holding `$state` fields instead: [examples/advanced.md](examples/advanced.md).

---

<critical_requirements>

## Before writing Svelte code

**Declare changing values with `$state` and compute from them with `$derived`.** A `$derived` recomputes lazily and cannot fall out of step; the same value maintained by an `$effect` updates after the DOM has already painted the old one.

**Pass composable markup as snippets — `{#snippet}` declares it, `{@render}` renders it.** Snippets are typed, take parameters, and can be passed as props; `<slot>` did none of that.

**Let a child notify its parent through a callback prop — `onsave`, `onselect`.** The signature is checked at the call site, where a dispatched event's payload was not.

**Reach for `$state.raw()` when a value is replaced wholesale rather than mutated.** It skips the deep proxy, which is the whole cost on a large array that only ever gets reassigned.

**Reach for `createContext<T>()` over `setContext`/`getContext`.** It hands back a typed `[get, set]` pair with the key minted for you, so no consumer casts and no two libraries collide on a string key — [examples/advanced.md](examples/advanced.md) has it.

</critical_requirements>

---

**Auto-detection:** Svelte 5, runes, $state, $derived, $effect, $props, $bindable, $inspect, .svelte, .svelte.ts, {#snippet}, {@render}, Snippet, createContext, setContext, getContext, $state.raw, $state.snapshot, $state.eager, $derived.by, $effect.pre, ClassValue

**Applies to:**

- Component state, derived values and side effects with runes
- Props, defaults, rest props and two-way binding with `$bindable`
- Composition with snippets, including snippets passed as props
- Event handling and parent-child communication
- Context, shared state modules and class-based reactive state

**Handled elsewhere:**

- Styling — a `<style>` block is scoped by the compiler, and which CSS approach fills it is not settled here
- Routing, server-side loading and form submission — a meta-framework's concern, whichever one is in use
- Server-state caching and invalidation
- Test doubles for the network

---

<philosophy>

## Philosophy

Svelte 4 inferred reactivity from position: a `let` at the top level of a component was reactive, `$:` re-ran on assignment, and neither meant anything in a `.ts` file. Runes replace that with a marker on the value itself, so the same declaration behaves identically in a component, a module and a class field.

The ordering that follows is: `$derived` for anything computable, an event handler for anything a user triggers, and `$effect` only for what is genuinely outside the component — a canvas, a third-party widget, a subscription. An `$effect` that assigns to `$state` is a `$derived` written the long way round, and it runs after the DOM update rather than before it.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: $state

`$state` makes a value reactive and, for objects and arrays, deeply so — `push` and property assignment are both tracked, with no immutable update dance.

```svelte
<script lang="ts">
  let count = $state(0);
  let todos = $state<Todo[]>([]);

  function addTodo(text: string) {
    todos.push({ done: false, text });
  }
</script>
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: $derived

`$derived` takes an expression, `$derived.by` a function for anything longer. Both recompute only when a dependency actually changed.

```svelte
<script lang="ts">
  let doubled = $derived(count * 2);

  let stats = $derived.by(() => ({
    isEven: count % 2 === 0,
    isPositive: count > 0,
  }));
</script>
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: $props

Props are destructured out of `$props()` with defaults and rest, and typed by an interface.

```svelte
<script lang="ts">
  interface Props {
    name: string;
    role?: string;
    class?: string;
  }

  let { name, role = 'member', ...rest }: Props = $props();
  let initials = $derived(name.split(' ').map((n) => n[0]).join(''));
</script>
```

Destructuring `$props()` is the one place it is safe — the compiler keeps the bindings live. Destructuring a `$state` object does not.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: $bindable

`$bindable` marks a prop the child may write back through `bind:`. Worth it for form primitives; for everything else a callback prop keeps the data flowing one way.

```svelte
<!-- text-input.svelte -->
<script lang="ts">
  let { value = $bindable(''), placeholder = '' }: Props = $props();
</script>

<input bind:value {placeholder} />

<!-- parent.svelte -->
<TextInput bind:value={searchQuery} placeholder="Search..." />
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: $effect

An effect reaches outside the component; the function it returns is the teardown, run before the next execution and on unmount.

```svelte
<script lang="ts">
  $effect(() => {
    const timer = setTimeout(() => search(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  });
</script>
```

Anything of the form `$effect(() => { x = f(y) })` is a `$derived`. Anything triggered by a click is an event handler. Anything you wanted to log is `$inspect`.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Snippets

`{#snippet}` declares a block of markup and `{@render}` renders it. Content between a component's tags becomes its `children` snippet automatically; anything else is a prop typed `Snippet`.

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, children, footer }: { title: string; children: Snippet; footer?: Snippet } = $props();
</script>

<h2>{title}</h2>
{@render children()}
{#if footer}{@render footer()}{/if}
```

Full code: [examples/snippets.md](examples/snippets.md)

---

### Pattern 7: Events

Element events are plain attributes. Component events are callback props, optional ones called with `?.()`.

```svelte
<script lang="ts">
  let { color, onchange, onreset }: Props = $props();
</script>

<button onclick={() => onchange?.('red')}>Red</button>
{#if onreset}<button onclick={onreset}>Reset</button>{/if}
```

Full code: [examples/events.md](examples/events.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Destructuring a `$state` object — the values are read once at destructure time and never again
- Mutating a `$state.raw` value — only reassignment is tracked, which is the trade it exists to make
- `setContext` called from an event handler or an `$effect` — context is only settable during component initialisation
- `$effect` created outside component or module initialisation — calling it from an event handler is a runtime error rather than a silent no-op; `$effect.root()` is how an effect scope gets opened by hand, and it hands back its own cleanup
- State read after an `await` inside an `$effect` — those reads are not tracked, so the effect never re-runs for them
- A cleanup function returned from `$derived` — only `$effect` runs one
- `$effect` relied on during server rendering — it runs in the browser only

**Surprising behaviour:**

- Every Svelte 4 form still compiles: `export let`, `$:`, `<slot>`, `createEventDispatcher`, `on:click`, `<svelte:component this={X}>`. Nothing warns, so a file can be half-migrated and look fine
- A `$state` value is a proxy, not the object you passed — `$state.snapshot()` before serialising or handing it to a library that compares identity
- A `$derived` result is not deeply reactive; only `$state` creates the proxy
- Fallback values in `$props()` are not proxied either
- `$effect` runs after the DOM update — `$effect.pre` is the hook for measuring before it
- `$inspect` compiles to nothing in production, so it is a debugging tool rather than logging
- Svelte 5 delegates some events at the root, which changes what `stopPropagation()` reaches

</red_flags>
