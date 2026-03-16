# Database Adapters

> Code examples for Auth.js database adapters - Prisma, Drizzle, session storage. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Prisma Adapter

### Good Example - Full Prisma Setup

```typescript
// auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [GitHub],
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      // With database sessions, `user` (not `token`) is available
      session.user.id = user.id;
      session.user.role = user.role;
      return session;
    },
  },
});
```

Auth.js requires four models in your schema: **User**, **Account**, **Session**, **VerificationToken**. See the [official Prisma adapter docs](https://authjs.dev/getting-started/adapters/prisma) for the complete schema. Key points:

- `Account` has `@@unique([provider, providerAccountId])` composite key
- `Session` has `sessionToken @unique` and `expires` field
- `VerificationToken` has `@@unique([identifier, token])` composite key
- All relations should use `onDelete: Cascade`
- Add custom fields (e.g., `role`) to User model, then expose via session callback

**Why good:** Session callback uses `user` (not `token`) for database strategy, cascade deletes clean up related records

---

## Pattern 2: Drizzle Adapter

### Good Example - Drizzle ORM with PostgreSQL

```typescript
// auth.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [GitHub],
  session: { strategy: "database" },
});
```

The same four models (users, accounts, sessions, verificationTokens) are required. See the [official Drizzle adapter docs](https://authjs.dev/getting-started/adapters/drizzle) for the complete schema. Key points:

- Import `AdapterAccountType` from `next-auth/adapters` for typed `account.type` field
- Use `primaryKey({ columns: [account.provider, account.providerAccountId] })` composite key
- Use `onDelete: "cascade"` on all foreign key references
- Use `timestamp("emailVerified", { mode: "date" })` for proper Date handling

**Why good:** Drizzle schema matches Auth.js model requirements, cascade deletes for data integrity, typed account type from Auth.js adapters

---

## Pattern 3: Email Provider with Database

### Good Example - Magic Link Authentication

```typescript
// auth.ts
import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma), // Required for email provider
  providers: [
    Resend({
      // Auto-detects AUTH_RESEND_KEY
      from: "noreply@example.com",
    }),
  ],
});
```

**Why good:** Email provider requires database adapter (stores verification tokens), Resend auto-detects API key, minimal configuration needed

### Bad Example - Email Provider Without Adapter

```typescript
// BAD: Email provider needs a database adapter
export const { auth } = NextAuth({
  providers: [Resend({ from: "noreply@example.com" })],
  // Missing adapter - verification tokens can't be stored
});
```

**Why bad:** Email provider stores verification tokens in database; without adapter, magic links can't be verified

---

## Pattern 4: Custom User Fields

### Good Example - Extending User Model

Add custom fields directly to your User model (e.g., `role`, `bio`, `onboardingComplete`), then expose them via the session callback:

```typescript
// auth.ts - Expose custom fields in session
export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [GitHub],
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      // `user` is the full database User object
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.onboardingComplete = user.onboardingComplete;
      return session;
    },
  },
});
```

```typescript
// types/next-auth.d.ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      onboardingComplete: boolean;
    } & DefaultSession["user"];
  }
}
```

**Why good:** Custom fields on User model, exposed via session callback, TypeScript types updated for type safety, database strategy gives access to full `user` object

---

_See [patterns.md](patterns.md) for role-based access and account linking patterns._
