# Svelte 5 Core Examples

> Complete code examples for Svelte 5 Runes patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Advanced patterns:** See [snippets.md](snippets.md), [events.md](events.md), and [advanced.md](advanced.md).

---

## Pattern 1: $state — Reactive State

### Good Example — Primitive State

```svelte
<!-- counter.svelte -->
<script lang="ts">
  const INITIAL_COUNT = 0;
  const MAX_COUNT = 100;

  let count = $state(INITIAL_COUNT);

  function increment() {
    if (count < MAX_COUNT) {
      count += 1;
    }
  }

  function reset() {
    count = INITIAL_COUNT;
  }
</script>

<div>
  <p>Count: {count}</p>
  <button onclick={increment} disabled={count >= MAX_COUNT}>
    Increment
  </button>
  <button onclick={reset}>Reset</button>
</div>
```

**Why good:** Named constants for limits, guard against exceeding max, explicit reactive declaration with `$state`

### Good Example — Deep Reactive Objects

```svelte
<!-- todo-list.svelte -->
<script lang="ts">
  interface Todo {
    id: number;
    text: string;
    done: boolean;
  }

  let todos = $state<Todo[]>([]);
  let nextId = $state(1);

  function addTodo(text: string) {
    todos.push({ id: nextId, text, done: false });
    nextId += 1;
  }

  function toggleTodo(id: number) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.done = !todo.done; // Deep mutation tracked!
    }
  }

  function removeTodo(id: number) {
    const index = todos.findIndex(t => t.id === id);
    if (index !== -1) {
      todos.splice(index, 1); // Array method tracked!
    }
  }
</script>

<ul>
  {#each todos as todo (todo.id)}
    <li class={{ done: todo.done }}>
      <input
        type="checkbox"
        checked={todo.done}
        onchange={() => toggleTodo(todo.id)}
      />
      <span>{todo.text}</span>
      <button onclick={() => removeTodo(todo.id)}>Delete</button>
    </li>
  {/each}
</ul>
```

**Why good:** Deep mutations (property assignment, `splice`, `push`) automatically tracked by `$state` proxy, keyed each block for correct DOM updates

### Bad Example — Destructuring Breaks Reactivity

```svelte
<script lang="ts">
  let user = $state({ name: 'Alice', age: 30 });

  // BAD: Destructuring captures VALUES, not references
  let { name, age } = user;

  function birthday() {
    age += 1; // This updates the LOCAL variable, not user.age!
  }
</script>

<!-- Shows stale data -->
<p>{name} is {age} years old</p>
```

**Why bad:** Destructuring `$state` objects captures values at destruction time, mutations to destructured variables don't affect the original reactive object, UI shows stale data

### Good Example — Fix: Access Properties Directly

```svelte
<script lang="ts">
  let user = $state({ name: 'Alice', age: 30 });

  function birthday() {
    user.age += 1; // Correctly mutates the proxy
  }
</script>

<p>{user.name} is {user.age} years old</p>
```

---

## Pattern 2: $state.raw — Shallow Reactivity

### Good Example — Large API Responses

```svelte
<script lang="ts">
  interface Product {
    id: string;
    name: string;
    price: number;
  }

  // Use $state.raw for large data you replace, not mutate
  let products = $state.raw<Product[]>([]);
  let loading = $state(false);

  async function fetchProducts() {
    loading = true;
    const response = await fetch('/api/products');
    products = await response.json(); // Reassignment works
    loading = false;
  }
</script>

{#if loading}
  <p>Loading...</p>
{:else}
  {#each products as product (product.id)}
    <p>{product.name}: ${product.price}</p>
  {/each}
{/if}
```

**Why good:** `$state.raw` avoids wrapping every product object in a Proxy, better performance for read-only data, reassignment triggers reactivity

### Bad Example — Mutating $state.raw

```svelte
<script lang="ts">
  let items = $state.raw([{ name: 'A' }, { name: 'B' }]);

  function rename() {
    items[0].name = 'C'; // NO EFFECT — mutations not tracked!
  }
</script>
```

**Why bad:** `$state.raw` does not create deep proxies, property mutations are not tracked, only full reassignment triggers updates

---

## Pattern 3: $derived — Computed Values

### Good Example — Simple and Complex Derivations

```svelte
<script lang="ts">
  interface CartItem {
    name: string;
    price: number;
    quantity: number;
  }

  let items = $state<CartItem[]>([
    { name: 'Widget', price: 9.99, quantity: 2 },
    { name: 'Gadget', price: 24.99, quantity: 1 },
  ]);

  const TAX_RATE = 0.08;
  const FREE_SHIPPING_THRESHOLD = 50;

  // Simple derived
  let itemCount = $derived(items.reduce((sum, item) => sum + item.quantity, 0));

  // Complex derived with $derived.by
  let orderSummary = $derived.by(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const tax = subtotal * TAX_RATE;
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 5.99;
    const total = subtotal + tax + shipping;

    return { subtotal, tax, shipping, total };
  });

  let freeShippingEligible = $derived(
    orderSummary.subtotal >= FREE_SHIPPING_THRESHOLD
  );
</script>

<p>Items: {itemCount}</p>
<p>Subtotal: ${orderSummary.subtotal.toFixed(2)}</p>
<p>Tax: ${orderSummary.tax.toFixed(2)}</p>
<p>Shipping: {freeShippingEligible ? 'FREE' : `$${orderSummary.shipping.toFixed(2)}`}</p>
<p><strong>Total: ${orderSummary.total.toFixed(2)}</strong></p>
```

