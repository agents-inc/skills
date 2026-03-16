# Advanced Auth Patterns

> Code examples for role-based access, magic links, account linking, and custom sign-in pages. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Role-Based Access Control

### Good Example - RBAC with Auth.js

```typescript
// lib/auth-utils.ts
import { auth } from "@/auth";
import { redirect } from "next/navigation";

type Role = "admin" | "editor" | "user";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(requiredRole: Role) {
  const session = await requireAuth();

  const ROLE_HIERARCHY: Record<Role, number> = {
    admin: 3,
    editor: 2,
    user: 1,
  };

  const userLevel = ROLE_HIERARCHY[session.user.role as Role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  if (userLevel < requiredLevel) {
    redirect("/unauthorized");
  }

  return session;
}
```

```typescript
// app/admin/users/page.tsx
import { requireRole } from "@/lib/auth-utils";

export default async function AdminUsersPage() {
  const session = await requireRole("admin");

  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <div>
      <h1>User Management</h1>
      <p>Logged in as: {session.user.name} ({session.user.role})</p>
      <table>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th></tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Why good:** Reusable auth helpers, role hierarchy allows admins to access editor pages too, named constant for hierarchy, redirect on insufficient permissions

---

## Pattern 2: Custom Sign-In Page

### Good Example - Branded Login Page

```typescript
// auth.ts
export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    GitHub,
    Google,
    Credentials({
      /* ... */
    }),
  ],
  pages: {
    signIn: "/login", // Custom login page
    error: "/login/error", // Custom error page
  },
});
```

```typescript
// app/login/page.tsx
import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;

  // Already logged in - redirect to callback or dashboard
  if (session?.user) {
    redirect(callbackUrl ?? "/dashboard");
  }

  return (
    <div className="login-container">
      <h1>Sign In</h1>

      {error && (
        <div className="error-banner" role="alert">
          {error === "OAuthAccountNotLinked"
            ? "This email is already associated with another provider."
            : "An error occurred during sign in."}
        </div>
      )}

      {/* OAuth providers */}
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: callbackUrl ?? "/dashboard" });
        }}
      >
        <button type="submit">Continue with GitHub</button>
      </form>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: callbackUrl ?? "/dashboard" });
        }}
      >
        <button type="submit">Continue with Google</button>
      </form>

      {/* Credentials form */}
      <form
        action={async (formData: FormData) => {
          "use server";
          await signIn("credentials", {
            email: formData.get("email"),
            password: formData.get("password"),
            redirectTo: callbackUrl ?? "/dashboard",
          });
        }}
      >
        <input type="email" name="email" placeholder="Email" required />
        <input type="password" name="password" placeholder="Password" required />
        <button type="submit">Sign in with Email</button>
      </form>
    </div>
  );
}
```

**Why good:** Redirects already-authenticated users, preserves callback URL, handles OAuth error codes, Server Actions for each provider, progressive enhancement

---

## Pattern 3: Account Linking

### Good Example - Controlled Account Linking

```typescript
// auth.ts
export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [GitHub, Google],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Check if email already exists with a different provider
      if (account?.provider && user.email) {
        const existingUser = await db.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        });

        if (existingUser) {
          const hasProvider = existingUser.accounts.some(
            (a) => a.provider === account.provider,
          );

          if (!hasProvider) {
            // Link the new provider to existing account
            // Auth.js handles this automatically with allowDangerousEmailAccountLinking
            // But you may want custom logic here
          }
        }
      }
      return true;
    },
  },
  // Enable automatic linking for same-email accounts
  // WARNING: Only enable if you trust ALL your OAuth providers to verify emails
  // allowDangerousEmailAccountLinking: true,
});
```

**Why good:** Explicit check for existing accounts, documented security implications, automatic linking commented out with warning

---

## Pattern 4: Session-Based Guards for Components

### Good Example - Conditional UI Based on Auth Status

```typescript
// components/auth-guard.tsx
import { auth } from "@/auth";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredRole?: string;
}

export async function AuthGuard({
  children,
  fallback = null,
  requiredRole,
}: AuthGuardProps) {
  const session = await auth();

  if (!session?.user) {
    return <>{fallback}</>;
  }

  if (requiredRole && session.user.role !== requiredRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

```typescript
// app/page.tsx
import { AuthGuard } from "@/components/auth-guard";

export default function HomePage() {
  return (
    <div>
      <h1>Welcome</h1>

      <AuthGuard fallback={<p>Sign in to see your dashboard</p>}>
        <DashboardWidget />
      </AuthGuard>

      <AuthGuard requiredRole="admin">
        <AdminPanel />
      </AuthGuard>
    </div>
  );
}
```

**Why good:** Reusable Server Component guard, optional role check, fallback content for unauthenticated users, composable

---

## Pattern 5: Rate Limiting Sign-In

### Good Example - Rate Limiting Credentials Provider

```typescript
// lib/rate-limit.ts
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = attempts.get(identifier);

  if (!entry || now > entry.resetTime) {
    attempts.set(identifier, { count: 1, resetTime: now + WINDOW_MS });
    return true; // Allowed
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false; // Rate limited
  }

  entry.count++;
  return true; // Allowed
}
```

```typescript
// auth.ts
import { checkRateLimit } from "@/lib/rate-limit";

Credentials({
  async authorize(credentials) {
    const email = credentials.email as string;

    // Rate limit by email address
    if (!checkRateLimit(email)) {
      return null; // Silently reject (don't reveal rate limiting)
    }

    // ... normal auth logic
  },
});
```

**Why good:** Named constants for window and max attempts, per-email rate limiting, silent rejection (doesn't tell attacker they're rate limited), simple in-memory store (use Redis in production)

---

_See [core.md](core.md) for basic configuration and [session.md](session.md) for session strategies._
