# Jotai - Reference

> Utility lookup and anti-pattern code. The decision trees and the red flags they belong to are in [SKILL.md](SKILL.md).

---

## Utilities

| Utility           | Import from    | What it does                                           | Caveat                                                         |
| ----------------- | -------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| `atomWithStorage` | `jotai/utils`  | backs an atom with `localStorage` / `sessionStorage`   | initial value renders first unless `getOnInit: true`           |
| `atomWithReset`   | `jotai/utils`  | an atom that accepts the `RESET` symbol as a value     | `RESET` only works on atoms built for it                       |
| `RESET`           | `jotai/utils`  | the sentinel that restores an atom's initial value     | passed as the value, not called                                |
| `splitAtom`       | `jotai/utils`  | array atom to an atom of per-item atoms                | pass a `keyExtractor` or item atoms churn on reorder           |
| `selectAtom`      | `jotai/utils`  | reads part of an atom with a custom equality function  | the docs call it an escape hatch — prefer a derived atom       |
| `loadable`        | `jotai/utils`  | async atom to `{ state }` union, never suspends        | check `state` before reading `data`                            |
| `unwrap`          | `jotai/utils`  | async atom to a plain value with a fallback            | no way to tell pending from failed                             |
| `createStore`     | `jotai`        | an explicit store, readable and writable outside React | atoms under different stores are different state               |
| `Provider`        | `jotai`        | scopes atoms to a store                                | with no `store` prop it creates a fresh isolated one           |
| `atomFamily`      | `jotai-family` | atoms created on demand from a parameter               | holds every atom it creates until `remove` / `setShouldRemove` |

The `atomFamily` exported from `jotai/utils` is the deprecated one.

---

## Anti-patterns

### Creating an atom in render

```typescript
// WRONG - a new atom identity every render
function Counter() {
  const countAtom = atom(0);
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

// CORRECT - module level
const countAtom = atom(0);

function Counter() {
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}

// The exception - the atom genuinely depends on a prop
function DynamicCounter({ initialValue }: { initialValue: number }) {
  const countAtom = useMemo(() => atom(initialValue), [initialValue]);
  const [count, setCount] = useAtom(countAtom);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

### Async atom with no boundary

```tsx
// WRONG
function App() {
  return (
    <Provider>
      <AsyncDataComponent />
    </Provider>
  );
}

// CORRECT
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

### One atom holding unrelated state

```typescript
// WRONG - any field changing re-renders every reader
const appStateAtom = atom({
  user: null,
  theme: "light",
  notifications: [],
  sidebarOpen: false,
});

// CORRECT
const userAtom = atom<User | null>(null);
const themeAtom = atom<"light" | "dark">("light");
const notificationsAtom = atom<Notification[]>([]);
const sidebarOpenAtom = atom(false);
```

### Expecting two Providers to share state

```tsx
// WRONG - two Providers, two values
<Provider>
  <Counter />   {/* count = 5 */}
</Provider>
<Provider>
  <Counter />   {/* count = 0 */}
</Provider>

// CORRECT - one store, passed to both
const sharedStore = createStore();

<Provider store={sharedStore}>
  <Counter />
</Provider>
<Provider store={sharedStore}>
  <AnotherComponent />
</Provider>
```

### Rebuilding a cache out of atoms

```typescript
// WRONG - fetches once, never revalidates, and every caller repeats the three atoms
const usersAtom = atom<User[]>([]);
const loadingAtom = atom(false);
const errorAtom = atom<Error | null>(null);

const fetchUsersAtom = atom(null, async (get, set) => {
  set(loadingAtom, true);
  try {
    set(usersAtom, await fetch("/api/users").then((r) => r.json()));
  } catch (e) {
    set(errorAtom, e as Error);
  } finally {
    set(loadingAtom, false);
  }
});
```

Caching, invalidation and refetching are a separate concern with its own tools; atoms hold the client state around them.

### Tests sharing the default store

```typescript
// WRONG - the global store carries state between tests
test("first", () => {
  render(<Counter />);
});

test("second", () => {
  render(<Counter />); // starts from wherever the first test left off
});

// CORRECT - a fresh store per test
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  store = createStore();
});

const renderWithStore = (ui: ReactElement) => render(<Provider store={store}>{ui}</Provider>);
```
