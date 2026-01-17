# SolidJS Best Practices Research

> Research compiled for creating atomic skills. Last updated: January 2026

## Table of Contents

1. [Reactivity System](#1-reactivity-system-signals-effects-memos)
2. [Component Patterns](#2-component-patterns)
3. [Control Flow Components](#3-control-flow-components)
4. [Store Patterns](#4-store-patterns)
5. [Context Patterns](#5-context-patterns)
6. [SolidStart Patterns](#6-solidstart-patterns)
7. [Resource Pattern](#7-resource-pattern-for-data-fetching)
8. [Suspense and Error Boundaries](#8-suspense-and-error-boundaries)
9. [Testing Patterns](#9-testing-patterns)
10. [Performance Considerations](#10-performance-considerations)

---

## 1. Reactivity System (Signals, Effects, Memos)

### Core Patterns

#### Signals - The Foundation

```typescript
import { createSignal } from 'solid-js';

// Basic signal
const [count, setCount] = createSignal(0);

// Reading a signal (MUST call as function)
console.log(count()); // 0

// Setting a signal
setCount(1);
setCount(prev => prev + 1);

// With TypeScript explicit types
const [user, setUser] = createSignal<User | null>(null);
```

#### Effects - Side Effects on State Changes

```typescript
import { createEffect, onCleanup } from 'solid-js';

// Basic effect - automatically tracks dependencies
createEffect(() => {
  console.log('Count changed:', count());
});

// Effect with cleanup
createEffect(() => {
  const handler = () => console.log(count());
  window.addEventListener('click', handler);

  onCleanup(() => {
    window.removeEventListener('click', handler);
  });
});

// Effect that runs on specific signal (explicit tracking)
createEffect(on(count, (value, prev) => {
  console.log('Count went from', prev, 'to', value);
}));
```

#### Memos - Cached Derived Values

```typescript
import { createMemo } from 'solid-js';

const [firstName, setFirstName] = createSignal('John');
const [lastName, setLastName] = createSignal('Doe');

// Memo caches the result until dependencies change
const fullName = createMemo(() => `${firstName()} ${lastName()}`);

// Expensive computation - only runs when items changes
const sortedItems = createMemo(() => {
  return [...items()].sort((a, b) => a.name.localeCompare(b.name));
});
```

### Anti-Patterns to Avoid

```typescript
// BAD: Async operations inside createEffect
createEffect(() => {
  setTimeout(() => {
    console.log(count()); // NOT tracked - runs outside sync scope
  }, 1000);
});

// GOOD: Use untrack for non-reactive reads
import { untrack } from 'solid-js';
createEffect(() => {
  const currentCount = count(); // tracked
  setTimeout(() => {
    console.log(untrack(() => otherSignal())); // explicitly not tracked
  }, 1000);
});

// BAD: Side effects in memos
const doubled = createMemo(() => {
  updateSomethingElse(); // DON'T DO THIS
  return count() * 2;
});

// GOOD: Keep memos pure
const doubled = createMemo(() => count() * 2);

// BAD: Destructuring reactive sources
const { name, age } = props; // BREAKS reactivity

// GOOD: Access props directly or use splitProps
const name = () => props.name;
// OR
const [local, others] = splitProps(props, ['name', 'age']);
```

### When to Use

| Primitive | Use When | Don't Use When |
|-----------|----------|----------------|
| `createSignal` | Managing reactive state | Static values that never change |
| `createEffect` | Side effects (DOM, network, logging) | Deriving computed values |
| `createMemo` | Expensive computations, derived values | Simple inline expressions |

### Key Differences from React

| React | SolidJS | Notes |
|-------|---------|-------|
| `useState` returns value | `createSignal` returns getter function | Must call `count()` not `count` |
| `useEffect` needs dependency array | `createEffect` auto-tracks | No manual dependency management |
| `useMemo` needs dependency array | `createMemo` auto-tracks | Always fresh, no stale closures |
| Re-renders on state change | Only updates DOM nodes | Fine-grained, not component-level |

---

## 2. Component Patterns

### Core Patterns

#### Basic Component

```typescript
import { Component, JSX } from 'solid-js';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
  children: JSX.Element;
}

// Using Component type for props with children
const Button: Component<ButtonProps> = (props) => {
  return (
    <button
      class={`btn btn-${props.variant ?? 'primary'}`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
};
```

#### Props Handling with splitProps and mergeProps

```typescript
import { splitProps, mergeProps, Component } from 'solid-js';
import type { JSX } from 'solid-js';

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input: Component<InputProps> = (props) => {
  // Split custom props from native HTML props
  const [local, inputProps] = splitProps(props, ['label', 'error']);

  return (
    <div>
      <label>{local.label}</label>
      <input {...inputProps} />
      {local.error && <span class="error">{local.error}</span>}
    </div>
  );
};

// Default props with mergeProps
const Button: Component<ButtonProps> = (rawProps) => {
  const props = mergeProps({ variant: 'primary' }, rawProps);
  // props.variant is now guaranteed to have a value
  return <button class={`btn-${props.variant}`}>{props.children}</button>;
};
```

#### Ref Forwarding

```typescript
interface InputProps {
  ref?: HTMLInputElement | ((el: HTMLInputElement) => void);
  placeholder?: string;
}

const Input: Component<InputProps> = (props) => {
  return (
    <input
      ref={props.ref}
      placeholder={props.placeholder}
    />
  );
};

// Usage - no forwardRef HOC needed!
function Parent() {
  let inputRef: HTMLInputElement;

  return (
    <div>
      <Input ref={inputRef!} />
      <button onClick={() => inputRef.focus()}>Focus</button>
    </div>
  );
}
```

#### Component Types

```typescript
import {
  Component,        // Standard component with optional children
  ParentComponent,  // Component that expects children
  VoidComponent,    // Component that should NOT have children
  FlowComponent     // For control flow (Show, For, etc.)
} from 'solid-js';

// No children expected
const Icon: VoidComponent<{ name: string }> = (props) => (
  <svg><use href={`#${props.name}`} /></svg>
);

// Children required
const Card: ParentComponent<{ title: string }> = (props) => (
  <div class="card">
    <h2>{props.title}</h2>
    {props.children}
  </div>
);

// Flow component (like Show)
const MyShow: FlowComponent<{ when: boolean }, JSX.Element> = (props) => (
  props.when ? props.children : null
);
```

### Anti-Patterns to Avoid

```typescript
// BAD: Destructuring props (breaks reactivity)
const Greeting = ({ name }) => <h1>Hello {name}</h1>;

// GOOD: Access props directly
const Greeting: Component<{ name: string }> = (props) => (
  <h1>Hello {props.name}</h1>
);

// BAD: Creating derived values in component body without memo
const List: Component<{ items: Item[] }> = (props) => {
  const sorted = props.items.sort(); // Runs every time accessed!
  return <ul>{/* ... */}</ul>;
};

// GOOD: Use createMemo for derived values
const List: Component<{ items: Item[] }> = (props) => {
  const sorted = createMemo(() => [...props.items].sort());
  return <ul>{/* ... */}</ul>;
};

// BAD: Assuming component re-renders like React
const Counter: Component = () => {
  const [count, setCount] = createSignal(0);
  console.log('This only logs ONCE, not on every update!');
  return <button onClick={() => setCount(c => c + 1)}>{count()}</button>;
};
```

### When to Use

| Pattern | Use When | Don't Use When |
|---------|----------|----------------|
| `splitProps` | Separating custom props from HTML attrs | Simple components with few props |
| `mergeProps` | Providing default prop values | Props don't need defaults |
| `ParentComponent` | Component must have children | Children are optional |
| `VoidComponent` | Component should never have children | Children might be needed |

### Key Differences from React

| React | SolidJS | Notes |
|-------|---------|-------|
| `React.forwardRef` HOC | Just pass ref as prop | No special wrapper needed |
| Components re-render | Components run once | Only JSX expressions update |
| `children` is a value | `children` is a getter | Use `children()` helper if iterating |
| Destructure props freely | Never destructure props | Use splitProps if needed |

---

## 3. Control Flow Components

### Core Patterns

#### Show - Conditional Rendering

```typescript
import { Show } from 'solid-js';

// Basic boolean condition
<Show when={isLoggedIn()}>
  <Dashboard />
</Show>

// With fallback
<Show when={user()} fallback={<LoginForm />}>
  <Dashboard />
</Show>

// Keyed flow - access the truthy value
<Show when={user()} fallback={<LoginForm />}>
  {(user) => <Dashboard user={user()} />}
</Show>
```

#### For - List Rendering

```typescript
import { For } from 'solid-js';

// Basic list
<For each={items()}>
  {(item, index) => (
    <li>
      {index()}: {item.name}
    </li>
  )}
</For>

// With fallback for empty list
<For each={items()} fallback={<p>No items found</p>}>
  {(item) => <Item data={item} />}
</For>
```

#### Index - When Index is the Key

```typescript
import { Index } from 'solid-js';

// Use Index when the array is static but values change
// (opposite of For - here index is fixed, values are signals)
<Index each={items()}>
  {(item, index) => (
    <li>
      {index}: {item().name}
    </li>
  )}
</Index>
```

#### Switch/Match - Multiple Conditions

```typescript
import { Switch, Match } from 'solid-js';

// Multiple exclusive conditions
<Switch fallback={<p>Unknown status</p>}>
  <Match when={status() === 'loading'}>
    <Spinner />
  </Match>
  <Match when={status() === 'error'}>
    <ErrorMessage />
  </Match>
  <Match when={status() === 'success'}>
    <SuccessView />
  </Match>
</Switch>

// Keyed matches
<Switch>
  <Match when={user()}>
    {(user) => <UserProfile user={user()} />}
  </Match>
  <Match when={guest()}>
    {(guest) => <GuestView guest={guest()} />}
  </Match>
</Switch>
```

#### Dynamic - Dynamic Component Rendering

```typescript
import { Dynamic } from 'solid-js/web';

const components = {
  button: Button,
  link: Link,
  text: Text
};

// Render component based on type
<Dynamic component={components[props.type]} {...props} />

// With native elements
<Dynamic component={props.as || 'div'} class="container">
  {props.children}
</Dynamic>
```

#### Portal - Render Outside DOM Hierarchy

```typescript
import { Portal } from 'solid-js/web';

// Render modal at document.body
<Portal>
  <div class="modal-overlay">
    <div class="modal">{props.children}</div>
  </div>
</Portal>

// Custom mount point
<Portal mount={document.getElementById('modals')!}>
  <Modal />
</Portal>
```

### Anti-Patterns to Avoid

```typescript
// BAD: Using ternary instead of Show
const MyComponent = () => (
  <div>
    {isLoggedIn() ? <Dashboard /> : <Login />}
  </div>
);

// GOOD: Use Show for conditional rendering
const MyComponent = () => (
  <div>
    <Show when={isLoggedIn()} fallback={<Login />}>
      <Dashboard />
    </Show>
  </div>
);

// BAD: Using array.map instead of For
const List = () => (
  <ul>
    {items().map(item => <li>{item.name}</li>)}
  </ul>
);

// GOOD: Use For for list rendering
const List = () => (
  <ul>
    <For each={items()}>
      {(item) => <li>{item.name}</li>}
    </For>
  </ul>
);

// BAD: Nested Shows for multiple conditions
<Show when={a()}>
  <A />
  <Show when={!a() && b()}>
    <B />
  </Show>
</Show>

// GOOD: Use Switch for multiple conditions
<Switch>
  <Match when={a()}><A /></Match>
  <Match when={b()}><B /></Match>
</Switch>
```

### When to Use

| Component | Use When | Don't Use When |
|-----------|----------|----------------|
| `Show` | Simple boolean/truthy condition | Multiple exclusive conditions |
| `For` | Reference-stable array items | Values change but keys don't |
| `Index` | Values change, positions stable | Items are added/removed frequently |
| `Switch/Match` | Multiple exclusive conditions | Simple boolean check |
| `Dynamic` | Component type is runtime-determined | Component type is static |
| `Portal` | Rendering outside DOM tree (modals) | Normal component hierarchy |

### Key Differences from React

| React | SolidJS | Notes |
|-------|---------|-------|
| Ternary `? :` | `<Show>` component | Show is optimized for fine-grained updates |
| `array.map()` | `<For>` component | For handles keying automatically |
| Switch statement | `<Switch>/<Match>` | First truthy Match renders |
| `ReactDOM.createPortal` | `<Portal>` | Same concept, component syntax |

---

## 4. Store Patterns

### Core Patterns

#### Basic Store

```typescript
import { createStore } from 'solid-js/store';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

interface TodoStore {
  todos: Todo[];
  filter: 'all' | 'active' | 'completed';
}

// Create store with initial state
const [store, setStore] = createStore<TodoStore>({
  todos: [],
  filter: 'all'
});

// Reading (auto-tracked in reactive contexts)
console.log(store.todos.length);

// Setting - path-based syntax
setStore('filter', 'active');
setStore('todos', todos => [...todos, newTodo]);
setStore('todos', 0, 'completed', true);
```

#### Nested Updates with Path Syntax

```typescript
const [store, setStore] = createStore({
  user: {
    profile: {
      name: 'John',
      settings: {
        theme: 'dark'
      }
    }
  }
});

// Update deeply nested value
setStore('user', 'profile', 'settings', 'theme', 'light');

// Update multiple items in array
setStore('todos', todo => todo.completed, 'visible', false);

// Update by index
setStore('todos', 0, 'completed', true);

// Update with function
setStore('user', 'profile', 'name', prev => prev.toUpperCase());
```

#### Using produce for Complex Updates

```typescript
import { createStore, produce } from 'solid-js/store';

const [store, setStore] = createStore({
  users: [
    { id: 1, name: 'John', tasks: [] }
  ]
});

// Complex mutation with produce (Immer-like API)
setStore(produce((state) => {
  const user = state.users.find(u => u.id === 1);
  if (user) {
    user.tasks.push({ id: Date.now(), text: 'New task' });
    user.name = 'John Doe';
  }
}));
```

#### Using reconcile for External Data

```typescript
import { createStore, reconcile } from 'solid-js/store';

const [store, setStore] = createStore({ items: [] });

// Replace store contents, preserving references where possible
async function fetchItems() {
  const newItems = await api.getItems();
  setStore('items', reconcile(newItems));
}
```

#### Using unwrap for Non-Reactive Access

```typescript
import { createStore, unwrap } from 'solid-js/store';

const [store, setStore] = createStore({ data: [] });

// Get plain JavaScript object (for third-party libs, logging, etc.)
const plainObject = unwrap(store);
console.log(JSON.stringify(plainObject));
```

### Anti-Patterns to Avoid

```typescript
// BAD: Direct mutation (won't trigger updates)
store.todos.push(newTodo);

// GOOD: Use setStore
setStore('todos', todos => [...todos, newTodo]);

// BAD: Replacing entire store when updating one field
setStore({ ...store, filter: 'active' });

// GOOD: Update specific path
setStore('filter', 'active');

// BAD: Not handling null in path syntax
setStore('user', 'profile', 'name', 'New Name'); // Fails if user is null

// GOOD: Use produce for null-safe updates
setStore(produce((state) => {
  if (state.user?.profile) {
    state.user.profile.name = 'New Name';
  }
}));

// BAD: Creating store from prop (stores get connected)
const [localStore, setLocalStore] = createStore(props.data);

// GOOD: Deep clone if isolation needed
const [localStore, setLocalStore] = createStore(
  JSON.parse(JSON.stringify(props.data))
);
```

### When to Use

| Pattern | Use When | Don't Use When |
|---------|----------|----------------|
| `createStore` | Complex nested state | Simple primitive values (use signal) |
| `produce` | Multiple mutations, complex logic | Simple single-field updates |
| `reconcile` | Replacing data from external source | Fine-grained known updates |
| `unwrap` | Need plain JS object | Keeping reactivity |
| Path syntax | Direct updates to known paths | Complex conditional logic |

### Key Differences from React

| React | SolidJS | Notes |
|-------|---------|-------|
| `useState` with spread | `createStore` with path syntax | No need to spread/clone |
| Immer library | Built-in `produce` | Same API, built into Solid |
| Replace entire state | Fine-grained path updates | Only affected parts re-render |
| Normalized state pattern | Nested state is fine | Proxies make deep nesting efficient |

---

## 5. Context Patterns

### Core Patterns

#### Basic Context

```typescript
import { createContext, useContext, ParentComponent } from 'solid-js';
import { createStore } from 'solid-js/store';

// 1. Create context with type
interface AuthContextValue {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>();

// 2. Create provider component
const AuthProvider: ParentComponent = (props) => {
  const [store, setStore] = createStore<{ user: User | null }>({
    user: null
  });

  const value: AuthContextValue = {
    get user() { return store.user; },
    async login(credentials) {
      const user = await api.login(credentials);
      setStore('user', user);
    },
    logout() {
      setStore('user', null);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {props.children}
    </AuthContext.Provider>
  );
};

// 3. Create typed hook with error handling
function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export { AuthProvider, useAuth };
```

#### Context with Default Value

```typescript
// With default - useContext never returns undefined
const ThemeContext = createContext<'light' | 'dark'>('light');

function useTheme() {
  return useContext(ThemeContext); // Always returns a value
}
```

#### Using @solid-primitives/context

```typescript
import { createContextProvider } from '@solid-primitives/context';

// Creates both Provider and useContext in one call
const [ThemeProvider, useTheme] = createContextProvider(
  (props: { initial?: 'light' | 'dark' }) => {
    const [theme, setTheme] = createSignal(props.initial ?? 'light');
    return {
      theme,
      toggle: () => setTheme(t => t === 'light' ? 'dark' : 'light')
    };
  },
  // Optional default value (removes undefined from return type)
  { theme: () => 'light' as const, toggle: () => {} }
);

export { ThemeProvider, useTheme };
```

#### Multi-Provider Pattern

```typescript
import { MultiProvider } from '@solid-primitives/context';

// Avoid Provider nesting hell
function App() {
  return (
    <MultiProvider
      values={[
        [ThemeContext.Provider, { value: theme }],
        [AuthContext.Provider, { value: auth }],
        [I18nContext.Provider, { value: i18n }]
      ]}
    >
      <MainContent />
    </MultiProvider>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// BAD: Creating context in component (recreates on HMR)
function App() {
  const MyContext = createContext(); // Recreated on every HMR!
  // ...
}

// GOOD: Create context in its own module
// context/theme.ts
export const ThemeContext = createContext<ThemeValue>();

// BAD: Not handling undefined context
function useAuth() {
  return useContext(AuthContext); // Could be undefined!
}

// GOOD: Throw helpful error
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// BAD: Passing primitives that lose reactivity
<MyContext.Provider value={count()}> // Loses reactivity!

// GOOD: Pass signals or objects with getters
<MyContext.Provider value={{ count }}>  // Signal preserved
<MyContext.Provider value={{ get count() { return count(); } }}>
```

### When to Use

| Pattern | Use When | Don't Use When |
|---------|----------|----------------|
| Context | Data needed by many components at different depths | Prop drilling is only 1-2 levels |
| Context + Store | Complex shared state | Simple primitive values |
| Default value | Value should never be undefined | Presence indicates proper setup |
| @solid-primitives | Want cleaner API | Simple use cases |

### Key Differences from React

| React | SolidJS | Notes |
|-------|---------|-------|
| `createContext(default)` | Same API | Default works same way |
| Context causes re-renders | Only accessed values update | Fine-grained, not tree-wide |
| `useContext` returns value | Same API | Must be in component/effect scope |
| Provider nesting | Same pattern | Or use MultiProvider primitive |

---

## 6. SolidStart Patterns

### Core Patterns

#### File-Based Routing

```
src/
  routes/
    index.tsx          -> /
    about.tsx          -> /about
    blog/
      index.tsx        -> /blog
      [slug].tsx       -> /blog/:slug
    users/
      [id]/
        index.tsx      -> /users/:id
        posts.tsx      -> /users/:id/posts
    [...404].tsx       -> /* (catch-all)
```

#### Server Functions

```typescript
// src/lib/server.ts
'use server';

import { db } from './db';

export async function getUsers() {
  return db.users.findMany();
}

export async function createUser(data: CreateUserInput) {
  return db.users.create({ data });
}

// Usage in component
import { getUsers } from '~/lib/server';

function UserList() {
  const users = createAsync(() => getUsers());

  return (
    <For each={users()}>
      {(user) => <UserCard user={user} />}
    </For>
  );
}
```

#### Data Loading with cache and createAsync

```typescript
import { cache, createAsync } from '@solidjs/router';

// Define cached data fetcher
const getUser = cache(async (id: string) => {
  'use server';
  return db.users.findUnique({ where: { id } });
}, 'user');

// Preload in route
export const route = {
  preload: ({ params }) => getUser(params.id)
};

// Use in component
function UserPage() {
  const params = useParams();
  const user = createAsync(() => getUser(params.id));

  return (
    <Show when={user()}>
      {(user) => <UserProfile user={user()} />}
    </Show>
  );
}
```

#### Actions for Mutations

```typescript
import { action, useAction, useSubmission } from '@solidjs/router';

// Define action
const updateUser = action(async (formData: FormData) => {
  'use server';
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;

  await db.users.update({ where: { id }, data: { name } });

  // Revalidate cached data
  return redirect(`/users/${id}`);
}, 'updateUser');

// Use with form
function EditUserForm(props: { user: User }) {
  const submission = useSubmission(updateUser);

  return (
    <form action={updateUser} method="post">
      <input type="hidden" name="id" value={props.user.id} />
      <input
        name="name"
        value={props.user.name}
        disabled={submission.pending}
      />
      <button type="submit" disabled={submission.pending}>
        {submission.pending ? 'Saving...' : 'Save'}
      </button>
      <Show when={submission.error}>
        <p class="error">{submission.error.message}</p>
      </Show>
    </form>
  );
}

// Programmatic action usage
function EditUser() {
  const submit = useAction(updateUser);

  const handleClick = async () => {
    const formData = new FormData();
    formData.set('id', '123');
    formData.set('name', 'New Name');
    await submit(formData);
  };

  return <button onClick={handleClick}>Update</button>;
}
```

#### API Routes

```typescript
// src/routes/api/users.ts
import { json } from '@solidjs/router';
import type { APIEvent } from '@solidjs/start/server';

export async function GET(event: APIEvent) {
  const users = await db.users.findMany();
  return json(users);
}

export async function POST(event: APIEvent) {
  const body = await event.request.json();
  const user = await db.users.create({ data: body });
  return json(user, { status: 201 });
}
```

#### Middleware

```typescript
// src/middleware.ts
import { createMiddleware } from '@solidjs/start/middleware';

export default createMiddleware({
  onRequest: [
    // Auth middleware
    async (event) => {
      const session = await getSession(event);
      if (!session && event.request.url.includes('/dashboard')) {
        return redirect('/login');
      }
    },
    // Logging middleware
    (event) => {
      console.log(`${event.request.method} ${event.request.url}`);
    }
  ]
});
```

### Anti-Patterns to Avoid

```typescript
// BAD: Not using cache for data fetching
async function getUser(id: string) {
  'use server';
  return db.users.findUnique({ where: { id } }); // No dedup!
}

// GOOD: Use cache for deduplication
const getUser = cache(async (id: string) => {
  'use server';
  return db.users.findUnique({ where: { id } });
}, 'user');

// BAD: Mixing client and server code
function UserCard(props: { userId: string }) {
  const user = await db.users.findUnique({}); // DB on client!
}

// GOOD: Server function + createAsync
const getUser = cache(async (id: string) => {
  'use server';
  return db.users.findUnique({ where: { id } });
}, 'user');

function UserCard(props: { userId: string }) {
  const user = createAsync(() => getUser(props.userId));
}

// BAD: Not handling action errors
const submit = useAction(myAction);
submit(data); // Fire and forget

// GOOD: Handle errors
const submission = useSubmission(myAction);
// Check submission.error in UI
```

### When to Use

| Pattern | Use When | Don't Use When |
|---------|----------|----------------|
| `cache` | Fetching data (GET-like) | Mutations |
| `action` | Mutations (POST/PUT/DELETE) | Read-only data |
| `createAsync` | Async data in components | Signals work fine |
| API routes | External API consumers | Internal app data |
| Server functions | DB access, secrets | Public/static data |

### Key Differences from React/Next.js

| Next.js | SolidStart | Notes |
|---------|------------|-------|
| `getServerSideProps` | `cache` + route preload | Co-located with component |
| API routes `/api/*` | API routes + server functions | Server functions are simpler |
| Server Actions | `action()` | Similar concept |
| Server Components | No equivalent | Use server functions instead |

---

## 7. Resource Pattern for Data Fetching

### Core Patterns

#### createResource - Basic Usage

```typescript
import { createResource, Suspense } from 'solid-js';

// Simple fetcher
const [user, { refetch, mutate }] = createResource(fetchUser);

// With source signal (re-fetches when source changes)
const [userId, setUserId] = createSignal('1');
const [user, { refetch }] = createResource(userId, async (id) => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});

// Resource properties
user()           // The data (or undefined)
user.loading     // Boolean - is currently fetching
user.error       // Error if fetch failed
user.latest      // Last successful data (even during refetch)
user.state       // 'unresolved' | 'pending' | 'ready' | 'refreshing' | 'errored'
```

#### createResource with Source Signal

```typescript
const [searchQuery, setSearchQuery] = createSignal('');

// Won't fetch if source is falsy (null, undefined, false, '')
const [results] = createResource(
  () => searchQuery() || null, // Return null to skip fetch
  async (query) => {
    const response = await fetch(`/api/search?q=${query}`);
    return response.json();
  }
);

// Usage
<input
  value={searchQuery()}
  onInput={(e) => setSearchQuery(e.target.value)}
/>
<Show when={!results.loading} fallback={<Spinner />}>
  <Results data={results()} />
</Show>
```

#### Optimistic Updates with mutate

```typescript
const [todos, { mutate, refetch }] = createResource(fetchTodos);

async function addTodo(text: string) {
  const optimisticTodo = { id: Date.now(), text, completed: false };

  // Optimistically update UI
  mutate(prev => [...(prev ?? []), optimisticTodo]);

  try {
    await api.createTodo(text);
    // Optionally refetch for server-confirmed data
    refetch();
  } catch (error) {
    // Revert on error
    mutate(prev => prev?.filter(t => t.id !== optimisticTodo.id));
    throw error;
  }
}
```

#### createAsync (Recommended for SolidStart)

```typescript
import { createAsync, cache } from '@solidjs/router';

// Define cached fetcher
const getPost = cache(async (id: string) => {
  'use server';
  return db.posts.findUnique({ where: { id } });
}, 'post');

// Use in component - cleaner API than createResource
function Post(props: { id: string }) {
  const post = createAsync(() => getPost(props.id));

  return (
    <Show when={post()}>
      {(post) => <article>{post().content}</article>}
    </Show>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// BAD: Using createEffect for data fetching
createEffect(async () => {
  const data = await fetch(`/api/user/${userId()}`);
  setUser(await data.json());
});

// GOOD: Use createResource
const [user] = createResource(userId, fetchUser);

// BAD: Not handling loading/error states
function UserProfile() {
  const [user] = createResource(fetchUser);
  return <div>{user().name}</div>; // Crashes if loading!
}

// GOOD: Handle all states
function UserProfile() {
  const [user] = createResource(fetchUser);
  return (
    <Switch>
      <Match when={user.loading}><Spinner /></Match>
      <Match when={user.error}><Error error={user.error} /></Match>
      <Match when={user()}>{(u) => <div>{u().name}</div>}</Match>
    </Switch>
  );
}

// BAD: Fetching in createMemo
const userData = createMemo(async () => {
  return await fetchUser(); // This doesn't work as expected!
});

// GOOD: Use createResource
const [userData] = createResource(fetchUser);
```

### When to Use

| Pattern | Use When | Don't Use When |
|---------|----------|----------------|
| `createResource` | Client-side data fetching | SSR with SolidStart |
| `createAsync` | SolidStart apps | Plain SolidJS without router |
| Source signal | Fetch depends on reactive value | Static fetch |
| `mutate` | Optimistic updates | Simple refetch is enough |
| `refetch` | Force refresh data | Data auto-refreshes via source |

### Key Differences from React

| React | SolidJS | Notes |
|-------|---------|-------|
| `useEffect` + state | `createResource` | Built-in loading/error states |
| React Query | `createResource` or `createAsync` | Similar features built-in |
| Manual loading state | `resource.loading` | Automatic tracking |
| Dependency array | Source signal | Auto-refetch on source change |

---

## 8. Suspense and Error Boundaries

### Core Patterns

#### Suspense

```typescript
import { Suspense, lazy, createResource } from 'solid-js';

// Basic Suspense boundary
function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AsyncContent />
    </Suspense>
  );
}

// Suspense with lazy-loaded component
const LazyDashboard = lazy(() => import('./Dashboard'));

function App() {
  return (
    <Suspense fallback={<Skeleton />}>
      <LazyDashboard />
    </Suspense>
  );
}

// Nested Suspense (each controls its own loading)
function UserPage() {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <Header />
      <Suspense fallback={<ContentSkeleton />}>
        <Content />
      </Suspense>
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
    </Suspense>
  );
}
```

#### ErrorBoundary

```typescript
import { ErrorBoundary } from 'solid-js';

// Basic error boundary
function App() {
  return (
    <ErrorBoundary fallback={(err) => <div>Error: {err.message}</div>}>
      <RiskyComponent />
    </ErrorBoundary>
  );
}

// With reset functionality
function App() {
  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div>
          <p>Error: {err.message}</p>
          <button onClick={reset}>Try again</button>
        </div>
      )}
    >
      <RiskyComponent />
    </ErrorBoundary>
  );
}
```

#### Combined Pattern

```typescript
// Standard pattern: ErrorBoundary wraps Suspense
function DataSection() {
  return (
    <ErrorBoundary fallback={(err) => <ErrorMessage error={err} />}>
      <Suspense fallback={<LoadingSpinner />}>
        <AsyncDataComponent />
      </Suspense>
    </ErrorBoundary>
  );
}

// Full page with multiple boundaries
function Page() {
  return (
    <ErrorBoundary fallback={<PageError />}>
      <Suspense fallback={<PageSkeleton />}>
        <Header />
        <main>
          <ErrorBoundary fallback={<SectionError />}>
            <Suspense fallback={<ContentSkeleton />}>
              <MainContent />
            </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
      </Suspense>
    </ErrorBoundary>
  );
}
```

#### SolidStart SSR Streaming

```typescript
// routes/posts/[id].tsx
import { Suspense } from 'solid-js';
import { createAsync, cache } from '@solidjs/router';

const getPost = cache(async (id: string) => {
  'use server';
  // This fetches on server and streams to client
  return db.posts.findUnique({ where: { id } });
}, 'post');

export default function PostPage() {
  const params = useParams();
  const post = createAsync(() => getPost(params.id));

  return (
    <article>
      <Suspense fallback={<PostSkeleton />}>
        <Show when={post()}>
          {(p) => (
            <>
              <h1>{p().title}</h1>
              <div>{p().content}</div>
            </>
          )}
        </Show>
      </Suspense>
    </article>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// BAD: ErrorBoundary inside Suspense (won't catch resource errors)
<Suspense fallback={<Loading />}>
  <ErrorBoundary fallback={<Error />}>
    <AsyncComponent />
  </ErrorBoundary>
</Suspense>

// GOOD: ErrorBoundary wraps Suspense
<ErrorBoundary fallback={<Error />}>
  <Suspense fallback={<Loading />}>
    <AsyncComponent />
  </Suspense>
</ErrorBoundary>

// BAD: Not using Suspense with createResource
function Component() {
  const [data] = createResource(fetchData);
  return <div>{data()?.name}</div>; // Flickers!
}

// GOOD: Wrap in Suspense
function Component() {
  const [data] = createResource(fetchData);
  return (
    <Suspense fallback={<Loading />}>
      <div>{data()?.name}</div>
    </Suspense>
  );
}

// BAD: Single Suspense for entire app
<Suspense fallback={<FullPageLoader />}>
  <EntireApp /> {/* Blocks everything */}
</Suspense>

// GOOD: Granular Suspense boundaries
<Header />
<Suspense fallback={<ContentLoader />}>
  <Content />
</Suspense>
<Footer />
```

### When to Use

| Pattern | Use When | Don't Use When |
|---------|----------|----------------|
| Suspense | Async data, lazy components | Synchronous rendering |
| ErrorBoundary | Catch render-time errors | Event handlers (use try/catch) |
| Nested Suspense | Independent loading states | Single coordinated load |
| Streaming SSR | Large pages with async data | Static pages |

### Key Differences from React

| React | SolidJS | Notes |
|-------|---------|-------|
| Concurrent Suspense | First-class Suspense | Same concept, different implementation |
| Class ErrorBoundary | Component `<ErrorBoundary>` | No class needed |
| `fallback` prop | Same API | Identical usage |
| Server Components | Server functions + Streaming | Different approach to SSR |

---

## 9. Testing Patterns

### Core Patterns

#### Setup (Vitest + Testing Library)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    deps: {
      optimizer: {
        web: {
          include: ['solid-js']
        }
      }
    }
  }
});

// src/test/setup.ts
import '@testing-library/jest-dom';
```

#### Component Testing

```typescript
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';
import { Counter } from './counter';

describe('Counter', () => {
  it('renders initial count', () => {
    // NOTE: Must pass function returning component, not component itself
    render(() => <Counter initialCount={5} />);

    expect(screen.getByText('Count: 5')).toBeInTheDocument();
  });

  it('increments on click', async () => {
    render(() => <Counter initialCount={0} />);

    const button = screen.getByRole('button', { name: /increment/i });
    await fireEvent.click(button);

    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });
});
```

#### Testing with Signals

```typescript
import { render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

it('updates when external signal changes', async () => {
  // Create signal outside component for test control
  const [count, setCount] = createSignal(0);

  render(() => <Display count={count()} />);

  expect(screen.getByText('0')).toBeInTheDocument();

  // Update signal - component updates automatically
  setCount(10);

  // Use waitFor or check immediately (Solid is synchronous)
  expect(screen.getByText('10')).toBeInTheDocument();
});
```

#### Testing Hooks with renderHook

```typescript
import { renderHook } from '@solidjs/testing-library';
import { useCounter } from './use-counter';

describe('useCounter', () => {
  it('increments counter', () => {
    const { result } = renderHook(() => useCounter(0));

    expect(result.count()).toBe(0);

    result.increment();

    expect(result.count()).toBe(1);
  });
});
```

#### Testing Async with testEffect

```typescript
import { testEffect } from '@solidjs/testing-library';
import { createResource } from 'solid-js';

it('fetches data', async () => {
  await testEffect(async (done) => {
    const [data] = createResource(() => Promise.resolve('loaded'));

    // Wait for resource to resolve
    createEffect(() => {
      if (data.state === 'ready') {
        expect(data()).toBe('loaded');
        done();
      }
    });
  });
});
```

#### Testing with MSW

```typescript
import { render, screen, waitFor } from '@solidjs/testing-library';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { UserProfile } from './user-profile';

const server = setupServer(
  http.get('/api/user/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Test User' });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('loads and displays user', async () => {
  render(() => <UserProfile userId="123" />);

  // Wait for async content
  await waitFor(() => {
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
});
```

### Anti-Patterns to Avoid

```typescript
// BAD: Passing component directly (not a function)
render(<Counter />);

// GOOD: Pass function returning component
render(() => <Counter />);

// BAD: Expecting re-render function
const { rerender } = render(() => <Counter />);
rerender(); // This doesn't exist in Solid!

// GOOD: Use signals to trigger updates
const [count, setCount] = createSignal(0);
render(() => <Counter count={count()} />);
setCount(5); // Triggers update

// BAD: Testing implementation details
expect(component.state.count).toBe(5);

// GOOD: Test behavior from user perspective
expect(screen.getByText('Count: 5')).toBeInTheDocument();

// BAD: Not waiting for async operations
render(() => <AsyncComponent />);
expect(screen.getByText('Data')).toBeInTheDocument(); // May fail!

// GOOD: Use waitFor
render(() => <AsyncComponent />);
await waitFor(() => {
  expect(screen.getByText('Data')).toBeInTheDocument();
});
```

### When to Use

| Pattern | Use When | Don't Use When |
|---------|----------|----------------|
| `render` | Testing components | Testing hooks in isolation |
| `renderHook` | Testing custom hooks | Hook used in component context |
| `testEffect` | Testing reactive effects | Simple synchronous tests |
| MSW | Testing data fetching | Static components |
| `fireEvent` | Simulating user interaction | Testing static rendering |

### Key Differences from React Testing

| React Testing Library | Solid Testing Library | Notes |
|-----------------------|----------------------|-------|
| `render(<Component />)` | `render(() => <Component />)` | Must be function |
| `rerender()` | Use signals | No re-render concept |
| `act()` wrapper | Usually not needed | Solid is synchronous |
| Same queries | Same queries | `screen.getBy*` etc. |

---

## 10. Performance Considerations

### Core Concepts

#### Fine-Grained Reactivity

```typescript
// Solid tracks at the expression level, not component level
function Counter() {
  const [count, setCount] = createSignal(0);

  console.log('This runs ONCE, not on every update');

  return (
    <div>
      {/* Only this text node updates, not the whole div */}
      <span>{count()}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
}
```

#### Automatic Optimization

```typescript
// Solid optimizes this automatically - no useMemo needed
function ExpensiveList(props) {
  // This calculation runs only when items() changes
  const sorted = createMemo(() =>
    [...props.items].sort((a, b) => a.name.localeCompare(b.name))
  );

  return (
    <For each={sorted()}>
      {(item) => <Item data={item} />}
    </For>
  );
}
```

### Optimization Patterns

#### Lazy Components

```typescript
import { lazy, Suspense } from 'solid-js';

// Code-split heavy components
const HeavyChart = lazy(() => import('./heavy-chart'));

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart />
    </Suspense>
  );
}
```

#### Batch Updates

```typescript
import { batch } from 'solid-js';

// Batch multiple signal updates
function updateUser(user: User) {
  batch(() => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    // All updates applied together
  });
}
```

#### Untrack for Non-Reactive Reads

```typescript
import { untrack, createEffect } from 'solid-js';

createEffect(() => {
  // count is tracked, triggers effect
  const currentCount = count();

  // otherValue is NOT tracked, doesn't trigger effect
  const other = untrack(() => otherValue());

  console.log(currentCount, other);
});
```

#### on() for Explicit Dependencies

```typescript
import { on, createEffect } from 'solid-js';

// Only runs when count changes, not when name changes
createEffect(on(count, (value, prev) => {
  console.log('Count changed from', prev, 'to', value);
  // name() here won't add a dependency
  console.log('Current name:', name());
}));

// Multiple dependencies
createEffect(on([count, name], ([c, n]) => {
  console.log('Either count or name changed:', c, n);
}));
```

#### Transitions for Non-Urgent Updates

```typescript
import { useTransition } from 'solid-js';

function Search() {
  const [query, setQuery] = createSignal('');
  const [results] = createResource(query, search);
  const [pending, start] = useTransition();

  return (
    <div>
      <input
        value={query()}
        onInput={(e) => {
          // Mark as non-urgent - won't block UI
          start(() => setQuery(e.target.value));
        }}
      />
      <div classList={{ 'opacity-50': pending() }}>
        <Results data={results()} />
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// BAD: Creating signals in render (recreates every time)
function List(props) {
  const items = props.items.map(item => {
    const [selected, setSelected] = createSignal(false); // Recreated!
    return { ...item, selected, setSelected };
  });
}

// GOOD: Use stores or memos for derived reactive data
function List(props) {
  const [selected, setSelected] = createStore<Record<string, boolean>>({});
  // ...
}

// BAD: Excessive granularity (over-optimization)
const [firstName, setFirstName] = createSignal('');
const [lastName, setLastName] = createSignal('');
const [email, setEmail] = createSignal('');
// ... 20 more signals

// GOOD: Use store for related data
const [user, setUser] = createStore({
  firstName: '',
  lastName: '',
  email: ''
});

// BAD: Heavy computation without memo
function Component() {
  // Runs every time ANY signal in scope changes
  const sorted = expensiveSort(items());
}

// GOOD: Wrap in createMemo
function Component() {
  const sorted = createMemo(() => expensiveSort(items()));
}

// BAD: Accessing signal value for condition but not using it
<Show when={user() !== null}>
  <StaticContent /> {/* Doesn't need user */}
</Show>

// GOOD: Use Boolean for simpler checks
<Show when={Boolean(user())}>
  <StaticContent />
</Show>
```

### Performance Comparison with React

| Aspect | React | SolidJS |
|--------|-------|---------|
| Update granularity | Component tree | Individual DOM nodes |
| Bundle size | ~40KB (React + ReactDOM) | ~5KB |
| Initial render | VDOM diff | Direct DOM creation |
| Updates | Full component re-render | Surgical DOM updates |
| Memoization | Manual (useMemo, memo) | Automatic (fine-grained) |
| Memory | VDOM overhead | No VDOM |

### When to Optimize

| Situation | Solution |
|-----------|----------|
| Expensive computation | `createMemo` |
| Multiple related updates | `batch()` |
| Large code bundles | `lazy()` |
| Event handlers in loops | Delegate to parent |
| Non-urgent UI updates | `useTransition` |
| Frequent list updates | Use `For` not `Index` |
| Large static lists | Consider virtualization |

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
  ErrorBoundary
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

// Router (SolidStart)
import {
  cache,
  createAsync,
  action,
  useAction,
  useSubmission,
  useParams,
  useNavigate,
  A
} from '@solidjs/router';
```

### Decision Tree: Signal vs Store vs Context

```
Is the data:
├─ Simple primitive (string, number, boolean)?
│   └─ createSignal
├─ Object/Array with nested updates?
│   └─ createStore
├─ Shared across distant components?
│   └─ Context + Store
└─ From server/async source?
    └─ createResource or createAsync
```

---

## Sources

- [Solid Docs - Signals](https://docs.solidjs.com/concepts/signals)
- [Solid Docs - Fine-grained Reactivity](https://docs.solidjs.com/advanced-concepts/fine-grained-reactivity)
- [Solid Docs - Memos](https://docs.solidjs.com/concepts/derived-values/memos)
- [Solid Docs - Stores](https://docs.solidjs.com/concepts/stores)
- [Solid Docs - Context](https://docs.solidjs.com/concepts/context)
- [Solid Docs - Control Flow](https://docs.solidjs.com/concepts/control-flow/conditional-rendering)
- [Solid Docs - Refs](https://docs.solidjs.com/concepts/refs)
- [Solid Docs - Testing](https://docs.solidjs.com/guides/testing)
- [SolidStart Docs](https://docs.solidjs.com/solid-start)
- [Solid Testing Library](https://github.com/solidjs/solid-testing-library)
- [SolidJS vs React Comparison](https://blog.logrocket.com/solidjs-vs-react/)
- [Solid Primitives](https://primitives.solidjs.community/)
- [SolidJS Pain Points](https://vladislav-lipatov.medium.com/solidjs-pain-points-and-pitfalls-a693f62fcb4c)
- [SolidJS for React Developers](https://marmelab.com/blog/2025/05/28/solidjs-for-react-developper.html)
