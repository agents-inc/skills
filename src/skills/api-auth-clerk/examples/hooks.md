# Clerk Client-Side Hooks Examples

> Client-side hooks, conditional rendering, and loading states. See [SKILL.md](../SKILL.md) for core concepts.

**Core setup:** See [core.md](core.md). **Components:** See [components.md](components.md). **Server auth:** See [server.md](server.md).

---

## Pattern 1: useUser -- User Profile Data

### Good Example -- User Profile Display

```tsx
// components/user-profile-card.tsx
"use client";

import { useUser } from "@clerk/nextjs";

export function UserProfileCard() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <div className="skeleton" aria-label="Loading user profile" />;
  }

  if (!isSignedIn) {
    return <p>Please sign in to view your profile.</p>;
  }

  const primaryEmail = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress;

  return (
    <div className="profile-card">
      <img src={user.imageUrl} alt={`${user.firstName}'s avatar`} />
      <h2>
        {user.firstName} {user.lastName}
      </h2>
      <p>{primaryEmail}</p>
      <p>Joined: {user.createdAt?.toLocaleDateString()}</p>
    </div>
  );
}
```

**Why good:** Checks `isLoaded` first (prevents undefined access), checks `isSignedIn` before accessing `user`, finds primary email from email addresses array, accessible loading state

### Good Example -- Update User Profile

```tsx
// components/edit-name-form.tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { useState, type FormEvent } from "react";

export function EditNameForm() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isLoaded || !isSignedIn) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await user.update({ firstName, lastName });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder={user.firstName ?? "First name"}
      />
      <input
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder={user.lastName ?? "Last name"}
      />
      <button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Update Name"}
      </button>
    </form>
  );
}
```

**Why good:** `user.update()` method updates Clerk user data directly, loading state during save, placeholder shows current values, guards against unloaded state

### Bad Example -- No Loading Check

```tsx
// BAD: Accessing user without guards
"use client";
import { useUser } from "@clerk/nextjs";

export default function Profile() {
  const { user } = useUser();
  // user is undefined until isLoaded is true, null when signed out
  return <p>Hello {user.firstName}</p>; // Runtime error!
}
```

**Why bad:** `user` is `undefined` during initialization and `null` when signed out, accessing `.firstName` throws TypeError, no loading state for UX, default export

---

## Pattern 2: useAuth -- Session and Authorization

### Good Example -- Authenticated API Calls

```tsx
// components/data-fetcher.tsx
"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

interface DashboardData {
  stats: { label: string; value: number }[];
}

export function DataFetcher() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setData(await response.json());
    } catch (err) {
      // Core 3: getToken() throws ClerkOfflineError when offline
      setError(err instanceof Error ? err.message : "Failed to fetch");
    }
  }, [getToken]);

  useEffect(() => {
    if (isSignedIn) {
      fetchData();
    }
  }, [isSignedIn, fetchData]);

  if (!isLoaded) return <div>Loading auth...</div>;
  if (!isSignedIn) return <div>Sign in required</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>Loading data...</div>;

  return (
    <ul>
      {data.stats.map((stat) => (
        <li key={stat.label}>
          {stat.label}: {stat.value}
        </li>
      ))}
    </ul>
  );
}
```

**Why good:** `getToken()` provides JWT for API authentication, try/catch handles `ClerkOfflineError` (Core 3 behavior), sequential loading states, fetches only when signed in

### Good Example -- Authorization Check with has()

```tsx
// components/admin-actions.tsx
"use client";

import { useAuth } from "@clerk/nextjs";

