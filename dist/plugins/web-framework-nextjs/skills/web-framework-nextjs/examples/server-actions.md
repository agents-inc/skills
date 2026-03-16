# Next.js Server Actions Examples

> Complete code examples for Server Actions patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Advanced patterns:** See other files in this folder for optimistic updates, cookies, non-form handlers, and streaming.

---

## Pattern 1: Server Action Definition

### Good Example - File-level directive with full pattern

```typescript
// app/actions/posts.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 10000;

const CreatePostSchema = z.object({
  title: z.string().min(1, "Title is required").max(MAX_TITLE_LENGTH),
  content: z.string().min(1, "Content is required").max(MAX_CONTENT_LENGTH),
});

export type CreatePostState = {
  success: boolean;
  errors?: {
    title?: string[];
    content?: string[];
    _form?: string[];
  };
};

export async function createPost(
  prevState: CreatePostState,
  formData: FormData,
): Promise<CreatePostState> {
  // 1. Validate input
  const validatedFields = CreatePostSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // 2. Authorization check (defer to your auth solution)
  const user = await getCurrentUser();
  if (!user) {
    return {
      success: false,
      errors: { _form: ["You must be logged in to create a post"] },
    };
  }

  try {
    // 3. Perform mutation (defer to your database solution)
    await db.post.create({
      data: {
        title: validatedFields.data.title,
        content: validatedFields.data.content,
        authorId: user.id,
      },
    });

    // 4. Revalidate cache
    revalidatePath("/posts");
  } catch (error) {
    return {
      success: false,
      errors: { _form: ["Failed to create post. Please try again."] },
    };
  }

  // 5. Redirect (must be outside try/catch as it throws)
  redirect("/posts");
}
```

**Why good:** Complete pattern with validation, auth, mutation, revalidation, and redirect. Named constants for limits. Type-safe state with proper error structure. Auth check before mutation. Redirect outside try/catch.

### Bad Example - Missing critical patterns

```typescript
// app/actions.ts
"use server";

export async function createPost(formData: FormData) {
  const title = formData.get("title");
  const content = formData.get("content");

  // No validation
  // No auth check
  await db.post.create({ data: { title, content } });

  // No revalidation - UI shows stale data
}
```

**Why bad:** No input validation allows malformed data. No auth check means anyone can create posts. No revalidation causes stale UI. No error handling crashes on failure.

---

## Pattern 2: Progressive Enhancement Form

### Good Example - Basic form with Server Action

```typescript
// app/posts/new/page.tsx
import { createPost } from '@/app/actions/posts'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <div>
        <label htmlFor="title">Title</label>
        <input
          type="text"
          id="title"
          name="title"
          required
          maxLength={200}
        />
      </div>

      <div>
        <label htmlFor="content">Content</label>
        <textarea
          id="content"
          name="content"
          required
          rows={10}
        />
      </div>

      <button type="submit">Create Post</button>
    </form>
  )
}
```

**Why good:** Works without JavaScript (progressive enhancement). Native validation with `required` and `maxLength`. Semantic form structure with labels.

### Good Example - Form with useActionState for validation errors

```typescript
// components/post-form.tsx
'use client'

import { useActionState } from 'react'
import { createPost, type CreatePostState } from '@/app/actions/posts'

const initialState: CreatePostState = { success: false }

export function PostForm() {
  const [state, formAction, isPending] = useActionState(createPost, initialState)

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="title">Title</label>
        <input
          type="text"
          id="title"
          name="title"
          required
          aria-describedby={state.errors?.title ? 'title-error' : undefined}
        />
        {state.errors?.title && (
          <p id="title-error" role="alert">
            {state.errors.title[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="content">Content</label>
        <textarea
          id="content"
          name="content"
          required
          aria-describedby={state.errors?.content ? 'content-error' : undefined}
        />
        {state.errors?.content && (
          <p id="content-error" role="alert">
            {state.errors.content[0]}
          </p>
        )}
      </div>

      {state.errors?._form && (
        <p role="alert">{state.errors._form[0]}</p>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  )
}
```

**Why good:** `useActionState` manages form state and pending state. Displays server validation errors. Accessible error associations with `aria-describedby`. Submit button disabled during pending.

---

## Pattern 3: Pending State with useFormStatus

### Good Example - useFormStatus in separate component

