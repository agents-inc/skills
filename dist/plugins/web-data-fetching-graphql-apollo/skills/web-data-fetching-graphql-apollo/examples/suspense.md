# Apollo Client — Suspense Examples

> Suspense-based loading. See [core.md](core.md) for client setup and the classic hooks.

**Prerequisites**: Pattern 1 (client setup) and Pattern 2 (queries) from core.

**Requires** Apollo Client v3.9+.

---

## useSuspenseQuery — loading on mount

```typescript
// components/user-profile-suspense.tsx
import { Suspense } from "react";
import { gql, type TypedDocumentNode } from "@apollo/client";
import { useSuspenseQuery } from "@apollo/client/react";
import type { GetUserQuery, GetUserQueryVariables } from "../generated/graphql";

const GET_USER: TypedDocumentNode<GetUserQuery, GetUserQueryVariables> = gql`
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
  const { data, error } = useSuspenseQuery(GET_USER, { variables: { id: userId } });

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

The fallback lives in the parent, so the component that needs the data never renders a loading
branch at all.

---

## useLoadableQuery — loading on interaction

Starts the fetch from an event — a hover or a click — rather than from a mount.

```typescript
// components/user-preview-link.tsx
import { Suspense, useState } from "react";
import { gql, type TypedDocumentNode } from "@apollo/client";
import { useLoadableQuery, useReadQuery } from "@apollo/client/react";
import type { QueryRef } from "@apollo/client/react";
import type { GetUserPreviewQuery, GetUserPreviewQueryVariables } from "../generated/graphql";

const GET_USER_PREVIEW: TypedDocumentNode<GetUserPreviewQuery, GetUserPreviewQueryVariables> = gql`
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
function UserPreviewPopover({ queryRef }: { queryRef: QueryRef<GetUserPreviewQuery> }) {
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
  const [loadQuery, queryRef, { reset }] = useLoadableQuery(GET_USER_PREVIEW);

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

The fetch is already in flight by the time the popover renders, so the popover's own suspension is
usually invisible.

---

## useBackgroundQuery — the parent starts, the child reads

```typescript
// components/dashboard.tsx
import { Suspense } from "react";
import { gql } from "@apollo/client";
import { useBackgroundQuery, useReadQuery } from "@apollo/client/react";
import type { QueryRef } from "@apollo/client/react";

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

Both queries leave together and each child suspends behind its own boundary, so the slower one does
not hold up the faster one.

---

## createQueryPreloader — loading before React renders

Runs outside the React tree, which is what makes it usable from a router loader.

```typescript
// lib/apollo-preloader.ts
import { createQueryPreloader } from "@apollo/client/react";
import { apolloClient } from "./apollo-client";

// Create preloader bound to client
const preloadQuery = createQueryPreloader(apolloClient);

export { preloadQuery };
```

```typescript
// routes/user-route.tsx
import { Suspense } from "react";
import { gql } from "@apollo/client";
import { useReadQuery } from "@apollo/client/react";
import type { QueryRef } from "@apollo/client/react";
import { preloadQuery } from "../lib/apollo-preloader";

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

The request leaves during the route transition rather than after the component mounts, which is one
round trip removed from the waterfall.

---

## useQueryRefHandlers — refetch and fetchMore on a preloaded query

```typescript
// components/user-posts.tsx
import { Suspense, useState } from "react";
import { gql } from "@apollo/client";
import { useReadQuery, useQueryRefHandlers } from "@apollo/client/react";
import type { QueryRef } from "@apollo/client/react";

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

The handlers come from the `queryRef` itself, so a component deep in the tree can refetch without the
parent passing anything down.

---

## Mixing with the classic hooks

Both read the same cache, so a Suspense hook and a `useQuery` for the same entity share one entry.
What they do not share is where the loading and the failure surface: a Suspense hook needs a
`Suspense` boundary and an error boundary above it, and a subtree carrying both hook styles needs
both those boundaries and the component's own `loading` branch. `errorPolicy: "all"` still delivers
partial data alongside the thrown error.
