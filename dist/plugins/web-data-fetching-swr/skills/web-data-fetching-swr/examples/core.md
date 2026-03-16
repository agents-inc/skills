# SWR - Core Examples

> Basic usage, fetcher patterns, and return values. See [SKILL.md](../SKILL.md) for core concepts.

**Extended examples:**

- [caching.md](caching.md) - Revalidation strategies, immutable data
- [mutations.md](mutations.md) - mutate, useSWRMutation, optimistic updates
- [pagination.md](pagination.md) - useSWRInfinite, infinite scroll
- [conditional.md](conditional.md) - Dependent queries, enabled patterns
- [error-handling.md](error-handling.md) - Retry, error boundaries
- [suspense.md](suspense.md) - Suspense integration, SSR patterns

---

## Basic useSWR Usage

### Simple Fetch

```typescript
// components/user-profile.tsx
import useSWR from "swr";

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function UserProfile({ userId }: { userId: string }) {
  const { data, error, isLoading } = useSWR<User>(
    `/api/users/${userId}`,
    fetcher
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>User not found</div>;

  return (
    <div>
      <img src={data.avatar} alt={data.name} />
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </div>
  );
}

export { UserProfile };
```

**Why good:** Clean separation of loading/error/data states, typed data with generics, named export

---

## Fetcher Patterns

### Standard Fetch Fetcher

```typescript
// lib/fetcher.ts
interface FetchError extends Error {
  info: unknown;
  status: number;
}

const fetcher = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = new Error("An error occurred") as FetchError;
    error.info = await response.json().catch(() => ({}));
    error.status = response.status;
    throw error;
  }

  return response.json();
};

export { fetcher };
export type { FetchError };
```

### Axios Fetcher

```typescript
// lib/axios-fetcher.ts
import axios from "axios";

const API_BASE_URL = process.env.API_BASE_URL || "";
const API_TIMEOUT_MS = 10000;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
});

// Add request interceptor for auth
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const axiosFetcher = async <T>(url: string): Promise<T> => {
  const response = await apiClient.get<T>(url);
  return response.data;
};

export { axiosFetcher, apiClient };
```

### Fetcher with Multiple Arguments

```typescript
// lib/multi-arg-fetcher.ts
// Array keys allow multiple arguments to fetcher

type FetcherArgs = [url: string, options?: RequestInit];

const fetcherWithOptions = async ([url, options]: FetcherArgs) => {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
  });

  if (!response.ok) throw new Error("Fetch failed");
  return response.json();
};

// Usage
function PostsByUser({ userId, filter }: { userId: string; filter: string }) {
  const { data } = useSWR(
    [`/api/users/${userId}/posts`, { method: "GET" }],
    fetcherWithOptions
  );

  return <PostList posts={data} />;
}

export { fetcherWithOptions };
```

### POST Fetcher (for complex queries)

```typescript
// lib/post-fetcher.ts
interface PostFetcherArgs {
  url: string;
  body: unknown;
}

const postFetcher = async <T>({ url, body }: PostFetcherArgs): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error("Request failed");
  return response.json();
};

// Usage with array key
function SearchResults({ query }: { query: string }) {
  const { data } = useSWR(
    query ? { url: "/api/search", body: { query } } : null,
    postFetcher
  );

  return <Results items={data} />;
}

export { postFetcher };
```

**Why good:** Typed fetchers provide full TypeScript support, error info included for debugging, interceptors enable auth headers, array keys support multiple arguments

---

## Return Values and States

### All Return Values

```typescript
// Understanding all useSWR return values
import useSWR from "swr";

function DataComponent({ endpoint }: { endpoint: string }) {
  const {
    data,         // T | undefined - The fetched data
    error,        // Error | undefined - Error object if failed
    isLoading,    // boolean - Initial load with no data
    isValidating, // boolean - Any request in-flight
    mutate,       // function - Manually revalidate
  } = useSWR(endpoint, fetcher);

  // State combinations:
  // Initial load:     data=undefined, isLoading=true,  isValidating=true
  // Success:          data=T,         isLoading=false, isValidating=false
  // Revalidating:     data=T,         isLoading=false, isValidating=true
  // Error (no data):  error=Error,    isLoading=false, isValidating=false
  // Error (has data): data=T, error=Error, isLoading=false, isValidating=false

  return <div>...</div>;
}

export { DataComponent };
```

### Proper State Handling

```typescript
// components/proper-state-handling.tsx
import useSWR from "swr";

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

  // 1. Initial loading (no data yet)
  if (isLoading) {
    return <PostSkeleton />;
  }

  // 2. Error with no data
  if (error && !data) {
    return (
      <ErrorCard>
        <p>Failed to load post: {error.message}</p>
        <button onClick={() => mutate()}>Retry</button>
      </ErrorCard>
    );
  }

  // 3. Error but has stale data
  if (error && data) {
    return (
      <div>
        <WarningBanner>
          Data may be outdated. Error: {error.message}
          <button onClick={() => mutate()}>Retry</button>
        </WarningBanner>
        <PostContent post={data} />
      </div>
    );
  }

  // 4. No data and no error (shouldn't happen after loading)
  if (!data) {
    return <NotFound message="Post not found" />;
  }

  // 5. Success - show data with optional refresh indicator
  return (
    <article>
      {isValidating && (
        <RefreshIndicator aria-label="Refreshing..." />
      )}
      <h1>{data.title}</h1>
      <p>{data.content}</p>
      <button onClick={() => mutate()}>Refresh</button>
    </article>
  );
}

export { PostView };
```

