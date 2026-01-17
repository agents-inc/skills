# Jotai Async Patterns

Patterns for async data fetching with Jotai.

---

## Pattern 1: Async Atoms with Suspense

### Good Example - Async Read Atom

```typescript
import { atom } from "jotai";
import type { Atom } from "jotai";

interface User {
  id: number;
  name: string;
  email: string;
}

const userIdAtom = atom(1);

// Async read atom - triggers Suspense
const userAtom = atom(async (get) => {
  const id = get(userIdAtom);
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }
  return response.json() as Promise<User>;
});

// Async atom with AbortController support
const userWithAbortAtom = atom(async (get, { signal }) => {
  const id = get(userIdAtom);
  const response = await fetch(`/api/users/${id}`, { signal });
  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }
  return response.json() as Promise<User>;
});

export { userIdAtom, userAtom, userWithAbortAtom };
```

### Good Example - Suspense Setup

```tsx
import { Provider } from "jotai";
import { Suspense } from "react";

// CRITICAL: At least one Suspense must be inside Provider
function App() {
  return (
    <Provider>
      <Suspense fallback={<div>Loading...</div>}>
        <MainContent />
      </Suspense>
    </Provider>
  );
}

// Multiple Suspense boundaries for granular loading states
function MainContent() {
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <Suspense fallback={<ContentSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}

export { App };
```

**Why good:** Suspense boundary catches async atom loading, granular boundaries allow independent loading states, Provider wraps entire tree

---

## Pattern 2: Loadable Pattern (Non-Suspense)

### Good Example - Manual Loading States

```typescript
import { atom, useAtom } from "jotai";
import { loadable } from "jotai/utils";

const asyncDataAtom = atom(async () => {
  const response = await fetch("/api/data");
  return response.json();
});

// Convert to loadable - doesn't trigger Suspense
const loadableDataAtom = loadable(asyncDataAtom);

// Usage - handles loading/error/data states manually
function DataComponent() {
  const [state] = useAtom(loadableDataAtom);

  if (state.state === "loading") {
    return <div>Loading...</div>;
  }

  if (state.state === "hasError") {
    return <div>Error: {String(state.error)}</div>;
  }

  // state.state === 'hasData'
  return <div>{JSON.stringify(state.data)}</div>;
}

export { loadableDataAtom, DataComponent };
```

**Why good:** Loadable utility converts async atom to sync, returns discriminated union for type-safe state handling, no Suspense boundary needed

### Bad Example - No Suspense Boundary

```tsx
import { Provider } from "jotai";

function App() {
  return (
    <Provider>
      {/* BAD: No Suspense - will crash if asyncAtom is used */}
      <AsyncComponent />
    </Provider>
  );
}
```

**Why bad:** Async atoms trigger Suspense by default, missing boundary causes React error

---

## Pattern 3: atomFamily for Parameterized Atoms

### Good Example - Creating Atoms On-Demand

```typescript
import { atom } from "jotai";
import { atomFamily } from "jotai/utils";
import type { Atom } from "jotai";

interface User {
  id: string;
  name: string;
  email: string;
}

// Create atoms on-demand based on parameters
const userAtomFamily = atomFamily((userId: string) =>
  atom(async () => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json() as Promise<User>;
  })
);

// With custom equality function for complex params
interface ItemParams {
  id: string;
  version: number;
}

const itemAtomFamily = atomFamily(
  (params: ItemParams) => atom({ ...params, count: 0 }),
  (a, b) => a.id === b.id && a.version === b.version
);

export { userAtomFamily, itemAtomFamily };
```

### Usage Example

```tsx
import { useAtom } from "jotai";
import { Suspense } from "react";

interface UserProfileProps {
  userId: string;
}

function UserProfile({ userId }: UserProfileProps) {
  const [user] = useAtom(userAtomFamily(userId));
  return <div>{user.name}</div>;
}

function UserList({ userIds }: { userIds: string[] }) {
  return (
    <div>
      {userIds.map((id) => (
        <Suspense key={id} fallback={<div>Loading user...</div>}>
          <UserProfile userId={id} />
        </Suspense>
      ))}
    </div>
  );
}

export { UserProfile, UserList };
```

**Why good:** Atoms created lazily when needed, same params return same atom instance, custom equality prevents unnecessary atom recreation
