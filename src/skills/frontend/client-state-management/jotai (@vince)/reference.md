# Jotai - Reference

Decision frameworks, red flags, and anti-patterns for Jotai atomic state management.

---

## Decision Framework

### When to Use Jotai

```
Is it server data (from API)?
├─ YES → Use your data fetching solution (not Jotai's scope)
└─ NO → Is it URL-appropriate (filters, search, shareable)?
    ├─ YES → URL params (searchParams)
    └─ NO → Is it needed in 2+ components?
        ├─ YES → Do you need fine-grained reactivity?
        │   ├─ YES → Jotai (automatic dependency tracking)
        │   └─ NO → Your state management solution
        └─ NO → Is it truly component-local?
            └─ YES → useState
```

### Atom Type Decision

```
What kind of atom do I need?

Need to store a value?
├─ YES → Primitive atom: atom(initialValue)
└─ NO → Need to compute from other atoms?
    ├─ YES → Is it read-only?
    │   ├─ YES → Derived atom: atom((get) => computed)
    │   └─ NO → Read-write atom: atom(read, write)
    └─ NO → Need to trigger side effects?
        └─ YES → Write-only atom: atom(null, (get, set) => {...})
```

### Async Handling Decision

```
Is the atom async?

├─ YES → Do you want Suspense?
│   ├─ YES → Use async atom directly + Suspense boundary
│   └─ NO → Wrap with loadable() utility
└─ NO → Use sync atom
```

### Collection Optimization Decision

```
Working with arrays/collections?

├─ Does each item need independent updates?
│   ├─ YES → Use splitAtom for array items
│   └─ NO → Use regular array atom
├─ Do items have unique IDs?
│   └─ YES → Use keyExtractor with splitAtom
└─ Creating items on-demand by parameter?
    └─ YES → Use atomFamily
```

### Large Object Decision

```
Working with large objects?

├─ Do you need read-only access to specific properties?
│   └─ YES → Use selectAtom
├─ Do you need read-write access to specific properties?
│   └─ YES → Use read-write atom (lens pattern)
└─ Does the entire object update frequently (>10/sec)?
    └─ YES → Skip selectAtom, use atom directly
```

### Quick Reference Table

| Use Case | Solution | Why |
|----------|----------|-----|
| Server/API data | Data fetching solution | Caching, synchronization, loading states |
| Shareable filters | URL params | Bookmarkable, browser navigation |
| Computed values | Derived atom | Auto-updates when dependencies change |
| Encapsulated actions | Write-only atom | Code splitting, reusable logic |
| Property lens | Read-write atom | Read and write specific object parts |
| Async data with Suspense | Async atom + Suspense | First-class React Suspense support |
| Async data without Suspense | loadable() utility | Manual loading/error handling |
| Parameterized atoms | atomFamily | Create atoms on-demand by parameter |
| Persistent state | atomWithStorage | localStorage/sessionStorage sync |
| Array item isolation | splitAtom | Per-item re-render optimization |
| Large object selection | selectAtom | Prevent re-renders from unrelated changes |

---

## RED FLAGS

**High Priority Issues:**

- **Creating atoms inside components** - causes new atom every render, state never persists, appears broken
- **Missing Suspense boundary for async atoms** - async atoms trigger Suspense by default, missing boundary crashes app
- **State mutations after await without write atom** - updates after async operations need proper encapsulation
- **Default exports in atom files** - violates project conventions, breaks tree-shaking
- **Magic numbers in atom initial values or logic** - makes code unclear, hard to maintain

**Medium Priority Issues:**

- Overusing selectAtom on frequently-updating objects (adds overhead without benefit)
- Not using keyExtractor with splitAtom for items with IDs (causes unnecessary atom recreation)
- Subscribing to entire large object when only one property needed (causes excessive re-renders)
- Missing Provider isolation in tests (state bleeds between tests)
- Using atomFamily without custom equality for complex params (memory leaks from duplicate atoms)

**Common Mistakes:**