**Why good:** Handles all possible state combinations, shows stale data with error banner, refresh indicator doesn't block content, manual refresh option available

---

## Global Configuration

### SWRConfig Provider

```typescript
// providers/swr-provider.tsx
"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { fetcher } from "@/lib/fetcher";

const REVALIDATE_FOCUS_INTERVAL_MS = 5000;
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
        // Default fetcher
        fetcher,

        // Revalidation behavior
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        revalidateIfStale: true,
        focusThrottleInterval: REVALIDATE_FOCUS_INTERVAL_MS,

        // Error handling
        shouldRetryOnError: true,
        errorRetryCount: ERROR_RETRY_COUNT,
        errorRetryInterval: ERROR_RETRY_INTERVAL_MS,

        // Request deduplication
        dedupingInterval: DEDUP_INTERVAL_MS,

        // UX improvements
        keepPreviousData: true,

        // SSR fallback data
        fallback,

        // Global error handler
        onError: (error, key) => {
          // Don't report 404s
          if (error.status === 404) return;

          console.error(`SWR Error [${key}]:`, error);
          // Report to error tracking service
          // errorTracker.captureException(error, { extra: { key } });
        },

        // Global success handler
        onSuccess: (data, key) => {
          // Optional: track successful fetches
          // analytics.track('data_fetched', { key });
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

export { SWRProvider };
```

### Nested Config Override

```typescript
// components/static-section.tsx
import { SWRConfig } from "swr";

// Override global config for specific section
function StaticSection({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Disable all revalidation for static content
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        refreshInterval: 0,
      }}
    >
      {children}
    </SWRConfig>
  );
}

export { StaticSection };
```

**Why good:** Centralized configuration reduces duplication, named constants are self-documenting, global error handler enables centralized logging, nested config allows overrides for specific sections

---

## Key Patterns

### String Keys

```typescript
// Simple string key (most common)
const { data } = useSWR("/api/users", fetcher);

// With path parameters
const { data } = useSWR(`/api/users/${userId}`, fetcher);

// With query parameters
const { data } = useSWR(`/api/users?status=${status}&page=${page}`, fetcher);
```

### Array Keys

```typescript
// Array key for multiple arguments
const { data } = useSWR(["/api/users", userId, filter], fetcher);

// The fetcher receives the array as argument
const fetcher = ([url, userId, filter]) => {
  return fetch(`${url}/${userId}?filter=${filter}`).then((r) => r.json());
};
```

### Object Keys (Not Recommended)

```typescript
// BAD: Object creates new reference each render = infinite requests
const { data } = useSWR({ url: "/api/users", page: 1 }, fetcher);

// GOOD: Serialize object to string
const { data } = useSWR(
  `/api/users?${new URLSearchParams({ page: String(page) })}`,
  fetcher,
);
```

### Null Key (Skip Request)

```typescript
// Null key prevents the request
const { data } = useSWR(userId ? `/api/users/${userId}` : null, fetcher);

// Function that returns null
const { data } = useSWR(() => (isReady ? "/api/data" : null), fetcher);
```

**Why good:** String keys are stable and predictable, array keys allow multiple arguments, null key pattern enables conditional fetching without breaking hook rules

---

## Anti-Pattern Examples

```typescript
// BAD: Unstable key (new object each render)
const { data } = useSWR({ endpoint: "/api/users" }, fetcher);

// BAD: Conditional hook call
if (userId) {
  const { data } = useSWR(`/api/users/${userId}`, fetcher);
}

// BAD: Using isValidating as loading state
if (isValidating) return <Spinner />; // Hides cached data!

// BAD: Magic numbers
const { data } = useSWR("/api/data", fetcher, {
  refreshInterval: 30000,
  errorRetryInterval: 5000,
});

// BAD: Fetcher doesn't throw on error
const fetcher = (url) => fetch(url).then(r => r.json()); // Returns error body as data!
```

```typescript
// GOOD: Stable string key
const { data } = useSWR(`/api/users`, fetcher);

// GOOD: Null key for conditional fetching
const { data } = useSWR(userId ? `/api/users/${userId}` : null, fetcher);

// GOOD: isLoading for initial, isValidating for refresh indicator
if (isLoading) return <Spinner />;
return (
  <div>
    {isValidating && <RefreshBadge />}
    <Content data={data} />
  </div>
);

// GOOD: Named constants
const POLL_INTERVAL_MS = 30 * 1000;
const RETRY_INTERVAL_MS = 5 * 1000;
const { data } = useSWR("/api/data", fetcher, {
  refreshInterval: POLL_INTERVAL_MS,
  errorRetryInterval: RETRY_INTERVAL_MS,
});

// GOOD: Fetcher throws on error
const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Fetch failed");
  return response.json();
};
```

**Why bad examples fail:** Unstable keys cause infinite requests, conditional hooks violate React rules, wrong loading state hides content, magic numbers are unmaintainable, non-throwing fetcher returns error body as data
