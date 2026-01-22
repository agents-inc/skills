## Example Scaffolding Output

Here's what a complete, high-quality scaffolding looks like:

### Investigation Notes

```markdown
## Investigation: Scaffolding "dashboard" app

**Existing App Examined:** apps/web-app/

**Patterns Discovered:**

1. Directory structure follows Next.js App Router convention
2. All files use kebab-case naming
3. Drizzle schema uses snake_case with camelCase mapping
4. Better Auth configured in src/lib/auth/
5. Hono API in src/lib/api/ with OpenAPI decorators
6. PostHog in src/lib/analytics/ with client/server split
7. Environment validation in src/lib/env.ts using Zod

**@repo/\* Packages Used:**

- @repo/ui - shared UI components
- @repo/eslint-config - ESLint configuration
- @repo/typescript-config - TypeScript base config

**Conventions Noted:**

- Named exports only (no default exports)
- SCREAMING_SNAKE_CASE for constants
- All env vars validated with Zod
- Correlation IDs on all API requests
```

### Scaffolded Structure

```
apps/dashboard/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── signup/
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   ├── [...route]/
│   │   │   │   └── route.ts
│   │   │   └── auth/
│   │   │       └── [...all]/
│   │   │           └── route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   └── error-boundary.tsx
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── migrations/
│   │   ├── api/
│   │   │   ├── index.ts
│   │   │   └── routes/
│   │   │       └── health.ts
│   │   ├── analytics/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── logger.ts
│   │   └── env.ts
│   └── middleware.ts
├── public/
├── .env.example
├── drizzle.config.ts
├── next.config.js
├── package.json
├── postcss.config.js
└── tsconfig.json
```

### Key File Examples

**src/lib/env.ts:**

```typescript
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  NEXT_PUBLIC_POSTHOG_KEY: z.string(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
  SENTRY_DSN: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
```

**src/lib/db/schema.ts:**

```typescript
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
```

**src/lib/api/routes/health.ts:**

```typescript
import { createRoute, z } from "@hono/zod-openapi";

export const healthRoute = createRoute({
  method: "get",
  path: "/health",
  operationId: "getHealth",
  responses: {
    200: {
      description: "Health check response",
      content: {
        "application/json": {
          schema: z.object({
            status: z.literal("ok"),
            timestamp: z.string(),
          }),
        },
      },
    },
  },
});
```

### Handoff Document

```markdown
## Scaffolding Complete: dashboard

### Created Structure

[directory tree above]

### Environment Setup

1. Copy `.env.example` to `.env.local`
2. Fill in required values:
   - DATABASE_URL: Your Neon Postgres connection string
   - BETTER_AUTH_SECRET: Generate with `openssl rand -base64 32`
   - NEXT_PUBLIC_POSTHOG_KEY: From PostHog project settings
   - NEXT_PUBLIC_POSTHOG_HOST: https://app.posthog.com

### Commands

- `pnpm install` - Install dependencies
- `pnpm db:push` - Apply database schema
- `pnpm dev` - Start development server

### Next Steps

1. **Add features**: Invoke `pm` agent to create spec
2. **Write tests**: Invoke `tester` agent
3. **Implement**: Invoke `frontend-developer` or `backend-developer`
4. **Review**: Invoke `frontend-reviewer` or `backend-reviewer`

### Pattern References

- API routes: `src/lib/api/routes/health.ts`
- Database schema: `src/lib/db/schema.ts`
- Auth: `src/lib/auth/server.ts`
- Environment: `src/lib/env.ts`
- Analytics: `src/lib/analytics/client.ts`
- Logger: `src/lib/logger.ts`
```

This scaffolding:

- Investigated existing patterns first
- Created consistent directory structure
- Used correct naming conventions everywhere
- Documented all environment variables
- Provided clear handoff for feature development
- Referenced pattern files for future agents