export function AdminActions() {
  const { isLoaded, isSignedIn, has, orgRole } = useAuth();

  if (!isLoaded || !isSignedIn) return null;

  const isAdmin = has?.({ role: "org:admin" });
  const canManageBilling = has?.({ permission: "org:billing:manage" });

  return (
    <div className="admin-actions">
      <p>Current role: {orgRole ?? "No organization"}</p>

      {isAdmin && (
        <button onClick={() => window.location.assign("/admin")}>
          Admin Panel
        </button>
      )}

      {canManageBilling && (
        <button onClick={() => window.location.assign("/billing")}>
          Manage Billing
        </button>
      )}
    </div>
  );
}
```

**Why good:** `has()` checks roles and permissions client-side, optional chaining on `has?.()` (null when no active org), `orgRole` shows current role, named export

---

## Pattern 3: useSession -- Session Management

### Good Example -- Session Info Display

```tsx
// components/session-info.tsx
"use client";

import { useSession } from "@clerk/nextjs";

export function SessionInfo() {
  const { isLoaded, isSignedIn, session } = useSession();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn || !session) return null;

  return (
    <div className="session-info">
      <p>Session ID: {session.id}</p>
      <p>Last active: {session.lastActiveAt.toLocaleString()}</p>
      <p>Status: {session.status}</p>
      <p>Expires: {session.expireAt.toLocaleString()}</p>
    </div>
  );
}
```

**Why good:** Session object provides activity and expiration info, useful for session management UIs, guards against unloaded state

---

## Pattern 4: useOrganization -- Active Organization

### Good Example -- Organization Dashboard

```tsx
// components/org-dashboard.tsx
"use client";

import { useOrganization } from "@clerk/nextjs";

export function OrgDashboard() {
  const { isLoaded, organization, membership } = useOrganization();

  if (!isLoaded) return <div>Loading organization...</div>;

  if (!organization) {
    return (
      <div>
        <p>No active organization.</p>
        <p>Select or create an organization to continue.</p>
      </div>
    );
  }

  return (
    <div className="org-dashboard">
      <div className="org-header">
        <img src={organization.imageUrl} alt={organization.name} />
        <h1>{organization.name}</h1>
        <p>Slug: {organization.slug}</p>
        <p>Members: {organization.membersCount}</p>
      </div>

      <div className="membership-info">
        <p>Your role: {membership?.role}</p>
        <p>Joined: {membership?.createdAt?.toLocaleDateString()}</p>
      </div>
    </div>
  );
}
```

**Why good:** Handles no-org state (user might not have selected an org), `membership` contains user's role in active org, `organization` has org metadata

---

## Pattern 5: Combining Multiple Hooks

### Good Example -- Complete Dashboard Header

```tsx
// components/dashboard-header.tsx
"use client";

import { useUser, useAuth, useOrganization } from "@clerk/nextjs";
import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";

export function DashboardHeader() {
  const { isLoaded: userLoaded, user } = useUser();
  const { orgId } = useAuth();
  const { organization } = useOrganization();

  if (!userLoaded) {
    return <header className="dashboard-header skeleton" />;
  }

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1>
          {orgId && organization
            ? organization.name
            : `${user?.firstName}'s Workspace`}
        </h1>
      </div>

      <div className="header-right">
        <OrganizationSwitcher hidePersonal={false} />
        <UserButton />
      </div>
    </header>
  );
}
```

**Why good:** Combines user, auth, and org hooks for complete header, graceful fallback to personal workspace when no org, `hidePersonal={false}` allows personal workspace option

---

## Pattern 6: Reverification for Sensitive Actions

### Good Example -- Reverify Before Dangerous Action

```tsx
// components/delete-account.tsx
"use client";

import { useReverification, useUser } from "@clerk/nextjs";

export function DeleteAccountButton() {
  const { user } = useUser();

  const deleteAccount = useReverification(async () => {
    // This callback only runs after the user re-authenticates
    await user?.delete();
    window.location.assign("/");
  });

  return (
    <button
      onClick={() => deleteAccount()}
      className="btn btn-danger"
    >
      Delete My Account
    </button>
  );
}
```

**Why good:** `useReverification` prompts user to re-authenticate before executing, protects sensitive actions from session theft, callback pattern keeps code clean

---

_For server-side auth, see [server.md](server.md). For organizations, see [organizations.md](organizations.md)._
