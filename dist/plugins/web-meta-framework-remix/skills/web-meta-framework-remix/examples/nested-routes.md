# Remix — Nested Routes

> Layouts, index routes and pathless routes. The naming table is in [SKILL.md](../SKILL.md).

---

## Admin Layout with Protected Nested Routes

```typescript
// app/routes/admin.tsx (layout)
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, NavLink, Outlet, useLoaderData } from "@remix-run/react";

const HTTP_FORBIDDEN = 403;

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);

  if (!session.userId) {
    return redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, role: true },
  });

  if (user?.role !== "admin") {
    throw new Response("Forbidden", { status: HTTP_FORBIDDEN });
  }

  return json({ user });
}

export default function AdminLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div>
      <header>
        <h1>Admin Dashboard</h1>
        <span>Logged in as {user.name}</span>
      </header>

      <nav aria-label="Admin navigation">
        <NavLink
          to="/admin"
          end
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Overview
        </NavLink>
        <NavLink
          to="/admin/users"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Users
        </NavLink>
        <NavLink
          to="/admin/orders"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Orders
        </NavLink>
        <NavLink
          to="/admin/products"
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          Products
        </NavLink>
      </nav>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

**Why good:** The auth check lives in the layout's loader, so every route under `/admin` is protected
by existing — a new child route is guarded before anyone remembers to guard it.

---

## Admin Index Route

```typescript
// app/routes/admin._index.tsx (overview - renders at /admin)
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  // Runs in parallel with parent loader
  const [userCount, orderCount, revenue] = await Promise.all([
    db.user.count(),
    db.order.count({ where: { createdAt: { gte: startOfMonth() } } }),
    db.order.aggregate({
      where: { createdAt: { gte: startOfMonth() } },
      _sum: { total: true },
    }),
  ]);

  return json({
    userCount,
    orderCount,
    revenue: revenue._sum.total || 0,
  });
}

export default function AdminOverview() {
  const { userCount, orderCount, revenue } = useLoaderData<typeof loader>();

  return (
    <div>
      <h2>Overview</h2>
      <div>
        <div>
          <h3>Total Users</h3>
          <p>{userCount.toLocaleString()}</p>
        </div>
        <div>
          <h3>Orders This Month</h3>
          <p>{orderCount.toLocaleString()}</p>
        </div>
        <div>
          <h3>Revenue This Month</h3>
          <p>${(revenue / 100).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
```

**Why good:** This loader and the layout's run at the same time rather than one after the other, so
nesting costs no extra latency — which is the property that makes deep route trees viable.

---

## Pathless Layout Route

```typescript
// app/routes/_auth.tsx (pathless layout - note leading underscore)
import { Outlet } from "@remix-run/react";

export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-sidebar">
        <img src="/logo.svg" alt="Company logo" />
        <h2>Welcome to MyApp</h2>
      </div>
      <div className="auth-content">
        <Outlet />
      </div>
    </div>
  );
}

// app/routes/_auth.login.tsx (renders at /login, NOT /_auth/login)
import { Form } from "@remix-run/react";

export default function Login() {
  return (
    <Form method="post">
      <h1>Log In</h1>
      {/* form fields */}
    </Form>
  );
}

// app/routes/_auth.signup.tsx (renders at /signup)
export default function Signup() {
  return (
    <Form method="post">
      <h1>Sign Up</h1>
      {/* form fields */}
    </Form>
  );
}
```

**Why good:** Login and signup share a layout without sharing a URL prefix — the reader gets `/login`
rather than `/auth/login`, and the two files still cannot drift apart visually.

---

## The Two Underscores

Both characters change nesting, in opposite directions.

```
app/routes/
├── _auth.tsx              # leading _ : contributes a layout but no URL segment
├── _auth.login.tsx        # /login, wrapped in _auth.tsx
├── admin.tsx              # /admin layout
├── admin.users.tsx        # /admin/users, wrapped in admin.tsx
└── admin_.settings.tsx    # trailing _ : /admin/settings, NOT wrapped in admin.tsx
```

A trailing underscore is the escape hatch for a route that belongs to a URL hierarchy but not to its
layout — a full-screen settings page under `/admin`, say, that should not carry the admin chrome.
Note what it also escapes: the parent's loader, and therefore the parent's auth check.

The full naming table is in [SKILL.md](../SKILL.md).
