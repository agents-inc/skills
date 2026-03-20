# React Router -- Layouts & Auth Guards

> Nested layouts with Outlet, useOutletContext, auth guard patterns, and protected route strategies. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Core Setup & Route Config](core.md) -- root layout, route config
- [Data Loading & Actions](data-loading.md) -- loaders, redirect in actions
- [Navigation & Search Params](navigation.md) -- redirect, NavLink active states
- [Error Handling & Code Splitting](error-handling.md) -- error boundaries in layouts

---

## Basic Nested Layout

Parent routes render `<Outlet />` where child routes appear. The parent layout persists across child navigations.

```typescript
import { Outlet, NavLink, useNavigation } from "react-router";

function DashboardLayout() {
  const navigation = useNavigation();

  return (
    <div className="dashboard">
      <aside>
        <nav>
          <NavLink to="/dashboard" end>Overview</NavLink>
          <NavLink to="/dashboard/analytics">Analytics</NavLink>
          <NavLink to="/dashboard/settings">Settings</NavLink>
        </nav>
      </aside>
      <main>
        {navigation.state === "loading" && <div className="loading-bar" />}
        <Outlet />
      </main>
    </div>
  );
}
```

```typescript
// Route config
{
  path: "dashboard",
  element: <DashboardLayout />,
  children: [
    { index: true, element: <DashboardOverview /> },
    { path: "analytics", element: <AnalyticsPage />, loader: analyticsLoader },
    { path: "settings", element: <SettingsPage />, loader: settingsLoader },
  ],
}
```

**Why:** Navigating between `/dashboard/analytics` and `/dashboard/settings` does not unmount `DashboardLayout`. Only the `<Outlet />` content changes. The sidebar, navigation state, and any parent state persist.

---

## Passing Data to Children with useOutletContext

```typescript
import { Outlet, useOutletContext } from "react-router";
import type { ReactNode } from "react";

interface DashboardContext {
  user: User;
  permissions: string[];
}

function DashboardLayout() {
  const { user } = useLoaderData() as { user: User };
  const permissions = user.roles.flatMap((r) => r.permissions);

  return (
    <div className="dashboard">
      <header>Welcome, {user.name}</header>
      <Outlet context={{ user, permissions } satisfies DashboardContext} />
    </div>
  );
}

// Child route component
function AnalyticsPage() {
  const { user, permissions } = useOutletContext<DashboardContext>();

  if (!permissions.includes("view:analytics")) {
    return <p>You do not have permission to view analytics.</p>;
  }

  return <div>Analytics for {user.name}</div>;
}
```

**Why:** `<Outlet context={...} />` passes data down to the rendered child route. `useOutletContext<T>()` provides type-safe access. Avoids prop drilling through route config. The context only flows one level — grandchild routes need their own `<Outlet context>`.

---

## Pathless Layout Route (Shared UI Without URL Segment)

Pathless routes wrap children without adding a URL segment. Useful for auth guards or visual grouping.

```typescript
// Route config
{
  path: "/",
  element: <RootLayout />,
  errorElement: <RootError />,
  children: [
    { index: true, element: <HomePage /> },
    { path: "login", element: <LoginPage />, action: loginAction },

    // Pathless layout — no 'path' property
    {
      element: <AuthenticatedLayout />,
      loader: authGuardLoader,
      errorElement: <AuthError />,
      children: [
        { path: "dashboard", element: <DashboardPage />, loader: dashboardLoader },
        { path: "settings", element: <SettingsPage /> },
        { path: "profile", element: <ProfilePage />, loader: profileLoader },
      ],
    },
  ],
}
```

```typescript
// The auth guard loader
import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export async function authGuardLoader({ request }: LoaderFunctionArgs) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/login?returnTo=${encodeURIComponent(url.pathname)}`);
  }
  return { user };
}

