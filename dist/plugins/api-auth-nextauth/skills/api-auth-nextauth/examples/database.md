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

```typescript
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  role          String    @default("user")

  accounts Account[]
  sessions Session[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
}
```

**Why good:** Standard Auth.js schema with all required models, Prisma singleton prevents connection exhaustion in dev, session callback uses `user` (not `token`) for database strategy, cascade deletes clean up related records

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

```typescript
// lib/db/schema.ts
import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  role: text("role").default("user").notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ],
);
```

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

```prisma
// prisma/schema.prisma - Custom fields on User
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?

  // Custom fields
  role          String    @default("user")
  bio           String?
  onboardingComplete Boolean @default(false)

  accounts Account[]
  sessions Session[]
}
```

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
