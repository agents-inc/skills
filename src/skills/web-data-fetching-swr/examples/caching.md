# SWR — Caching and Revalidation Examples

> Revalidation strategy, deduplication, prefetching and persistence. See [core.md](core.md) for
> keys and config, and [reference.md](../reference.md) for every option's default.

---

## Revalidation strategies

All of these are per-hook options; the same names in `SWRConfig` set the default for everything
under it.

```typescript
const FOCUS_THROTTLE_MS = 5000;
const POLL_INTERVAL_MS = 10 * 1000;

// On focus — on by default. The throttle stops a user tabbing back and forth
// from producing a request each time.
useSWR("/api/dashboard", fetcher, {
  revalidateOnFocus: true,
  focusThrottleInterval: FOCUS_THROTTLE_MS,
});

// On reconnect — on by default, and the reason an offline page repairs itself
useSWR("/api/data", fetcher, { revalidateOnReconnect: true });

// Polling — off by default. Both guards matter: a hidden tab and an offline
// device both produce requests nobody will see.
useSWR(`/api/stocks/${symbol}`, fetcher, {
  refreshInterval: POLL_INTERVAL_MS,
  refreshWhenHidden: false,
  refreshWhenOffline: false,
});
```

## Static data

```typescript
import useSWRImmutable from "swr/immutable";

// Fetched once per cache lifetime, never revalidated
const { data } = useSWRImmutable(`/api/resources/${resourceId}`, fetcher);

// The same thing written out
useSWR(key, fetcher, {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
});
```

## Manual revalidation only

```typescript
const { data, mutate, isValidating } = useSWR("/api/data", fetcher, {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
});

<button onClick={() => mutate()} disabled={isValidating}>
  {isValidating ? "Refreshing..." : "Refresh"}
</button>;
```

Global and pattern-based revalidation is in [mutations.md](mutations.md).

---

## Keys and cache separation

Every distinct key is a separate cache entry, so putting the filters into the key is what makes
going back to a previous filter instant.

```typescript
// components/filtered-list.tsx
type Status = "all" | "active" | "archived";

function FilteredList() {
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useSWR(`/api/items?status=${status}&page=${page}`, fetcher);

  return (
    <div>
      <StatusSelect value={status} onChange={setStatus} />
      {isLoading ? <Skeleton /> : <ItemList items={data?.items} />}
      <Pagination page={page} total={data?.totalPages} onChange={setPage} />
    </div>
  );
}
```

### keepPreviousData

Because a new key has no cached value, `data` is `undefined` for the moment after a filter changes —
which empties the list and jumps the scroll position. `keepPreviousData` holds the previous key's
value until the new one arrives.

```typescript
const { data, isValidating } = useSWR(`/api/items?filter=${filter}`, fetcher, {
  keepPreviousData: true,
});
```

Leave it off for search. Showing the previous query's results under the new query is worse than
showing nothing, because the results look like an answer.

---

## Deduplication

Deduplication is why data can be fetched where it is used rather than lifted to a common parent and
drilled down.

```typescript
function UserAvatar() {
  const { data } = useSWR("/api/user", fetcher);
  return <img src={data?.avatar} alt={data?.name} />;
}

function UserName() {
  const { data } = useSWR("/api/user", fetcher);
  return <span>{data?.name}</span>;
}

// One fetch, not two
function UserHeader() {
  return (
    <header>
      <UserAvatar />
      <UserName />
    </header>
  );
}
```

`dedupingInterval` (default 2000ms) is the window in which repeat requests for a key collapse into
the in-flight one.

---

## Prefetching

`preload` fills the cache outside a render, so the hook that eventually asks for the key finds it
already there.

```typescript
import { preload } from "swr";
import { fetcher } from "../lib/fetcher";

// On hover, so navigation lands on cached data
<a href={href} onMouseEnter={() => preload(`/api/users/${userId}`, fetcher)}>
  View Profile
</a>;

// Or ahead of a list the user is about to open
useEffect(() => {
  userIds.forEach((id) => preload(`/api/users/${id}`, fetcher));
}, [userIds]);
```

---

## Persisting the cache

A custom `provider` replaces the `Map` SWR keeps its cache in, which is how the cache survives a
reload.

```typescript
// providers/persistent-swr-provider.tsx
import { SWRConfig } from "swr";
import type { Cache, State } from "swr";

const CACHE_KEY = "swr-cache";

function localStorageProvider(): Cache<unknown> {
  const map = new Map<string, State<unknown, unknown>>(
    JSON.parse(localStorage.getItem(CACHE_KEY) || "[]")
  );

  window.addEventListener("beforeunload", () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(map.entries())));
  });

  return {
    get: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value);
    },
    delete: (key) => {
      map.delete(key);
    },
    keys: () => map.keys(),
  };
}

function PersistentSWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ provider: localStorageProvider }}>{children}</SWRConfig>;
}
```

The serialization is the catch: cached `Error` objects come back as `{}`, and anything the fetcher
returned that JSON cannot represent comes back changed. Persist responses, not failures.