**Why good:** Named constants for rates and thresholds, `$derived.by` for multi-step computation, derived values chain automatically (freeShippingEligible depends on orderSummary)

### Bad Example — Effect for Computed Values

```svelte
<script lang="ts">
  let items = $state<CartItem[]>([]);
  let total = $state(0);

  // BAD: Using $effect to compute a value
  $effect(() => {
    total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  });
</script>
```

**Why bad:** `$effect` runs after DOM update (timing mismatch), creates unnecessary subscription overhead, computed values should use `$derived` not `$effect`

---

## Pattern 4: $props — Component Props

### Good Example — Typed Props with Defaults

```svelte
<!-- alert.svelte -->
<script lang="ts">
  type AlertVariant = 'info' | 'warning' | 'error' | 'success';

  interface Props {
    variant?: AlertVariant;
    title: string;
    dismissible?: boolean;
    ondismiss?: () => void;
  }

  let {
    variant = 'info',
    title,
    dismissible = false,
    ondismiss,
  }: Props = $props();

  let visible = $state(true);

  function dismiss() {
    visible = false;
    ondismiss?.();
  }
</script>

{#if visible}
  <div class="alert alert-{variant}" role="alert">
    <strong>{title}</strong>
    {#if dismissible}
      <button onclick={dismiss} aria-label="Dismiss">x</button>
    {/if}
  </div>
{/if}
```

**Why good:** Interface with explicit types, union type for variant, optional callback with `?.()`, optional dismissible flag with default

### Good Example — Rest Props for Pass-Through

```svelte
<!-- button.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    children,
    ...rest
  }: Props = $props();
</script>

<button class="btn btn-{variant} btn-{size}" {...rest}>
  {@render children()}
</button>
```

**Why good:** Extends `HTMLButtonAttributes` for full button prop support, rest props passed through for `onclick`, `disabled`, etc., `Snippet` for typed children

---

## Pattern 5: $bindable — Two-Way Binding

### Good Example — Reusable Input Component

```svelte
<!-- search-input.svelte -->
<script lang="ts">
  interface Props {
    value: string;
    placeholder?: string;
    oninput?: (value: string) => void;
  }

  let {
    value = $bindable(''),
    placeholder = 'Search...',
    oninput,
  }: Props = $props();

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    oninput?.(target.value);
  }
</script>

<div class="search-input">
  <input
    type="text"
    {value}
    {placeholder}
    oninput={handleInput}
  />
  {#if value}
    <button onclick={() => { value = ''; oninput?.(''); }}>
      Clear
    </button>
  {/if}
</div>
```

```svelte
<!-- usage with bind: -->
<script lang="ts">
  import SearchInput from './search-input.svelte';

  let query = $state('');
  let filtered = $derived(
    items.filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
  );
</script>

<SearchInput bind:value={query} />
<p>Showing {filtered.length} results</p>
```

**Why good:** `$bindable` declares intent for two-way binding, also supports one-way use (without `bind:`), clear input button works from both parent and child

---

## Pattern 6: $effect — Side Effects

### Good Example — External Library Integration

```svelte
<script lang="ts">
  import { Chart } from 'chart.js';

  interface Props {
    data: number[];
    labels: string[];
  }

  let { data, labels }: Props = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  $effect(() => {
    // Create/update chart when data or labels change
    if (chart) {
      chart.data.datasets[0].data = data;
      chart.data.labels = labels;
      chart.update();
    } else {
      chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Values', data }],
        },
      });
    }

    // Cleanup on unmount
    return () => {
      chart?.destroy();
      chart = null;
    };
  });
</script>

<canvas bind:this={canvas}></canvas>
```

**Why good:** Legitimate side effect (third-party library integration), cleanup destroys chart on unmount, dependencies (data, labels) tracked automatically

### Good Example — $effect.pre for Pre-Update Logic

```svelte
<script lang="ts">
  interface Props {
    messages: string[];
  }

  let { messages }: Props = $props();
  let container: HTMLDivElement;

  // Runs BEFORE DOM update — useful for scroll position
  $effect.pre(() => {
    if (container) {
      const isAtBottom =
        container.scrollHeight - container.scrollTop <= container.clientHeight + 1;

      if (isAtBottom) {
        // After DOM updates, scroll to bottom
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  });
</script>

<div bind:this={container} class="messages">
  {#each messages as message}
    <p>{message}</p>
  {/each}
</div>
```

**Why good:** `$effect.pre()` runs before DOM update for measurement, `requestAnimationFrame` for post-update scroll, auto-scroll only when already at bottom

---

_For snippet patterns, see [snippets.md](snippets.md). For event patterns, see [events.md](events.md). For advanced patterns, see [advanced.md](advanced.md)._
