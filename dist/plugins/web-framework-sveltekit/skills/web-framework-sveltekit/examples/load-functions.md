# SvelteKit Load Functions Examples

> Complete code examples for SvelteKit load function patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Server Load with Database Access

### Good Example — Full Server Load Pattern

```typescript
// src/routes/products/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const PRODUCTS_PER_PAGE = 20;

export const load: PageServerLoad = async ({ url, locals }) => {
  const page = Number(url.searchParams.get('page') ?? '1');
  const category = url.searchParams.get('category');

  if (page < 1 || !Number.isInteger(page)) {
    error(400, 'Invalid page number');
  }

  const offset = (page - 1) * PRODUCTS_PER_PAGE;

  const where = category ? { category } : {};

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      take: PRODUCTS_PER_PAGE,
      skip: offset,
      orderBy: { name: 'asc' },
    }),
    db.product.count({ where }),
  ]);

  return {
    products,
    pagination: {
      page,
      totalPages: Math.ceil(total / PRODUCTS_PER_PAGE),
      total,
    },
    activeCategory: category,
  };
};
```

**Why good:** Named constant for page size, parallel queries with `Promise.all`, validation of page param, type-safe with `$types`

---

## Pattern 2: Universal Load with External API

### Good Example — Public API Fetch

```typescript
// src/routes/weather/[city]/+page.ts
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
  // SvelteKit's enhanced fetch:
  // - Works on server (SSR) and client (navigation)
  // - Auto-deduplicates identical requests
  // - Inherits cookies for same-origin requests
  const response = await fetch(
    `https://api.weather.com/v1/forecast?city=${encodeURIComponent(params.city)}`
  );

  if (!response.ok) {
    error(response.status, `Failed to load weather for ${params.city}`);
  }

  const forecast = await response.json();

  return { forecast, city: params.city };
};
```

**Why good:** Universal load runs on both server and client, `fetch` is SvelteKit's enhanced version, error handling with proper status codes

### Bad Example — Direct Fetch in Component

```svelte
<!-- BAD: Fetch in component effect -->
<script lang="ts">
  let forecast = $state(null);

  // BAD: Creates waterfall, runs after render
  $effect(() => {
    fetch('/api/weather?city=london')
      .then(r => r.json())
      .then(data => forecast = data);
  });
</script>
```

**Why bad:** Fetch happens after render (waterfall), no SSR, no error handling, no loading state management, no deduplication

---

## Pattern 3: Layout Load for Shared Data

### Good Example — Auth and Navigation Data

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user ?? null,
  };
};
```

```typescript
// src/routes/dashboard/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, '/login');
  }

  const [notifications, teams] = await Promise.all([
    db.notification.findMany({
      where: { userId: locals.user.id, read: false },
      take: 10,
    }),
    db.team.findMany({
      where: { members: { some: { userId: locals.user.id } } },
    }),
  ]);

  return {
    notifications,
    teams,
  };
};
```

```svelte
<!-- src/routes/dashboard/+layout.svelte -->
<script lang="ts">
  import type { LayoutProps } from './$types';

  let { data, children }: LayoutProps = $props();

  // data.user comes from root layout
  // data.notifications and data.teams come from this layout
</script>

<div class="dashboard">
  <aside>
    <p>Welcome, {data.user.name}</p>
    <span>{data.notifications.length} unread</span>

    <nav>
      {#each data.teams as team}
        <a href="/dashboard/team/{team.id}">{team.name}</a>
      {/each}
    </nav>
  </aside>

  <main>
    {@render children()}
  </main>
</div>
```

**Why good:** Root layout provides user data to all pages, dashboard layout adds auth check and dashboard-specific data, data cascades down to child pages, parallel fetching in dashboard layout

---

## Pattern 4: Streaming Promises

### Good Example — Fast and Slow Data

```typescript
// src/routes/dashboard/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  // FAST: Await critical data (blocks initial render)
  const user = await db.user.findUnique({
    where: { id: locals.user.id },
  });

  // SLOW: Don't await — stream these in
  const analyticsPromise = db.analytics.aggregate({
    where: { userId: locals.user.id },
    // Complex aggregation takes 2-3 seconds
  });

  const activityPromise = db.activity.findMany({
    where: { userId: locals.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return {
    user,                             // Available immediately
    analytics: analyticsPromise,      // Streams when ready
    activity: activityPromise,        // Streams when ready
  };
};
```

