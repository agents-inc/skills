# SvelteKit — Form Actions

> Default and named actions, `fail()`, `use:enhance`, and redirect ordering. The form-action checklist
> is in [reference.md](../reference.md).

---

## Pattern 1: A Complete Action

### Good Example — the five steps in order

```typescript
// src/routes/posts/new/+page.server.ts
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50_000;

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, "/login");
  }

  return { user: locals.user };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    // 1. Auth check
    if (!locals.user) {
      return fail(401, { message: "You must be logged in" });
    }

    // 2. Parse form data
    const formData = await request.formData();
    const title = formData.get("title")?.toString() ?? "";
    const content = formData.get("content")?.toString() ?? "";
    const published = formData.get("published")?.toString() === "true";

    // 3. Validate (use your validation library of choice)
    const errors: Record<string, string[]> = {};

    if (!title) {
      errors.title = ["Title is required"];
    } else if (title.length > MAX_TITLE_LENGTH) {
      errors.title = [`Title must be at most ${MAX_TITLE_LENGTH} characters`];
    }

    if (!content) {
      errors.content = ["Content is required"];
    } else if (content.length > MAX_CONTENT_LENGTH) {
      errors.content = [
        `Content must be at most ${MAX_CONTENT_LENGTH} characters`,
      ];
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { title, content, errors });
    }

    // 4. Mutation (inside try/catch)
    try {
      await db.post.create({
        data: {
          title,
          content,
          published,
          authorId: locals.user.id,
        },
      });
    } catch (err) {
      return fail(500, {
        title,
        content,
        message: "Failed to create post. Please try again.",
      });
    }

    // 5. Redirect (OUTSIDE try/catch — redirect throws)
    redirect(303, "/posts");
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

**Why good:** The order is the point — a failed auth check never reaches the parse, a failed parse
never reaches the database, and the redirect sits outside the `try` so the `catch` cannot swallow it.
`fail` carries `title` and `content` back, which is what refills the form; a thrown `error` would
have unmounted it and lost them.

---

## Pattern 2: Named Actions

### Good Example — several actions on one page

```typescript
// src/routes/settings/+page.server.ts
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const user = await db.user.findUnique({
    where: { id: locals.user.id },
  });

  return { user };
};

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    const data = await request.formData();
    const name = data.get("name")?.toString() ?? "";
    const bio = data.get("bio")?.toString() ?? "";

    if (!name) {
      return fail(400, { name, bio, profileError: "Name is required" });
    }

    await db.user.update({
      where: { id: locals.user.id },
      data: { name, bio },
    });

    return { profileSuccess: true };
  },

  updateEmail: async ({ request, locals }) => {
    const data = await request.formData();
    const email = data.get("email")?.toString() ?? "";

    if (!email.includes("@")) {
      return fail(400, { email, emailError: "Invalid email address" });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.id !== locals.user.id) {
      return fail(400, { email, emailError: "Email already in use" });
    }

    await db.user.update({
      where: { id: locals.user.id },
      data: { email },
    });

    return { emailSuccess: true };
  },

  deleteAccount: async ({ locals, cookies }) => {
    await db.user.delete({ where: { id: locals.user.id } });
    cookies.delete("session", { path: "/" });

    redirect(303, "/");
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

**Why good:** `action="?/updateProfile"` routes the POST to one named handler, so three forms on one
page need no `intent` field and no dispatch. Keying the messages by action (`profileError`,
`emailError`) is what stops the email form showing the profile form's result. A page with named
actions cannot also have a `default` one.

---

## Pattern 3: Custom use:enhance

### Good Example — a loading state

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

**Why good:** The callback runs before the submission and its return value runs after, which is the
window the pending flag needs. Calling `update()` inside it keeps the default behaviour — setting the
`form` prop and rerunning the loads — that a custom callback otherwise replaces.

### Good Example — confirming before a delete

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

**Why good:** `cancel()` stops the submission before it leaves the browser, so a declined confirmation
costs no request. Note what it does not do: without JavaScript there is no confirmation at all, so
the action itself still has to be safe to call.

---

## Pattern 4: Progressive Enhancement

### Good Example — the same form, with and without JavaScript

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

**Why good:** The markup is a real form, so it submits during the window before hydration finishes as
well as when scripting is off. `use:enhance` is an upgrade rather than a requirement, which is why
removing it degrades rather than breaks.

---

## Pattern 5: A Delete Button

### Good Example — a button that is a form

```typescript
// src/routes/posts/+page.server.ts
import { fail } from "@sveltejs/kit";
import type { Actions } from "./$types";

export const actions: Actions = {
  delete: async ({ request, locals }) => {
    if (!locals.user) {
      return fail(401, { message: "Unauthorized" });
    }

    const data = await request.formData();
    const postId = data.get("id")?.toString();

    if (!postId) {
      return fail(400, { message: "Post ID required" });
    }

    const post = await db.post.findUnique({ where: { id: postId } });

    if (!post) {
      return fail(404, { message: "Post not found" });
    }

    if (post.authorId !== locals.user.id) {
      return fail(403, { message: "Not authorized to delete this post" });
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

**Why good:** The hidden input is client-supplied, which is exactly why the action re-reads the post
and checks ownership rather than trusting it. Three distinct statuses — 401, 404, 403 — let the page
say what went wrong.

---

## Pattern 6: Redirect Placement

### Good Example — the redirect outside the try

```typescript
// CORRECT: redirect OUTSIDE try/catch
export const actions: Actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData();

    // Validation and mutation in try/catch
    try {
      const result = await createResource(data, locals.user.id);
    } catch (err) {
      return fail(500, { message: "Failed to create resource" });
    }

    // Redirect OUTSIDE try/catch
    redirect(303, "/resources");
  },
};
```

### Bad Example — the redirect inside it

```typescript
// BAD: redirect() throws — catch block intercepts it
export const actions: Actions = {
  default: async ({ request }) => {
    try {
      await createResource(data);
      redirect(303, "/resources"); // Caught by catch block!
    } catch (err) {
      return fail(500, { message: "Failed" }); // Catches redirect too!
    }
  },
};
```

**Why bad:** `redirect()` signals by throwing, so the `catch` treats a successful save as a failure —
the record is written and the user is told it was not. The failure mode is silent in the worst
direction: the more successful the operation, the more reliably it reports an error.

---

_Request-wide concerns are in [hooks.md](hooks.md); endpoints in
[api-routes.md](api-routes.md)._
