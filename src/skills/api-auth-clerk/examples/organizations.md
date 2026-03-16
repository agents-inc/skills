# Clerk Organizations & Multi-Tenancy Examples

> Organization management, role-based access, permissions, and multi-tenant patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Core setup:** See [core.md](core.md). **Server auth:** See [server.md](server.md). **Client hooks:** See [hooks.md](hooks.md).

---

## Pattern 1: Organization Setup and Switching

### Good Example -- Organization-Aware Layout

```tsx
// app/(org)/layout.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { orgId, isAuthenticated } = await auth();

  if (!isAuthenticated) {
    redirect("/sign-in");
  }

  // Require an active organization for all org routes
  if (!orgId) {
    redirect("/org-selection");
  }

  return <div className="org-layout">{children}</div>;
}
```

**Why good:** Layout-level org check ensures all nested routes have an active org, redirects to org selection when no org is active, defense in depth on top of middleware

### Good Example -- Organization Selection Page

```tsx
// app/org-selection/page.tsx
"use client";

import { OrganizationList } from "@clerk/nextjs";

export function OrgSelectionPage() {
  return (
    <main className="org-selection">
      <h1>Select an Organization</h1>
      <OrganizationList
        afterSelectOrganizationUrl="/dashboard"
        afterCreateOrganizationUrl="/dashboard"
      />
    </main>
  );
}
```

**Why good:** `<OrganizationList>` provides create + select UI, redirects to dashboard after selection/creation, simple page for org-required apps

### Good Example -- Organization Switcher in Sidebar

```tsx
// components/sidebar.tsx
"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";

export function Sidebar() {
  return (
    <aside className="sidebar">
      <OrganizationSwitcher
        hidePersonal
        afterCreateOrganizationUrl="/dashboard"
        afterSelectOrganizationUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: "w-full",
            organizationSwitcherTrigger:
              "w-full rounded-lg border p-3 hover:bg-gray-50",
          },
        }}
      />
      <nav>{/* sidebar navigation */}</nav>
    </aside>
  );
}
```

**Why good:** `hidePersonal` for B2B apps (no personal workspace), redirect after org change reloads dashboard with new org context, full-width styling

---

## Pattern 2: Role-Based Access Control

### Good Example -- Middleware-Level RBAC

