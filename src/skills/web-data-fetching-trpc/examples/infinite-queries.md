# tRPC Infinite Query Pagination

> Cursor-based pagination with infinite scroll. See [core.md](core.md) for setup patterns.

**Prerequisites**: Understand Pattern 3 (React Query Integration) from core examples first.

---

## Server-Side Cursor Pagination

```typescript
// packages/api/src/routers/post.ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const infinitePostsSchema = z.object({
  limit: z.number().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursor: z.string().uuid().optional(),
  filter: z.enum(["all", "published", "draft"]).default("all"),
});

export const postRouter = router({
  infinite: publicProcedure
    .input(infinitePostsSchema)
    .query(async ({ input, ctx }) => {
      const { limit, cursor, filter } = input;

      const where = filter !== "all" ? { status: filter } : {};

      const posts = await ctx.db.post.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where,
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, avatar: true } } },
      });

      let nextCursor: string | undefined;
      if (posts.length > limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem?.id;
      }

      return { posts, nextCursor };
    }),
});

// Named export
export { postRouter };
```

---

## Client-Side Infinite Query

```typescript
// apps/client/components/post-feed.tsx
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTRPC } from "../lib/trpc";
import { useEffect, useRef, useCallback } from "react";

const PAGE_SIZE = 20;

export function PostFeed() {
  const trpc = useTRPC();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // v11: infiniteQueryOptions factory with standard useInfiniteQuery
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    error,
  } = useInfiniteQuery(
    trpc.post.infinite.infiniteQueryOptions(
      { limit: PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [loadMore]);

  if (isPending) return <PostFeedSkeleton />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      {data.pages.map((page) =>
        page.posts.map((post) => <PostCard key={post.id} post={post} />)
      )}

      {/* Sentinel element triggers load when visible */}
      <div ref={sentinelRef}>
        {isFetchingNextPage && <Spinner />}
        {!hasNextPage && <p>No more posts</p>}
      </div>
    </div>
  );
}

// Named export
export { PostFeed };
```

---
