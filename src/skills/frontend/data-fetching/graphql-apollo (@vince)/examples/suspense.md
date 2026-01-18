# Apollo Client GraphQL - Suspense Patterns (v3.9+)

> Suspense-enabled data fetching patterns. See [core.md](core.md) for basic patterns.

**Prerequisites**: Understand Pattern 1 (Client Setup), Pattern 2 (useQuery) from core examples first.

**Version Requirements**: Apollo Client v3.9+ for `useSuspenseQuery`, `useLoadableQuery`, `useBackgroundQuery`

---

## Pattern 1: useSuspenseQuery for Basic Suspense

Use `useSuspenseQuery` when you want the component to suspend while loading data.

```typescript
// components/user-profile-suspense.tsx
import { Suspense } from "react";
import { useSuspenseQuery, gql } from "@apollo/client";
import type { GetUserQuery, GetUserQueryVariables } from "@/generated/graphql";

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      avatar
    }
  }
`;

// This component suspends while loading
function UserProfileContent({ userId }: { userId: string }) {
  // No loading state needed - component suspends instead
  const { data, error } = useSuspenseQuery<GetUserQuery, GetUserQueryVariables>(
    GET_USER,
    { variables: { id: userId } }
  );

  // Error boundary handles errors
  if (error) throw error;

  return (
    <article>
      <img src={data.user.avatar} alt={data.user.name} />
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
    </article>
  );
}

// Parent wraps in Suspense boundary
function UserProfile({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<UserProfileSkeleton />}>
      <UserProfileContent userId={userId} />
    </Suspense>
  );
}

export { UserProfile };
```

**Why good:** Declarative loading states via Suspense boundary, no manual loading state management, integrates with React concurrent features, cleaner component code

---

## Pattern 2: useLoadableQuery for User-Triggered Loading (v3.9+)

Use `useLoadableQuery` when you want to start fetching in response to user interaction (hover, click, etc.).

```typescript
// components/user-preview-link.tsx
import { Suspense, useState } from "react";
import { useLoadableQuery, useReadQuery, gql } from "@apollo/client";
import type { GetUserQuery, GetUserQueryVariables, QueryRef } from "@apollo/client";

const GET_USER_PREVIEW = gql`
  query GetUserPreview($id: ID!) {
    user(id: $id) {
      id
      name
      avatar
      bio
    }
  }
`;

const HOVER_DELAY_MS = 100;

// Reads query data and suspends while loading
function UserPreviewPopover({ queryRef }: { queryRef: QueryRef<GetUserQuery> }) {
  const { data } = useReadQuery(queryRef);

  return (
    <div className="user-preview">
      <img src={data.user.avatar} alt={data.user.name} />
      <h4>{data.user.name}</h4>
      <p>{data.user.bio}</p>
    </div>
  );
}

function UserPreviewLink({ userId, userName }: { userId: string; userName: string }) {
  const [showPreview, setShowPreview] = useState(false);

  // loadQuery triggers the fetch, queryRef is used to read data
  const [loadQuery, queryRef, { reset }] = useLoadableQuery<GetUserQuery, GetUserQueryVariables>(
    GET_USER_PREVIEW
  );

  const handleMouseEnter = () => {
    // Start fetching when user hovers
    loadQuery({ id: userId });

    const timeoutId = setTimeout(() => {
      setShowPreview(true);
    }, HOVER_DELAY_MS);

    return () => clearTimeout(timeoutId);
  };

  const handleMouseLeave = () => {
    setShowPreview(false);
  };

  return (
    <span
      className="user-link"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <a href={`/users/${userId}`}>{userName}</a>

      {showPreview && queryRef && (
        <Suspense fallback={<PreviewSkeleton />}>
          <UserPreviewPopover queryRef={queryRef} />
        </Suspense>
      )}
    </span>
  );
}

