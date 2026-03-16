# Clerk Server-Side Auth Examples

> Server Components, API route protection, Server Actions, and webhook handling. See [SKILL.md](../SKILL.md) for core concepts.

**Core setup:** See [core.md](core.md). **Components:** See [components.md](components.md). **Client hooks:** See [hooks.md](hooks.md).

---

## Pattern 1: auth() in Server Components

`auth()` is lightweight -- it reads session claims from the request cookie without making an API call. Safe to call multiple times (deduplicated per request).

### Good Example -- Protected Page

```tsx
// app/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const { userId, orgId, isAuthenticated, redirectToSignIn } = await auth();

  if (!isAuthenticated) {
    return redirectToSignIn();
  }

  // userId is guaranteed non-null after isAuthenticated check
  const dashboardData = await getDashboardData(userId, orgId);

  return (
    <main>
      <h1>Dashboard</h1>
      <p>User: {userId}</p>
      {orgId && <p>Organization: {orgId}</p>}
      <DashboardContent data={dashboardData} />
    </main>
  );
}
```

**Why good:** `auth()` is lightweight (no API call), `redirectToSignIn()` handles redirect, `orgId` may be null (user without active org), data fetched with user context

### Good Example -- Authorization with protect()

```tsx
// app/admin/page.tsx
import { auth } from "@clerk/nextjs/server";

export default async function AdminPage() {
  // Redirects to sign-in if unauthenticated, returns 404 if unauthorized
  await (await auth()).protect({ role: "org:admin" });

  return (
    <main>
      <h1>Admin Panel</h1>
      <p>Only org admins can see this page.</p>
    </main>
  );
}
```

**Why good:** `protect()` handles both authentication and authorization in one call, unauthenticated users redirected, unauthorized users get 404

### Good Example -- Permission-Based Check with has()

```tsx
// app/billing/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const { has, isAuthenticated, redirectToSignIn } = await auth();

  if (!isAuthenticated) {
    return redirectToSignIn();
  }

  if (!has({ permission: "org:billing:manage" })) {
    redirect("/dashboard");
  }

  return (
    <main>
      <h1>Billing Management</h1>
      {/* billing content */}
    </main>
  );
}
```

**Why good:** `has()` for granular permission checks, custom redirect for unauthorized (instead of 404), separate auth and authorization checks for different handling

---

## Pattern 2: currentUser() in Server Components

`currentUser()` makes a Backend API call to fetch the full user object. Use when you need user profile data server-side.

### Good Example -- Server-Side User Data

```tsx
// app/profile/page.tsx
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // IMPORTANT: Only pass specific fields to client components
  // currentUser() returns privateMetadata which must stay server-side
  const safeProfile = {
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    email: user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress,
    createdAt: user.createdAt,
  };

  return (
    <main>
      <h1>
        {safeProfile.firstName} {safeProfile.lastName}
      </h1>
      <img src={safeProfile.imageUrl} alt="Profile" />
      <p>{safeProfile.email}</p>
      <p>
        Member since: {new Date(safeProfile.createdAt).toLocaleDateString()}
      </p>

      {/* Safe to pass filtered data to client components */}
      <ProfileActions user={safeProfile} />
    </main>
  );
}
```

**Why good:** Explicitly picks safe fields before passing to client, never passes full user object (contains `privateMetadata`), redirect for unauthenticated users

### Bad Example -- Passing Full User to Client

```tsx
// BAD: Leaking privateMetadata to client
import { currentUser } from "@clerk/nextjs/server";

export default async function Page() {
  const user = await currentUser();
  // user.privateMetadata is exposed to the client!
  return <ClientComponent user={user} />;
}
```

**Why bad:** `currentUser()` includes `privateMetadata` (sensitive server-only data), passing full object to client component leaks it to the browser, security vulnerability

---

## Pattern 3: Route Handlers (API Routes)

### Good Example -- Protected API Route

```ts
// app/api/user/profile/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const updated = await db
    .update(users)
    .set({ name: body.name, bio: body.bio })
    .where(eq(users.clerkId, userId))
    .returning();

  return NextResponse.json(updated[0]);
}
```

**Why good:** Auth check in every handler (defense in depth, not just middleware), `userId` scopes all queries to current user, proper HTTP status codes, both GET and PATCH protected

### Good Example -- Organization-Scoped API Route

```ts
// app/api/org/members/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId, orgId, has } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!orgId) {
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 },
    );
  }

  // Check permission for member management
  if (!has({ permission: "org:members:read" })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await db.query.orgMembers.findMany({
    where: eq(orgMembers.orgId, orgId),
  });

  return NextResponse.json(members);
}
```

**Why good:** Checks auth, active org, AND permission separately, proper error status codes (401/400/403), `orgId` scopes query to active organization

---

## Pattern 4: Server Actions

### Good Example -- Protected Server Action

```ts
// app/actions/update-profile.ts
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";

export async function updateProfile(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;
  const bio = formData.get("bio") as string;

  // Update in your database
  await db.update(users).set({ name, bio }).where(eq(users.clerkId, userId));

  // Optionally update Clerk user metadata
  const user = await currentUser();
  if (user) {
    await user.update({
      publicMetadata: { bio },
    });
  }

  return { success: true };
}
```

