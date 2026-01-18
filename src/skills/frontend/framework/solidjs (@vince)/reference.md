# SolidJS Reference

> Decision frameworks, anti-patterns, and red flags for SolidJS development. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Frameworks

### Signal vs Store vs Context

```
What type of state are you managing?
├─ Simple primitive (string, number, boolean)?
│   └─ createSignal ✓
├─ Object or array with nested updates?
│   └─ createStore ✓
├─ Shared across distant components?
│   └─ Context + Store ✓
└─ Async data from server?
    └─ createResource or createAsync ✓
```

### Effect vs Memo

```
Do you need to derive a new value?
├─ YES → createMemo ✓
│   (cached, re-evaluated only when dependencies change)
└─ NO → Do you need to perform side effects?
    ├─ YES → createEffect ✓
    │   (DOM updates, network calls, logging, timers)
    └─ NO → You probably don't need either
```

### For vs Index

```
What changes in your list?
├─ Items added/removed/reordered?
│   └─ For ✓ (keys by reference, items stable)
└─ Values change but positions stay same?
    └─ Index ✓ (keys by index, values as signals)
```

### Show vs Switch/Match

```
How many conditions do you have?
├─ Simple boolean or truthy/falsy?
│   └─ Show ✓
├─ Multiple exclusive conditions?
│   └─ Switch/Match ✓
└─ Nested conditions?
    └─ Switch/Match ✓ (avoid nested Shows)
```

### createResource vs createAsync

```
What environment are you in?
├─ SolidStart with @solidjs/router?
│   └─ createAsync + query ✓ (SSR-friendly, recommended for Solid 2.0)
└─ Plain SolidJS without router?
    └─ createResource ✓
```

**Note:** The `cache` API is deprecated since Solid Router v0.15.0. Use `query` instead.

### When to Use onCleanup

```
Does your effect create:
├─ Event listeners? → onCleanup to removeEventListener ✓
├─ Timers (setInterval, setTimeout)? → onCleanup to clear ✓
├─ Subscriptions? → onCleanup to unsubscribe ✓
├─ Abort controllers? → onCleanup to abort ✓
└─ None of the above? → No cleanup needed
```

---

## RED FLAGS

### High Priority Issues

- **Reading signal without parentheses** - `count` instead of `count()` doesn't read the value or track dependencies
- **Destructuring props** - `const { name } = props` breaks reactivity; use `props.name` or `splitProps()`
- **Using ternary instead of Show** - `{condition ? <A /> : <B />}` bypasses Solid's optimizations
- **Using .map() instead of For** - `{items().map(...)}` doesn't get fine-grained list updates
- **Missing onCleanup in effects** - Event listeners, timers, subscriptions will leak memory
- **Async operations inside createEffect tracking scope** - Code after `await` loses tracking context

### Medium Priority Issues

- **Not using createMemo for expensive computations** - Recalculates on every access without memo
- **Side effects in createMemo** - Memos should be pure; use createEffect for side effects
- **Creating signals inside render** - Signals created in loops/maps get recreated
- **Not handling resource loading/error states** - Accessing `resource()` when loading causes issues
- **Missing Suspense boundary for async components** - UI flickers without proper loading state

### Common Mistakes

- **Expecting component to re-run** - Component function runs once; only expressions re-evaluate
- **Using React patterns directly** - `useState`, `useEffect` don't exist; use Solid equivalents
- **Returning null for conditional render** - Use `<Show>` component instead
- **Nested reactive assignments** - Assigning `store.field = signal()` loses reactivity
- **Forgetting to call signals** - `<div>{count}</div>` shows function, not value

### Gotchas and Edge Cases

- **Signals read outside reactive context aren't tracked** - Code in event handlers doesn't auto-track
- **Stores only track property access, not the store itself** - `store` doesn't trigger updates, `store.field` does
- **onMount runs after first render, not after mount** - It's synchronous, not truly "after mount"
- **Children is a getter in Solid** - Use `children()` helper when iterating over children
- **Index provides values as signals** - Call `item()` inside Index, not in For
- **Dynamic component with expressions** - Use `<Dynamic>` component for runtime component selection
- **Props spreading loses reactivity** - `{...props}` is fine, but extracted values aren't reactive

---

## Anti-Patterns

### Destructuring Props

Destructuring breaks Solid's proxy-based reactivity tracking.

