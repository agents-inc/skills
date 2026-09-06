# Svelte 5 Reference

> Decision trees, the rune cheat sheet, the Svelte 4 → 5 migration table and a component template. See [SKILL.md](SKILL.md) for the patterns and red flags, and [examples/](examples/) for full code.

---

## Decision trees

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
├─ 3+ levels → Use context (createContext, or a typed pair over setContext/getContext)
└─ Global/cross-tree → Need shared reactive state?
    ├─ YES → Use .svelte.ts module with $state class fields
    └─ NO → Use plain .ts module with exports
```

---

## Runes cheat sheet

| Rune                     | Purpose                            | Example                                    |
| ------------------------ | ---------------------------------- | ------------------------------------------ |
| `$state(value)`          | Reactive state (deep proxy)        | `let count = $state(0)`                    |
| `$state.raw(value)`      | Reactive state (no proxy)          | `let data = $state.raw([])`                |
| `$state.snapshot(proxy)` | Plain object from proxy            | `const plain = $state.snapshot(obj)`       |
| `$state.eager(value)`    | Immediate UI update (async bypass) | `let x = $state.eager(val)` (5.41+)        |
| `$derived(expr)`         | Computed value                     | `let doubled = $derived(count * 2)`        |
| `$derived.by(fn)`        | Complex computed value             | `let total = $derived.by(() => { ... })`   |
| `$effect(fn)`            | Side effect (escape hatch)         | `$effect(() => { ... })`                   |
| `$effect.pre(fn)`        | Pre-DOM-update effect              | `$effect.pre(() => { ... })`               |
| `$effect.tracking()`     | Check if inside tracking context   | `if ($effect.tracking()) { ... }`          |
| `$effect.root(fn)`       | Manual-cleanup effect scope        | `const cleanup = $effect.root(() => { })`  |
| `$props()`               | Component props                    | `let { x, y } = $props()`                  |
| `$bindable(default?)`    | Two-way bindable prop              | `let { value = $bindable('') } = $props()` |
| `$inspect(values)`       | Dev-only logging                   | `$inspect(count, name)`                    |
| `$inspect.trace(label?)` | Trace effect dependencies          | `$inspect.trace('my-effect')`              |

## Class attributes

Since 5.16 the `class` attribute accepts an object or an array and resolves it the way `clsx` would, so `class:active={isActive}` has no remaining use. A component that forwards a class prop types it `ClassValue` from `svelte/elements` (5.19+), which accepts the string, object and array forms alike.

---

## Svelte 4 → 5 migration

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
| `class:active={isActive}`     | `class={{ active: isActive }}`    |
| Svelte stores                 | `$state` in `.svelte.ts` files    |

---

## Component template

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