```typescript
// components/submit-button.tsx
'use client'

import { useFormStatus } from 'react-dom'

import type { ReactNode } from 'react'

type SubmitButtonProps = {
  children: ReactNode
  pendingText?: string
}

export function SubmitButton({ children, pendingText = 'Submitting...' }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? pendingText : children}
    </button>
  )
}
```

```typescript
// Usage in form
import { createPost } from '@/app/actions/posts'
import { SubmitButton } from '@/components/submit-button'

export function PostForm() {
  return (
    <form action={createPost}>
      {/* form fields */}
      <SubmitButton pendingText="Creating post...">
        Create Post
      </SubmitButton>
    </form>
  )
}
```

**Why good:** `useFormStatus` must be in a component nested within the form. Reusable submit button with customizable pending text. Clean separation of concerns.

### Bad Example - useFormStatus in same component as form

```typescript
// WRONG - useFormStatus won't work here
'use client'

import { useFormStatus } from 'react-dom'

export function PostForm() {
  const { pending } = useFormStatus() // Always false!

  return (
    <form action={createPost}>
      <button disabled={pending}>Submit</button>
    </form>
  )
}
```

**Why bad:** `useFormStatus` only works in components NESTED within the form, not in the component rendering the form. `pending` will always be `false` here.

---

## Pattern 4: Delete Actions with bind()

### Good Example - Delete with bind() for ID

```typescript
// app/actions/posts.ts
"use server";

import { revalidatePath } from "next/cache";

export async function deletePost(postId: string) {
  // Authorization check
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const post = await getPost(postId);
  if (!post) {
    throw new Error("Post not found");
  }

  if (post.authorId !== user.id) {
    throw new Error("Forbidden: Not the author");
  }

  // Perform deletion
  await db.post.delete({ where: { id: postId } });

  revalidatePath("/posts");
}
```

```typescript
// components/delete-post-button.tsx
'use client'

import { deletePost } from '@/app/actions/posts'

export function DeletePostButton({ postId }: { postId: string }) {
  const deletePostWithId = deletePost.bind(null, postId)

  return (
    <form action={deletePostWithId}>
      <button type="submit">Delete</button>
    </form>
  )
}
```

**Why good:** `bind()` passes postId to Server Action. Authorization verifies ownership before deletion. Works with progressive enhancement.

---

## Pattern 5: Multiple Actions in One Form

### Good Example - Nested formAction

```typescript
// components/post-editor.tsx
import { saveAsDraft, publishPost } from '@/app/actions/posts'

export function PostEditor() {
  return (
    <form action={publishPost}>
      <input type="text" name="title" />
      <textarea name="content" />

      {/* formAction overrides the form's action for this button */}
      <button type="submit" formAction={saveAsDraft}>
        Save Draft
      </button>

      {/* Default action from form's action attribute */}
      <button type="submit">
        Publish
      </button>
    </form>
  )
}
```

**Why good:** Multiple submit buttons with different actions. `formAction` attribute overrides form's `action`. Same form data goes to different handlers.

---

## Pattern 6: Structured Error Handling

### Good Example - Type-safe error responses

```typescript
// app/actions/users.ts
"use server";

import { z } from "zod";

const MIN_PASSWORD_LENGTH = 8;

const SignupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    ),
});

export type SignupState = {
  success: boolean;
  errors?: {
    email?: string[];
    password?: string[];
    _form?: string[];
  };
};

export async function signup(
  prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const validatedFields = SignupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    // Check if user exists
    const existingUser = await getUserByEmail(validatedFields.data.email);
    if (existingUser) {
      return {
        success: false,
        errors: { email: ["Email already in use"] },
      };
    }

    // Create user (defer to your auth solution)
    await createUser(validatedFields.data);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      errors: { _form: ["Something went wrong. Please try again."] },
    };
  }
}
```

**Why good:** Typed state object for consistent structure. Field-level errors for inline display. Form-level errors (`_form`) for general issues. Named constant for password length.

### Bad Example - Throwing errors for validation

```typescript
// WRONG - Don't throw for validation errors
"use server";

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email.includes("@")) {
    throw new Error("Invalid email"); // Bad - loses form state
  }

  // ...
}
```

**Why bad:** Throwing errors clears form state and shows error boundary. User loses their input. Use return values for validation errors instead.
