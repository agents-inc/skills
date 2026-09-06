# SWR — Error Handling Examples

> Retry policy, status-specific handling and offline behaviour. The fetcher that makes any of this
> possible is in [core.md](core.md) — it attaches `status`, which everything below branches on.

---

## Retry policy

The default retries anything, which wastes requests on failures that cannot succeed. `onErrorRetry`
replaces the whole retry decision, including its scheduling.

```typescript
// providers/swr-provider.tsx
const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404, 422];
const ERROR_RETRY_COUNT = 3;
const ERROR_RETRY_INTERVAL_MS = 5000;
const MAX_RETRY_INTERVAL_MS = 30_000;
const EXPONENTIAL_BASE = 2;

<SWRConfig
  value={{
    errorRetryCount: ERROR_RETRY_COUNT,
    errorRetryInterval: ERROR_RETRY_INTERVAL_MS,

    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // a 404 is an answer, not a fault — repeating the request cannot change it
      if (NON_RETRYABLE_STATUS_CODES.includes(error.status)) return;
      if (retryCount >= ERROR_RETRY_COUNT) return;

      const delay = Math.min(
        ERROR_RETRY_INTERVAL_MS * EXPONENTIAL_BASE ** retryCount,
        MAX_RETRY_INTERVAL_MS
      );
      setTimeout(() => revalidate({ retryCount }), delay);
    },
  }}
>
  {children}
</SWRConfig>;
```

Because `onErrorRetry` schedules the retry itself, forgetting the `retryCount` guard produces an
unbounded loop — `errorRetryCount` is not consulted once the callback is supplied.

### Per-query overrides

```typescript
const CRITICAL_RETRY_COUNT = 5;

// harder for something the page cannot work without
useSWR("/api/critical-data", fetcher, {
  errorRetryCount: CRITICAL_RETRY_COUNT,
});

// not at all for a one-shot request
useSWR("/api/one-shot", fetcher, { shouldRetryOnError: false });
```

---

## Status-specific handling

`status` from the fetcher is what turns one failure branch into the right screen.

```typescript
// components/user-data.tsx
import useSWR from "swr";
import { fetcher } from "../lib/fetcher";
import type { FetchError } from "../lib/fetcher";

interface User {
  id: string;
  name: string;
}

function UserData({ userId }: { userId: string }) {
  const { data, error, isLoading, mutate } = useSWR<User, FetchError>(
    `/api/users/${userId}`,
    fetcher
  );

  if (isLoading) return <Skeleton />;

  if (error) {
    switch (error.status) {
      case 401:
        return <SessionExpired />;
      case 403:
        return <ErrorCard variant="warning">You do not have access to this user</ErrorCard>;
      case 404:
        return <NotFound href="/users" />;
      case 429:
        return (
          <ErrorCard variant="warning">
            <p>Too many requests. Please wait a moment.</p>
            <button onClick={() => mutate()}>Retry</button>
          </ErrorCard>
        );
      default:
        return (
          <ErrorCard variant="error">
            <p>Failed to load user: {error.message}</p>
            <button onClick={() => mutate()}>Retry</button>
          </ErrorCard>
        );
    }
  }

  if (!data) return <p>No data available</p>;

  return <h1>{data.name}</h1>;
}
```

Only the last two offer a retry, because only they describe something that might succeed on a second
attempt.

### Failing with data already on screen

```typescript
const { data, error, isValidating, mutate } = useSWR(endpoint, fetcher);

// A failed background refresh: the content is still valid, only stale
if (error && data) {
  return (
    <div>
      <WarningBanner>
        <p>Showing cached data. The last refresh failed: {error.message}</p>
        <button onClick={() => mutate()} disabled={isValidating}>
          {isValidating ? "Retrying..." : "Retry"}
        </button>
      </WarningBanner>
      <DataView data={data} />
    </div>
  );
}

// A failure with nothing to fall back on
if (error) return <ErrorBanner message={error.message} onRetry={() => mutate()} />;
```

---

## Handling every failure in one place

```typescript
<SWRConfig
  value={{
    onError: (error, key) => {
      if (error.status === 404) return; // expected, not an incident
      if (error.status === 401) {
        redirectToLogin();
        return;
      }
      reportError(error, { key, status: error.status, info: error.info });
    },
  }}
>
  {children}
</SWRConfig>
```

`onError` fires alongside the component's own `error` value rather than instead of it, so this
handles logging and session expiry while each component still renders its own failure state.

---

## Throwing to an error boundary

Two options make SWR throw instead of returning an error, and the boundary itself is ordinary React —
whatever the project already uses for one.

```typescript
// Throws, without suspending: the component still handles its own loading state
const { data, isLoading } = useSWR("/api/data", fetcher, {
  throwOnError: true,
});

// Throws and suspends: no loading branch at all — see suspense.md
const { data } = useSWR("/api/data", fetcher, { suspense: true });
```

Reach for a boundary where a failure has no meaningful in-place rendering, and keep the `error`
value where the component can say something specific — the status-code switch above cannot be
written in a boundary, which sees only that something threw.

---

## Offline

```typescript
// components/network-aware.tsx
function NetworkAwareData() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const { data, error, mutate } = useSWR("/api/data", fetcher, {
    // a focus event while offline can only produce a failed request
    revalidateOnFocus: isOnline,
    revalidateOnReconnect: true,
  });

  if (!isOnline) {
    return data ? (
      <>
        <OfflineBanner>Showing cached data</OfflineBanner>
        <DataView data={data} />
      </>
    ) : (
      <OfflineBanner>Data will load when the connection is restored</OfflineBanner>
    );
  }

  if (error) return <ErrorBanner message={error.message} onRetry={() => mutate()} />;

  return <DataView data={data} />;
}
```

`revalidateOnReconnect` stays `true` throughout: it is the thing that repairs the page when the
connection returns.
