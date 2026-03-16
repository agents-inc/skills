# Client State - Reference

> Quick-reference anti-patterns with code examples. See [SKILL.md](SKILL.md) for decision frameworks and full red flags.

---

## Anti-Patterns

### Context for State Management

Using React Context with useState/useReducer for state management causes every consumer to re-render when ANY value changes.

```typescript
// WRONG - Context causes full re-renders
const AppContext = createContext({ user: null, theme: "light", cart: [] });

// CORRECT - Zustand with selectors
const useStore = create<AppState>()((set) => ({
  user: null,
  theme: "light",
  cart: [],
}));
const theme = useStore((s) => s.theme); // Only re-renders when theme changes
```

### Server Data in Client State

Storing API/server data in useState, Zustand, or Context causes stale data, no caching, and manual synchronization.

```typescript
// WRONG - Server data in useState
const [users, setUsers] = useState([]);
useEffect(() => {
  fetchUsers().then(setUsers);
}, []);

// CORRECT - Use a data fetching solution with caching, refetch, sync
```

### Prop Drilling for Shared State

Passing state through 3+ levels creates tight coupling and refactoring difficulty.

```typescript
// WRONG - Prop drilling
<Parent isOpen={isOpen} setIsOpen={setIsOpen}>
  <Child isOpen={isOpen} setIsOpen={setIsOpen}>
    <GrandChild isOpen={isOpen} setIsOpen={setIsOpen} />

// CORRECT - Zustand accessed directly
const isOpen = useUIStore((s) => s.isOpen);
```

### Destructuring Entire Store

```typescript
// WRONG - Subscribes to everything, re-renders on any change
const { bears, fish } = useBearStore();

// CORRECT - Atomic selectors
const bears = useBearStore((s) => s.bears);
const fish = useBearStore((s) => s.fish);
```
