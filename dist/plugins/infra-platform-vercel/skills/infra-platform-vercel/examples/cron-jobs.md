# Vercel -- Cron Jobs & Scheduling Examples

> Cron job configuration and handler patterns for Vercel. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Core Configuration & Functions](core.md) -- vercel.json, functions, runtime selection
- [Routing & Middleware](routing.md) -- Headers, redirects, rewrites
- [Monorepo & Advanced](monorepo.md) -- Monorepo and advanced config

---

## Cron Configuration in vercel.json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/sync",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

### Cron Expression Reference

```
*    *    *    *    *
|    |    |    |    |
|    |    |    |    +--- Day of week (0-6, Sun=0)
|    |    |    +-------- Month (1-12)
|    |    +------------- Day of month (1-31)
|    +------------------ Hour (0-23, UTC)
+----------------------- Minute (0-59)
```

| Expression     | Meaning                                  |
| -------------- | ---------------------------------------- |
| `* * * * *`    | Every minute                             |
| `*/15 * * * *` | Every 15 minutes                         |
| `0 * * * *`    | Every hour                               |
| `0 2 * * *`    | Daily at 2:00 AM UTC                     |
| `0 9 * * 1`    | Every Monday at 9:00 AM UTC              |
| `0 0 1 * *`    | First day of every month at midnight UTC |

---

## Secure Cron Handler

```typescript
// api/cron/cleanup.ts
export default {
  async fetch(request: Request) {
    // CRITICAL: Verify CRON_SECRET -- cron endpoints are public URLs
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Idempotent cleanup logic
    const result = await performCleanup();

    return Response.json({
      success: true,
      cleaned: result.deletedCount,
      timestamp: new Date().toISOString(),
    });
  },
};
```

**Why good:** Verifies `CRON_SECRET` before executing, returns structured response for observability, timestamp helps debug timing issues

```typescript
// BAD: No auth check
export default {
  async fetch(request: Request) {
    await deleteExpiredRecords(); // Anyone can trigger this!
    return Response.json({ success: true });
  },
};
```

**Why bad:** No CRON_SECRET verification, anyone who discovers the URL can trigger the cleanup, potential for abuse or data loss

---

## Setting Up CRON_SECRET

1. Generate a secure random value:

   ```bash
   openssl rand -base64 32
   ```

2. Add it as an environment variable in the Vercel dashboard:
   - Go to Project Settings > Environment Variables
   - Add `CRON_SECRET` with the generated value
   - Scope it to Production only (crons only run in production)

3. Vercel automatically sends the secret as `Authorization: Bearer <CRON_SECRET>` when invoking cron endpoints.

---

## Idempotent Handler Pattern

Vercel may deliver cron events more than once. Design handlers to produce the same result on repeated execution.

```typescript
// api/cron/process-pending.ts
const MAX_BATCH_SIZE = 100;

export default {
  async fetch(request: Request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Idempotent: only process items in "pending" state
    // If this runs twice, the second run finds no pending items
    const pending = await fetchPendingItems(MAX_BATCH_SIZE);

    if (pending.length === 0) {
      return Response.json({ processed: 0, message: "No pending items" });
    }

    const results = await Promise.allSettled(
      pending.map((item) => processItem(item)),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return Response.json({
      processed: succeeded,
      failed,
      total: pending.length,
    });
  },
};
```

**Why good:** Processes only "pending" items (idempotent -- second run is a no-op), batch size limit prevents timeout, `Promise.allSettled` handles partial failures, structured response for monitoring

---

## Plan Limits for Crons

| Plan       | Max Cron Jobs | Minimum Interval |
| ---------- | ------------- | ---------------- |
| Hobby      | 2             | Daily            |
| Pro        | 40            | Every minute     |
| Enterprise | 100+          | Every minute     |

**Key constraints:**

- Crons only execute on Production deployments (not Preview)
- All cron times are in UTC
- Vercel's event system may deliver events more than once
- Cron handlers are regular Vercel Functions -- same maxDuration limits apply
