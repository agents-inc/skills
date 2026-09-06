# Remix — Streaming

> Streaming non-critical data with `Suspense` and `Await`. On React Router v7, drop the `defer()`
> wrapper and return the Promises directly — see [react-router-v7.md](react-router-v7.md).

---

## Dashboard with Deferred Analytics

```typescript
// app/routes/dashboard.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { defer } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

const HTTP_UNAUTHORIZED = 401;

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);

  // Critical data - must wait
  const user = await db.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    throw new Response("Unauthorized", { status: HTTP_UNAUTHORIZED });
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

**Why good:** The page is interactive as soon as the user record resolves; the three slow queries race
each other behind it rather than queueing. `errorElement` per section means a failing analytics
service degrades one panel instead of taking the dashboard to the ErrorBoundary.

---

## The Shape

```typescript
const critical = await getCriticalData(); // resolved value — delays the first byte
const nonCritical = getNonCriticalData(); // Promise — streams in behind it

return defer({ critical, nonCritical });
```

```typescript
<Await
  resolve={promise}          // what to wait for
  errorElement={<Error />}   // what to render if it rejects
>
  {(data) => <Component data={data} />}
</Await>
```

Await authentication state, the page title, the main content and anything a crawler reads. Stream
analytics, notifications and recommendations. The test is whether the page is worth looking at
without it.