```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<!-- Renders immediately (user was awaited) -->
<h1>Welcome, {data.user.name}</h1>

<!-- Streams in when analytics resolves -->
{#await data.analytics}
  <div class="skeleton" aria-busy="true">Loading analytics...</div>
{:then analytics}
  <div class="analytics-panel">
    <p>Total views: {analytics.totalViews}</p>
    <p>Revenue: ${analytics.revenue.toFixed(2)}</p>
  </div>
{:catch error}
  <div class="error" role="alert">
    Failed to load analytics: {error.message}
  </div>
{/await}

<!-- Streams in when activity resolves -->
{#await data.activity}
  <div class="skeleton" aria-busy="true">Loading activity...</div>
{:then activity}
  <ul class="activity-feed">
    {#each activity as item}
      <li>{item.description} — {item.createdAt.toLocaleDateString()}</li>
    {/each}
  </ul>
{:catch error}
  <div class="error" role="alert">Failed to load activity</div>
{/await}
```

**Why good:** Critical data (user) renders immediately, slow data streams in progressively, each section has loading/error/success states, `{#await}` handles all three states

---

## Pattern 5: Using Parent Data

### Good Example — Child Page Using Layout Data

```typescript
// src/routes/dashboard/analytics/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals }) => {
  // Fetch independent data first (don't create waterfall)
  const chartData = await db.analytics.getChartData(locals.user.id);

  // Then access parent data if needed
  const { teams } = await parent();

  // Use parent data for additional queries
  const teamAnalytics = await Promise.all(
    teams.map(team =>
      db.analytics.getTeamSummary(team.id)
    )
  );

  return {
    chartData,
    teamAnalytics,
  };
};
```

**Why good:** Independent data fetched first (avoids waterfall), `parent()` called after independent fetch, type-safe access to layout data

### Bad Example — Waterfall with parent()

```typescript
// BAD: Calling parent() first blocks independent data
export const load: PageServerLoad = async ({ parent, locals }) => {
  const { teams } = await parent(); // Blocks until layout load finishes

  // This could have started in parallel!
  const chartData = await db.analytics.getChartData(locals.user.id);

  return { chartData, teams };
};
```

**Why bad:** `parent()` blocks until layout load completes, `chartData` fetch waits unnecessarily, creates a waterfall where parallel loading was possible

---

## Pattern 6: Data Invalidation

### Good Example — Manual Invalidation

```typescript
// src/routes/notifications/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, depends }) => {
  // Register custom dependency
  depends('app:notifications');

  const notifications = await db.notification.findMany({
    where: { userId: locals.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return { notifications };
};
```

```svelte
<!-- src/routes/notifications/+page.svelte -->
<script lang="ts">
  import { invalidate, invalidateAll } from '$app/navigation';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const REFRESH_INTERVAL_MS = 30_000;

  // Periodic refresh
  $effect(() => {
    const interval = setInterval(() => {
      invalidate('app:notifications');
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  });

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    // Rerun the load function
    invalidate('app:notifications');
  }
</script>

<h1>Notifications ({data.notifications.length})</h1>

<button onclick={markAllRead}>Mark all read</button>

{#each data.notifications as notification}
  <div class="notification">
    <p>{notification.message}</p>
  </div>
{/each}
```

**Why good:** `depends('app:notifications')` registers custom invalidation key, `invalidate()` reruns only matching load functions, periodic refresh with cleanup, named constant for interval

---

## Pattern 7: Using SvelteKit's Enhanced Fetch

### Good Example — Internal API Call from Load

```typescript
// src/routes/dashboard/+page.ts
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  // SvelteKit's fetch makes internal API calls efficient:
  // - On server: Calls handler directly (no HTTP round-trip)
  // - On client: Normal HTTP request
  // - Cookies are inherited automatically
  const response = await fetch('/api/stats');
  const stats = await response.json();

  return { stats };
};
```

**Why good:** SvelteKit's `fetch` calls internal routes directly on server (no HTTP overhead), cookies inherited automatically, works identically on server and client

---

_For form action patterns, see [form-actions.md](form-actions.md). For hooks, see [hooks.md](hooks.md)._
