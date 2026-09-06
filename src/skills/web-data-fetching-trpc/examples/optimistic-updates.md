# tRPC — Optimistic Update Examples

> The full snapshot-and-rollback cycle. See [core.md](core.md) for client setup.

**Prerequisites**: Pattern 3 (the client and provider) from core.

---

## The whole cycle

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
```

Each callback earns its place. `cancelQueries` stops an in-flight refetch from landing on top of the
optimistic write with pre-mutation data. The snapshot returned from `onMutate` is what `onError`
receives as `context`, which is the only route back to the previous value. `onSettled` invalidates
on both outcomes, so the cache ends up holding the server's version rather than the guess.

## Bad example — no rollback

```typescript
const toggleLike = useMutation({
  ...trpc.post.toggleLike.mutationOptions(),
  onMutate: async ({ postId }) => {
    queryClient.setQueryData(
      trpc.post.getById.queryKey({ id: postId }),
      (old) => ({
        ...old!,
        liked: !old!.liked,
      }),
    );
    // nothing returned, so onError has nothing to restore from — and there is no onError
  },
});
```

A failed request leaves the button showing "Unlike" for a like that never happened, and the UI stays
wrong until something else refetches.
