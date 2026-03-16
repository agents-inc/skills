# Svelte 5 Reference

> Decision frameworks, anti-patterns, and red flags for Svelte 5 development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### Which Rune to Use

```
Do you need to store a value that changes?
├─ YES → Is it computed from other reactive values?
│   ├─ YES → Is the computation a simple expression?
│   │   ├─ YES → $derived(expression)
│   │   └─ NO → $derived.by(() => { ... })
│   └─ NO → Is it a component prop?
│       ├─ YES → $props()
│       └─ NO → Is it a large object you replace (not mutate)?
│           ├─ YES → $state.raw(value)
│           └─ NO → $state(value)
└─ NO → Use plain const or let (no rune needed)
```

### $state vs $state.raw

```
Will you mutate properties on the object/array?
├─ YES → $state(value) (deep proxy, mutations tracked)
└─ NO → Will you replace the entire value?
    ├─ YES → $state.raw(value) (no proxy, better performance)
    └─ NO → Is it a constant? Use plain const
```

### $derived vs $effect

```
Does the code compute a value from reactive state?
├─ YES → Use $derived (or $derived.by for complex logic)
└─ NO → Does it perform a side effect (API call, DOM manipulation)?
    ├─ YES → Use $effect
    └─ NO → Does it need to run code when state changes?
        ├─ YES → Is it triggered by a user action?
        │   ├─ YES → Use an event handler (onclick, etc.)
        │   └─ NO → Use $effect (escape hatch)
        └─ NO → No rune needed
```

### Snippets vs Component

```
Is the markup reused in multiple files?
├─ YES → Extract to a separate .svelte component
└─ NO → Is it repeated within the same template?
    ├─ YES → Use {#snippet}
    └─ NO → Is it passed as composable content to a child?
        ├─ YES → Use {#snippet} as a prop
        └─ NO → Inline markup is fine
```

### Component Events Pattern

```
Does the child need to notify the parent?
├─ YES → Define a callback prop (onsomething)
│   ├─ Is it optional? → Use optional type and ?.() call
│   └─ Is it required? → Use required type
└─ NO → Does the parent need to control child state?
    ├─ YES → Does it need two-way binding?
    │   ├─ YES → Use $bindable prop with bind:
    │   └─ NO → Pass state as a regular prop
    └─ NO → No special pattern needed
```

### Context vs Props vs Module State

```
How many levels deep does data need to go?
├─ 1-2 levels → Use props (direct passing)
├─ 3+ levels → Use context (createContext)
└─ Global/cross-tree → Need shared reactive state?
    ├─ YES → Use .svelte.ts module with $state class fields
    └─ NO → Use plain .ts module with exports
```

---

## RED FLAGS

### High Priority Issues

- **Using `export let` for props** — Svelte 4 syntax, use `$props()` instead
- **Using `$:` reactive statements** — Svelte 4 syntax, use `$derived` or `$effect`
- **Using `<slot>` or `<slot name="x">`** — Deprecated, use `{#snippet}` and `{@render}`
- **Using `createEventDispatcher`** — Deprecated, use callback props
- **Using `$effect` to sync state** — Use `$derived` for computed values
- **Using stores for component state** — Use `$state` rune instead
- **Destructuring `$state` objects** — Breaks reactivity (values evaluated at destructure time)

### Medium Priority Issues

- **Using `on:click` directive** — Use `onclick` attribute (Svelte 5 syntax)
- **Not using `$state.raw()` for large API responses** — Unnecessary proxy overhead
- **Missing TypeScript types on `$props()`** — Lose type safety and IDE support
- **Using `setContext`/`getContext` with string keys** — Use `createContext` for type safety
- **Using `<svelte:component this={X}>`** — Use `<X />` directly in Svelte 5
- **Using `class:name={condition}`** — Use clsx-style arrays/objects in `class` attribute

### Common Mistakes

- **Mutating `$state.raw` objects** — Mutations are not tracked, only reassignment works
- **Returning cleanup from `$derived`** — Only `$effect` supports cleanup functions
- **Using async reads in `$effect`** — Dependencies after `await` are not tracked
- **Exporting `$state` with direct reassignment** — Export object properties instead
- **Using `$inspect` in production** — It's a no-op in production builds, use for dev only
- **Calling `$effect` outside component/module init** — Must be called during initialization

### Gotchas & Edge Cases

- **`$state` proxies are not the original object** — `$state.snapshot()` to get plain object
- **Destructuring `$state` breaks reactivity** — `let { x } = $state({x: 1})` captures value, not reference
- **`$derived` return values are NOT deeply reactive** — Only `$state` creates deep proxies
- **Fallback values in `$props` are not reactive proxies** — Default values don't get proxied
- **`$effect` runs after DOM update** — Use `$effect.pre()` if you need pre-update timing
- **Context must be set during component init** — Cannot call `setContext` in event handlers or `$effect`
- **`$effect` does not run during SSR** — Only executes in the browser
- **Svelte 5 uses event delegation for some events** — Be careful with `stopPropagation()` on delegated events

---

## Quick Reference

### Runes Cheat Sheet

| Rune                     | Purpose                     | Example                                    |
| ------------------------ | --------------------------- | ------------------------------------------ |
| `$state(value)`          | Reactive state (deep proxy) | `let count = $state(0)`                    |
| `$state.raw(value)`      | Reactive state (no proxy)   | `let data = $state.raw([])`                |
| `$state.snapshot(proxy)` | Plain object from proxy     | `const plain = $state.snapshot(obj)`       |
| `$derived(expr)`         | Computed value              | `let doubled = $derived(count * 2)`        |
| `$derived.by(fn)`        | Complex computed value      | `let total = $derived.by(() => { ... })`   |
| `$effect(fn)`            | Side effect (escape hatch)  | `$effect(() => { ... })`                   |
| `$effect.pre(fn)`        | Pre-DOM-update effect       | `$effect.pre(() => { ... })`               |
| `$props()`               | Component props             | `let { x, y } = $props()`                  |
| `$bindable(default?)`    | Two-way bindable prop       | `let { value = $bindable('') } = $props()` |
| `$inspect(values)`       | Dev-only logging            | `$inspect(count, name)`                    |
| `$inspect.trace()`       | Trace effect dependencies   | `$inspect.trace()`                         |

### Svelte 4 to Svelte 5 Migration

| Svelte 4                      | Svelte 5                          |
| ----------------------------- | --------------------------------- |
| `export let prop`             | `let { prop } = $props()`         |
| `$: derived = x * 2`          | `let derived = $derived(x * 2)`   |
| `$: { sideEffect() }`         | `$effect(() => { sideEffect() })` |
| `<slot />`                    | `{@render children()}`            |
| `<slot name="x" />`           | `{@render x?.()}`                 |
| `on:click={handler}`          | `onclick={handler}`               |
| `createEventDispatcher()`     | Callback props                    |
| `<svelte:component this={C}>` | `<C />`                           |
| Svelte stores                 | `$state` in `.svelte.ts` files    |

### Component Template

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    children: Snippet;
    onaction?: (value: string) => void;
  }

  let { title, children, onaction }: Props = $props();

  let internalState = $state('');
  let computed = $derived(title.toUpperCase());
</script>

<div class="component">
  <h2>{computed}</h2>
  {@render children()}
  <button onclick={() => onaction?.(internalState)}>
    Action
  </button>
</div>

<style>
  .component {
    /* Scoped styles */
  }
</style>
```
