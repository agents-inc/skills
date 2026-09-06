# Cache Revalidation

> Invalidating the cache after a mutation. The single-action shape is in
> [server-actions.md](server-actions.md); the decision tree for path versus tag is in
> [reference.md](../reference.md).

---

## Pattern: Revalidating Multiple Paths

### Good Example — every surface that shows the changed row

```typescript
// app/actions/posts.ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";

export async function updatePost(
  postId: string,
  authorId: string,
  formData: FormData,
) {
  // Update logic...

  // Revalidate multiple related paths
  revalidatePath("/posts"); // Posts list
  revalidatePath(`/posts/${postId}`); // Post detail
  revalidatePath("/dashboard"); // Dashboard if it shows posts
  revalidatePath(`/users/${authorId}/posts`); // Author's posts

  // Or use tags for broader invalidation
  revalidateTag("posts");
  revalidateTag(`post-${postId}`);
}
```

**Why good:** A post appears on more pages than the one it was edited from, and a path missed here is
a page that keeps showing the old title with nothing reporting it. Tags cover the ones you cannot
enumerate.

**On Next.js 16:** `revalidateTag` takes a `cacheLife` profile as a second argument —
`revalidateTag("posts", "max")`.

---

## Setting Up Tags for Revalidation

```typescript
// app/posts/[id]/page.tsx
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  // Absolute — a server-side fetch has no page to resolve a relative URL against
  const response = await fetch(`https://api.example.com/posts/${id}`, {
    next: { tags: [`post-${id}`, "posts"] },
  });
  const post = await response.json();
  // ...
}
```

**Why good:** Two tags on one fetch give two granularities — `post-${id}` for this row, `posts` for
every list that includes it — so an action can invalidate at whichever level it changed.
