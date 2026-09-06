# SWR — Core Examples

> Fetchers, keys, state handling and global config. See [SKILL.md](../SKILL.md) for the decisions.

**Extended examples:**

- [caching.md](caching.md) — revalidation strategies, prefetching, persistence
- [mutations.md](mutations.md) — `useSWRMutation`, optimistic updates, `mutate`
- [pagination.md](pagination.md) — `useSWRInfinite`, infinite scroll
- [conditional.md](conditional.md) — null keys, dependent queries
- [error-handling.md](error-handling.md) — retry policy, status-specific handling
- [suspense.md](suspense.md) — suspense mode, hydrating from a server render

---

## The fetcher

This is the canonical one; the other example files import it rather than redefining it.

```typescript
// lib/fetcher.ts
interface FetchError extends Error {
  info: unknown;
  status: number;
}

const fetcher = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const error = new Error("An error occurred") as FetchError;
    // the body may not be JSON on a 502 from a proxy
    error.info = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    error.status = response.status;
    throw error;
  }

  return response.json();
};

export { fetcher };
export type { FetchError };
```

### Through an HTTP client

Any function returning a promise works, so a client with interceptors slots in unchanged — and its
rejection on a non-2xx response is already the throw SWR needs.

```typescript
// lib/client-fetcher.ts
// `createClient`, the interceptor registration and the `.data` unwrapping below are placeholders
// for whatever HTTP client the project already uses — none of them is an SWR API.
const API_TIMEOUT_MS = 10_000;

const apiClient = createClient({
  baseURL: process.env.API_BASE_URL,
  timeout: API_TIMEOUT_MS,
});
apiClient.interceptors.request.use(attachAuthHeader);

const clientFetcher = async <T>(url: string): Promise<T> =>
  (await apiClient.get<T>(url)).data;
```

### With more than one argument

An array key passes each element to the fetcher, which is how anything beyond a URL reaches it.

```typescript
type FetcherArgs = [url: string, options?: RequestInit];

const fetcherWithOptions = async ([url, options]: FetcherArgs) => {
  const response = await fetch(url, { ...options, credentials: "include" });
  if (!response.ok) throw new Error("Fetch failed");
  return response.json();
};

const { data } = useSWR(
  [`/api/users/${userId}/posts`, { method: "GET" }],
  fetcherWithOptions,
);
```

### For a request whose body is the query

```typescript
const postFetcher = async <T>({
  url,
  body,
}: {
  url: string;
  body: unknown;
}): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Request failed");
  return response.json();
};

// The object literal is safe here only because `query` changing is exactly when a refetch is
// wanted — SWR serializes object keys deterministically, so equal contents are one cache entry.
const { data } = useSWR(
  query ? { url: "/api/search", body: { query } } : null,
  postFetcher,
);
```

---

## Handling every state

```typescript
// components/post-view.tsx
import useSWR from "swr";
import { fetcher } from "../lib/fetcher";

interface Post {
  id: string;
  title: string;
  content: string;
}

function PostView({ postId }: { postId: string }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<Post>(
    `/api/posts/${postId}`,
    fetcher
  );

  // 1. First fetch, nothing cached
  if (isLoading) return <PostSkeleton />;

  // 2. Failed with nothing to show
  if (error && !data) {
    return (
      <ErrorCard>
        <p>Failed to load post: {error.message}</p>
        <button onClick={() => mutate()}>Retry</button>
      </ErrorCard>
    );
  }

  // 3. Failed, but a cached value is still worth showing
  if (error && data) {
    return (
      <div>
        <WarningBanner>
          Showing cached data; the last refresh failed: {error.message}
          <button onClick={() => mutate()}>Retry</button>
        </WarningBanner>
        <PostContent post={data} />
      </div>
    );
  }

  if (!data) return <NotFound message="Post not found" />;

  // 4. Settled — isValidating marks a refresh happening behind the content
  return (
    <article>
      {isValidating && <RefreshIndicator aria-label="Refreshing" />}
      <h1>{data.title}</h1>
      <p>{data.content}</p>
      <button onClick={() => mutate()}>Refresh</button>
    </article>
  );
}
```

Branch 3 is the one that gets collapsed into branch 2 by accident, and collapsing it throws away a
working page every time a background refresh fails.

---

## Global configuration

```typescript
// providers/swr-provider.tsx
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { fetcher } from "../lib/fetcher";

const FOCUS_THROTTLE_MS = 5000;
const ERROR_RETRY_COUNT = 3;
const ERROR_RETRY_INTERVAL_MS = 5000;
const DEDUP_INTERVAL_MS = 2000;

interface SWRProviderProps {
  children: ReactNode;
  fallback?: Record<string, unknown>;
}

function SWRProvider({ children, fallback = {} }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher,
        focusThrottleInterval: FOCUS_THROTTLE_MS,
        errorRetryCount: ERROR_RETRY_COUNT,
        errorRetryInterval: ERROR_RETRY_INTERVAL_MS,
        dedupingInterval: DEDUP_INTERVAL_MS,
        keepPreviousData: true,
        fallback, // keys pre-filled from a server render
        onError: (error, key) => {
          if (error.status === 404) return; // an expected outcome, not an incident
          reportError(error, { key });
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
```

`revalidateOnFocus`, `revalidateOnReconnect`, `revalidateIfStale` and `shouldRetryOnError` are all
`true` by default and are omitted here rather than restated.

### Overriding for one section

A nested provider inherits everything above it and replaces only what it names.

```typescript
function StaticSection({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{ revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false }}
    >
      {children}
    </SWRConfig>
  );
}
```

---

## Key shapes

```typescript
// String — the common case. Everything that varies the response varies the key.
useSWR(`/api/users/${userId}`, fetcher);
useSWR(`/api/users?status=${status}&page=${page}`, fetcher);

// Array — passes several arguments to the fetcher; stable as long as the members are primitives
useSWR(["/api/users", userId, filter], fetcher);

// Null — the hook runs, the request does not
useSWR(userId ? `/api/users/${userId}` : null, fetcher);

// Function — returns a key or null, for several conditions at once
useSWR(() => (isReady ? "/api/data" : null), fetcher);
```

A key built inline from a fresh object or array literal is the failure case: the reference changes
every render, so SWR sees a different key each time. Serialize it into the string instead:

```typescript
useSWR(`/api/users?${new URLSearchParams({ page: String(page) })}`, fetcher);
```

Where two components fetch the same resource, give them one key factory — `/api/user/1` and
`/api/users/1` are two cache entries and two requests for the same thing.