// The layout component
function AuthenticatedLayout() {
  const { user } = useLoaderData() as { user: User };

  return (
    <div className="authenticated">
      <header>
        <span>Logged in as {user.name}</span>
      </header>
      <Outlet context={{ user }} />
    </div>
  );
}
```

**Why:** No `path` on the route means it does not add a URL segment. `/dashboard` goes through `RootLayout` -> `AuthenticatedLayout` -> `DashboardPage`. The `authGuardLoader` runs before ANY child loader — if it redirects, no child data loads. Single auth check protects all children.

---

## Login Page with Return-To Redirect

```typescript
import { Form, useActionData, useSearchParams, useNavigation } from "react-router";
import { redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";

const DEFAULT_REDIRECT = "/dashboard";

export async function loginAction({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const user = await authenticateUser(email, password);
  if (!user) {
    return { error: "Invalid email or password" };
  }

  // Redirect to the originally requested page
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") ?? DEFAULT_REDIRECT;
  throw redirect(returnTo);
}

export function LoginPage() {
  const actionData = useActionData() as { error?: string } | undefined;
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const returnTo = searchParams.get("returnTo") ?? DEFAULT_REDIRECT;

  return (
    <Form method="POST">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required />
      </div>
      {actionData?.error && <p className="error">{actionData.error}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign In"}
      </button>
    </Form>
  );
}
```

**Why:** `returnTo` search param preserves the user's intended destination through the login flow. The auth guard sets it when redirecting to login. The login action reads it and redirects back after successful auth. Default fallback ensures login works even without a `returnTo` param.

---

## Multiple Nested Layouts

Layouts can be nested multiple levels deep. Each level adds shared UI.

```typescript
// Route config
{
  path: "/",
  element: <AppLayout />,           // Level 1: header, footer
  children: [
    { index: true, element: <Home /> },
    {
      element: <AuthLayout />,       // Level 2: auth guard (pathless)
      loader: authGuardLoader,
      children: [
        {
          path: "dashboard",
          element: <DashboardLayout />,  // Level 3: sidebar nav
          children: [
            { index: true, element: <DashboardHome /> },
            { path: "analytics", element: <Analytics />, loader: analyticsLoader },
            {
              path: "reports",
              element: <ReportsLayout />,   // Level 4: tabs
              children: [
                { index: true, element: <ReportsSummary /> },
                { path: "monthly", element: <MonthlyReport /> },
                { path: "annual", element: <AnnualReport /> },
              ],
            },
          ],
        },
      ],
    },
  ],
}
```

**Why:** Each layout level adds its own `<Outlet />`. Component tree for `/dashboard/reports/monthly`: `AppLayout` > `AuthLayout` > `DashboardLayout` > `ReportsLayout` > `MonthlyReport`. Navigating between tabs only re-renders `MonthlyReport`/`AnnualReport` — everything above persists.

---

## useBlocker: Unsaved Changes Guard

```typescript
import { useBlocker } from "react-router";
import { useState } from "react";

function EditForm() {
  const [isDirty, setIsDirty] = useState(false);
  const blocker = useBlocker(isDirty);

  return (
    <div>
      <form onChange={() => setIsDirty(true)}>
        <input name="title" />
        <textarea name="body" />
        <button type="submit" onClick={() => setIsDirty(false)}>
          Save
        </button>
      </form>

      {blocker.state === "blocked" && (
        <dialog open>
          <p>You have unsaved changes. Leave anyway?</p>
          <button type="button" onClick={() => blocker.proceed()}>
            Leave
          </button>
          <button type="button" onClick={() => blocker.reset()}>
            Stay
          </button>
        </dialog>
      )}
    </div>
  );
}
```

**Why:** `useBlocker(shouldBlock)` intercepts navigations when `shouldBlock` is `true`. `blocker.state` is `"blocked"` when a navigation was intercepted. `blocker.proceed()` allows the navigation. `blocker.reset()` cancels it and stays on the page.

---

## BAD: Auth Check in Component Render

```typescript
// BAD: Component renders briefly before redirect
function DashboardPage() {
  const user = useUser(); // Hook that checks auth

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <div>Dashboard for {user.name}</div>;
}
```

**Why bad:** The component mounts and renders (briefly showing dashboard content or a flash) before the `<Navigate>` triggers a redirect. Loaders in child routes may have already fired with an unauthenticated user. Use a pathless layout with a loader that throws `redirect()` — the component never mounts if the user is not authenticated.

---

## BAD: Forgetting Outlet in Layout

```typescript
// BAD: Child routes render nothing
function DashboardLayout() {
  return (
    <div className="dashboard">
      <nav>{/* sidebar */}</nav>
      <main>
        {/* Forgot <Outlet /> — children render nowhere */}
      </main>
    </div>
  );
}
```

**Why bad:** Without `<Outlet />`, matched child routes have nowhere to render. No error is thrown — the child content simply does not appear. This is one of the most common and confusing React Router bugs.