```typescript
// WRONG - Breaks reactivity
const Greeting = ({ name }) => <h1>Hello {name}</h1>;

// ALSO WRONG - Breaks reactivity
const Greeting: Component<Props> = (props) => {
  const { name, age } = props; // NOT reactive!
  return <h1>Hello {name}, age {age}</h1>;
};

// CORRECT - Access props directly
const Greeting: Component<Props> = (props) => (
  <h1>Hello {props.name}, age {props.age}</h1>
);

// CORRECT - Use splitProps when needed
const Greeting: Component<Props> = (props) => {
  const [local, others] = splitProps(props, ['name', 'age']);
  return <h1>Hello {local.name}</h1>;
};
```

### Using JavaScript Control Flow

Solid's control flow components enable fine-grained updates.

```typescript
// WRONG - Ternary bypasses optimizations
const Component = () => (
  <div>
    {isLoggedIn() ? <Dashboard /> : <Login />}
  </div>
);

// WRONG - map doesn't get list optimizations
const List = () => (
  <ul>
    {items().map(item => <li>{item.name}</li>)}
  </ul>
);

// CORRECT - Show for conditionals
const Component = () => (
  <div>
    <Show when={isLoggedIn()} fallback={<Login />}>
      <Dashboard />
    </Show>
  </div>
);

// CORRECT - For for lists
const List = () => (
  <ul>
    <For each={items()}>
      {(item) => <li>{item.name}</li>}
    </For>
  </ul>
);
```

### Forgetting to Call Signals

Signals are getter functions - you must call them.

```typescript
// WRONG - Shows [Function] or doesn't track
const Component = () => {
  const [count, setCount] = createSignal(0);
  return <span>{count}</span>; // Missing ()!
};

// WRONG - Condition never updates
const Component = () => {
  const [isOpen, setIsOpen] = createSignal(false);
  if (isOpen) { // Missing ()!
    return <Modal />;
  }
  return <Button />;
};

// CORRECT - Call signals as functions
const Component = () => {
  const [count, setCount] = createSignal(0);
  return <span>{count()}</span>;
};

// CORRECT - Call in conditions too
const Component = () => {
  const [isOpen, setIsOpen] = createSignal(false);
  return (
    <Show when={isOpen()}>
      <Modal />
    </Show>
  );
};
```

### Missing Cleanup in Effects

Effects that create resources must clean them up.

```typescript
// WRONG - Memory leak
createEffect(() => {
  window.addEventListener('resize', handleResize);
  setInterval(pollData, 5000);
});

// CORRECT - Clean up resources
createEffect(() => {
  window.addEventListener('resize', handleResize);
  const intervalId = setInterval(pollData, 5000);

  onCleanup(() => {
    window.removeEventListener('resize', handleResize);
    clearInterval(intervalId);
  });
});
```

### Side Effects in Memos

Memos should be pure - use effects for side effects.

```typescript
// WRONG - Side effect in memo
const doubled = createMemo(() => {
  console.log('Calculating...'); // Side effect!
  updateAnalytics(); // Side effect!
  return count() * 2;
});

// CORRECT - Keep memos pure
const doubled = createMemo(() => count() * 2);

// Use effect for side effects
createEffect(() => {
  console.log('Count doubled:', doubled());
  updateAnalytics();
});
```

### Async in Effects Without Proper Handling

Async code loses tracking context after await.

```typescript
// WRONG - otherSignal() not tracked after await
createEffect(async () => {
  const data = await fetchData(id());
  // This read happens outside tracking scope!
  console.log(otherSignal());
});

// CORRECT - Read dependencies before await
createEffect(() => {
  const currentId = id();
  const other = otherSignal(); // Track before async

  (async () => {
    const data = await fetchData(currentId);
    console.log(other); // Use captured value
  })();
});

// BETTER - Use createResource for async data
const [data] = createResource(id, fetchData);
```

### Using createEffect for Data Fetching

createResource is designed for async data.

```typescript
// WRONG - Manual loading state management
const Component = () => {
  const [data, setData] = createSignal(null);
  const [loading, setLoading] = createSignal(true);

  createEffect(async () => {
    setLoading(true);
    const result = await fetch(`/api/${id()}`);
    setData(await result.json());
    setLoading(false);
  });

  return /* ... */;
};

// CORRECT - Use createResource
const Component = () => {
  const [data] = createResource(id, async (id) => {
    const result = await fetch(`/api/${id}`);
    return result.json();
  });

  return (
    <Suspense fallback={<Loading />}>
      <Show when={data()}>{(d) => <Content data={d()} />}</Show>
    </Suspense>
  );
};
```

