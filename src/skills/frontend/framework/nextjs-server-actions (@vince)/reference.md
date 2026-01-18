# Next.js Server Actions Reference

> Decision frameworks, anti-patterns, and red flags for Server Actions. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Server Actions

```
Is this a mutation (create, update, delete)?
├─ YES → Is it triggered by user action (form, button)?
│   ├─ YES → Use Server Action ✓
│   └─ NO → Is it a scheduled job or webhook?
│       ├─ YES → Use Route Handler or separate service
│       └─ NO → Consider Server Action or Route Handler
└─ NO → Is it data fetching?
    ├─ YES → Use Server Components or your data fetching solution
    └─ NO → Consider if Server Action is appropriate
```

### Server Action vs Route Handler

```
Do external clients need to call this endpoint?
├─ YES → Use Route Handler (API Route)
└─ NO → Is this a form submission or button action?
    ├─ YES → Use Server Action ✓
    └─ NO → Do you need parallel operations?
        ├─ YES → Use Route Handler (actions queue sequentially)
        └─ NO → Either works, Server Action is simpler
```

### Form Action vs Event Handler

```
Is there a form with inputs?
├─ YES → Does it need to work without JavaScript?
│   ├─ YES → Use form action ✓ (progressive enhancement)
│   └─ NO → Form action still preferred, or event handler if complex logic needed
└─ NO → Is it a simple toggle/click?
    ├─ YES → Use event handler with startTransition
    └─ NO → Consider if form wrapper makes sense
```

### When to Use useOptimistic

```
Does the action have high success rate (>99%)?
├─ YES → Does immediate feedback improve UX significantly?
│   ├─ YES → Use useOptimistic ✓
│   └─ NO → Standard pending state is sufficient
└─ NO → Don't use optimistic updates (rollbacks confuse users)
```

### revalidatePath vs revalidateTag

```
Do you know all specific paths that need updating?
├─ YES → Are there few paths (<5)?
│   ├─ YES → Use revalidatePath for each
│   └─ NO → Use revalidateTag for broader invalidation
└─ NO → Is the data tagged during fetch?
    ├─ YES → Use revalidateTag
    └─ NO → Consider adding tags to fetches, or revalidate route segments
```

---

## RED FLAGS

### High Priority Issues