export { UserPreviewLink };
```

**Why good:** Data fetching starts on hover (before showing UI), queryRef enables Suspense integration, reset() clears cached data when needed

---

## Pattern 3: useBackgroundQuery + useReadQuery for Parent-Child Loading

Use `useBackgroundQuery` when a parent component should trigger loading while a child reads the data.

```typescript
// components/dashboard.tsx
import { Suspense } from "react";
import { useBackgroundQuery, useReadQuery, gql } from "@apollo/client";
import type { QueryRef } from "@apollo/client";

const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats {
    stats {
      totalUsers
      activeUsers
      revenue
    }
  }
`;

const GET_RECENT_ACTIVITY = gql`
  query GetRecentActivity($limit: Int!) {
    recentActivity(limit: $limit) {
      id
      type
      message
      createdAt
    }
  }
`;

const ACTIVITY_LIMIT = 10;

// Child component reads query data
function StatsCard({ queryRef }: { queryRef: QueryRef<any> }) {
  const { data } = useReadQuery(queryRef);

  return (
    <div className="stats-card">
      <div>Total Users: {data.stats.totalUsers}</div>
      <div>Active: {data.stats.activeUsers}</div>
      <div>Revenue: ${data.stats.revenue}</div>
    </div>
  );
}

function ActivityFeed({ queryRef }: { queryRef: QueryRef<any> }) {
  const { data } = useReadQuery(queryRef);

  return (
    <ul className="activity-feed">
      {data.recentActivity.map((item: any) => (
        <li key={item.id}>
          <span>{item.message}</span>
          <time>{new Date(item.createdAt).toLocaleString()}</time>
        </li>
      ))}
    </ul>
  );
}

// Parent triggers both queries, children read them
function Dashboard() {
  // Both queries start immediately when Dashboard mounts
  const [statsQueryRef] = useBackgroundQuery(GET_DASHBOARD_STATS);
  const [activityQueryRef] = useBackgroundQuery(GET_RECENT_ACTIVITY, {
    variables: { limit: ACTIVITY_LIMIT },
  });

  return (
    <div className="dashboard">
      <Suspense fallback={<StatsSkeleton />}>
        <StatsCard queryRef={statsQueryRef} />
      </Suspense>

      <Suspense fallback={<ActivitySkeleton />}>
        <ActivityFeed queryRef={activityQueryRef} />
      </Suspense>
    </div>
  );
}

export { Dashboard };
```

**Why good:** Parent controls when fetching starts, children suspend independently, parallel loading with independent Suspense boundaries

---

## Pattern 4: createQueryPreloader for Router Integration (v3.9+)

Use `createQueryPreloader` to start fetching before React renders (e.g., in router loaders).

```typescript
// lib/apollo-preloader.ts
import { createQueryPreloader, ApolloClient } from "@apollo/client";
import { apolloClient } from "./apollo-client";

// Create preloader bound to client
const preloadQuery = createQueryPreloader(apolloClient);

export { preloadQuery };
```

```typescript
// routes/user-route.tsx
import { Suspense } from "react";
import { useReadQuery, gql } from "@apollo/client";
import type { QueryRef } from "@apollo/client";
import { preloadQuery } from "@/lib/apollo-preloader";

const GET_USER_PROFILE = gql`
  query GetUserProfile($id: ID!) {
    user(id: $id) {
      id
      name
      email
      avatar
      posts {
        id
        title
      }
    }
  }
`;

// Router loader - runs before component renders
export function loader({ params }: { params: { userId: string } }) {
  // Start fetching immediately
  const userQueryRef = preloadQuery(GET_USER_PROFILE, {
    variables: { id: params.userId },
  });

  return { userQueryRef };
}

// Component reads preloaded data
function UserProfileContent({ queryRef }: { queryRef: QueryRef<any> }) {
  const { data } = useReadQuery(queryRef);

  return (
    <article>
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
      <h2>Posts</h2>
      <ul>
        {data.user.posts.map((post: any) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </article>
  );
}

// React Router usage
function UserRoute() {
  const { userQueryRef } = useLoaderData() as { userQueryRef: QueryRef<any> };

  return (
    <Suspense fallback={<UserProfileSkeleton />}>
      <UserProfileContent queryRef={userQueryRef} />
    </Suspense>
  );
}

export { UserRoute };
```

