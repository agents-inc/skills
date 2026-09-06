# Remix — Multiple Forms in One Route

> One action serving several forms, distinguished by a hidden `intent` field.

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

**Why good:** A route has one action, so the `intent` field is what routes the submission to the right
branch — and echoing it back in the response is what lets each form show only its own result. The
`isSubmitting(intent)` helper reads `navigation.formData`, so saving the profile does not disable the
delete button.

---

## The Four Parts

```typescript
// 1. Every form declares which one it is
<input type="hidden" name="intent" value="formName" />

// 2. The action branches on it
switch (formData.get("intent")) {
  case "formName":
    break;
}

// 3. The response says which form it belongs to, so feedback lands in one place
{actionData?.intent === "formName" && actionData.success && <p>Success!</p>}

// 4. The pending state reads the in-flight submission's own intent
const isSubmitting = (intent: string) =>
  navigation.state === "submitting" && navigation.formData?.get("intent") === intent;
```

## The Alternative: one fetcher per form

`useNavigation` describes a single navigation, so several forms sharing it are serialised — one
submission at a time. Giving each form its own fetcher makes them independent, at the cost of a
route per form.

```typescript
const profileFetcher = useFetcher();
const emailFetcher = useFetcher();

<profileFetcher.Form action="/api/profile" method="post">
<emailFetcher.Form action="/api/email" method="post">
```
