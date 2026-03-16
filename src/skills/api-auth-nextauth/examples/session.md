# Session Strategies & Access

> Code examples for Auth.js session management - JWT vs database sessions, accessing sessions in different contexts. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: JWT Sessions (Default)

### Good Example - JWT Configuration

```typescript
// auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const UPDATE_AGE_SECONDS = 24 * 60 * 60; // 24 hours

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: {
    strategy: "jwt",
    maxAge: MAX_AGE_SECONDS,
    updateAge: UPDATE_AGE_SECONDS, // How often to refresh the JWT
  },
});
```

**Why good:** Named constants for time values, explicit strategy declaration, `updateAge` prevents unnecessary JWT refreshes

---

## Pattern 2: Database Sessions

### Good Example - Database Session with Prisma

```typescript
// auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [GitHub],
  session: {
    strategy: "database", // Explicit (default when adapter is present)
  },
});
```

See [database.md](database.md) for the required Prisma/Drizzle schema models (User, Account, Session, VerificationToken).

**Why good:** PrismaAdapter handles session CRUD, database sessions support immediate revocation, explicit `strategy: "database"` when adapter is present

### Bad Example - Database Strategy Without Adapter

```typescript
// BAD: Database strategy requires an adapter
export const { auth } = NextAuth({
  providers: [GitHub],
  session: {
    strategy: "database", // Will fail - no adapter configured
  },
});
```

**Why bad:** Database strategy requires a database adapter; will throw runtime error

---

## Pattern 3: Accessing Sessions in Different Contexts

### Good Example - Server Component

```typescript
// app/profile/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div>
      <h1>Profile</h1>
      <p>Name: {session.user.name}</p>
      <p>Email: {session.user.email}</p>
      <p>Role: {session.user.role}</p>
    </div>
  );
}
```

### Good Example - Route Handler

```typescript
// app/api/profile/route.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const GET = auth(function GET(req) {
  if (!req.auth?.user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    id: req.auth.user.id,
    name: req.auth.user.name,
    role: req.auth.user.role,
  });
});
```

### Good Example - Server Action

```typescript
// app/actions.ts
"use server";

import { auth } from "@/auth";

export async function updateProfile(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;

  await db.user.update({
    where: { id: session.user.id },
    data: { name },
  });

  return { success: true };
}
```

### Good Example - Client Component with SessionProvider

```typescript
// components/session-info.tsx
"use client";

import { useSession } from "next-auth/react";

export function SessionInfo() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p>Loading session...</p>;
  }

  if (status === "unauthenticated") {
    return <p>Not signed in</p>;
  }

  return (
    <div>
      <p>Signed in as {session?.user?.name}</p>
      <p>Role: {session?.user?.role}</p>
    </div>
  );
}
```

**Why good:** Each context uses the appropriate method, server-side uses `auth()` directly, client-side uses `useSession()` with loading states

### Bad Example - Using Deprecated Functions

```typescript
// BAD: v4 patterns
import { getServerSession } from "next-auth"; // Deprecated
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Deprecated pattern

export default async function Page() {
  const session = await getServerSession(authOptions); // BAD
  // ...
}
```

**Why bad:** `getServerSession` is deprecated in v5, `authOptions` export pattern is v4, should use `auth()` from `@/auth`

---

## Pattern 4: Session Update (Refreshing Client Session)

### Good Example - Updating Session After Profile Change

```typescript
// components/profile-form.tsx
"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

export function ProfileForm() {
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Update in database via Server Action
    await updateProfile(new FormData(e.target as HTMLFormElement));

    // Refresh the client session to reflect changes
    await update({ name });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit">Save</button>
    </form>
  );
}
```

**Why good:** `update()` refreshes client session after server-side change, no full page reload needed, optimistic UI with local state

---

_See [middleware.md](middleware.md) for route protection patterns and [database.md](database.md) for adapter setup._
