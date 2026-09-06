# Next.js Server Actions Examples

> Defining, invoking, validating and authorizing Server Actions. Optimistic updates, cookies,
> non-form handlers and streaming each have their own file in this folder.

---

## Pattern 1: Server Action Definition

Two places the directive can go. File level marks every export as an action, which is what allows a
Client Component to import one:

```typescript
// app/actions/posts.ts
"use server";
export async function createPost(formData: FormData) {
  /* ... */
}
```

Function level keeps a one-off action next to the Server Component that uses it:

```tsx
// app/page.tsx — a Server Component
export default function Page() {
  async function createPost(formData: FormData) {
    "use server";
    // ...
  }

  return <form action={createPost}>...</form>;
}
```

### Good Example — the full shape of a create action

```typescript
// app/actions/posts.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
// CreatePostSchema is defined with your schema validation library; toFieldErrors
// reshapes that library's error into { [field]: string[] }.
import { CreatePostSchema, toFieldErrors } from "./schemas";

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
    return { success: false, errors: toFieldErrors(validatedFields.error) };
  }

  // 2. Authorization — the action is a public endpoint until this line runs
  const user = await getCurrentUser();
  if (!user) {
    return {
      success: false,
      errors: { _form: ["You must be logged in to create a post"] },
    };
  }

  try {
    // 3. Mutate
    await createPostRecord({ ...validatedFields.data, authorId: user.id });

    // 4. Revalidate
    revalidatePath("/posts");
  } catch (error) {
    return {
      success: false,
      errors: { _form: ["Failed to create post. Please try again."] },
    };
  }

  // 5. Redirect, outside the try — it signals by throwing
  redirect("/posts");
}
```

**Why good:** The five steps run in the only order that works: a failed parse never reaches the auth
check, a failed auth check never reaches the database, and the redirect sits outside the `try` so the
`catch` cannot swallow it. Errors come back as values, so the form keeps the user's input.

### Bad Example — the same action with each step missing

```typescript
// app/actions.ts
"use server";

export async function createPost(formData: FormData) {
  const title = formData.get("title");
  const content = formData.get("content");

  // No validation
  // No auth check
  await createPostRecord({ title, content });

  // No revalidation — the list keeps rendering the pre-mutation cache
}
```

**Why bad:** Untyped `FormData` reaches the database, any anonymous caller who finds the action ID can
write a row, the list page shows stale data afterwards, and a database failure escapes to the error
boundary instead of coming back as a message.

---

## Pattern 2: Progressive Enhancement Form

### Good Example — a plain form

```typescript
// app/posts/new/page.tsx
import { createPost } from '../../actions/posts'

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

**Why good:** No JavaScript is involved, so the form submits from a browser that has not hydrated yet
or has scripting disabled. `required` and `maxLength` give first-pass validation for free.

### Good Example — useActionState for validation errors

```typescript
// components/post-form.tsx
'use client'

import { useActionState } from 'react'
import { createPost, type CreatePostState } from '../app/actions/posts'

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

**Why good:** `useActionState` returns the action's own return value, so server-side validation errors
render inline; `aria-describedby` ties each message to its field for a screen reader; and the pending
flag comes from the same hook rather than a second piece of state to keep in sync.

---

## Pattern 3: Pending State with useFormStatus

### Good Example — useFormStatus in a nested component

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
import { createPost } from '../app/actions/posts'
import { SubmitButton } from './submit-button'

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

**Why good:** `useFormStatus` reads the nearest form above it in the tree, so a nested button gets the
pending state without the form passing anything down — and the button is reusable across every form
in the app.

### Bad Example — useFormStatus beside the form it describes

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

**Why bad:** The hook looks upward for a form, and there is none above this component — the `<form>`
is below it. `pending` stays `false` for the life of the component, so the button never disables and
nothing reports the failure.

---

## Pattern 4: Delete Actions with bind()

### Good Example — passing an ID with bind()

```typescript
// app/actions/posts.ts
"use server";

import { revalidatePath } from "next/cache";

export async function deletePost(postId: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const post = await getPost(postId);
  if (!post) {
    throw new Error("Not found");
  }

  if (post.authorId !== user.id) {
    throw new Error("Forbidden: Not the author");
  }

  await deletePostRecord(postId);

  revalidatePath("/posts");
}
```

```typescript
// components/delete-post-button.tsx
'use client'

import { deletePost } from '../app/actions/posts'

export function DeletePostButton({ postId }: { postId: string }) {
  const deletePostWithId = deletePost.bind(null, postId)

  return (
    <form action={deletePostWithId}>
      <button type="submit">Delete</button>
    </form>
  )
}
```

**Why good:** `bind()` supplies the ID without a hidden input, so the client cannot substitute another
post's — and the form still works unenhanced. Ownership is checked server-side regardless.

---

## Pattern 5: Multiple Actions in One Form

### Good Example — formAction per button

```typescript
// components/post-editor.tsx
import { saveAsDraft, publishPost } from '../app/actions/posts'

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

**Why good:** `formAction` on a button overrides the form's own `action`, so one set of fields reaches
two handlers — and the native attribute means it works before hydration too.

---

## Pattern 6: Structured Error Handling

### Good Example — type-safe error responses

```typescript
// app/actions/users.ts
"use server";

// Same stand-ins as Pattern 1: the schema comes from your validation library, and
// toFieldErrors reshapes its error into { [field]: string[] }.
import { SignupSchema, toFieldErrors } from "./schemas";

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
    return { success: false, errors: toFieldErrors(validatedFields.error) };
  }

  try {
    const existingUser = await getUserByEmail(validatedFields.data.email);
    if (existingUser) {
      return { success: false, errors: { email: ["Email already in use"] } };
    }

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

**Why good:** One state shape covers every outcome, so the form component has a single thing to
render. Field errors key by field name for inline display; `_form` carries what belongs to no single
field, such as an unavailable database.

### Bad Example — throwing for a validation failure

```typescript
// WRONG
"use server";

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email.includes("@")) {
    throw new Error("Invalid email");
  }

  // ...
}
```

**Why bad:** The throw reaches the nearest error boundary, which unmounts the form — so the user is
told what is wrong and loses everything they typed at the same moment. Return the errors instead.
