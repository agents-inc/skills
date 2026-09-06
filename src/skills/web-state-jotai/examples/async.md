# Jotai Async Patterns

> Async atoms, Suspense, `loadable`, `unwrap` and atom families. See [core.md](core.md) for the synchronous atom shapes.

---

## Pattern 1: Async Atoms with Suspense

### Good Example - Async Read Atom

```typescript
import { atom } from "jotai";

interface User {
  id: number;
  name: string;
  email: string;
}

const userIdAtom = atom(1);

const userAtom = atom(async (get) => {
  const id = get(userIdAtom);
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }
  return response.json() as Promise<User>;
});

// The read function's second argument carries an AbortSignal
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

**Why good:** Writing `userIdAtom` re-runs the read, and the `signal` version aborts the request the new read supersedes — so a fast sequence of id changes leaves one in flight rather than a race.

### Good Example - Suspense Boundaries

```tsx
import { Provider } from "jotai";
import { Suspense } from "react";

function App() {
  return (
    <Provider>
      <Suspense fallback={<div>Loading...</div>}>
        <MainContent />
      </Suspense>
    </Provider>
  );
}

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

**Why good:** One boundary per region means a slow header does not hold the content back. At least one boundary has to sit inside the Provider, since that is where the reads happen.

### Bad Example - No Boundary

```tsx
function App() {
  return (
    <Provider>
      <AsyncComponent />
    </Provider>
  );
}
```

**Why bad:** The first read of an async atom suspends, and with nothing above it to catch the suspension React raises an error instead of showing a fallback.

---

## Pattern 2: Handling the States Yourself

### Good Example - loadable

```typescript
import { atom, useAtomValue } from "jotai";
import { loadable } from "jotai/utils";

const asyncDataAtom = atom(async () => {
  const response = await fetch("/api/data");
  return response.json();
});

const loadableDataAtom = loadable(asyncDataAtom);

function DataComponent() {
  const state = useAtomValue(loadableDataAtom);

  if (state.state === "loading") return <div>Loading...</div>;
  if (state.state === "hasError") return <div>Error: {String(state.error)}</div>;

  return <div>{JSON.stringify(state.data)}</div>;
}

export { loadableDataAtom, DataComponent };
```

**Why good:** `loadable` neither suspends nor throws, so no boundary is needed. The union is discriminated on `state`, so `data` and `error` are unreachable until the branch that has them.

### Good Example - unwrap

```typescript
import { atom } from "jotai";
import { unwrap } from "jotai/utils";

const countAtom = atom(0);

const delayedCountAtom = atom(async (get) => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return get(countAtom);
});

// undefined while pending
const unwrappedAtom = unwrap(delayedCountAtom);

// or keep the last value, starting from 0
const unwrappedWithFallbackAtom = unwrap(delayedCountAtom, (prev) => prev ?? 0);

export { delayedCountAtom, unwrappedAtom, unwrappedWithFallbackAtom };
```

**Why good:** The consumer sees a plain value throughout, which suits a display that can show the previous number while the next one arrives. Errors still throw, unlike `loadable`, so a boundary is still what catches a failure.

`unwrap` also earns its place inside a derived atom: `get()` on an async atom hands back the promise rather than the resolved value, so a derivation that wants to do arithmetic on it reads the unwrapped atom instead.

---

## Pattern 3: Parameterised Atoms

> `atomFamily` from `jotai/utils` is deprecated and slated for removal in Jotai v3. New code uses the [`jotai-family`](https://github.com/jotaijs/jotai-family) package, which carries the same API plus `atomTree`.

> A family caches an atom per parameter and keeps it. With dynamic parameters — ids from a list — call `remove(param)` or set an eviction policy with `setShouldRemove()`, or the cache grows for the life of the page.

### Good Example - Atoms Created On Demand

```typescript
import { atom } from "jotai";
import { atomFamily } from "jotai-family";

interface User {
  id: string;
  name: string;
  email: string;
}

const userAtomFamily = atomFamily((userId: string) =>
  atom(async () => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json() as Promise<User>;
  }),
);

// A second argument compares non-primitive parameters
interface ItemParams {
  id: string;
  version: number;
}

const itemAtomFamily = atomFamily(
  (params: ItemParams) => atom({ ...params, count: 0 }),
  (a, b) => a.id === b.id && a.version === b.version,
);

export { userAtomFamily, itemAtomFamily };
```

**Why good:** The same parameter returns the same atom, so two components asking for user `"7"` share one piece of state. Object parameters compare by reference by default, which would mint a new atom per render — the equality function is what prevents that.

### Usage

```tsx
import { useAtomValue } from "jotai";
import { Suspense } from "react";

function UserProfile({ userId }: { userId: string }) {
  const user = useAtomValue(userAtomFamily(userId));
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

**Why good:** A boundary per row means each profile resolves on its own rather than the list waiting for the slowest.
