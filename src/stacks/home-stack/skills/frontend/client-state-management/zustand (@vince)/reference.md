# Client State - Reference

Decision frameworks, red flags, and anti-patterns for client state management.

---

## Decision Framework

### State Management Decision Tree

```
What kind of state do I have?

Is it server data (from API)?
├─ YES → Data fetching solution (not this skill's scope)
└─ NO → Is it URL-appropriate (filters, search, shareable)?
    ├─ YES → URL params (searchParams)
    └─ NO → Is it needed in 2+ components?
        ├─ YES → Zustand
        └─ NO → Is it truly component-local?
            ├─ YES → useState
            └─ NO → Is it a singleton/dependency?
                └─ YES → Context (ONLY for DI)
```

### Form Library Decision

```
What kind of form do I have?

Simple form (1-3 fields, minimal validation)?
├─ YES → Vanilla React (useState + Zod)
└─ NO → Complex form (10+ fields, field-level validation)?
    └─ YES → React Hook Form
```

### Quick Reference Table

| Use Case | Solution | Why |
|----------|----------|-----|
| Server/API data | Data fetching solution | Caching, synchronization, loading states |
| Shareable filters | URL params | Bookmarkable, browser navigation |
| Shared UI state (2+ components) | Zustand | Fast, selective re-renders, no prop drilling |
| Local UI state (1 component) | useState | Simple, component-local |
| Framework providers | Context | Singletons that never change |
| Dependency injection | Context | Services, DB connections |
| **ANY state management** | **NEVER Context** | **Use Zustand instead** |

---

## RED FLAGS

**High Priority Issues:**

- **Storing server/API data in client state (useState, Context, Zustand)** - causes stale data, no caching, manual sync complexity
- **Using Context with useState/useReducer for state management** - every consumer re-renders on any change, performance nightmare
- **Using useState for state needed in 2+ components** - causes prop drilling, tight coupling, refactoring difficulty
- **Default exports in state files** - violates project conventions, breaks tree-shaking
- **Magic numbers in validation or initial state** - makes rules unclear, hard to maintain

**Medium Priority Issues:**

- Prop drilling 3+ levels instead of using Zustand
- Filter state in useState instead of URL params (not shareable)
- Creating unnecessary object references in Zustand selectors (causes re-renders)
- Subscribing to entire Zustand store instead of specific values
- Validating on every keystroke instead of on blur/submit

**Common Mistakes:**

- Mixing controlled and uncontrolled inputs in forms
- Not preventing default on form submit
- Showing validation errors before user finishes typing
- Not typing form events explicitly (use `ChangeEvent<HTMLInputElement>`, `FormEvent<HTMLFormElement>`)
- Disabling input fields during submission (only disable submit button)
- Not handling submit errors with user-friendly messages
- Missing loading states during async operations

**Gotchas & Edge Cases:**

- Context re-renders ALL consumers when ANY value changes - no way to select specific values
- Zustand selectors that return new objects cause re-renders even if values identical (use shallow or primitive selectors)
- URL params are always strings - need parsing for numbers/booleans
- Form validation on every keystroke kills performance - validate on blur/submit
- Persisting modal/sidebar state across sessions confuses users - only persist preferences

---

## Anti-Patterns

### Context for State Management

Using React Context with useState/useReducer for state management causes every consumer to re-render when ANY value changes. This creates a performance nightmare at scale with no way to select specific values.

```typescript
// WRONG - Context causes full re-renders
const AppContext = createContext({ user: null, theme: 'light', cart: [] });

// CORRECT - Zustand with selectors
const useStore = create((set) => ({ user: null, theme: 'light', cart: [] }));
const theme = useStore((s) => s.theme); // Only re-renders when theme changes
```

### Server Data in Client State

Storing API/server data in useState, Zustand, or Context causes stale data, no caching, and manual synchronization complexity.

```typescript
// WRONG - Server data in useState
const [users, setUsers] = useState([]);
useEffect(() => { fetchUsers().then(setUsers); }, []);

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
