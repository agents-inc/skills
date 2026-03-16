# Jotai - Reference

Decision frameworks, red flags, and anti-patterns for Jotai atomic state management.

---

## Decision Framework

### When to Use Jotai

```
Is it server data (from API)?
├─ YES -> Use your data fetching solution (not Jotai's scope)
└─ NO -> Is it URL-appropriate (filters, search, shareable)?
    ├─ YES -> URL params (searchParams)
    └─ NO -> Is it needed in 2+ components?
        ├─ YES -> Do you need fine-grained reactivity?
        │   ├─ YES -> Jotai (automatic dependency tracking)
        │   └─ NO -> Your state management solution
        └─ NO -> Is it truly component-local?
            └─ YES -> useState
```

### Atom Type Decision

```
What kind of atom do I need?

Need to store a value?
├─ YES -> Primitive atom: atom(initialValue)
└─ NO -> Need to compute from other atoms?
    ├─ YES -> Is it read-only?
    │   ├─ YES -> Derived atom: atom((get) => computed)
    │   └─ NO -> Read-write atom: atom(read, write)
    └─ NO -> Need to trigger side effects?
        └─ YES -> Write-only atom: atom(null, (get, set) => {...})
```

### Async Handling Decision

```
Is the atom async?

├─ YES -> Do you want Suspense?
│   ├─ YES -> Use async atom directly + Suspense boundary
│   └─ NO -> Need loading/error states?
│       ├─ YES -> Wrap with loadable() utility
│       └─ NO -> Wrap with unwrap() for simple fallback
└─ NO -> Use sync atom
```

### Collection Optimization Decision

```
Working with arrays/collections?

├─ Does each item need independent updates?
│   ├─ YES -> Use splitAtom for array items
│   └─ NO -> Use regular array atom
├─ Do items have unique IDs?
│   └─ YES -> Use keyExtractor with splitAtom
└─ Creating items on-demand by parameter?
    └─ YES -> Use jotai-family package (atomFamily is deprecated)
```

### Quick Reference Table

| Use Case                    | Solution               | Why                                      |
| --------------------------- | ---------------------- | ---------------------------------------- |
| Server/API data             | Data fetching solution | Caching, synchronization, loading states |
| Shareable filters           | URL params             | Bookmarkable, browser navigation         |
| Computed values             | Derived atom           | Auto-updates when dependencies change    |
| Encapsulated actions        | Write-only atom        | Code splitting, reusable logic           |
| Property lens               | Read-write atom        | Read and write specific object parts     |
| Async data with Suspense    | Async atom + Suspense  | First-class React Suspense support       |
| Async data without Suspense | loadable() utility     | Manual loading/error handling            |
| Async with fallback         | unwrap() utility       | Simpler than loadable, keeps prev value  |
| Parameterized atoms         | jotai-family package   | On-demand atom creation (not atomFamily) |
| Persistent state            | atomWithStorage        | localStorage/sessionStorage sync         |
| Array item isolation        | splitAtom              | Per-item re-render optimization          |
| Large object property read  | Derived atom           | Preferred over selectAtom (escape hatch) |

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

Async atoms trigger Suspense by default -- missing boundary crashes the app.

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

### Grouping Unrelated State in One Atom

Putting unrelated state in one atom causes unnecessary re-renders across the app.

```typescript
// WRONG - Tightly coupled unrelated state
const appStateAtom = atom({
  user: null,
  theme: "light",
  notifications: [],
  sidebarOpen: false,
});

// CORRECT - Separate atoms for independent concerns
const userAtom = atom<User | null>(null);
const themeAtom = atom<"light" | "dark">("light");
const notificationsAtom = atom<Notification[]>([]);
const sidebarOpenAtom = atom(false);
```

### Expecting Shared State Across Providers

Each Provider creates isolated state -- atoms don't share across Providers.

```tsx
// WRONG - Expecting shared state
<Provider>
  <Counter /> {/* count = 5 */}
</Provider>
<Provider>
  <Counter /> {/* count = 0, NOT 5 - different Provider! */}
</Provider>

// CORRECT - Single Provider for shared state, or shared store
const sharedStore = createStore();

<Provider store={sharedStore}>
  <Counter />
</Provider>
<Provider store={sharedStore}>
  <AnotherComponent /> {/* Same state as Counter */}
</Provider>
```

### Using Jotai for Server Data

Managing server data in Jotai means rebuilding caching, refetching, and loading state management from scratch.

```typescript
// WRONG - Server data in Jotai (no caching, no auto-refetch)
const usersAtom = atom<User[]>([]);
const loadingAtom = atom(false);
const errorAtom = atom<Error | null>(null);

const fetchUsersAtom = atom(null, async (get, set) => {
  set(loadingAtom, true);
  try {
    const data = await fetch("/api/users").then((r) => r.json());
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
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  store = createStore(); // Fresh store each test
});

const renderWithStore = (ui: ReactElement) =>
  render(<Provider store={store}>{ui}</Provider>);
```
