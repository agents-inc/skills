# Remix - Action Examples

> Patterns for form submissions, validation, and mutations.

---

## Signup Form with Validation

```typescript
// app/routes/signup.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";

const HTTP_BAD_REQUEST = 400;
const MIN_PASSWORD_LENGTH = 8;

type ActionErrors = {
  email?: string;
  password?: string;
  general?: string;
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  const errors: ActionErrors = {};

  if (!email || typeof email !== "string") {
    errors.email = "Email is required";
  } else if (!email.includes("@")) {
    errors.email = "Please enter a valid email";
  }

  if (!password || typeof password !== "string") {
    errors.password = "Password is required";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors }, { status: HTTP_BAD_REQUEST });
  }

  // Check if user exists
  const existingUser = await db.user.findUnique({
    where: { email: email as string },
  });

  if (existingUser) {
    return json(
      { errors: { email: "An account with this email already exists" } },
      { status: HTTP_BAD_REQUEST }
    );
  }

  // Create user
  const hashedPassword = await hashPassword(password as string);
  const user = await db.user.create({
    data: { email: email as string, password: hashedPassword },
  });

  // Create session and redirect
  const session = await createSession(user.id);
  return redirect("/dashboard", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function Signup() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Form method="post">
      <fieldset disabled={isSubmitting}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(actionData?.errors?.email)}
            aria-describedby={actionData?.errors?.email ? "email-error" : undefined}
          />
          {actionData?.errors?.email && (
            <span id="email-error" role="alert">
              {actionData.errors.email}
            </span>
          )}
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(actionData?.errors?.password)}
            aria-describedby={actionData?.errors?.password ? "password-error" : undefined}
          />
          {actionData?.errors?.password && (
            <span id="password-error" role="alert">
              {actionData.errors.password}
            </span>
          )}
        </div>

        <button type="submit">
          {isSubmitting ? "Creating account..." : "Sign up"}
        </button>
      </fieldset>
    </Form>
  );
}
```

**Why good:** Comprehensive validation with typed errors, disabled fieldset during submission, accessible form with aria attributes, loading state feedback, redirect with session cookie after success

---

## Delete Action with Confirmation

```typescript
// app/routes/posts.$postId.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";

const HTTP_NOT_FOUND = 404;
const HTTP_FORBIDDEN = 403;

export async function loader({ params, request }: LoaderFunctionArgs) {
  const post = await db.post.findUnique({
    where: { id: params.postId },
    include: { author: true },
  });

  if (!post) {
    throw json({ message: "Post not found" }, { status: HTTP_NOT_FOUND });
  }

  const session = await getSession(request);
  const canEdit = session.userId === post.authorId;

  return json({ post, canEdit });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const session = await getSession(request);
  if (!session.userId) {
    throw json({ message: "Not authenticated" }, { status: HTTP_FORBIDDEN });
  }

  const post = await db.post.findUnique({ where: { id: params.postId } });

  if (!post) {
    throw json({ message: "Post not found" }, { status: HTTP_NOT_FOUND });
  }

  if (post.authorId !== session.userId) {
    throw json({ message: "Not authorized" }, { status: HTTP_FORBIDDEN });
  }

  await db.post.delete({ where: { id: params.postId } });

  return redirect("/posts");
}

export default function PostPage() {
  const { post, canEdit } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isDeleting = navigation.state === "submitting";

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>

      {canEdit && (
        <Form method="post" onSubmit={(e) => {
          if (!confirm("Are you sure you want to delete this post?")) {
            e.preventDefault();
          }
        }}>
          <button type="submit" disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Post"}
          </button>
        </Form>
      )}
    </article>
  );
}
```

**Why good:** Authorization check in both loader (for UI) and action (for security), confirmation dialog before delete, loading state while deleting, redirect after successful delete
