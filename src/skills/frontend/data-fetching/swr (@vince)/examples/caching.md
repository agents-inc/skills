# SWR - Caching & Revalidation Examples

> Revalidation strategies and cache configuration. See [core.md](core.md) for basic patterns.

---

## Revalidation Strategies

### Focus Revalidation (Default)

```typescript
// components/user-dashboard.tsx
import useSWR from "swr";

const FOCUS_THROTTLE_MS = 5000;

function UserDashboard() {
  const { data, isValidating } = useSWR("/api/dashboard", fetcher, {
    // Revalidate when window regains focus (default: true)
    revalidateOnFocus: true,
    // Throttle focus revalidation to prevent rapid re-fetches
    focusThrottleInterval: FOCUS_THROTTLE_MS,
  });

  return (
    <div>
      {isValidating && <RefreshIndicator />}
      <DashboardContent data={data} />
    </div>
  );
}

export { UserDashboard };
```

### Reconnect Revalidation

```typescript
// components/offline-aware-data.tsx
import useSWR from "swr";

function OfflineAwareData() {
  const { data, isValidating } = useSWR("/api/data", fetcher, {
    // Revalidate when network reconnects (default: true)
    revalidateOnReconnect: true,
  });

  return (
    <div>
      {isValidating && <span>Syncing...</span>}
      <DataView data={data} />
    </div>
  );
}

export { OfflineAwareData };
```

### Polling (Interval Revalidation)

```typescript
// components/live-data.tsx
import useSWR from "swr";

const POLL_INTERVAL_MS = 10 * 1000;

function LiveStockPrice({ symbol }: { symbol: string }) {
  const { data } = useSWR(`/api/stocks/${symbol}`, fetcher, {
    // Poll every 10 seconds
    refreshInterval: POLL_INTERVAL_MS,
    // Don't poll when tab is hidden
    refreshWhenHidden: false,
    // Don't poll when offline
    refreshWhenOffline: false,
  });

  return (
    <div className="stock-price">
      <span>{symbol}</span>
      <span>${data?.price?.toFixed(2)}</span>
    </div>
  );
}

export { LiveStockPrice };
```

### Stale Data Revalidation

```typescript
// components/cached-data.tsx
import useSWR from "swr";

function CachedData() {
  const { data } = useSWR("/api/config", fetcher, {
    // Revalidate if data in cache is stale (default: true)
    revalidateIfStale: true,
  });

  return <ConfigView config={data} />;
}

export { CachedData };
```

**Why good:** Different strategies for different freshness requirements, named constants make intervals clear, throttling prevents excessive requests, hidden/offline options save bandwidth

---

## Disable Revalidation (Static Data)

### Immutable Data

```typescript
// components/static-config.tsx
import useSWR from "swr";

function StaticConfig() {
  const { data } = useSWR("/api/app-config", fetcher, {
    // Disable all automatic revalidation
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshInterval: 0,
  });

  return <AppConfig config={data} />;
}

export { StaticConfig };
```

### Using useSWRImmutable

```typescript
// components/immutable-data.tsx
import useSWRImmutable from "swr/immutable";

// Shorthand for disabling all revalidation
function ImmutableData({ resourceId }: { resourceId: string }) {
  const { data } = useSWRImmutable(`/api/resources/${resourceId}`, fetcher);

  // Equivalent to:
  // useSWR(key, fetcher, {
  //   revalidateIfStale: false,
  //   revalidateOnFocus: false,
  //   revalidateOnReconnect: false,
  // })

  return <ResourceView resource={data} />;
}

export { ImmutableData };
```

**Why good:** useSWRImmutable is cleaner for static data, prevents unnecessary network requests, data fetched once and cached indefinitely

---

## Manual Revalidation

### Using Bound Mutate

```typescript
// components/manual-refresh.tsx
import useSWR from "swr";

function ManualRefresh() {
  const { data, mutate, isValidating } = useSWR("/api/data", fetcher, {
    // Disable automatic revalidation
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0,
  });

  // Bound mutate - only revalidates this key
  const handleRefresh = async () => {
    await mutate();
  };

  return (
    <div>
      <DataView data={data} />
      <button onClick={handleRefresh} disabled={isValidating}>
        {isValidating ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  );
}

export { ManualRefresh };
```

### Using Global Mutate

```typescript
// components/global-revalidation.tsx
import useSWR, { useSWRConfig } from "swr";

function GlobalRevalidation() {
  const { mutate } = useSWRConfig();

  // Revalidate specific key
  const refreshUsers = () => mutate("/api/users");

  // Revalidate multiple keys matching pattern
  const refreshAll = () => mutate(
    (key) => typeof key === "string" && key.startsWith("/api/"),
    undefined,
    { revalidate: true }
  );

  // Clear all cache
  const clearCache = () => mutate(
    () => true,
    undefined,
    { revalidate: false }
  );

  return (
    <div>
      <button onClick={refreshUsers}>Refresh Users</button>
      <button onClick={refreshAll}>Refresh All API Data</button>
      <button onClick={clearCache}>Clear Cache</button>
    </div>
  );
}

export { GlobalRevalidation };
```

**Why good:** Bound mutate is simpler for single-key revalidation, global mutate enables batch operations, filter function allows pattern-based revalidation

---

## Cache Key Strategies

### Including Query Parameters

```typescript
// components/filtered-list.tsx
import useSWR from "swr";
import { useState } from "react";

type Status = "all" | "active" | "archived";

function FilteredList() {
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);

  // Each unique key combination is cached separately
  const { data, isLoading } = useSWR(
    `/api/items?status=${status}&page=${page}`,
    fetcher
  );

  return (
    <div>
      <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </select>

      {isLoading ? <Skeleton /> : <ItemList items={data?.items} />}

      <Pagination
        page={page}
        total={data?.totalPages}
        onChange={setPage}
      />
    </div>
  );
}

export { FilteredList };
```

