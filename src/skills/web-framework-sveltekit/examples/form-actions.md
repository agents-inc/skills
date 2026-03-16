# SvelteKit Form Actions Examples

> Complete code examples for SvelteKit form action patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Complete Form Action with Validation

### Good Example — Full CRUD Pattern

```typescript
// src/routes/posts/new/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50_000;

const CreatePostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(MAX_TITLE_LENGTH),
  content: z.string().min(1, 'Content is required').max(MAX_CONTENT_LENGTH),
  published: z.enum(['true', 'false']).transform(v => v === 'true'),
});

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, '/login');
  }

  return { user: locals.user };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    // 1. Auth check
    if (!locals.user) {
      return fail(401, { message: 'You must be logged in' });
    }

    // 2. Parse form data
    const formData = await request.formData();
    const rawData = {
      title: formData.get('title')?.toString() ?? '',
      content: formData.get('content')?.toString() ?? '',
      published: formData.get('published')?.toString() ?? 'false',
    };

    // 3. Validate
    const result = CreatePostSchema.safeParse(rawData);

    if (!result.success) {
      return fail(400, {
        ...rawData,
        errors: result.error.flatten().fieldErrors,
      });
    }

    // 4. Mutation (inside try/catch)
    try {
      await db.post.create({
        data: {
          title: result.data.title,
          content: result.data.content,
          published: result.data.published,
          authorId: locals.user.id,
        },
      });
    } catch (err) {
      return fail(500, {
        ...rawData,
        message: 'Failed to create post. Please try again.',
      });
    }

    // 5. Redirect (OUTSIDE try/catch — redirect throws)
    redirect(303, '/posts');
  },
};
```

```svelte
<!-- src/routes/posts/new/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';

  let { form }: PageProps = $props();
</script>

<h1>New Post</h1>

{#if form?.message}
  <p class="error" role="alert">{form.message}</p>
{/if}

<form method="POST" use:enhance>
  <div>
    <label for="title">Title</label>
    <input
      id="title"
      name="title"
      type="text"
      value={form?.title ?? ''}
      required
      maxlength={200}
      aria-invalid={form?.errors?.title ? 'true' : undefined}
      aria-describedby={form?.errors?.title ? 'title-error' : undefined}
    />
    {#if form?.errors?.title}
      <p id="title-error" class="field-error" role="alert">
        {form.errors.title[0]}
      </p>
    {/if}
  </div>

  <div>
    <label for="content">Content</label>
    <textarea
      id="content"
      name="content"
      required
      rows={10}
      aria-invalid={form?.errors?.content ? 'true' : undefined}
      aria-describedby={form?.errors?.content ? 'content-error' : undefined}
    >{form?.content ?? ''}</textarea>
    {#if form?.errors?.content}
      <p id="content-error" class="field-error" role="alert">
        {form.errors.content[0]}
      </p>
    {/if}
  </div>

  <label>
    <input type="checkbox" name="published" value="true" />
    Publish immediately
  </label>

  <button type="submit">Create Post</button>
</form>
```

**Why good:** Full validation with Zod, `fail()` preserves form input, auth check before mutation, redirect OUTSIDE try/catch, `use:enhance` for progressive enhancement, aria attributes for accessibility, named constants for limits

---

## Pattern 2: Named Actions

### Good Example — Multiple Actions on One Page

```typescript
// src/routes/settings/+page.server.ts
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = await db.user.findUnique({
    where: { id: locals.user.id },
  });

  return { user };
};

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    const data = await request.formData();
    const name = data.get('name')?.toString() ?? '';
    const bio = data.get('bio')?.toString() ?? '';

    if (!name) {
      return fail(400, { name, bio, profileError: 'Name is required' });
    }

    await db.user.update({
      where: { id: locals.user.id },
      data: { name, bio },
    });

    return { profileSuccess: true };
  },

  updateEmail: async ({ request, locals }) => {
    const data = await request.formData();
    const email = data.get('email')?.toString() ?? '';

    if (!email.includes('@')) {
      return fail(400, { email, emailError: 'Invalid email address' });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.id !== locals.user.id) {
      return fail(400, { email, emailError: 'Email already in use' });
    }

    await db.user.update({
      where: { id: locals.user.id },
      data: { email },
    });

    return { emailSuccess: true };
  },

  deleteAccount: async ({ locals, cookies }) => {
    await db.user.delete({ where: { id: locals.user.id } });
    cookies.delete('session', { path: '/' });

    redirect(303, '/');
  },
};
```