- Missing `'use server'` directive (action runs on client, exposing secrets)
- No authorization check (anyone can invoke the action)
- No input validation (accepts any data, security risk)
- Missing `revalidatePath`/`revalidateTag` after mutation (stale UI)
- `redirect()` inside try/catch (redirect won't work, throws internally)

### Medium Priority Issues

- Using Server Actions for data fetching (use Server Components instead)
- `useFormStatus` in same component as form (won't work, must be nested)
- Throwing errors for validation failures (clears form state, use return values)
- Missing pending/loading states (poor UX)
- Not using `startTransition` with event handler invocations (blocks UI)

### Common Mistakes

- Assuming Server Actions are private (they're public HTTP endpoints)
- Not handling errors gracefully (crashes propagate to error boundary)
- Magic numbers for limits (use named constants)
- Calling `redirect()` before `revalidatePath()` (destination shows stale data)
- Parallel Server Action calls expecting parallelism (they queue sequentially)

### Gotchas & Edge Cases

- Server Actions queue sequentially when called in parallel from client
- `redirect()` throws a special exception caught by Next.js - don't catch it
- Setting/deleting cookies in actions triggers server re-render
- `useFormStatus` only works in components NESTED within the form
- FormData values are always strings (or File) - parse numbers explicitly
- Server Actions create encrypted IDs recalculated between builds
- Dead code elimination removes unused actions from client bundle
- CSRF protection is built-in via POST-only and Origin header checking
- **Next.js 16 Preview:** `revalidateTag()` will require a `cacheLife` profile as second argument
- **Next.js 16 Preview:** New `updateTag()` API for read-your-writes semantics in Server Actions
- **Next.js 16 Preview:** New `refresh()` API for uncached data (vs revalidatePath for cached)

---

## Anti-Patterns

### Missing Authorization Check

Server Actions are public HTTP endpoints. Even if not imported elsewhere, they can be invoked if the ID is discovered.

```typescript
// WRONG - No authorization
'use server'

export async function deletePost(postId: string) {
  await db.post.delete({ where: { id: postId } }) // Anyone can delete!
}

// CORRECT - Authorization check
'use server'

export async function deletePost(postId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')

  const post = await getPost(postId)
  if (post?.authorId !== user.id) throw new Error('Forbidden')

  await db.post.delete({ where: { id: postId } })
}
```

### Redirect Inside Try/Catch

`redirect()` throws a special exception that Next.js catches. Wrapping it in try/catch prevents the redirect.

```typescript
// WRONG - Redirect won't work
'use server'

export async function createPost(formData: FormData) {
  try {
    await db.post.create({ data })
    revalidatePath('/posts')
    redirect('/posts') // Caught by try/catch!
  } catch (error) {
    return { error: 'Failed' }
  }
}

// CORRECT - Redirect outside try/catch
'use server'

export async function createPost(formData: FormData) {
  try {
    await db.post.create({ data })
  } catch (error) {
    return { error: 'Failed' }
  }

  revalidatePath('/posts')
  redirect('/posts') // Works correctly
}
```

### Forgetting to Revalidate Cache

After mutations, the UI shows stale data unless cache is revalidated.

```typescript
// WRONG - No revalidation
'use server'

export async function updatePost(postId: string, formData: FormData) {
  await db.post.update({ where: { id: postId }, data })
  // UI still shows old data!
}

// CORRECT - Cache revalidated
'use server'

import { revalidatePath } from 'next/cache'

export async function updatePost(postId: string, formData: FormData) {
  await db.post.update({ where: { id: postId }, data })
  revalidatePath('/posts')
  revalidatePath(`/posts/${postId}`)
}
```

### useFormStatus in Wrong Component

`useFormStatus` must be called in a component that is a CHILD of the form, not in the component that renders the form.

```typescript
// WRONG - useFormStatus in form component
'use client'

export function PostForm() {
  const { pending } = useFormStatus() // Always false!

  return (
    <form action={createPost}>
      <button disabled={pending}>Submit</button>
    </form>
  )
}

// CORRECT - useFormStatus in nested component
'use client'

function SubmitButton() {
  const { pending } = useFormStatus() // Works!
  return <button disabled={pending}>Submit</button>
}

export function PostForm() {
  return (
    <form action={createPost}>
      <SubmitButton />
    </form>
  )
}
```

### Throwing Errors for Validation

Throwing errors triggers error boundaries and clears form state. Use return values for validation errors.

```typescript
// WRONG - Throws for validation
'use server'

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  if (!email.includes('@')) {
    throw new Error('Invalid email') // Clears form!
  }
}

// CORRECT - Returns validation errors
'use server'

export async function signup(prevState: State, formData: FormData) {
  const email = formData.get('email') as string
  if (!email.includes('@')) {
    return { errors: { email: ['Invalid email format'] } }
  }
  // ...
}
```

### Using Server Actions for Data Fetching

Server Actions are for mutations, not data fetching. Use Server Components for reads.

```typescript
// WRONG - Fetching in Server Action
'use server'

export async function getPosts() {
  return await db.post.findMany()
}

// In client component
const posts = await getPosts() // Anti-pattern

// CORRECT - Fetch in Server Component
// app/posts/page.tsx
export default async function PostsPage() {
  const posts = await db.post.findMany()
  return <PostList posts={posts} />
}
```

### Expecting Parallel Execution

Server Actions called in parallel from the client still execute sequentially (they queue).

```typescript
// WRONG - Expecting parallel execution
'use client'

export function BatchActions() {
  const handleAll = async () => {
    // These run SEQUENTIALLY, not in parallel
    await updateItem1()
    await updateItem2()
    await updateItem3()
  }
}

// CORRECT - Use Route Handler for true parallelism
// Or combine into single Server Action
'use server'

export async function updateAllItems(ids: string[]) {
  // Run in parallel within single action
  await Promise.all(ids.map(id => updateItem(id)))
}
```

---

## Security Checklist

- [ ] Every Server Action has `'use server'` directive
- [ ] Every Server Action validates input (Zod, etc.)
- [ ] Every Server Action checks authentication
- [ ] Every Server Action checks authorization (user can perform this action)
- [ ] No sensitive data in client-accessible code
- [ ] Error messages don't leak internal details
- [ ] Rate limiting considered for public-facing actions

## Performance Checklist

- [ ] Cache revalidated after mutations (`revalidatePath` or `revalidateTag`)
- [ ] `redirect()` called AFTER `revalidatePath()`
- [ ] Pending states shown during action execution
- [ ] Optimistic updates used where appropriate (high-confidence actions)
- [ ] Related paths revalidated (list and detail pages)

## Quick Reference

### Server Action Signature with useActionState

```typescript
// Action receives prevState as first parameter when used with useActionState
export async function action(
  prevState: StateType,
  formData: FormData
): Promise<StateType> {
  // ...
}
```

### useActionState Hook (React 19)

```typescript
const [state, formAction, isPending] = useActionState(serverAction, initialState)
// state: Current state returned from action
// formAction: Function to pass to form's action attribute
// isPending: Boolean indicating if action is running
```

**React 19 Note:** Replaces deprecated `ReactDOM.useFormState` from React Canary. Now part of core React package.

### useFormStatus Hook (React 19)

```typescript
// Must be in component NESTED within form
const { pending, data, method, action } = useFormStatus()
// pending: Boolean, true while form is submitting
// data: FormData being submitted (React 19+)
// method: HTTP method (always 'POST' for Server Actions, React 19+)
// action: The action function (React 19+)
```

**React 19 Note:** In React 18, only `pending` is available. In React 19, `data`, `method`, and `action` are also returned.

### useOptimistic Hook (React 19)

```typescript
const [optimisticState, addOptimistic] = useOptimistic(
  state,
  (currentState, optimisticValue) => {
    // Return new state with optimistic value merged
    return [...currentState, optimisticValue]
  }
)
```

**React 19 Note:** New hook for optimistic UI updates during async operations.

---

## Next.js 16 Preview: API Changes

**Prepare for upcoming Next.js 16 changes:**

### revalidateTag() Change (v16)

```typescript
// Current (v15) - single argument (will show deprecation warning in v15.5+)
revalidateTag('blog-posts');

// Future (v16) - requires cacheLife profile as second argument
revalidateTag('blog-posts', 'max');
// Or with custom profiles:
revalidateTag('news-feed', 'hours');
revalidateTag('products', { expire: 3600 });
```

### New updateTag() API (v16)

For Server Actions, use `updateTag()` instead of `revalidateTag()` for read-your-writes semantics:

```typescript
'use server';

import { updateTag } from 'next/cache';

export async function updateUserProfile(userId: string, formData: FormData) {
  await db.users.update(userId, formData);

  // updateTag ensures immediate consistency (read-your-writes)
  updateTag(`user-${userId}`);
}
```

### New refresh() API (v16)

For uncached data that should be refetched:

```typescript
'use server';

import { refresh } from 'next/cache';

export async function markNotificationAsRead(notificationId: string) {
  await db.notifications.markAsRead(notificationId);

  // refresh() for uncached data (NOT tagged cache data)
  refresh();
}
```

### Migration Codemod

```bash
# Automated migration when v16 releases
npx @next/codemod@canary upgrade latest
```