### Keep Previous Data

```typescript
// components/smooth-filter.tsx
import useSWR from "swr";
import { useState } from "react";

function SmoothFilteredList() {
  const [filter, setFilter] = useState("");

  const { data, isValidating } = useSWR(
    `/api/items?filter=${filter}`,
    fetcher,
    {
      // Keep previous data while loading new data
      keepPreviousData: true,
    }
  );

  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter..."
      />
      {isValidating && <LoadingOverlay />}
      {/* Shows previous results while loading new filter */}
      <ItemList items={data?.items} />
    </div>
  );
}

export { SmoothFilteredList };
```

**Why good:** Query params in key create separate cache entries, keepPreviousData prevents content flash during filter changes, smooth UX during data transitions

---

## Deduplication

### Automatic Request Deduplication

```typescript
// Multiple components using same key share one request
// components/user-avatar.tsx
function UserAvatar() {
  const { data } = useSWR("/api/user", fetcher);
  return <img src={data?.avatar} alt={data?.name} />;
}

// components/user-name.tsx
function UserName() {
  const { data } = useSWR("/api/user", fetcher);
  return <span>{data?.name}</span>;
}

// components/user-header.tsx
function UserHeader() {
  // Both components request same key, but only ONE fetch is made
  return (
    <header>
      <UserAvatar />
      <UserName />
    </header>
  );
}

export { UserHeader };
```

### Deduping Interval Configuration

```typescript
// providers/swr-config.tsx
import { SWRConfig } from "swr";

const DEDUP_INTERVAL_MS = 2000;

function SWRProvider({ children }) {
  return (
    <SWRConfig
      value={{
        // Requests within this window are deduplicated
        dedupingInterval: DEDUP_INTERVAL_MS,
      }}
    >
      {children}
    </SWRConfig>
  );
}

export { SWRProvider };
```

**Why good:** Automatic deduplication prevents redundant requests, multiple components can use same data without coordination, configurable interval for different use cases

---

## Prefetching

### Prefetch on Hover

```typescript
// components/prefetch-link.tsx
import Link from "next/link";
import { preload } from "swr";
import { fetcher } from "@/lib/fetcher";

function PrefetchLink({ userId }: { userId: string }) {
  const handleMouseEnter = () => {
    // Prefetch user data on hover
    preload(`/api/users/${userId}`, fetcher);
  };

  return (
    <Link
      href={`/users/${userId}`}
      onMouseEnter={handleMouseEnter}
    >
      View Profile
    </Link>
  );
}

export { PrefetchLink };
```

### Prefetch with preload (SWR 2.0+)

```typescript
// components/prefetch-list.tsx
import { preload } from "swr";
import { useEffect } from "react";
import { fetcher } from "@/lib/fetcher";

function PrefetchList({ userIds }: { userIds: string[] }) {
  useEffect(() => {
    // Prefetch all user data on mount using official preload API
    userIds.forEach((id) => {
      preload(`/api/users/${id}`, fetcher);
    });
  }, [userIds]);

  return <UserList userIds={userIds} />;
}

export { PrefetchList };
```

**Why good:** preload is the official SWR 2.0 prefetch API, hover prefetch makes navigation feel instant, batch prefetch prepares data before it's needed

---

## Cache Persistence (localStorage)

### Custom Cache Provider

```typescript
// providers/persistent-swr-provider.tsx
"use client";

import { SWRConfig } from "swr";
import type { Cache, State } from "swr";

const CACHE_KEY = "swr-cache";

function localStorageProvider(): Cache<unknown> {
  // Initialize from localStorage
  const map = new Map<string, State<unknown, unknown>>(
    JSON.parse(localStorage.getItem(CACHE_KEY) || "[]")
  );

  // Save to localStorage before unload
  window.addEventListener("beforeunload", () => {
    const appCache = JSON.stringify(Array.from(map.entries()));
    localStorage.setItem(CACHE_KEY, appCache);
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
  return (
    <SWRConfig value={{ provider: localStorageProvider }}>
      {children}
    </SWRConfig>
  );
}

export { PersistentSWRProvider };
```

**Why good:** Custom cache provider enables persistence, data survives page refresh, useful for offline-first applications

---

## Anti-Pattern Examples

```typescript
// BAD: Not using keepPreviousData for filters (content flash)
const { data } = useSWR(`/api/items?filter=${filter}`, fetcher);
// Shows undefined while loading new filter

// BAD: Polling when tab is hidden (wastes bandwidth)
const { data } = useSWR("/api/data", fetcher, {
  refreshInterval: 10000,
  refreshWhenHidden: true, // Don't do this!
});

// BAD: Different keys for same data (no cache sharing)
// Component A
const { data } = useSWR(`/api/user/${userId}`, fetcher);
// Component B
const { data } = useSWR(`/api/users/${userId}`, fetcher); // Different key!
```

```typescript
// GOOD: keepPreviousData prevents flash
const { data } = useSWR(`/api/items?filter=${filter}`, fetcher, {
  keepPreviousData: true,
});

// GOOD: Stop polling when hidden
const { data } = useSWR("/api/data", fetcher, {
  refreshInterval: POLL_INTERVAL_MS,
  refreshWhenHidden: false,
});

// GOOD: Consistent keys enable cache sharing
const USERS_KEY = (id: string) => `/api/users/${id}`;
// Both components use same key factory
const { data } = useSWR(USERS_KEY(userId), fetcher);
```

**Why bad examples fail:** Missing keepPreviousData causes content flash, polling when hidden wastes bandwidth, inconsistent keys prevent cache sharing
