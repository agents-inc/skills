# Remix - Multiple Forms Examples

> Patterns for handling multiple forms in a single route.

---

## Settings Page with Multiple Forms

```typescript
// app/routes/settings.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";

const HTTP_BAD_REQUEST = 400;

type ActionData = {
  intent: string;
  success?: boolean;
  errors?: Record<string, string>;
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  switch (intent) {
    case "updateProfile": {
      const name = formData.get("name") as string;
      const bio = formData.get("bio") as string;

      if (!name) {
        return json<ActionData>(
          { intent: "updateProfile", errors: { name: "Name is required" } },
          { status: HTTP_BAD_REQUEST }
        );
      }

      await db.user.update({
        where: { id: session.userId },
        data: { name, bio },
      });

      return json<ActionData>({ intent: "updateProfile", success: true });
    }

    case "updateEmail": {
      const email = formData.get("email") as string;
      const password = formData.get("currentPassword") as string;

      // Verify current password before email change
      const isValid = await verifyPassword(session.userId, password);
      if (!isValid) {
        return json<ActionData>(
          { intent: "updateEmail", errors: { currentPassword: "Incorrect password" } },
          { status: HTTP_BAD_REQUEST }
        );
      }

      await db.user.update({
        where: { id: session.userId },
        data: { email },
      });

      return json<ActionData>({ intent: "updateEmail", success: true });
    }

    case "deleteAccount": {
      const confirmation = formData.get("confirmation") as string;

      if (confirmation !== "DELETE") {
        return json<ActionData>(
          { intent: "deleteAccount", errors: { confirmation: 'Type "DELETE" to confirm' } },
          { status: HTTP_BAD_REQUEST }
        );
      }

      await db.user.delete({ where: { id: session.userId } });
      return redirect("/goodbye");
    }

    default:
      return json<ActionData>(
        { intent: "unknown", errors: { form: "Unknown action" } },
        { status: HTTP_BAD_REQUEST }
      );
  }
}

export default function Settings() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = (intent: string) =>
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === intent;

  return (
    <div>
      <h1>Settings</h1>

      {/* Profile Form */}
      <section>
        <h2>Profile</h2>
        {actionData?.intent === "updateProfile" && actionData.success && (
          <p role="status">Profile updated!</p>
        )}
        <Form method="post">
          <input type="hidden" name="intent" value="updateProfile" />
          <div>
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" />
            {actionData?.intent === "updateProfile" && actionData.errors?.name && (
              <span role="alert">{actionData.errors.name}</span>
            )}
          </div>
          <div>
            <label htmlFor="bio">Bio</label>
            <textarea id="bio" name="bio" />
          </div>
          <button type="submit" disabled={isSubmitting("updateProfile")}>
            {isSubmitting("updateProfile") ? "Saving..." : "Save Profile"}
          </button>
        </Form>
      </section>

      {/* Email Form */}
      <section>
        <h2>Email</h2>
        <Form method="post">
          <input type="hidden" name="intent" value="updateEmail" />
          {/* email form fields */}
          <button type="submit" disabled={isSubmitting("updateEmail")}>
            {isSubmitting("updateEmail") ? "Updating..." : "Update Email"}
          </button>
        </Form>
      </section>

      {/* Delete Account Form */}
      <section>
        <h2>Danger Zone</h2>
        <Form method="post">
          <input type="hidden" name="intent" value="deleteAccount" />
          {/* delete confirmation field */}
          <button type="submit" disabled={isSubmitting("deleteAccount")}>
            Delete Account
          </button>
        </Form>
      </section>
    </div>
  );
}
```

**Why good:** Hidden `intent` field distinguishes forms, action uses switch statement for routing, success/error messages scoped to specific form, individual loading states per form

---

## Key Concepts

### Multi-Form Pattern Structure

```typescript
// 1. Hidden intent field in each form
<input type="hidden" name="intent" value="formName" />

// 2. Switch on intent in action
switch (formData.get("intent")) {
  case "formName":
    // Handle this form
    break;
}

// 3. Scope feedback to specific form
{actionData?.intent === "formName" && actionData.success && (
  <p>Success!</p>
)}

// 4. Track loading state per form
const isSubmitting = (intent: string) =>
  navigation.state === "submitting" &&
  navigation.formData?.get("intent") === intent;
```

### Alternative: Separate Actions with useFetcher

For complex pages, consider using `useFetcher` with different endpoints:

```typescript
const profileFetcher = useFetcher();
const emailFetcher = useFetcher();

// Each fetcher submits to its own resource route
<profileFetcher.Form action="/api/profile" method="post">
<emailFetcher.Form action="/api/email" method="post">
```
