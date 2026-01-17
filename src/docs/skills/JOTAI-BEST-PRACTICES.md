# Jotai Best Practices Research

**Research Date:** 2026-01-17
**Purpose:** Atomic skill creation for Jotai state management patterns
**Version:** Jotai v2.x (2.15.1 as of research date)
**Sources:** Official Jotai documentation, community best practices 2025/2026

---

## Table of Contents

1. [Core Concepts and Philosophy](#1-core-concepts-and-philosophy)
2. [Atom Types and Creation Patterns](#2-atom-types-and-creation-patterns)
3. [Derived and Computed Atoms](#3-derived-and-computed-atoms)
4. [Async Atoms and Suspense](#4-async-atoms-and-suspense)
5. [Atom Composition Patterns](#5-atom-composition-patterns)
6. [Performance Optimization](#6-performance-optimization)
7. [Storage and Persistence](#7-storage-and-persistence)
8. [TypeScript Integration](#8-typescript-integration)
9. [Store and Provider Patterns](#9-store-and-provider-patterns)
10. [TanStack Query Integration](#10-tanstack-query-integration)
11. [DevTools and Debugging](#11-devtools-and-debugging)
12. [Testing Patterns](#12-testing-patterns)
13. [Anti-Patterns and Common Mistakes](#13-anti-patterns-and-common-mistakes)

---

## 1. Core Concepts and Philosophy

### Philosophy

Jotai takes an atomic approach to global React state management. The core principle is: **"Anything that can be derived from the application state should be derived automatically."**

**Key characteristics:**
- **Bottom-up state design**: Build state from small, composable atoms
- **Automatic dependency tracking**: Like a spreadsheet - cells (atoms) automatically update when dependencies change
- **Fine-grained reactivity**: Components only re-render when their specific atoms change
- **First-class async support**: Async operations integrate seamlessly with React Suspense

### Mental Model

Think of atoms like cells in a spreadsheet:
- Each atom is an independent cell
- Derived atoms are formulas that reference other cells
- When a cell changes, only formulas depending on it recalculate
- This provides the minimum necessary work automatically

### When to Use Jotai

**Use Jotai when:**
- You need fine-grained reactivity without manual memoization
- You want to avoid the "prop drilling" problem
- You prefer a bottom-up, composable state architecture
- You need seamless async state with Suspense

**Do NOT use Jotai when:**
- Managing server/remote data (use TanStack Query instead)
- Simple local component state (use useState)
- You need Redux DevTools time-travel by default (though Jotai supports it)

---

## 2. Atom Types and Creation Patterns

### Primitive Atoms

The simplest atom type - holds a single value.

```typescript
import { atom } from 'jotai'

// Primitive atoms with type inference
const countAtom = atom(0)
const textAtom = atom('hello')
const boolAtom = atom(false)

// Explicit typing when needed
const userAtom = atom<User | null>(null)
const itemsAtom = atom<string[]>([])
```

### Read-Only Derived Atoms

Compute values from other atoms - cannot be written to directly.

```typescript
import { atom } from 'jotai'

const priceAtom = atom(100)
const quantityAtom = atom(2)

// Read-only derived atom
const totalAtom = atom((get) => get(priceAtom) * get(quantityAtom))

// Multiple dependencies
const count1Atom = atom(1)
const count2Atom = atom(2)
const count3Atom = atom(3)

const sumAtom = atom((get) =>
  get(count1Atom) + get(count2Atom) + get(count3Atom)
)

// FP style with array of atoms
const countsAtom = atom([count1Atom, count2Atom, count3Atom])
const fpSumAtom = atom((get) =>
  get(countsAtom).map(get).reduce((acc, val) => acc + val, 0)
)
```

### Write-Only Atoms (Action Atoms)

Write-only atoms for side effects and code splitting.

```typescript
import { atom } from 'jotai'

const countAtom = atom(0)

// Write-only action atom
const incrementAtom = atom(null, (get, set) => {
  set(countAtom, get(countAtom) + 1)
})

// Action atom with arguments
const addAtom = atom(null, (get, set, amount: number) => {
  set(countAtom, get(countAtom) + amount)
})

// Multiple arguments
const multiArgAtom = atom(
  null,
  (get, set, first: string, second: number) => {
    // Handle multiple args
  }
)
```

**Why action atoms?**
- Enable code splitting / lazy loading
- Encapsulate complex update logic
- Allow dead code elimination

### Read-Write Atoms

Atoms that can both read derived state and accept writes.

```typescript
import { atom } from 'jotai'

const textAtom = atom('hello')

// Read-write derived atom
const uppercaseAtom = atom(
  (get) => get(textAtom).toUpperCase(),
  (get, set, newValue: string) => {
    set(textAtom, newValue.toLowerCase())
  }
)

// Lens-like pattern for object properties
const userAtom = atom({ name: 'John', age: 30 })

const nameAtom = atom(
  (get) => get(userAtom).name,
  (get, set, newName: string) => {
    set(userAtom, { ...get(userAtom), name: newName })
  }
)
```

---

## 3. Derived and Computed Atoms

### Basic Computed Atoms

```typescript
import { atom } from 'jotai'

const baseAtom = atom(1)

// Computed with transformation
const doubledAtom = atom((get) => get(baseAtom) * 2)
const stringifiedAtom = atom((get) => String(get(baseAtom)))

// Conditional computation
const statusAtom = atom((get) => {
  const count = get(countAtom)
  if (count < 0) return 'negative'
  if (count === 0) return 'zero'
  return 'positive'
})
```

### Chained Derived Atoms

```typescript
const baseAtom = atom(1)
const step1Atom = atom((get) => get(baseAtom) * 2)
const step2Atom = atom((get) => get(step1Atom) + 10)
const finalAtom = atom((get) => `Result: ${get(step2Atom)}`)

// Each atom only recalculates when its dependencies change
```

### Computed Atoms with Multiple Sources

```typescript
interface CartItem {
  id: string
  price: number
  quantity: number
}

const cartItemsAtom = atom<CartItem[]>([])
const taxRateAtom = atom(0.08)
const discountAtom = atom(0)

const subtotalAtom = atom((get) =>
  get(cartItemsAtom).reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )
)

const taxAtom = atom((get) => get(subtotalAtom) * get(taxRateAtom))

const totalAtom = atom((get) => {
  const subtotal = get(subtotalAtom)
  const tax = get(taxAtom)
  const discount = get(discountAtom)
  return subtotal + tax - discount
})
```

---

## 4. Async Atoms and Suspense

### Basic Async Read Atoms

```typescript
import { atom } from 'jotai'

const urlAtom = atom('https://api.example.com/data')

// Async read atom - triggers Suspense
const dataAtom = atom(async (get) => {
  const url = get(urlAtom)
  const response = await fetch(url)
  return response.json()
})

// Usage requires Suspense boundary
// <Suspense fallback={<Loading />}>
//   <DataComponent />
// </Suspense>
```

### Async Atoms with AbortController

```typescript
const userIdAtom = atom(1)

// Supports cancellation via AbortController
const userAtom = atom(async (get, { signal }) => {
  const id = get(userIdAtom)
  const response = await fetch(`/api/users/${id}`, { signal })
  if (!response.ok) throw new Error('Failed to fetch user')
  return response.json()
})
```

### Async Write Atoms

```typescript
const dataAtom = atom<Data | null>(null)

// Async action atom
const fetchDataAtom = atom(null, async (get, set) => {
  const response = await fetch('/api/data')
  const data = await response.json()
  set(dataAtom, data)
})

// Usage in component
const [, fetchData] = useAtom(fetchDataAtom)
// Call fetchData() to trigger the async operation
```

### Suspense Setup Pattern

```tsx
import { Provider } from 'jotai'
import { Suspense } from 'react'

// CRITICAL: At least one Suspense must be inside Provider
const App = () => (
  <Provider>
    <Suspense fallback={<div>Loading...</div>}>
      <MainContent />
    </Suspense>
  </Provider>
)

// Multiple Suspense boundaries for granular loading states
const MainContent = () => (
  <>
    <Suspense fallback={<HeaderSkeleton />}>
      <Header />
    </Suspense>
    <Suspense fallback={<ContentSkeleton />}>
      <Content />
    </Suspense>
  </>
)
```

### Loadable Pattern (Non-Suspense)

```typescript
import { atom } from 'jotai'
import { loadable } from 'jotai/utils'

const asyncAtom = atom(async () => {
  const response = await fetch('/api/data')
  return response.json()
})

// Convert to loadable - doesn't trigger Suspense
const loadableAtom = loadable(asyncAtom)

// Returns: { state: 'loading' } | { state: 'hasData', data: T } | { state: 'hasError', error: unknown }
function Component() {
  const [value] = useAtom(loadableAtom)

  if (value.state === 'loading') return <Loading />
  if (value.state === 'hasError') return <Error error={value.error} />
  return <Data data={value.data} />
}
```

### Unwrap Utility for Sync/Async Atoms

```typescript
import { atom } from 'jotai'
import { unwrap } from 'jotai/utils'

const asyncAtom = atom(async () => fetchData())

// Convert async to sync with fallback
const syncAtom = unwrap(asyncAtom, (prev) => prev ?? defaultValue)

// Unlike loadable, unwrap throws errors (use ErrorBoundary)
```

---

## 5. Atom Composition Patterns

### Atoms in Atom Pattern

Store atom configs inside an atom for dynamic collections.

```typescript
import { atom, PrimitiveAtom } from 'jotai'

// Array of atoms pattern
const countsAtom = atom<PrimitiveAtom<number>[]>([
  atom(1),
  atom(2),
  atom(3),
])

// Benefits: updating one counter only re-renders that counter's component
function CounterList() {
  const [counts] = useAtom(countsAtom)

  return (
    <>
      {counts.map((countAtom, index) => (
        <Counter key={index} countAtom={countAtom} />
      ))}
    </>
  )
}

function Counter({ countAtom }: { countAtom: PrimitiveAtom<number> }) {
  const [count, setCount] = useAtom(countAtom)
  return (
    <button onClick={() => setCount((c) => c + 1)}>
      {count}
    </button>
  )
}
```

### Adding/Removing Atoms Dynamically

```typescript
const todosAtom = atom<PrimitiveAtom<Todo>[]>([])

const addTodoAtom = atom(null, (get, set, text: string) => {
  const newTodoAtom = atom<Todo>({ id: Date.now(), text, done: false })
  set(todosAtom, [...get(todosAtom), newTodoAtom])
})

const removeTodoAtom = atom(null, (get, set, todoAtom: PrimitiveAtom<Todo>) => {
  set(todosAtom, get(todosAtom).filter((a) => a !== todoAtom))
})
```

### atomFamily for Parameterized Atoms

```typescript
import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

// Create atoms on-demand based on parameters
const userAtomFamily = atomFamily((userId: string) =>
  atom(async () => {
    const response = await fetch(`/api/users/${userId}`)
    return response.json()
  })
)

// Usage
function UserProfile({ userId }: { userId: string }) {
  const [user] = useAtom(userAtomFamily(userId))
  return <div>{user.name}</div>
}

// With custom equality function
const itemAtomFamily = atomFamily(
  (id: string) => atom({ id, count: 0 }),
  (a, b) => a === b // Custom equality check for params
)
```

### Overriding Read-Only Atoms

```typescript
const readOnlyAtom = atom((get) => get(baseAtom) * 2)

// Create override capability
const overrideAtom = atom<number | null>(null)

const effectiveAtom = atom((get) => {
  const override = get(overrideAtom)
  return override !== null ? override : get(readOnlyAtom)
})
```

---

## 6. Performance Optimization

### Core Performance Principles

1. **Atoms are automatically fine-grained**: Each atom updates independently
2. **Computed values are cached**: Only recalculate when dependencies change
3. **Split components to match atom boundaries**: Smaller components = fewer re-renders

### selectAtom for Large Objects

```typescript
import { atom } from 'jotai'
import { selectAtom } from 'jotai/utils'

const userAtom = atom({
  name: 'John',
  email: 'john@example.com',
  preferences: {
    theme: 'dark',
    notifications: true,
  },
})

// Only re-render when name changes
const nameAtom = selectAtom(userAtom, (user) => user.name)

// Deep selection with equality check
const themeAtom = selectAtom(
  userAtom,
  (user) => user.preferences.theme,
  (a, b) => a === b // Custom equality
)
```

### focusAtom for Read-Write Access

```typescript
import { atom } from 'jotai'
import { focusAtom } from 'jotai-optics'

const userAtom = atom({ name: 'John', age: 30 })

// Creates a writable atom focused on a property
const nameAtom = focusAtom(userAtom, (optic) => optic.prop('name'))

// Now you can both read AND write to just the name
function NameEditor() {
  const [name, setName] = useAtom(nameAtom)
  return <input value={name} onChange={(e) => setName(e.target.value)} />
}
```

### splitAtom for Arrays

```typescript
import { atom } from 'jotai'
import { splitAtom } from 'jotai/utils'

interface Todo {
  id: string
  text: string
  done: boolean
}

const todosAtom = atom<Todo[]>([
  { id: '1', text: 'Learn Jotai', done: false },
  { id: '2', text: 'Build app', done: false },
])

// Split into individual atoms - each item gets its own atom
const todoAtomsAtom = splitAtom(todosAtom)

// With keyExtractor for stability (recommended)
const todoAtomsWithKeyAtom = splitAtom(todosAtom, (todo) => todo.id)

// Usage - each TodoItem only re-renders when its own todo changes
function TodoList() {
  const [todoAtoms, dispatch] = useAtom(todoAtomsAtom)

  return (
    <>
      {todoAtoms.map((todoAtom) => (
        <TodoItem
          key={`${todoAtom}`}
          todoAtom={todoAtom}
          onRemove={() => dispatch({ type: 'remove', atom: todoAtom })}
        />
      ))}
    </>
  )
}

function TodoItem({ todoAtom, onRemove }) {
  const [todo, setTodo] = useAtom(todoAtom)

  return (
    <div>
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => setTodo({ ...todo, done: !todo.done })}
      />
      {todo.text}
      <button onClick={onRemove}>Remove</button>
    </div>
  )
}
```

### When NOT to Use focusAtom/selectAtom

If an atom's object changes frequently (e.g., every second), creating focused atoms adds overhead without benefit since they'll all re-render anyway. Use direct access instead.

```typescript
// BAD: Object updates every second - focused atoms add overhead
const liveDataAtom = atom({ x: 0, y: 0, z: 0 }) // Updates 60fps
const xAtom = focusAtom(liveDataAtom, (o) => o.prop('x')) // Wasteful

// GOOD: Just use the atom directly for frequently-updating data
function LiveDisplay() {
  const [data] = useAtom(liveDataAtom)
  return <div>{data.x}, {data.y}, {data.z}</div>
}
```

---

## 7. Storage and Persistence

### atomWithStorage for localStorage

```typescript
import { atomWithStorage } from 'jotai/utils'

// Persists to localStorage by default
const themeAtom = atomWithStorage('theme', 'light')
const userPrefsAtom = atomWithStorage('userPrefs', {
  notifications: true,
  language: 'en',
})

// Options
const advancedAtom = atomWithStorage(
  'key',
  initialValue,
  undefined, // use default storage
  { getOnInit: true } // Read from storage on initialization
)
```

### sessionStorage

```typescript
import { atomWithStorage, createJSONStorage } from 'jotai/utils'

const sessionStorage = createJSONStorage(() => globalThis.sessionStorage)

const sessionAtom = atomWithStorage(
  'session-key',
  'default',
  sessionStorage
)
```

### Custom Storage (e.g., AsyncStorage for React Native)

```typescript
import { atomWithStorage, createJSONStorage } from 'jotai/utils'
import AsyncStorage from '@react-native-async-storage/async-storage'

const asyncStorage = createJSONStorage(() => AsyncStorage)

const persistedAtom = atomWithStorage(
  'my-key',
  defaultValue,
  asyncStorage
)
// Note: With async storage, the atom value becomes async
```

### Resetting Stored Values

```typescript
import { atomWithStorage, RESET } from 'jotai/utils'
import { useSetAtom } from 'jotai'

const settingsAtom = atomWithStorage('settings', defaultSettings)

function ResetButton() {
  const setSettings = useSetAtom(settingsAtom)

  return (
    <button onClick={() => setSettings(RESET)}>
      Reset to defaults
    </button>
  )
}
```

### SSR/Hydration with atomWithStorage

```tsx
// SSR renders with initialValue (no localStorage on server)
// This causes hydration mismatch if stored value differs

// Solution 1: ClientOnly wrapper
function ClientOnly({ children }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? children : null
}

// Solution 2: useHydrateAtoms
import { useHydrateAtoms } from 'jotai/utils'

function HydrateAtoms({ initialValues, children }) {
  useHydrateAtoms(initialValues)
  return children
}
```

---

## 8. TypeScript Integration

### Configuration Requirements

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,  // Required for Jotai's type inference
    "strictNullChecks": true  // Essential
  }
}
```

### Primitive Atom Typing

```typescript
import { atom } from 'jotai'

// Type inference works automatically
const countAtom = atom(0) // Atom<number>
const textAtom = atom('hello') // Atom<string>

// Explicit typing when needed
const userAtom = atom<User | null>(null)
const dataAtom = atom<Data[]>([])

// Union types
type Status = 'idle' | 'loading' | 'success' | 'error'
const statusAtom = atom<Status>('idle')
```

### Derived Atom Typing

```typescript
// Usually inferred correctly
const doubledAtom = atom((get) => get(countAtom) * 2)

// Explicit for async atoms
const asyncAtom = atom<Promise<string>>(async () => 'result')

// Explicit for complex types
interface DerivedData {
  total: number
  average: number
}

const statsAtom = atom<DerivedData>((get) => {
  const items = get(itemsAtom)
  return {
    total: items.reduce((sum, i) => sum + i.value, 0),
    average: items.length ? items.reduce((sum, i) => sum + i.value, 0) / items.length : 0,
  }
})
```

### Write Atom Type Parameters

```typescript
// Three type parameters: Value, Args (array), Result
const actionAtom = atom<null, [string], void>(
  null,
  (get, set, arg: string) => {
    // arg is typed as string
  }
)

// Multiple arguments
const multiArgAtom = atom<null, [string, number], void>(
  null,
  (get, set, name: string, count: number) => {
    // Both args are typed
  }
)

// With return value
const asyncActionAtom = atom<null, [string], Promise<Result>>(
  null,
  async (get, set, id: string) => {
    const result = await fetchData(id)
    set(dataAtom, result)
    return result
  }
)
```

### ExtractAtomValue Utility

```typescript
import { atom, ExtractAtomValue } from 'jotai'

const userAtom = atom({ name: 'John', age: 30 })

// Extract the value type from an atom
type User = ExtractAtomValue<typeof userAtom>
// Result: { name: string; age: number }

// Useful for function parameters
function processUser(user: ExtractAtomValue<typeof userAtom>) {
  // user is typed as { name: string; age: number }
}
```

### atomFamily with TypeScript

```typescript
import { atomFamily } from 'jotai/utils'
import type { Atom } from 'jotai'

interface User {
  id: string
  name: string
}

// Explicit typing
const userAtomFamily = atomFamily<string, Atom<Promise<User>>>(
  (userId: string) => atom(async () => {
    const response = await fetch(`/api/users/${userId}`)
    return response.json() as Promise<User>
  })
)
```

---

## 9. Store and Provider Patterns

### Provider-less Mode (Default)

```tsx
import { useAtom } from 'jotai'

// Works without Provider - uses default store
function Counter() {
  const [count, setCount] = useAtom(countAtom)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

### Custom Store with Provider

```tsx
import { Provider, createStore } from 'jotai'

const myStore = createStore()

// Pre-populate values
myStore.set(countAtom, 10)

// Subscribe to changes
const unsubscribe = myStore.sub(countAtom, () => {
  console.log('Count changed:', myStore.get(countAtom))
})

function App() {
  return (
    <Provider store={myStore}>
      <Counter />
    </Provider>
  )
}
```

### Using Store Outside React

```typescript
import { createStore } from 'jotai'

const store = createStore()

// Get value
const currentCount = store.get(countAtom)

// Set value
store.set(countAtom, 42)

// Subscribe to changes
const unsub = store.sub(countAtom, () => {
  console.log('New value:', store.get(countAtom))
})

// Later: cleanup
unsub()
```

### getDefaultStore for Provider-less Access

```typescript
import { getDefaultStore } from 'jotai'

// Access the default store used in provider-less mode
const defaultStore = getDefaultStore()

// Useful for accessing state outside React
defaultStore.set(countAtom, 0)
```

### Multiple Providers for Isolated State

```tsx
function App() {
  return (
    <>
      {/* Each Provider has its own isolated store */}
      <Provider>
        <Counter /> {/* Count: 0, 1, 2... */}
      </Provider>
      <Provider>
        <Counter /> {/* Count: 0, 1, 2... (independent) */}
      </Provider>
    </>
  )
}
```

### Resetting All State

```tsx
function App() {
  const [store, setStore] = useState(() => createStore())

  const resetAll = () => {
    setStore(createStore()) // Fresh store = reset all atoms
  }

  return (
    <Provider store={store}>
      <button onClick={resetAll}>Reset All</button>
      <MainContent />
    </Provider>
  )
}
```

---

## 10. TanStack Query Integration

### Installation

```bash
npm install jotai-tanstack-query @tanstack/query-core
```

### atomWithQuery Pattern

```typescript
import { atomWithQuery } from 'jotai-tanstack-query'

const userIdAtom = atom(1)

// Creates a query atom
const userAtom = atomWithQuery((get) => ({
  queryKey: ['user', get(userIdAtom)],
  queryFn: async ({ queryKey: [, id] }) => {
    const response = await fetch(`/api/users/${id}`)
    return response.json()
  },
}))

// Usage - returns QueryObserverResult
function UserProfile() {
  const [{ data, isLoading, error }] = useAtom(userAtom)

  if (isLoading) return <Loading />
  if (error) return <Error error={error} />
  return <div>{data.name}</div>
}
```

### atomWithInfiniteQuery Pattern

```typescript
import { atomWithInfiniteQuery } from 'jotai-tanstack-query'

const postsAtom = atomWithInfiniteQuery(() => ({
  queryKey: ['posts'],
  queryFn: async ({ pageParam = 0 }) => {
    const response = await fetch(`/api/posts?page=${pageParam}`)
    return response.json()
  },
  getNextPageParam: (lastPage) => lastPage.nextCursor,
  getPreviousPageParam: (firstPage) => firstPage.prevCursor,
}))
```

### atomWithMutation Pattern

```typescript
import { atomWithMutation } from 'jotai-tanstack-query'

const updateUserAtom = atomWithMutation(() => ({
  mutationFn: async (userData: UpdateUserInput) => {
    const response = await fetch('/api/user', {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
    return response.json()
  },
}))

function UpdateUserForm() {
  const [{ mutate, isPending }] = useAtom(updateUserAtom)

  const handleSubmit = (data) => {
    mutate(data)
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

### Sharing QueryClient with TanStack Query Hooks

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'jotai'
import { queryClientAtom } from 'jotai-tanstack-query'
import { useHydrateAtoms } from 'jotai/utils'

const queryClient = new QueryClient()

// Hydrate the queryClient atom
function HydrateAtoms({ children }) {
  useHydrateAtoms([[queryClientAtom, queryClient]])
  return children
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider>
        <HydrateAtoms>
          <MainContent />
        </HydrateAtoms>
      </Provider>
    </QueryClientProvider>
  )
}
```

### When to Use jotai-tanstack-query vs Plain TanStack Query

**Use jotai-tanstack-query when:**
- You need to compose query results with other Jotai atoms
- You want to use query results in derived atoms
- You prefer atoms over hooks for consistency

**Use plain TanStack Query when:**
- Simple data fetching without atom composition
- You're gradually adopting Jotai
- Team is more familiar with hooks

---

## 11. DevTools and Debugging

### Jotai DevTools Setup

```bash
npm install jotai-devtools
```

```tsx
// Only in development - tree-shake in production
import { DevTools } from 'jotai-devtools'
import 'jotai-devtools/styles.css'

function App() {
  return (
    <>
      {process.env.NODE_ENV === 'development' && <DevTools />}
      <MainContent />
    </>
  )
}
```

### Next.js Configuration

```javascript
// next.config.js
const nextConfig = {
  transpilePackages: ['jotai-devtools'],
}

export default nextConfig
```

### Debug Labels

```typescript
// Manual debug labels
const countAtom = atom(0)
countAtom.debugLabel = 'count'

// Or use Babel/SWC plugin for automatic labels
// babel.config.js
module.exports = {
  plugins: [
    'jotai/babel/plugin-react-refresh', // Hot reload for atoms
    'jotai/babel/plugin-debug-label',   // Auto debug labels
  ],
}
```

### React DevTools Integration

```typescript
import { useAtomsDebugValue } from 'jotai-devtools/utils'

// Add to a component high in the tree
function DebugAtoms() {
  useAtomsDebugValue()
  return null
}

function App() {
  return (
    <Provider>
      <DebugAtoms />
      <MainContent />
    </Provider>
  )
}

// Now in React DevTools, look for "AtomsDebugValue" hook
// to see all atom values
```

### Redux DevTools Integration

```typescript
import { useAtomDevtools } from 'jotai-devtools/utils'

const countAtom = atom(0)

function Counter() {
  const [count, setCount] = useAtom(countAtom)

  // Connect to Redux DevTools for this specific atom
  useAtomDevtools(countAtom, { name: 'count' })

  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}

// Features:
// - Time travel debugging
// - Action logging
// - State inspection
```

---

## 12. Testing Patterns

### Core Philosophy

Treat atoms as implementation details. Test behavior, not state management internals.

### Testing Components That Use Atoms

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'jotai'

// Test through component behavior
test('counter increments on click', async () => {
  render(
    <Provider>
      <Counter />
    </Provider>
  )

  const button = screen.getByRole('button')
  expect(button).toHaveTextContent('0')

  await userEvent.click(button)
  expect(button).toHaveTextContent('1')
})
```

### useHydrateAtoms for Initial Test Values

```typescript
import { Provider } from 'jotai'
import { useHydrateAtoms } from 'jotai/utils'

// Helper component to set initial values
function HydrateAtoms({
  initialValues,
  children
}: {
  initialValues: [Atom<unknown>, unknown][]
  children: React.ReactNode
}) {
  useHydrateAtoms(initialValues)
  return children
}

// Custom render function
function renderWithAtoms(
  ui: React.ReactElement,
  initialValues: [Atom<unknown>, unknown][] = []
) {
  return render(
    <Provider>
      <HydrateAtoms initialValues={initialValues}>
        {ui}
      </HydrateAtoms>
    </Provider>
  )
}

// Usage
test('counter at boundary', async () => {
  renderWithAtoms(<Counter />, [[countAtom, 99]])

  const button = screen.getByRole('button')
  expect(button).toHaveTextContent('99')
})
```

### Testing with createStore

```typescript
import { createStore } from 'jotai'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

test('counter with store access', async () => {
  const store = createStore()

  render(
    <Provider store={store}>
      <Counter />
    </Provider>
  )

  // Verify initial value
  expect(store.get(countAtom)).toBe(0)

  await userEvent.click(screen.getByRole('button'))

  // Verify store was updated
  expect(store.get(countAtom)).toBe(1)
})
```

### Testing Atoms Directly (When Needed)

```typescript
import { renderHook, act } from '@testing-library/react'
import { Provider, useAtom } from 'jotai'

test('counter never goes below 0', () => {
  const { result } = renderHook(() => useAtom(countAtom), {
    wrapper: Provider,
  })

  const [, setCount] = result.current

  // Try to set negative
  act(() => {
    setCount(-10)
  })

  // Assuming the atom has validation
  const [count] = result.current
  expect(count).toBeGreaterThanOrEqual(0)
})
```

### Resetting State Between Tests

```typescript
import { createStore, Provider } from 'jotai'

describe('Counter', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    // Fresh store for each test
    store = createStore()
  })

  const renderCounter = () =>
    render(
      <Provider store={store}>
        <Counter />
      </Provider>
    )

  test('starts at 0', () => {
    renderCounter()
    expect(screen.getByRole('button')).toHaveTextContent('0')
  })

  test('can be pre-set', () => {
    store.set(countAtom, 42)
    renderCounter()
    expect(screen.getByRole('button')).toHaveTextContent('42')
  })
})
```

### Testing atomWithHash (URL State)

```typescript
beforeEach(() => {
  // Reset URL hash before each test
  window.location.assign('#')
})

test('syncs with URL hash', () => {
  // Test component that uses atomWithHash
})
```

---

## 13. Anti-Patterns and Common Mistakes

### Anti-Pattern 1: Overusing Atom Scope

```typescript
// BAD: Creating too many atoms for tightly coupled state
const firstNameAtom = atom('')
const lastNameAtom = atom('')
const emailAtom = atom('')
const ageAtom = atom(0)
// ... 20 more related atoms

// GOOD: Group related state
interface UserForm {
  firstName: string
  lastName: string
  email: string
  age: number
}

const userFormAtom = atom<UserForm>({
  firstName: '',
  lastName: '',
  email: '',
  age: 0,
})

// Use focusAtom or selectAtom if you need granular updates
```

### Anti-Pattern 2: Not Using Derived Atoms

```typescript
// BAD: Computing in component
function Total() {
  const [items] = useAtom(itemsAtom)
  const [tax] = useAtom(taxAtom)

  // Recomputes every render, even if unrelated state changes
  const total = items.reduce((sum, i) => sum + i.price, 0) * (1 + tax)

  return <div>{total}</div>
}

// GOOD: Computed atom
const totalAtom = atom((get) => {
  const items = get(itemsAtom)
  const tax = get(taxAtom)
  return items.reduce((sum, i) => sum + i.price, 0) * (1 + tax)
})

function Total() {
  const [total] = useAtom(totalAtom)
  return <div>{total}</div>
}
```

### Anti-Pattern 3: Using Jotai for Server State

```typescript
// BAD: Managing server data with plain atoms
const usersAtom = atom<User[]>([])
const loadingAtom = atom(false)
const errorAtom = atom<Error | null>(null)

const fetchUsersAtom = atom(null, async (get, set) => {
  set(loadingAtom, true)
  try {
    const data = await fetchUsers()
    set(usersAtom, data)
  } catch (e) {
    set(errorAtom, e)
  } finally {
    set(loadingAtom, false)
  }
})

// GOOD: Use TanStack Query for server state
import { useQuery } from '@tanstack/react-query'

function UserList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })
  // ...
}

// OR use jotai-tanstack-query if you need atom composition
```

### Anti-Pattern 4: Creating Atoms in Render

```typescript
// BAD: New atom every render = broken state
function Counter() {
  const countAtom = atom(0) // New atom each render!
  const [count, setCount] = useAtom(countAtom)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}

// GOOD: Define atoms outside component
const countAtom = atom(0)

function Counter() {
  const [count, setCount] = useAtom(countAtom)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}

// GOOD: Use useMemo if atom must be created dynamically
function DynamicCounter({ initialValue }) {
  const countAtom = useMemo(() => atom(initialValue), [initialValue])
  const [count, setCount] = useAtom(countAtom)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

### Anti-Pattern 5: Not Handling Async Properly

```typescript
// BAD: No Suspense boundary
function App() {
  return (
    <Provider>
      <AsyncComponent /> {/* Will crash if asyncAtom suspends */}
    </Provider>
  )
}

// GOOD: Always wrap async consumers in Suspense
function App() {
  return (
    <Provider>
      <Suspense fallback={<Loading />}>
        <AsyncComponent />
      </Suspense>
    </Provider>
  )
}
```

### Anti-Pattern 6: Forgetting Provider Isolation

```typescript
// BAD: Expecting shared state across Providers
<Provider>
  <Counter /> {/* count = 5 */}
</Provider>
<Provider>
  <Counter /> {/* count = 0, NOT shared! */}
</Provider>

// GOOD: Use single Provider for shared state
<Provider>
  <Counter />
  <AnotherComponent />
</Provider>

// OR explicitly share a store
const sharedStore = createStore()

<Provider store={sharedStore}>
  <Counter />
</Provider>
<Provider store={sharedStore}>
  <AnotherComponent />
</Provider>
```

### Anti-Pattern 7: Overcomplicating with focusAtom

```typescript
// BAD: Using focusAtom on frequently-updating data
const realtimeDataAtom = atom({ x: 0, y: 0, z: 0 }) // Updates 60fps
const xAtom = focusAtom(realtimeDataAtom, (o) => o.prop('x'))
const yAtom = focusAtom(realtimeDataAtom, (o) => o.prop('y'))
const zAtom = focusAtom(realtimeDataAtom, (o) => o.prop('z'))
// Adds overhead when all values update together anyway

// GOOD: Just use the atom directly
const [data] = useAtom(realtimeDataAtom)
```

### Anti-Pattern 8: Testing Implementation Details

```typescript
// BAD: Testing atom values directly
test('increments', () => {
  expect(store.get(countAtom)).toBe(0)
  // Triggering update somehow...
  expect(store.get(countAtom)).toBe(1)
})

// GOOD: Test through component behavior
test('increments', async () => {
  render(<Counter />)
  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toHaveTextContent('1')
})
```

---

## Quick Reference

### Essential Imports

```typescript
// Core
import { atom, useAtom, useAtomValue, useSetAtom, Provider, createStore } from 'jotai'

// Utils
import {
  atomWithStorage,
  atomFamily,
  selectAtom,
  splitAtom,
  loadable,
  unwrap,
  useHydrateAtoms,
  RESET
} from 'jotai/utils'

// Extensions
import { focusAtom } from 'jotai-optics'
import { atomWithQuery, atomWithMutation } from 'jotai-tanstack-query'
import { DevTools } from 'jotai-devtools'
```

### Atom Creation Cheat Sheet

| Type | Signature | Example |
|------|-----------|---------|
| Primitive | `atom(initialValue)` | `atom(0)` |
| Read-only | `atom((get) => derived)` | `atom((get) => get(a) * 2)` |
| Write-only | `atom(null, (get, set, arg) => {})` | `atom(null, (g, s, x) => s(a, x))` |
| Read-write | `atom((get) => val, (get, set, arg) => {})` | See above |
| Async | `atom(async (get) => promise)` | `atom(async () => fetch(...))` |

### Decision Framework

```
Is it server data?
├── YES → TanStack Query (or jotai-tanstack-query)
└── NO → Is it shared across components?
    ├── NO → useState
    └── YES → Is it persisted?
        ├── YES → atomWithStorage
        └── NO → Is it a collection?
            ├── YES → Consider splitAtom
            └── NO → Regular atom
```

---

## Sources

- [Jotai Official Documentation](https://jotai.org/docs)
- [Jotai GitHub Repository](https://github.com/pmndrs/jotai)
- [Jotai v2 Migration Guide](https://jotai.org/docs/guides/migrating-to-v2-api)
- [Jotai Performance Guide](https://jotai.org/docs/guides/performance)
- [Jotai Testing Guide](https://jotai.org/docs/guides/testing)
- [Jotai TypeScript Guide](https://jotai.org/docs/guides/typescript)
- [Jotai DevTools](https://github.com/jotaijs/jotai-devtools)
- [jotai-tanstack-query](https://github.com/jotaijs/jotai-tanstack-query)
- [Daishi Kato's Blog - You Might Not Need React Query for Jotai](https://blog.axlight.com/posts/you-might-not-need-react-query-for-jotai/)
- [Avoiding Death by 1000 Cuts with Jotai](https://dev.to/nibtime/avoid-the-death-by-a-1000-cuts-performance-problem-with-jotai-4mco)
- [Testing Jotai Atoms Best Practices](https://sandroroth.com/blog/testing-jotai-atoms/)
