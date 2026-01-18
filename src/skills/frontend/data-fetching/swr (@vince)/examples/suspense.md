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

  // No need for loading check - Suspense handles it
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
"use client";

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

## SSR with Next.js

### Next.js App Router (Server Components)

```typescript
// app/users/[id]/page.tsx (Server Component)
import { UserProfile } from "@/components/user-profile";

// Server Component - fetch data on server
async function UserPage({ params }: { params: { id: string } }) {
  // Server-side fetch
  const user = await fetch(`${process.env.API_URL}/users/${params.id}`).then(
    (res) => res.json()
  );

  return <UserProfile initialData={user} userId={params.id} />;
}

export default UserPage;
```

```typescript
// components/user-profile.tsx (Client Component)
"use client";

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

### SWRConfig Fallback for SSR

```typescript
// app/layout.tsx
import { SWRProvider } from "@/providers/swr-provider";

async function getInitialData() {
  // Fetch data needed for multiple components
  const [user, config] = await Promise.all([
    fetch(`${process.env.API_URL}/user`).then((r) => r.json()),
    fetch(`${process.env.API_URL}/config`).then((r) => r.json()),
  ]);

  return {
    "/api/user": user,
    "/api/config": config,
  };
}

async function RootLayout({ children }: { children: React.ReactNode }) {
  const fallback = await getInitialData();

  return (
    <html>
      <body>
        <SWRProvider fallback={fallback}>{children}</SWRProvider>
      </body>
    </html>
  );
}

export default RootLayout;
```

```typescript
// providers/swr-provider.tsx
"use client";

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

**Why good:** Server-fetched data hydrates client, fallbackData prevents loading flash, SWRConfig fallback enables multiple key hydration

---

## Next.js Pages Router

### getStaticProps with SWR

```typescript
// pages/posts/[slug].tsx
import useSWR from "swr";
import type { GetStaticProps, GetStaticPaths } from "next";

interface Post {
  slug: string;
  title: string;
  content: string;
}

interface PostPageProps {
  fallback: Record<string, Post>;
  slug: string;
}

function PostPage({ fallback, slug }: PostPageProps) {
  return (
    <SWRConfig value={{ fallback }}>
      <PostContent slug={slug} />
    </SWRConfig>
  );
}

function PostContent({ slug }: { slug: string }) {
  // Data from fallback is used initially, then revalidated
  const { data } = useSWR<Post>(`/api/posts/${slug}`, fetcher);

  return (
    <article>
      <h1>{data?.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: data?.content ?? "" }} />
    </article>
  );
}

export const getStaticProps: GetStaticProps<PostPageProps> = async ({ params }) => {
  const slug = params?.slug as string;
  const post = await fetch(`${process.env.API_URL}/posts/${slug}`).then((r) =>
    r.json()
  );

  return {
    props: {
      fallback: {
        [`/api/posts/${slug}`]: post,
      },
      slug,
    },
    revalidate: 60, // ISR: revalidate every 60 seconds
  };
};

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await fetch(`${process.env.API_URL}/posts`).then((r) => r.json());

  return {
    paths: posts.map((post: Post) => ({ params: { slug: post.slug } })),
    fallback: "blocking",
  };
};

export default PostPage;
```

### getServerSideProps with SWR

```typescript
// pages/dashboard.tsx
import useSWR from "swr";
import type { GetServerSideProps } from "next";

interface DashboardData {
  stats: unknown;
  recentActivity: unknown;
}

interface DashboardPageProps {
  fallback: Record<string, DashboardData>;
}

function DashboardPage({ fallback }: DashboardPageProps) {
  return (
    <SWRConfig value={{ fallback }}>
      <Dashboard />
    </SWRConfig>
  );
}

function Dashboard() {
  const { data } = useSWR<DashboardData>("/api/dashboard", fetcher);

  return (
    <div>
      <Stats data={data?.stats} />
      <Activity items={data?.recentActivity} />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<DashboardPageProps> = async (
  context
) => {
  // Include auth cookie in server-side fetch
  const cookie = context.req.headers.cookie || "";

  const dashboard = await fetch(`${process.env.API_URL}/dashboard`, {
    headers: { cookie },
  }).then((r) => r.json());

  return {
    props: {
      fallback: {
        "/api/dashboard": dashboard,
      },
    },
  };
};

export default DashboardPage;
```

**Why good:** SSR data passed through fallback prop, client revalidates after hydration, ISR combines static generation with freshness

---

## Preloading Data

### Prefetch Before Navigation

```typescript
// components/prefetch-link.tsx
import Link from "next/link";
import { preload } from "swr";
import { fetcher } from "@/lib/fetcher";

interface PrefetchLinkProps {
  href: string;
  dataKey: string;
  children: React.ReactNode;
}

function PrefetchLink({ href, dataKey, children }: PrefetchLinkProps) {
  const handleMouseEnter = () => {
    // Prefetch data when user hovers
    preload(dataKey, fetcher);
  };

  return (
    <Link href={href} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}

// Usage
function UserListItem({ user }: { user: { id: string; name: string } }) {
  return (
    <PrefetchLink href={`/users/${user.id}`} dataKey={`/api/users/${user.id}`}>
      {user.name}
    </PrefetchLink>
  );
}

export { PrefetchLink, UserListItem };
```

### Prefetch on Route Change

```typescript
// hooks/use-prefetch-route.ts
import { useRouter } from "next/router";
import { useEffect } from "react";
import { preload } from "swr";
import { fetcher } from "@/lib/fetcher";

interface RouteDataMap {
  [route: string]: string | ((params: Record<string, string>) => string);
}

const ROUTE_DATA_MAP: RouteDataMap = {
  "/dashboard": "/api/dashboard",
  "/users/[id]": (params) => `/api/users/${params.id}`,
  "/settings": "/api/settings",
};

function usePrefetchRoute() {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // Find matching route pattern
      const matchingRoute = Object.keys(ROUTE_DATA_MAP).find((pattern) => {
        const regex = new RegExp(pattern.replace(/\[(\w+)\]/g, "(\\w+)"));
        return regex.test(url);
      });

      if (matchingRoute) {
        const dataKeyOrFn = ROUTE_DATA_MAP[matchingRoute];
        const dataKey =
          typeof dataKeyOrFn === "function"
            ? dataKeyOrFn(router.query as Record<string, string>)
            : dataKeyOrFn;

        preload(dataKey, fetcher);
      }
    };

    router.events.on("routeChangeStart", handleRouteChange);
    return () => router.events.off("routeChangeStart", handleRouteChange);
  }, [router]);
}

export { usePrefetchRoute };
```

**Why good:** preload is the official SWR 2.0 prefetch API, hover prefetch provides instant navigation feel, route-based prefetch covers common patterns

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
