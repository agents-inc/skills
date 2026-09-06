# Apollo Client — Error Handling Examples

> Component states and the global error link. See [core.md](core.md) for client setup.

**Prerequisites**: Pattern 1 (client setup) from core.

---

## Rendering partial data

```typescript
// components/user-dashboard.tsx
import { useQuery, gql } from "@apollo/client";

const GET_DASHBOARD = gql`
  query GetDashboard {
    me {
      id
      name
      stats {
        posts
        followers
        following
      }
    }
    recentActivity {
      id
      type
      message
      createdAt
    }
  }
`;

function UserDashboard() {
  const { data, loading, error, refetch } = useQuery(GET_DASHBOARD, {
    // Return partial data even with errors
    errorPolicy: "all",
    // Fetch from network but also return stale cache
    fetchPolicy: "cache-and-network",
  });

  // Handle loading state
  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  // Handle complete failure (no cached data available)
  if (error && !data) {
    return (
      <ErrorState
        title="Unable to load dashboard"
        message={error.message}
        action={
          <button onClick={() => refetch()}>
            Try Again
          </button>
        }
      />
    );
  }

  // Render with partial data + error banner
  return (
    <div className="dashboard">
      {/* Show error banner if there's an error but we have data */}
      {error && (
        <Banner variant="warning">
          Some data may be outdated. {error.message}
          <button onClick={() => refetch()}>Refresh</button>
        </Banner>
      )}

      {/* User stats - may be from cache */}
      {data?.me && (
        <section className="user-stats">
          <h2>Welcome, {data.me.name}</h2>
          <div className="stats">
            <Stat label="Posts" value={data.me.stats.posts} />
            <Stat label="Followers" value={data.me.stats.followers} />
            <Stat label="Following" value={data.me.stats.following} />
          </div>
        </section>
      )}

      {/* Activity feed */}
      {data?.recentActivity && (
        <section className="activity">
          <h2>Recent Activity</h2>
          <ul>
            {data.recentActivity.map((item) => (
              <li key={item.id}>
                <span>{item.message}</span>
                <time>{new Date(item.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export { UserDashboard };
```

Two failure renders, not one: `error && !data` is a dead screen and gets the full error state, while
`error` with data is a banner over content the user can still read. Collapsing them to a single
`if (error)` throws away a working page whenever one field of the query fails.

---

## Global error link

```typescript
// lib/apollo-error-link.ts
import { onError } from "@apollo/client/link/error";

const AUTH_ERROR_CODES = ["UNAUTHENTICATED", "FORBIDDEN"];

const errorLink = onError(
  ({ graphQLErrors, networkError, operation, forward }) => {
    if (graphQLErrors) {
      for (const error of graphQLErrors) {
        const { message, locations, path, extensions } = error;
        const errorCode = extensions?.code as string;

        // Log to monitoring service
        console.error(`[GraphQL Error] ${errorCode}: ${message}`, {
          operationName: operation.operationName,
          path,
          locations,
          variables: operation.variables,
        });

        // Handle authentication errors
        if (AUTH_ERROR_CODES.includes(errorCode)) {
          // Clear auth state
          localStorage.removeItem("auth_token");

          // Redirect to login
          if (typeof window !== "undefined") {
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          }

          return;
        }

        // Handle rate limiting
        if (errorCode === "RATE_LIMITED") {
          const retryAfter = extensions?.retryAfter as number;
          console.warn(`Rate limited. Retry after ${retryAfter}ms`);
          // Could implement automatic retry here
        }
      }
    }

    if (networkError) {
      console.error(`[Network Error] ${networkError.message}`, {
        operationName: operation.operationName,
      });

      // Could show offline indicator
      if (!navigator.onLine) {
        // Dispatch offline event
        window.dispatchEvent(new CustomEvent("app:offline"));
      }
    }
  },
);

export { errorLink };
```

GraphQL errors and network errors arrive on separate arguments and mean different things: the first
is a 200 response carrying an `errors` array, the second is a request that never completed. Handling
only `networkError` misses every authorization failure.
