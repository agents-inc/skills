# Remix - Nested Routes Examples

> Patterns for layouts, pathless routes, and route nesting.

---

## Admin Layout with Protected Nested Routes

```typescript
// app/routes/admin.tsx (layout)
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, NavLink, Outlet, useLoaderData } from "@remix-run/react";

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
    throw new Response("Forbidden", { status: 403 });
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

**Why good:** Parent layout handles auth check (all children inherit protection), NavLink with isActive for current page styling, Outlet renders child routes

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

**Why good:** Child loaders run in parallel with parent, parallel database queries with Promise.all, index route renders at parent path with `_index` convention

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

**Why good:** Leading underscore makes layout pathless (no `/auth` in URL), login and signup share layout without URL prefix, clean URLs like `/login` instead of `/auth/login`

---

## File Structure Reference

### Nested Routes

```
app/routes/
├── admin.tsx              # Layout for /admin/* routes
├── admin._index.tsx       # Renders at /admin
├── admin.users.tsx        # Renders at /admin/users
├── admin.users.$id.tsx    # Renders at /admin/users/:id
└── admin_.settings.tsx    # Renders at /admin/settings WITHOUT admin layout (note the _)
```

### Pathless Layouts

```
app/routes/
├── _auth.tsx           # Pathless layout (no URL segment)
├── _auth.login.tsx     # /login (uses _auth layout)
├── _auth.signup.tsx    # /signup (uses _auth layout)
├── _auth.forgot.tsx    # /forgot (uses _auth layout)
└── dashboard.tsx       # /dashboard (does NOT use _auth layout)
```

### Key Conventions

| Pattern               | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `admin.tsx`           | Layout (has `<Outlet />`)                      |
| `admin._index.tsx`    | Index route (renders at parent URL)            |
| `admin.users.tsx`     | Nested child route                             |
| `admin_.settings.tsx` | Escapes parent layout with trailing underscore |
| `_auth.tsx`           | Pathless layout with leading underscore        |
