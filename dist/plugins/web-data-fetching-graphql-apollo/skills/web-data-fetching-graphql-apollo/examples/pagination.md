# Apollo Client — Pagination Examples

> Cursor and offset pagination. See [core.md](core.md) for client setup and queries.

**Prerequisites**: Pattern 2 (queries) from core.

---

## Infinite scroll with fetchMore

```typescript
// components/infinite-post-list.tsx
import { useQuery, gql, NetworkStatus } from "@apollo/client";
import { useCallback, useRef, useEffect } from "react";

const GET_POSTS_CONNECTION = gql`
  query GetPostsConnection($first: Int!, $after: String, $filter: PostFilter) {
    postsConnection(first: $first, after: $after, filter: $filter) {
      edges {
        cursor
        node {
          id
          title
          excerpt
          author {
            id
            name
          }
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
        totalCount
      }
    }
  }
`;

const PAGE_SIZE = 20;
const INTERSECTION_THRESHOLD = 0.5;

interface InfinitePostListProps {
  filter?: { category?: string };
}

function InfinitePostList({ filter }: InfinitePostListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, loading, error, fetchMore, networkStatus } = useQuery(
    GET_POSTS_CONNECTION,
    {
      variables: { first: PAGE_SIZE, filter },
      notifyOnNetworkStatusChange: true,
    }
  );

  // notifyOnNetworkStatusChange above is what makes this transition observable
  const isFetchingMore = networkStatus === NetworkStatus.fetchMore;
  const hasNextPage = data?.postsConnection?.pageInfo?.hasNextPage;
  const endCursor = data?.postsConnection?.pageInfo?.endCursor;

  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingMore) return;

    fetchMore({
      variables: {
        after: endCursor,
      },
    });
  }, [hasNextPage, isFetchingMore, fetchMore, endCursor]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: INTERSECTION_THRESHOLD }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [loadMore]);

  if (loading && !data) {
    return <PostListSkeleton count={PAGE_SIZE} />;
  }

  if (error) {
    return <Error message={error.message} />;
  }

  const posts = data?.postsConnection?.edges?.map((edge) => edge.node) || [];
  const totalCount = data?.postsConnection?.pageInfo?.totalCount || 0;

  return (
    <div className="post-list">
      <p className="count">Showing {posts.length} of {totalCount} posts</p>

      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <article>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
              <footer>
                By {post.author.name} on {new Date(post.createdAt).toLocaleDateString()}
              </footer>
            </article>
          </li>
        ))}
      </ul>

      {/* Sentinel element for infinite scroll */}
      <div ref={loadMoreRef} className="load-more-sentinel">
        {isFetchingMore && <Spinner />}
        {!hasNextPage && posts.length > 0 && (
          <p>No more posts to load</p>
        )}
      </div>
    </div>
  );
}

export { InfinitePostList };
```

The `fetchMore` call passes only `after` — the other variables carry over, so the filter stays put
and the type policy's `keyArgs` keeps this filter's pages separate from another's.

---

## Type policies for merging

```typescript
// lib/apollo-cache.ts
import { InMemoryCache } from "@apollo/client";
import { relayStylePagination } from "@apollo/client/utilities";

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        // Use built-in relay pagination helper
        postsConnection: relayStylePagination(["filter"]),

        // Custom merge for offset pagination
        posts: {
          keyArgs: ["filter", "sortBy"],
          merge(existing = { items: [], total: 0 }, incoming, { args }) {
            const offset = args?.offset || 0;

            // Create new array with merged items
            const merged = existing.items.slice(0);

            for (let i = 0; i < incoming.items.length; i++) {
              merged[offset + i] = incoming.items[i];
            }

            return {
              items: merged,
              total: incoming.total,
            };
          },
          read(existing, { args }) {
            if (!existing) return undefined;

            const offset = args?.offset || 0;
            const limit = args?.limit || existing.items.length;

            // Return slice for current page
            const items = existing.items.slice(offset, offset + limit);

            // Only return if we have all requested items
            if (
              items.length < limit &&
              offset + items.length < existing.total
            ) {
              return undefined; // Trigger network request
            }

            return {
              items,
              total: existing.total,
            };
          },
        },
      },
    },
  },
});

export { cache };
```

`relayStylePagination` covers a Relay-spec connection outright. Offset pagination has no helper: the
`merge` writes incoming items at their offset into a sparse array, and the `read` returns `undefined`
for a page it cannot fully serve, which is the signal that triggers the network request.
