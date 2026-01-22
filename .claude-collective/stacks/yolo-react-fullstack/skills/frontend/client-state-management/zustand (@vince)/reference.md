# Client State - Reference

Extended anti-patterns with code examples for client state management.

**Note:** Core decision frameworks and RED FLAGS are in [SKILL.md](SKILL.md). This file provides detailed code examples for anti-patterns.

---

## Anti-Patterns

### Context for State Management

Using React Context with useState/useReducer for state management causes every consumer to re-render when ANY value changes. This creates a performance nightmare at scale with no way to select specific values.

```typescript
// WRONG - Context causes full re-renders
const AppContext = createContext({ user: null, theme: "light", cart: [] });

// CORRECT - Zustand with selectors
const useStore = create((set) => ({ user: null, theme: "light", cart: [] }));
const theme = useStore((s) => s.theme); // Only re-renders when theme changes
```

### Server Data in Client State

Storing API/server data in useState, Zustand, or Context causes stale data, no caching, and manual synchronization complexity.

```typescript
// WRONG - Server data in useState
const [users, setUsers] = useState([]);
useEffect(() => {
  fetchUsers().then(setUsers);
}, []);

// CORRECT - Use a data fetching solution with caching, refetch, sync
// Your data fetching layer handles loading states and caching
```

### Prop Drilling for Shared State

Using useState and passing props through 3+ levels creates tight coupling and refactoring difficulty.

```typescript
// WRONG - Prop drilling
<Parent isOpen={isOpen} setIsOpen={setIsOpen}>
  <Child isOpen={isOpen} setIsOpen={setIsOpen}>
    <GrandChild isOpen={isOpen} setIsOpen={setIsOpen} />

// CORRECT - Zustand accessed directly
const isOpen = useUIStore((s) => s.isOpen);
```

### Magic Numbers in State Logic

Using raw numbers for validation thresholds, timeouts, or initial values.

```typescript
// WRONG - Magic numbers
if (password.length < 8) { ... }
setTimeout(save, 300);

// CORRECT - Named constants
const MIN_PASSWORD_LENGTH = 8;
const DEBOUNCE_DELAY_MS = 300;
```
