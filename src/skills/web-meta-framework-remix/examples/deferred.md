# Remix - Defer and Streaming Examples

> Patterns for streaming non-critical data with defer and Await.

---

## Dashboard with Deferred Analytics

```typescript
// app/routes/dashboard.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { defer } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);

  // Critical data - must wait
  const user = await db.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Non-critical data - stream these
  const analyticsPromise = getAnalyticsData(user.id);
  const notificationsPromise = getNotifications(user.id);
  const recentOrdersPromise = getRecentOrders(user.id);

  return defer({
    user,
    analytics: analyticsPromise,
    notifications: notificationsPromise,
    recentOrders: recentOrdersPromise,
  });
}

export default function Dashboard() {
  const { user, analytics, notifications, recentOrders } =
    useLoaderData<typeof loader>();

  return (
    <div>
      <header>
        <h1>Welcome back, {user.name}</h1>
      </header>

      <div>
        <section>
          <h2>Analytics</h2>
          <Suspense fallback={<AnalyticsSkeleton />}>
            <Await
              resolve={analytics}
              errorElement={<p>Failed to load analytics</p>}
            >
              {(data) => <AnalyticsChart data={data} />}
            </Await>
          </Suspense>
        </section>

        <section>
          <h2>Notifications</h2>
          <Suspense fallback={<NotificationsSkeleton />}>
            <Await
              resolve={notifications}
              errorElement={<p>Failed to load notifications</p>}
            >
              {(items) => <NotificationsList items={items} />}
            </Await>
          </Suspense>
        </section>

        <section>
          <h2>Recent Orders</h2>
          <Suspense fallback={<OrdersSkeleton />}>
            <Await
              resolve={recentOrders}
              errorElement={<p>Failed to load orders</p>}
            >
              {(orders) => <OrdersTable orders={orders} />}
            </Await>
          </Suspense>
        </section>
      </div>
    </div>
  );
}
```

**Why good:** User data loads immediately (critical), analytics/notifications/orders stream in parallel, skeleton loading states, error handling per section, page is interactive before all data loads

---

## Key Concepts

### When to Use Defer

| Use Case            | Await? | Reason                             |
| ------------------- | ------ | ---------------------------------- |
| User authentication | No     | Critical for page rendering        |
| Main content data   | No     | User expects to see it immediately |
| Analytics widgets   | Yes    | Not essential for core UX          |
| Notifications       | Yes    | Secondary information              |
| Recommendations     | Yes    | Nice to have, not blocking         |

### Defer Pattern Structure

```typescript
// Always await critical data
const criticalData = await getCriticalData();

// Pass promises (not awaited) for non-critical data
const nonCriticalPromise = getNonCriticalData();

return defer({
  critical: criticalData, // Resolved value
  nonCritical: nonCriticalPromise, // Promise
});
```

### Await Component Props

```typescript
<Await
  resolve={promise}              // The promise to wait for
  errorElement={<Error />}       // Shown if promise rejects
>
  {(data) => <Component data={data} />}
</Await>
```