---

## Quick Reference

### Import Cheat Sheet

```typescript
// Core reactivity
import {
  createSignal,
  createEffect,
  createMemo,
  createResource,
  batch,
  untrack,
  on,
  onMount,
  onCleanup
} from 'solid-js';

// Control flow
import {
  Show,
  For,
  Index,
  Switch,
  Match,
  Suspense,
  ErrorBoundary,
  lazy
} from 'solid-js';

// Web utilities
import { Portal, Dynamic } from 'solid-js/web';

// Store
import {
  createStore,
  produce,
  reconcile,
  unwrap
} from 'solid-js/store';

// Component types
import type {
  Component,
  ParentComponent,
  VoidComponent,
  FlowComponent,
  JSX
} from 'solid-js';
```

### Signal Checklist

- [ ] Using `createSignal` for primitives
- [ ] Calling signal as function to read: `count()`
- [ ] Using functional updates when depending on previous: `setCount(c => c + 1)`
- [ ] TypeScript generic for complex types: `createSignal<User | null>(null)`

### Effect Checklist

- [ ] Using `createEffect` for side effects only
- [ ] Using `onCleanup` for event listeners, timers, subscriptions
- [ ] Using `on()` when need explicit dependency control
- [ ] NOT using effects for derived values (use `createMemo`)

### Component Checklist

- [ ] NOT destructuring props
- [ ] Using `splitProps` to separate custom from HTML props
- [ ] Using `mergeProps` for default prop values
- [ ] Using correct component type (`Component`, `ParentComponent`, `VoidComponent`)
- [ ] Refs work without forwardRef - just pass as prop

### Control Flow Checklist

- [ ] `<Show>` for boolean/truthy conditions
- [ ] `<For>` for dynamic lists (keyed by reference)
- [ ] `<Index>` for lists where index is the key
- [ ] `<Switch>`/`<Match>` for multiple exclusive conditions
- [ ] `<Suspense>` wrapping async components
- [ ] `<ErrorBoundary>` wrapping error-prone components

### Store Checklist

- [ ] Using `createStore` for nested objects/arrays
- [ ] Using path syntax for updates: `setStore('user', 'name', 'New Name')`
- [ ] Using `produce` for complex mutations
- [ ] Using `reconcile` for replacing data from external sources
- [ ] NOT mutating store directly: `store.field = x` won't trigger updates

### Resource Checklist

- [ ] Using `createResource` for async data
- [ ] Handling `resource.loading` state
- [ ] Handling `resource.error` state
- [ ] Wrapping in `<Suspense>` for loading UI
- [ ] Using `mutate` for optimistic updates
- [ ] Using `refetch` to reload data

---

## Performance Patterns

### When to Optimize

| Situation | Solution |
|-----------|----------|
| Expensive computation | `createMemo` |
| Multiple related updates | `batch()` |
| Large code bundles | `lazy()` |
| Frequent list updates | Use `For` (not `Index`) |
| Non-reactive reads needed | `untrack()` |
| Non-urgent UI updates | `useTransition` |

### Fine-Grained Reactivity Benefits

```typescript
// Solid automatically optimizes this
function Dashboard() {
  const [count, setCount] = createSignal(0);
  const [name, setName] = createSignal('');

  return (
    <div>
      {/* Only this span updates when count changes */}
      <span>Count: {count()}</span>
      {/* Only this span updates when name changes */}
      <span>Name: {name()}</span>
    </div>
  );
}
// No useMemo, React.memo, or shouldComponentUpdate needed!
```

---

## React to Solid Translation

| React | Solid | Notes |
|-------|-------|-------|
| `useState(initial)` | `createSignal(initial)` | Returns `[getter, setter]` not `[value, setter]` |
| `useEffect(fn, deps)` | `createEffect(fn)` | No dependency array - auto-tracks |
| `useMemo(fn, deps)` | `createMemo(fn)` | No dependency array - auto-tracks |
| `useRef(null)` | `let ref;` + `ref={ref}` | No `useRef` needed |
| `useContext` | `useContext` | Same API |
| `React.memo(Comp)` | Not needed | Fine-grained by default |
| `forwardRef` | Not needed | Refs are just props |
| `{cond ? <A/> : <B/>}` | `<Show when={cond}>` | Use control flow components |
| `{items.map(...)}` | `<For each={items()}>` | Use For component |
| `children` prop | `props.children` | Never destructure |
