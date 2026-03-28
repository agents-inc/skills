# SWR - Suspense & SSR Examples

> Suspense integration and server-side rendering patterns. See [core.md](core.md) for basic patterns.

---

## React Suspense Integration

### Basic Suspense Mode

```typescript
// components/suspense-data.tsx
import useSWR from "swr";
import { Suspense } from "react";

interface User {
  id: string;
  name: string;
  email: string;
}

function UserData({ userId }: { userId: string }) {
  // With suspense: true, component suspends until data is ready
  const { data } = useSWR<User>(`/api/users/${userId}`, fetcher, {
    suspense: true,
  });

  // No need for loading check -- Suspense handles it
  // data is guaranteed to be available here
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

export { UserProfile };
```

**Why good:** Suspense handles loading state declaratively, data is guaranteed non-null in component, cleaner component code

---

## Global Suspense Configuration

### Enable Suspense Globally

```typescript
// providers/suspense-swr-provider.tsx
// Mark as client component if using an SSR framework
import { SWRConfig } from "swr";
import type { ReactNode } from "react";

function SuspenseSWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        suspense: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}

export { SuspenseSWRProvider };
```

### Opt-Out Per Query

```typescript
// components/non-suspense-data.tsx
import useSWR from "swr";

// Even with global suspense: true, this query opts out
function NonSuspenseData() {
  const { data, isLoading } = useSWR("/api/optional-data", fetcher, {
    suspense: false, // Override global setting
  });

  if (isLoading) return <Skeleton />;
  return <DataView data={data} />;
}

export { NonSuspenseData };
```

**Why good:** Global config reduces repetition, per-query override for special cases, flexibility without duplication

---

## Error Boundaries with Suspense

### Suspense + Error Boundary Pattern

```typescript
// components/data-boundary.tsx
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import useSWR from "swr";

interface User {
  id: string;
  name: string;
}

function UserDataInner({ userId }: { userId: string }) {
  const { data } = useSWR<User>(`/api/users/${userId}`, fetcher, {
    suspense: true,
  });

  return (
    <div>
      <h1>{data.name}</h1>
    </div>
  );
}

// Alternative: throwOnError option (SWR 2.0+)
// Throws errors to error boundary WITHOUT suspense mode
function UserDataWithThrow({ userId }: { userId: string }) {
  const { data, isLoading } = useSWR<User>(`/api/users/${userId}`, fetcher, {
    throwOnError: true, // Throws to error boundary
  });

  if (isLoading) return <Skeleton />;

  return (
    <div>
      <h1>{data.name}</h1>
    </div>
  );
}

function UserDataWithBoundary({ userId }: { userId: string }) {
  return (
    <ErrorBoundary
      fallback={
        <ErrorCard>
          <p>Failed to load user</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </ErrorCard>
      }
      onError={(error) => {
        console.error("User data error:", error);
      }}
    >
      <Suspense fallback={<UserSkeleton />}>
        <UserDataInner userId={userId} />
      </Suspense>
    </ErrorBoundary>
  );
}

export { UserDataWithBoundary };
```

### Nested Suspense Boundaries

```typescript
// components/dashboard.tsx
import { Suspense } from "react";
import useSWR from "swr";

function UserInfo() {
  const { data } = useSWR("/api/user", fetcher, { suspense: true });
  return <UserCard user={data} />;
}

function Notifications() {
  const { data } = useSWR("/api/notifications", fetcher, { suspense: true });
  return <NotificationList items={data} />;
}

function RecentActivity() {
  const { data } = useSWR("/api/activity", fetcher, { suspense: true });
  return <ActivityFeed items={data} />;
}

function Dashboard() {
  return (
    <div className="dashboard">
      {/* Each section has its own Suspense boundary */}
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

export { Dashboard };
```

**Why good:** Error boundary catches suspense errors, nested boundaries enable progressive loading, each section loads independently

---

## SSR Data Hydration

SWR supports server-side data hydration through `fallbackData` (per-hook) and `SWRConfig fallback` (global). This works with any SSR framework.

### Per-Hook Fallback

```typescript
// components/user-profile.tsx
// Mark as client component if using an SSR framework
import useSWR from "swr";

interface User {
  id: string;
  name: string;
  email: string;
}

interface UserProfileProps {
  initialData: User;
  userId: string;
}

function UserProfile({ initialData, userId }: UserProfileProps) {
  // Use initialData from server, revalidate on client
  const { data } = useSWR<User>(`/api/users/${userId}`, fetcher, {
    fallbackData: initialData,
  });

  return (
    <div>
      <h1>{data?.name}</h1>
      <p>{data?.email}</p>
    </div>
  );
}

export { UserProfile };
```

### Global Fallback via SWRConfig

```typescript
// providers/swr-provider.tsx
// Mark as client component if using an SSR framework
import { SWRConfig } from "swr";
import type { ReactNode } from "react";

interface SWRProviderProps {
  children: ReactNode;
  fallback?: Record<string, unknown>;
}

function SWRProvider({ children, fallback = {} }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fallback,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}

export { SWRProvider };
```

**Why good:** Server-fetched data hydrates client (no loading flash), `fallbackData` is per-hook, `fallback` in SWRConfig enables multi-key hydration, framework-agnostic approach

---

## Preloading Data

> See [caching.md](caching.md) for `preload()` prefetch patterns (hover prefetch, batch prefetch on mount).

---

## Anti-Pattern Examples

```typescript
// BAD: Using suspense without Suspense boundary (crashes app)
function BadSuspense() {
  const { data } = useSWR("/api/data", fetcher, { suspense: true });
  // If no <Suspense> parent, this throws to nearest error boundary or crashes
  return <div>{data.value}</div>;
}

// BAD: SSR without fallback (loading flash on hydration)
function BadSSR({ serverData }) {
  const { data } = useSWR("/api/data", fetcher);
  // Shows loading state on client even though we have serverData
  return <div>{data?.value}</div>;
}

// BAD: Mixing suspense with manual loading check
function BadSuspenseMix() {
  const { data, isLoading } = useSWR("/api/data", fetcher, { suspense: true });
  if (isLoading) return <Spinner />; // This never runs with suspense!
  return <div>{data.value}</div>;
}
```

```typescript
// GOOD: Suspense with Suspense boundary
function GoodSuspense() {
  return (
    <Suspense fallback={<Spinner />}>
      <DataComponent />
    </Suspense>
  );
}

function DataComponent() {
  const { data } = useSWR("/api/data", fetcher, { suspense: true });
  return <div>{data.value}</div>;
}

// GOOD: SSR with fallback/fallbackData
function GoodSSR({ serverData }) {
  const { data } = useSWR("/api/data", fetcher, {
    fallbackData: serverData, // Use server data, revalidate on client
  });
  return <div>{data?.value}</div>;
}

// GOOD: Suspense handles loading state
function GoodSuspenseClean() {
  // With suspense: true, data is guaranteed non-null
  const { data } = useSWR("/api/data", fetcher, { suspense: true });
  return <div>{data.value}</div>; // No loading check needed
}
```

**Why bad examples fail:** Missing Suspense boundary crashes app, no fallback causes loading flash, isLoading never true with suspense mode