**Why good:** Data fetching starts during route transition (before React renders), eliminates loading waterfalls, integrates with React Router and TanStack Router

---

## Pattern 5: useQueryRefHandlers for Refetch/FetchMore (v3.9+)

Use `useQueryRefHandlers` to access `refetch` and `fetchMore` for a preloaded query.

```typescript
// components/user-posts.tsx
import { Suspense, useState } from "react";
import { useReadQuery, useQueryRefHandlers, gql } from "@apollo/client";
import type { QueryRef } from "@apollo/client";

const GET_USER_POSTS = gql`
  query GetUserPosts($userId: ID!, $first: Int!, $after: String) {
    user(id: $userId) {
      id
      postsConnection(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            title
            createdAt
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const PAGE_SIZE = 10;

function UserPostsList({ queryRef }: { queryRef: QueryRef<any> }) {
  const { data } = useReadQuery(queryRef);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Access refetch and fetchMore without prop drilling
  const { fetchMore, refetch } = useQueryRefHandlers(queryRef);

  const handleLoadMore = async () => {
    const { endCursor } = data.user.postsConnection.pageInfo;
    setIsLoadingMore(true);

    await fetchMore({
      variables: { after: endCursor },
    });

    setIsLoadingMore(false);
  };

  const posts = data.user.postsConnection.edges.map((edge: any) => edge.node);
  const hasNextPage = data.user.postsConnection.pageInfo.hasNextPage;

  return (
    <div>
      <button onClick={() => refetch()}>Refresh</button>

      <ul>
        {posts.map((post: any) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>

      {hasNextPage && (
        <button onClick={handleLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}

export { UserPostsList };
```

**Why good:** Access refetch/fetchMore without prop drilling from parent, works with preloaded queries from router loaders

---

## Suspense Decision Framework

```
When to use each Suspense pattern?
├─ Data loads on component mount?
│   └─ useSuspenseQuery ✓
├─ Data loads on user interaction (hover, click)?
│   └─ useLoadableQuery ✓
├─ Parent triggers load, child reads data?
│   └─ useBackgroundQuery + useReadQuery ✓
├─ Load data before component renders (router)?
│   └─ createQueryPreloader ✓
└─ Need refetch/fetchMore on preloaded query?
    └─ useQueryRefHandlers ✓
```

---

## Common Gotchas

**Suspense Hooks vs Standard Hooks:**
- `useSuspenseQuery` always suspends - no `loading` state returned
- Standard `useQuery` still works for non-Suspense patterns
- Don't mix Suspense and non-Suspense in same tree without proper boundaries

**Error Handling with Suspense:**
- Errors from Suspense hooks throw to nearest Error Boundary
- Use `errorPolicy: "all"` to receive partial data with errors

**Cache Considerations:**
- Suspense hooks read from same Apollo cache
- `queryRef` is tied to specific variables - changing variables needs new loadQuery call

---

## Sources

- [Apollo Client Suspense Documentation](https://www.apollographql.com/docs/react/data/suspense)
- [useSuspenseQuery Reference](https://www.apollographql.com/docs/react/api/react/hooks/#usesuspensequery)
- [useLoadableQuery Reference](https://www.apollographql.com/docs/react/api/react/hooks/#useloadablequery)
- [useBackgroundQuery Reference](https://www.apollographql.com/docs/react/api/react/hooks/#usebackgroundquery)
- [Apollo Client 3.9 Blog Post](https://www.apollographql.com/blog/whats-new-in-apollo-client-3-9)