```svelte
<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';

  let { data, form }: PageProps = $props();
</script>

<h1>Settings</h1>

<!-- Profile form — targets ?/updateProfile -->
<section>
  <h2>Profile</h2>
  {#if form?.profileSuccess}
    <p class="success">Profile updated!</p>
  {/if}
  {#if form?.profileError}
    <p class="error" role="alert">{form.profileError}</p>
  {/if}

  <form method="POST" action="?/updateProfile" use:enhance>
    <label>
      Name
      <input name="name" value={form?.name ?? data.user.name} required />
    </label>
    <label>
      Bio
      <textarea name="bio">{form?.bio ?? data.user.bio}</textarea>
    </label>
    <button type="submit">Update Profile</button>
  </form>
</section>

<!-- Email form — targets ?/updateEmail -->
<section>
  <h2>Email</h2>
  {#if form?.emailSuccess}
    <p class="success">Email updated!</p>
  {/if}
  {#if form?.emailError}
    <p class="error" role="alert">{form.emailError}</p>
  {/if}

  <form method="POST" action="?/updateEmail" use:enhance>
    <label>
      Email
      <input name="email" type="email" value={form?.email ?? data.user.email} required />
    </label>
    <button type="submit">Update Email</button>
  </form>
</section>

<!-- Delete account — targets ?/deleteAccount -->
<section>
  <h2>Danger Zone</h2>
  <form method="POST" action="?/deleteAccount" use:enhance>
    <button type="submit" class="danger">Delete Account</button>
  </form>
</section>
```

**Why good:** Named actions separate concerns, each form targets its specific action with `action="?/actionName"`, form data preserved on validation error, success messages per action

---

## Pattern 3: Custom use:enhance

### Good Example — Custom Enhancement with Loading State

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';

  let { form }: PageProps = $props();
  let submitting = $state(false);
</script>

<form
  method="POST"
  use:enhance={() => {
    submitting = true;

    return async ({ update }) => {
      await update(); // Apply default behavior (update form prop, invalidate data)
      submitting = false;
    };
  }}
>
  <input name="title" required />

  <button type="submit" disabled={submitting}>
    {submitting ? 'Saving...' : 'Save'}
  </button>
</form>
```

**Why good:** Custom `use:enhance` callback for loading state, `update()` applies default behavior, button disabled during submission

### Good Example — Confirmation Before Delete

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
</script>

<form
  method="POST"
  action="?/delete"
  use:enhance={({ cancel }) => {
    if (!confirm('Are you sure you want to delete this?')) {
      cancel(); // Prevents form submission
      return;
    }

    return async ({ update }) => {
      await update();
    };
  }}
>
  <button type="submit" class="danger">Delete</button>
</form>
```

**Why good:** `cancel()` prevents submission, confirmation dialog before destructive action, clean abort pattern

---

## Pattern 4: Progressive Enhancement

### Good Example — Form Works Without JavaScript

```svelte
<!-- This form works with AND without JavaScript -->
<form method="POST" action="?/subscribe" use:enhance>
  <input
    name="email"
    type="email"
    required
    placeholder="your@email.com"
  />
  <button type="submit">Subscribe</button>
</form>

<!--
  Without JavaScript:
  - Browser POSTs to ?/subscribe
  - Server processes form action
  - Full page reload with form prop

  With JavaScript (use:enhance):
  - AJAX POST to ?/subscribe
  - Server processes form action
  - Page updates without reload
  - form prop updated reactively
-->
```

**Why good:** `method="POST"` works natively in browsers, `use:enhance` adds AJAX on top, input validation with `required` and `type="email"` works without JS

---

## Pattern 5: Delete with Hidden Inputs

### Good Example — Delete Button as Form

```typescript
// src/routes/posts/+page.server.ts
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  delete: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { message: 'Unauthorized' });
    }

    const data = await request.formData();
    const postId = data.get('id')?.toString();

    if (!postId) {
      return fail(400, { message: 'Post ID required' });
    }

    const post = await db.post.findUnique({ where: { id: postId } });

    if (!post) {
      return fail(404, { message: 'Post not found' });
    }

    if (post.authorId !== locals.user.id) {
      return fail(403, { message: 'Not authorized to delete this post' });
    }

    await db.post.delete({ where: { id: postId } });

    return { deleted: true };
  },
};
```

```svelte
<!-- In the posts list page -->
{#each data.posts as post}
  <article>
    <h2>{post.title}</h2>
    <p>{post.excerpt}</p>

    <form method="POST" action="?/delete" use:enhance>
      <input type="hidden" name="id" value={post.id} />
      <button type="submit" class="danger">Delete</button>
    </form>
  </article>
{/each}
```

**Why good:** Hidden input passes post ID, auth + ownership check, works without JavaScript, `use:enhance` prevents page reload

---

## Pattern 6: Redirect After Action

### Good Example — Correct Redirect Pattern

```typescript
// CORRECT: redirect OUTSIDE try/catch
export const actions: Actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData();

    // Validation and mutation in try/catch
    try {
      const result = await createResource(data, locals.user.id);
    } catch (err) {
      return fail(500, { message: 'Failed to create resource' });
    }

    // Redirect OUTSIDE try/catch
    redirect(303, '/resources');
  },
};
```

### Bad Example — Redirect Inside Try/Catch

```typescript
// BAD: redirect() throws — catch block intercepts it
export const actions: Actions = {
  default: async ({ request }) => {
    try {
      await createResource(data);
      redirect(303, '/resources'); // Caught by catch block!
    } catch (err) {
      return fail(500, { message: 'Failed' }); // Catches redirect too!
    }
  },
};
```

**Why bad:** `redirect()` throws a special exception that SvelteKit catches, wrapping it in try/catch prevents the redirect from working, user sees error instead of being redirected

---

_For hooks patterns, see [hooks.md](hooks.md). For API routes, see [api-routes.md](api-routes.md)._