```ts
// proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
  "/api/admin(.*)",
]);

const isMemberRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/projects(.*)",
  "/api/projects(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Admin routes: require org:admin role
  if (isAdminRoute(req)) {
    await auth.protect((has) => has({ role: "org:admin" }));
    return;
  }

  // Member routes: require any org membership (any role)
  if (isMemberRoute(req)) {
    await auth.protect();
    return;
  }

  // All other non-public routes: require authentication
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**Why good:** Tiered protection -- admin routes require admin role, member routes require auth, public routes open, early return prevents falling through to less restrictive checks

### Good Example -- Server Component RBAC

```tsx
// app/admin/members/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function MembersPage() {
  const { orgId, has, isAuthenticated, redirectToSignIn } = await auth();

  if (!isAuthenticated) return redirectToSignIn();

  if (!orgId) redirect("/org-selection");

  // Server-side role check (defense in depth)
  if (!has({ role: "org:admin" })) {
    redirect("/dashboard");
  }

  const members = await db.query.orgMembers.findMany({
    where: eq(orgMembers.orgId, orgId),
  });

  return (
    <main>
      <h1>Organization Members</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>{member.name}</td>
              <td>{member.email}</td>
              <td>{member.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

**Why good:** Auth, org, and role checks at data layer (not just middleware), `orgId` scopes query, custom redirect for unauthorized (to dashboard, not 404)

---

## Pattern 3: Permission-Based Access Control

### Good Example -- Custom Permissions

Custom permissions follow the format `org:<feature>:<action>`. Configure in Clerk Dashboard under Configure > Organizations > Roles.

```tsx
// app/invoices/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function InvoicesPage() {
  const { orgId, has, isAuthenticated } = await auth();

  if (!isAuthenticated) redirect("/sign-in");
  if (!orgId) redirect("/org-selection");

  const canRead = has({ permission: "org:invoices:read" });
  const canCreate = has({ permission: "org:invoices:create" });
  const canDelete = has({ permission: "org:invoices:delete" });

  if (!canRead) redirect("/dashboard");

  const invoices = await db.query.invoices.findMany({
    where: eq(invoices.orgId, orgId),
  });

  return (
    <main>
      <h1>Invoices</h1>

      {canCreate && (
        <a href="/invoices/new" className="btn btn-primary">
          Create Invoice
        </a>
      )}

      <table>
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Amount</th>
            <th>Status</th>
            {canDelete && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>{invoice.number}</td>
              <td>${invoice.amount.toFixed(2)}</td>
              <td>{invoice.status}</td>
              {canDelete && (
                <td>
                  <form action={deleteInvoice}>
                    <input type="hidden" name="id" value={invoice.id} />
                    <button type="submit" className="btn btn-danger">
                      Delete
                    </button>
                  </form>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

**Why good:** Granular permission checks (read/create/delete), UI adapts based on permissions, page-level read check prevents unauthorized access, action column only shown to users with delete permission

### Good Example -- Permission-Protected Server Action

```ts
// app/actions/delete-invoice.ts
"use server";

import { auth } from "@clerk/nextjs/server";

export async function deleteInvoice(formData: FormData) {
  const { userId, orgId, has } = await auth();

  if (!userId || !orgId) {
    throw new Error("Unauthorized");
  }

  if (!has({ permission: "org:invoices:delete" })) {
    throw new Error("Insufficient permissions");
  }

  const invoiceId = formData.get("id") as string;

  // Verify invoice belongs to this organization
  const invoice = await db.query.invoices.findFirst({
    where: and(
      eq(invoices.id, invoiceId),
      eq(invoices.orgId, orgId),
    ),
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  await db.delete(invoices).where(eq(invoices.id, invoiceId));

  return { success: true };
}
```

**Why good:** Permission check in server action (defense in depth), verifies invoice belongs to active org (prevents cross-tenant access), `orgId` used for scoping

---

## Pattern 4: Client-Side Organization Management

### Good Example -- useOrganization Hook

```tsx
// components/org-member-list.tsx
"use client";

import { useOrganization } from "@clerk/nextjs";

export function OrgMemberList() {
  const { isLoaded, organization, membership, memberships } =
    useOrganization({
      memberships: {
        pageSize: 20,
        keepPreviousData: true,
      },
    });

  if (!isLoaded) return <div>Loading...</div>;

  if (!organization) {
    return <p>No active organization</p>;
  }

  const isAdmin = membership?.role === "org:admin";

  return (
    <div className="member-list">
      <h2>{organization.name} Members</h2>
      <p>{organization.membersCount} total members</p>

      <ul>
        {memberships?.data?.map((member) => (
          <li key={member.id}>
            <span>{member.publicUserData.identifier}</span>
            <span className="role-badge">{member.role}</span>
            {isAdmin && member.role !== "org:admin" && (
              <button
                onClick={async () => {
                  await member.update({ role: "org:admin" });
                }}
              >
                Promote to Admin
              </button>
            )}
          </li>
        ))}
      </ul>

      {memberships?.hasNextPage && (
        <button onClick={() => memberships.fetchNext()}>
          Load More
        </button>
      )}
    </div>
  );
}
```

**Why good:** `useOrganization` with memberships pagination, role check before showing promote button, `fetchNext()` for pagination, `publicUserData.identifier` is the member's email

### Good Example -- Create Organization

```tsx
// components/create-org-form.tsx
"use client";

import { useOrganizationList } from "@clerk/nextjs";
import { useState, type FormEvent } from "react";

export function CreateOrgForm() {
  const { isLoaded, createOrganization, setActive } = useOrganizationList();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  if (!isLoaded) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    try {
      const org = await createOrganization({ name });
      // Set the new org as active
      await setActive({ organization: org.id });
      // Redirect or update UI
      window.location.assign("/dashboard");
    } catch (err) {
      console.error("Failed to create organization:", err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Organization name"
        required
      />
      <button type="submit" disabled={creating}>
        {creating ? "Creating..." : "Create Organization"}
      </button>
    </form>
  );
}
```

**Why good:** `createOrganization` from `useOrganizationList`, `setActive` switches to new org immediately, loading state during creation, error handling

---

## Pattern 5: Organization-Scoped Data Patterns

### Good Example -- Database Schema with Organization Scoping

```ts
// db/schema.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Users table -- synced via Clerk webhooks
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Organizations table -- synced via Clerk webhooks
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkOrgId: text("clerk_org_id").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Organization members -- synced via Clerk webhooks
export const orgMembers = pgTable("org_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Application data -- scoped to organization
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: text("org_id").notNull(), // Clerk organization ID
  name: text("name").notNull(),
  createdBy: text("created_by").notNull(), // Clerk user ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Why good:** `clerkId`/`clerkOrgId` as foreign keys (synced via webhooks), all app data scoped to `orgId`, `createdBy` tracks user who created resource

### Good Example -- Organization-Scoped Data Access Layer

```ts
// lib/data-access.ts
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";

// Always verify auth at the data access layer
export async function getProjects() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    throw new Error("Unauthorized: requires authenticated user with active org");
  }

  return db.query.projects.findMany({
    where: eq(projects.orgId, orgId),
    orderBy: desc(projects.createdAt),
  });
}

export async function getProject(projectId: string) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    throw new Error("Unauthorized");
  }

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.orgId, orgId), // Prevents cross-tenant access
    ),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return project;
}

export async function createProject(name: string) {
  const { userId, orgId, has } = await auth();

  if (!userId || !orgId) {
    throw new Error("Unauthorized");
  }

  if (!has({ permission: "org:projects:create" })) {
    throw new Error("Insufficient permissions");
  }

  return db.insert(projects).values({
    name,
    orgId,
    createdBy: userId,
  }).returning();
}
```

**Why good:** Auth verified at data layer (defense in depth), every query scoped to `orgId` (prevents cross-tenant data leaks), permission checks for mutations, throws on unauthorized

### Bad Example -- No Organization Scoping

```ts
// BAD: No org scoping -- leaks data across tenants
export async function getProjects() {
  return db.query.projects.findMany(); // Returns ALL projects!
}

// BAD: No ownership check
export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id)); // Any user can delete
}
```

**Why bad:** No org scoping means users see data from all organizations, no ownership check means any authenticated user can delete any project, cross-tenant data leak

---

## Pattern 6: Organization Profile Management

### Good Example -- Organization Settings Page

```tsx
// app/org/settings/[[...settings]]/page.tsx
import { OrganizationProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function OrgSettingsPage() {
  const { orgId, has } = await auth();

  if (!orgId) redirect("/org-selection");

  // Only admins can access org settings
  if (!has({ role: "org:admin" })) {
    redirect("/dashboard");
  }

  return (
    <main>
      <h1>Organization Settings</h1>
      <OrganizationProfile />
    </main>
  );
}
```

**Why good:** Catch-all route for multi-tab navigation, admin-only access check, `<OrganizationProfile>` provides member management, settings, and domain verification UI

---

_For core setup, see [core.md](core.md). For webhook handling, see [server.md](server.md)._
