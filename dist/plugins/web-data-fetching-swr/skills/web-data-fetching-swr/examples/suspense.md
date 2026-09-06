# SWR — Suspense and Hydration Examples

> Suspense mode, and starting from data a server already fetched. See [core.md](core.md) for the
> ordinary state-branching alternative.

---

## Suspense mode

With `suspense: true` the component suspends instead of returning `isLoading`, and `data` is
non-null wherever the component actually renders.

```typescript
// components/user-profile.tsx
import useSWR from "swr";
import { Suspense } from "react";
import { fetcher } from "../lib/fetcher";

interface User {
  id: string;
  name: string;
  email: string;
}

function UserData({ userId }: { userId: string }) {
  const { data } = useSWR<User>(`/api/users/${userId}`, fetcher, { suspense: true });

  // no loading branch, and no `data?.` — reaching this line means the data arrived
  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </div>
  );
}

function UserProfile({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<UserSkeleton />}>
      <UserData userId={userId} />
    </Suspense>
  );
}
```

The boundary is not optional. Without one the thrown promise travels to the nearest error boundary,
or past it.

`suspense` can be set globally in `SWRConfig` and turned off per hook with `suspense: false`, which
is worth doing for anything optional — a suspending hook holds up everything inside its boundary,
including content that had nothing to wait for.

---

## Independent boundaries

Each boundary suspends only what it wraps, so the page fills in section by section rather than
waiting for the slowest request.

```typescript
function Dashboard() {
  return (
    <div className="dashboard">
      <Suspense fallback={<UserInfoSkeleton />}>
        <UserInfo />
      </Suspense>

      <div className="dashboard-panels">
        <Suspense fallback={<NotificationsSkeleton />}>
          <Notifications />
        </Suspense>

        <Suspense fallback={<ActivitySkeleton />}>
          <RecentActivity />
        </Suspense>
      </div>
    </div>
  );
}
```

One boundary around all three would have made the whole dashboard wait for the slowest of them.

---

## Failures in suspense mode

Suspense mode throws on failure, so the pair is a `Suspense` boundary for the wait and an error
boundary above it for the failure.

```typescript
function UserDataWithBoundary({ userId }: { userId: string }) {
  return (
    <ErrorBoundary fallback={<ErrorCard>Failed to load user</ErrorCard>}>
      <Suspense fallback={<UserSkeleton />}>
        <UserData userId={userId} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

`throwOnError: true` gets the same failure routing without suspending — see
[error-handling.md](error-handling.md) for when each is the right trade.

---

## Starting from server-fetched data

Both options seed the cache so the first client render has a value instead of a loading state, and
revalidation proceeds normally afterwards. `SWRProviderProps` below is the one declared in
[core.md](core.md).

```typescript
// One hook: fallbackData is the value for this key
function UserProfile({ initialData, userId }: { initialData: User; userId: string }) {
  const { data } = useSWR<User>(`/api/users/${userId}`, fetcher, { fallbackData: initialData });
  return <h1>{data?.name}</h1>;
}
```

```typescript
// Many hooks: fallback is a map of key to value, passed down from the server render
function SWRProvider({ children, fallback = {} }: SWRProviderProps) {
  return <SWRConfig value={{ fallback }}>{children}</SWRConfig>;
}

// fallback = { "/api/users/1": user, "/api/posts": posts }
```

Neither works with an approximate key. `fallback` is matched exactly, so `/api/users/1` and
`/api/users/1/` are different entries and a trailing slash on one side means the hydration silently
does nothing — the page renders a loading state where the data was already on the wire.