- Forgetting that async atoms trigger Suspense by default (use loadable if you don't want Suspense)
- Not wrapping post-await state updates in proper action atoms
- Expecting atoms created inside components to persist state
- Not providing Suspense boundaries for async atom consumers
- Using selectAtom when all properties update together anyway

**Gotchas & Edge Cases:**

- Async atoms suspend by default - this is intentional, not a bug
- Provider creates isolated state - atoms in different Providers don't share values
- atomFamily returns same atom instance for same params (reference equality matters)
- loadable() returns discriminated union - always check `state` property first
- RESET symbol is special - pass to setter to reset atomWithStorage to initial value
- Default store is global - provider-less mode shares state across entire app
- **v2 async read behavior**: `get()` in read functions doesn't auto-resolve promises - use `await get(asyncAtom)` explicitly
- atomWithStorage `getOnInit: true` returns stored value immediately but may cause SSR hydration issues

---

## Anti-Patterns

### Creating Atoms in Render

Creating atoms inside components causes state loss on every render.

```typescript
// WRONG - New atom every render
function Counter() {
  const countAtom = atom(0); // BAD: Created in render
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// CORRECT - Atom defined at module level
const countAtom = atom(0);

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// CORRECT - Dynamic atom with useMemo (rare case)
function DynamicCounter({ initialValue }: { initialValue: number }) {
  const countAtom = useMemo(() => atom(initialValue), [initialValue]);
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Missing Suspense for Async Atoms

Async atoms trigger Suspense by default - missing boundary crashes the app.

```tsx
// WRONG - No Suspense boundary
function App() {
  return (
    <Provider>
      <AsyncDataComponent /> {/* Crashes if atom is loading */}
    </Provider>
  );
}

// CORRECT - Suspense boundary wraps async consumers
function App() {
  return (
    <Provider>
      <Suspense fallback={<Loading />}>
        <AsyncDataComponent />
      </Suspense>
    </Provider>
  );
}
```

### Overcomplicating with selectAtom

Using selectAtom on frequently-updating data adds overhead without benefit.

```typescript
// WRONG - All values update together, selectAtom is wasteful
const realtimeAtom = atom({ x: 0, y: 0, z: 0 }); // Updates 60fps
const xAtom = selectAtom(realtimeAtom, (d) => d.x);
const yAtom = selectAtom(realtimeAtom, (d) => d.y);
const zAtom = selectAtom(realtimeAtom, (d) => d.z);

// CORRECT - Use atom directly when all values change together
function LiveDisplay() {
  const [data] = useAtom(realtimeAtom);
  return <div>{data.x}, {data.y}, {data.z}</div>;
}
```

### Grouping Unrelated State in One Atom

Putting unrelated state in one atom causes unnecessary re-renders.

```typescript
// WRONG - Tightly coupled unrelated state
const appStateAtom = atom({
  user: null,
  theme: 'light',
  notifications: [],
  sidebarOpen: false,
  modalOpen: false,
  // 20 more properties...
});

// CORRECT - Separate atoms for independent concerns
const userAtom = atom<User | null>(null);
const themeAtom = atom<'light' | 'dark'>('light');
const notificationsAtom = atom<Notification[]>([]);
const sidebarOpenAtom = atom(false);
const modalOpenAtom = atom(false);
```

### Expecting Shared State Across Providers

Each Provider creates isolated state - atoms don't share across Providers.

```tsx
// WRONG - Expecting shared state
<Provider>
  <Counter /> {/* count = 5 */}
</Provider>
<Provider>
  <Counter /> {/* count = 0, NOT 5 - different Provider! */}
</Provider>

// CORRECT - Single Provider for shared state
<Provider>
  <Counter />
  <AnotherComponent />
</Provider>

// CORRECT - Explicit store sharing
const sharedStore = createStore();

<Provider store={sharedStore}>
  <Counter />
</Provider>
<Provider store={sharedStore}>
  <AnotherComponent /> {/* Same state as Counter */}
</Provider>
```

### Using Jotai for Server Data

Managing server data in Jotai means no caching, no automatic refetch, manual loading states.

```typescript
// WRONG - Server data in Jotai
const usersAtom = atom<User[]>([]);
const loadingAtom = atom(false);
const errorAtom = atom<Error | null>(null);

const fetchUsersAtom = atom(null, async (get, set) => {
  set(loadingAtom, true);
  try {
    const data = await fetch('/api/users').then(r => r.json());
    set(usersAtom, data);
  } catch (e) {
    set(errorAtom, e as Error);
  } finally {
    set(loadingAtom, false);
  }
});

// CORRECT - Use your data fetching solution for server data
// Jotai is for client state, not server state
```

### Testing Without Provider Isolation

State bleeds between tests without fresh Providers.

```typescript
// WRONG - State bleeds between tests
test('test 1', () => {
  render(<Counter />);
  // Modifies global state
});

test('test 2', () => {
  render(<Counter />);
  // State from test 1 affects this test!
});

// CORRECT - Fresh store per test
describe('Counter', () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore(); // Fresh store
  });

  const renderCounter = () =>
    render(
      <Provider store={store}>
        <Counter />
      </Provider>
    );

  test('test 1', () => {
    renderCounter();
    // Isolated state
  });

  test('test 2', () => {
    renderCounter();
    // Fresh state, unaffected by test 1
  });
});
```

---

## Essential Imports

```typescript
// Core
import { atom, useAtom, useAtomValue, useSetAtom, Provider, createStore } from "jotai";

// Types
import type { Atom, PrimitiveAtom, WritableAtom } from "jotai";

// Utils - async handling
import { loadable, unwrap } from "jotai/utils";

// Utils - collections and storage
import {
  atomWithStorage,
  atomFamily,
  selectAtom,
  splitAtom,
  useHydrateAtoms,
  RESET,
  createJSONStorage,
} from "jotai/utils";

// Optional: Optics for advanced lens patterns
// import { focusAtom } from "jotai-optics";
```

---

## TypeScript Patterns

### Configuration Requirements

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true
  }
}
```

### Atom Type Parameters

```typescript
// Primitive atom - type inferred from initial value
const countAtom = atom(0); // Atom<number>

// Explicit typing for nullable/union types
const userAtom = atom<User | null>(null);
const statusAtom = atom<'idle' | 'loading' | 'success'>('idle');

// Write atom type parameters: [Value, Args (array), Result]
const actionAtom = atom<null, [string], void>(
  null,
  (get, set, arg: string) => {
    // arg is typed as string
  }
);

// Multiple arguments
const multiArgAtom = atom<null, [string, number], void>(
  null,
  (get, set, name: string, count: number) => {
    // Both args are typed
  }
);

// With return value
const asyncActionAtom = atom<null, [string], Promise<Result>>(
  null,
  async (get, set, id: string) => {
    const result = await fetchData(id);
    set(dataAtom, result);
    return result;
  }
);
```

### ExtractAtomValue Utility

```typescript
import { atom, ExtractAtomValue } from "jotai";

const userAtom = atom({ name: "John", age: 30 });

// Extract the value type from an atom
type User = ExtractAtomValue<typeof userAtom>;
// Result: { name: string; age: number }

// Useful for function parameters
function processUser(user: ExtractAtomValue<typeof userAtom>) {
  // user is typed as { name: string; age: number }
}
```