**Why good:** Auth check inside server action (not relying on middleware alone), `userId` scopes mutation, updates both local DB and Clerk metadata, `"use server"` directive

### Good Example -- Organization-Scoped Server Action

```ts
// app/actions/create-project.ts
"use server";

import { auth } from "@clerk/nextjs/server";

export async function createProject(formData: FormData) {
  const { userId, orgId, has } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  if (!orgId) {
    throw new Error("No active organization");
  }

  if (!has({ permission: "org:projects:create" })) {
    throw new Error("Insufficient permissions");
  }

  const name = formData.get("name") as string;

  const project = await db.insert(projects).values({
    name,
    orgId,
    createdBy: userId,
  });

  return { success: true, projectId: project.id };
}
```

**Why good:** Checks auth, org, and permission in server action, `orgId` scopes created resource to organization, `createdBy` tracks who created it

---

## Pattern 5: Webhook Handling

### Good Example -- Complete Webhook Handler

```ts
// app/api/webhooks/clerk/route.ts
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { UserJSON, OrganizationJSON } from "@clerk/shared/types";

export async function POST(req: Request) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Webhook verification failed", { status: 400 });
  }

  switch (evt.type) {
    case "user.created": {
      const userData = evt.data as UserJSON;
      const primaryEmail = userData.email_addresses.find(
        (e) => e.id === userData.primary_email_address_id,
      )?.email_address;

      await db.insert(users).values({
        clerkId: userData.id,
        email: primaryEmail ?? "",
        firstName: userData.first_name,
        lastName: userData.last_name,
        imageUrl: userData.image_url,
      });
      break;
    }

    case "user.updated": {
      const userData = evt.data as UserJSON;
      const primaryEmail = userData.email_addresses.find(
        (e) => e.id === userData.primary_email_address_id,
      )?.email_address;

      await db
        .update(users)
        .set({
          email: primaryEmail ?? "",
          firstName: userData.first_name,
          lastName: userData.last_name,
          imageUrl: userData.image_url,
        })
        .where(eq(users.clerkId, userData.id));
      break;
    }

    case "user.deleted": {
      const { id } = evt.data;
      if (id) {
        await db.delete(users).where(eq(users.clerkId, id));
      }
      break;
    }

    case "organization.created": {
      const orgData = evt.data as OrganizationJSON;
      await db.insert(organizations).values({
        clerkOrgId: orgData.id,
        name: orgData.name,
        slug: orgData.slug,
        imageUrl: orgData.image_url,
      });
      break;
    }

    case "organizationMembership.created": {
      const memberData = evt.data;
      await db.insert(orgMembers).values({
        orgId: memberData.organization.id,
        userId: memberData.public_user_data.user_id,
        role: memberData.role,
      });
      break;
    }

    case "organizationMembership.deleted": {
      const memberData = evt.data;
      await db
        .delete(orgMembers)
        .where(
          and(
            eq(orgMembers.orgId, memberData.organization.id),
            eq(orgMembers.userId, memberData.public_user_data.user_id),
          ),
        );
      break;
    }

    default:
      // Unhandled event type -- return 200 to acknowledge receipt
      break;
  }

  return new Response("OK", { status: 200 });
}
```

**Why good:** `verifyWebhook` validates Svix signature, handles multiple event types, try/catch for verification failure, always returns 200 (Clerk retries non-2xx), separate handlers for users and organizations

### Bad Example -- Unverified Webhook

```ts
// BAD: No signature verification
export async function POST(req: Request) {
  const body = await req.json();
  // Anyone can send fake events to this endpoint!
  await db.insert(users).values({
    clerkId: body.data.id,
    email: body.data.email_addresses[0].email_address,
  });
  return new Response("OK");
}
```

**Why bad:** No signature verification, anyone can POST fake data, direct database insertion from untrusted input, major security vulnerability

---

## Pattern 6: Custom JWT Templates

### Good Example -- Fetching Custom Token for External API

```tsx
// components/external-api-caller.tsx
"use client";

import { useAuth } from "@clerk/nextjs";

const EXTERNAL_API_URL = "https://api.example.com/data";

export function ExternalApiCaller() {
  const { getToken, isSignedIn } = useAuth();

  async function callExternalApi() {
    if (!isSignedIn) return;

    try {
      // Fetch a JWT using a custom template configured in Clerk Dashboard
      const token = await getToken({ template: "supabase" });

      const response = await fetch(EXTERNAL_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.json();
    } catch (err) {
      // Core 3: throws ClerkOfflineError when offline
      console.error("Failed to get token:", err);
    }
  }

  return (
    <button onClick={callExternalApi} disabled={!isSignedIn}>
      Fetch External Data
    </button>
  );
}
```

**Why good:** Custom JWT template for external services (Supabase, Hasura, etc.), named constant for URL, try/catch for offline handling, configured in Clerk Dashboard under JWT Templates

---

_For organizations and multi-tenancy, see [organizations.md](organizations.md)._
