# tRPC Optimistic Updates with Rollback

> Instant UI feedback with automatic rollback on failure. See [core.md](core.md) for setup patterns.

**Prerequisites**: Understand Pattern 3 (React Query Integration) from core examples first.

---

## Complete Optimistic Pattern

```typescript
// apps/client/components/like-button.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../lib/trpc";

interface LikeButtonProps {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
}

export function LikeButton({ postId, initialLiked, initialCount }: LikeButtonProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const toggleLike = useMutation({
    ...trpc.post.toggleLike.mutationOptions(),
    // Optimistic update BEFORE server response
    onMutate: async ({ postId }) => {
      // Cancel in-flight queries to prevent overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: trpc.post.getById.queryKey({ id: postId }),
      });

      // Snapshot current state for rollback
      const previousPost = queryClient.getQueryData(
        trpc.post.getById.queryKey({ id: postId }),
      );

      // Optimistically update the cache
      queryClient.setQueryData(
        trpc.post.getById.queryKey({ id: postId }),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            liked: !old.liked,
            likeCount: old.liked ? old.likeCount - 1 : old.likeCount + 1,
          };
        },
      );

      // Return context for rollback
      return { previousPost };
    },

    // Rollback on error
    onError: (err, { postId }, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(
          trpc.post.getById.queryKey({ id: postId }),
          context.previousPost,
        );
      }
      toast.error("Failed to update like");
    },

    // Always refetch to ensure consistency
    onSettled: (data, error, { postId }) => {
      queryClient.invalidateQueries({
        queryKey: trpc.post.getById.queryKey({ id: postId }),
      });
    },
  });

  const post = useQuery(trpc.post.getById.queryOptions({ id: postId }));
  const liked = post.data?.liked ?? initialLiked;
  const count = post.data?.likeCount ?? initialCount;

  return (
    <button
      onClick={() => toggleLike.mutate({ postId })}
      disabled={toggleLike.isPending}
      aria-pressed={liked}
    >
      {liked ? "Unlike" : "Like"} ({count})
    </button>
  );
}

// Named export
export { LikeButton };
```

---

## Bad Example - No Rollback

```typescript
// BAD: Optimistic update without rollback
const toggleLike = useMutation({
  ...trpc.post.toggleLike.mutationOptions(),
  onMutate: async ({ postId }) => {
    // Updates cache but no snapshot for rollback!
    queryClient.setQueryData(
      trpc.post.getById.queryKey({ id: postId }),
      (old: any) => ({ ...old!, liked: !old!.liked }),
    );
    // Missing: return { previousPost }
  },
  // Missing: onError rollback
});
```

**Why bad:** If server fails, UI shows incorrect state, no way to restore previous data, user sees inconsistent information

---
