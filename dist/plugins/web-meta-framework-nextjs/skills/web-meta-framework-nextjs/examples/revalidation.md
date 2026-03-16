# Multiple Revalidation

> Cache invalidation strategies for Server Actions. For basic revalidation, see [server-actions.md](server-actions.md) Pattern 1.

---

## Pattern: Revalidating Multiple Paths

### Good Example - Comprehensive cache invalidation

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

**Why good:** Revalidates all paths that might show the updated data. Tags provide broader invalidation without knowing all paths.

---

## Path vs Tag Revalidation

| Use `revalidatePath`     | Use `revalidateTag`               |
| ------------------------ | --------------------------------- |
| Known, specific routes   | Data shown on many unknown routes |
| Few paths affected       | Many paths affected               |
| Simple routing structure | Complex/dynamic routing           |

---

## Setting Up Tags for Revalidation

```typescript
// app/posts/[id]/page.tsx
export default async function PostPage({ params }: { params: { id: string } }) {
  const post = await fetch(`/api/posts/${params.id}`, {
    next: { tags: [`post-${params.id}`, "posts"] },
  });
  // ...
}
```

**Why good:** Tags allow targeted invalidation. Multiple tags for different granularity. Works with `revalidateTag` in Server Actions.
