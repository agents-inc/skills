# Next.js App Router — Routing, Layouts and Errors

> File conventions, dynamic routes, layouts, error handling and server-only code. The Server/Client
> boundary and streaming live in [server-components.md](server-components.md); see also
> [metadata.md](metadata.md), [parallel-routes.md](parallel-routes.md) and
> [route-groups.md](route-groups.md).

---

## Pattern 1: Dynamic Segments

### Single parameter

```tsx
// app/users/[id]/page.tsx
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UserPage({ params }: PageProps) {
  const { id } = await params;
  return <h1>User: {id}</h1>;
}
```

### Catch-all

```tsx
// app/docs/[...slug]/page.tsx — matches /docs/a, /docs/a/b, /docs/a/b/c
interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function DocsPage({ params }: PageProps) {
  const { slug } = await params; // ["a", "b", "c"]
  return <h1>Docs: {slug.join("/")}</h1>;
}
```

### Optional catch-all

```tsx
// app/shop/[[...slug]]/page.tsx — matches /shop as well as /shop/a/b
interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function ShopPage({ params }: PageProps) {
  const { slug } = await params; // undefined for /shop
  return <h1>Shop: {slug?.join("/") ?? "All Products"}</h1>;
}
```

**Why good:** One extra bracket pair turns a required segment into an optional one, and `params` is
typed from the folder name.

### Pre-rendering the known values

```tsx
// app/blog/[slug]/page.tsx
import { getAllPosts } from "../../../lib/data";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}
```

**Why good:** Every listed slug is built as static HTML; anything not listed still renders on demand.

---

## Pattern 2: Layouts

### Dashboard layout with preserved navigation

```tsx
// app/dashboard/layout.tsx
import { DashboardNav } from "./dashboard-nav";
import { UserMenu } from "./user-menu";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar persists across every dashboard page */}
      <aside className="w-64 p-4">
        <DashboardNav />
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b px-6 flex items-center justify-end">
          <UserMenu />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

```tsx
// app/dashboard/dashboard-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? "font-semibold" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

**Why good:** Only `{children}` changes on navigation, so the sidebar keeps its scroll position and
the user menu keeps its state. `template.tsx` is the opposite choice — it remounts on every
navigation.

---

## Pattern 3: Error Handling

### Segment error boundary

```tsx
// app/dashboard/invoices/error.tsx
"use client"; // required — reset needs a client boundary

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function InvoicesError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Report to whatever error service the app uses
    console.error("Invoices error:", error);
  }, [error]);

  return (
    <div role="alert" className="p-6 text-center">
      <h2>Failed to load invoices</h2>
      <p>{error.message || "An unexpected error occurred"}</p>
      <button onClick={reset}>Try again</button>
      {error.digest && <p>Error ID: {error.digest}</p>}
    </div>
  );
}
```

**Why good:** The error is contained to the invoices segment, so the rest of the dashboard still
works. `reset` retries without a page reload, and `digest` is the server-side reference to quote in a
support ticket.

### Global error handler

```tsx
// app/global-error.tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
```

**Why good:** It replaces the root layout when it fires, which is why it has to render its own
`<html>` and `<body>`.

### Not found

```tsx
// app/dashboard/invoices/[id]/page.tsx
import { notFound } from "next/navigation";
import { getInvoice } from "../../../../lib/data";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) {
    notFound(); // renders the nearest not-found.tsx and returns a 404 status
  }

  return <h1>Invoice #{invoice.number}</h1>;
}
```

```tsx
// app/dashboard/invoices/[id]/not-found.tsx
import Link from "next/link";

export default function InvoiceNotFound() {
  return (
    <div className="text-center p-6">
      <h2>Invoice Not Found</h2>
      <Link href="/dashboard/invoices">Back to Invoices</Link>
    </div>
  );
}
```

**Why good:** The 404 is specific to the invoice context and offers a way back, and the HTTP status
is correct for crawlers.

---

## Pattern 4: Server-Only Code Protection

```tsx
// lib/data.ts
import "server-only"; // any client import of this module fails the build

// Safe to read here, and only here — this module cannot reach the browser
const db = connectToDatabase(process.env.DATABASE_SECRET);

export async function getUsers() {
  return db.listUsers();
}
```

```tsx
// app/users/page.tsx — a Server Component, so the import is allowed
import { getUsers } from "../lib/data";

export default async function UsersPage() {
  const users = await getUsers();
  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

```tsx
// components/user-search.tsx
"use client";

// import { getUsers } from "../lib/data";  ← build error: "server-only" module
// Reach the data through a Route Handler or a Server Action instead.

export function UserSearch() {
  const handleSearch = async (query: string) => {
    await fetch(`/api/users/search?q=${query}`);
  };

  return <input onChange={(e) => handleSearch(e.target.value)} />;
}
```

**Why good:** The guarantee is enforced at build time rather than by review, so a secret cannot reach
the client bundle by an import someone forgot to check.

---

_The Server/Client boundary and streaming are in [server-components.md](server-components.md)._
