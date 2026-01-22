# Next.js App Router Examples

> Complete code examples for Next.js App Router patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Advanced patterns:** See [metadata.md](metadata.md), [parallel-routes.md](parallel-routes.md), and [route-groups.md](route-groups.md).

---

## Pattern 1: Server vs Client Components

### Good Example - Server Component with Data Fetching

```tsx
// app/products/page.tsx (Server Component - default)
import { getProducts } from "@/lib/data";
import { ProductCard } from "./product-card";

export default async function ProductsPage() {
  // Direct database/API access - no client JavaScript needed
  const products = await getProducts();

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

**Why good:** Data fetches on server with zero client-side JavaScript, no loading spinners or waterfalls, SEO-friendly with pre-rendered content

### Good Example - Client Component for Interactivity

```tsx
// app/products/product-card.tsx
"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="border rounded-lg p-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={product.image}
        alt={product.name}
        className={isHovered ? "scale-105" : "scale-100"}
      />
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </div>
  );
}
```

**Why good:** Only the interactive card is a Client Component, hover state handled client-side, parent Server Component does the data fetching

### Bad Example - Unnecessary Client Component

```tsx
// app/products/page.tsx
"use client"; // BAD: Entire page is client-side unnecessarily

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map((product) => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

**Why bad:** Ships unnecessary JavaScript to client, causes loading waterfall (HTML -> JS -> fetch -> render), poor SEO because content is client-rendered, no streaming benefits

---

## Pattern 2: Streaming and Suspense

### Good Example - Granular Streaming with Suspense

```tsx
// app/dashboard/page.tsx
import { Suspense } from "react";
import { RevenueChart } from "./revenue-chart";
import { LatestInvoices } from "./latest-invoices";
import { CardsSkeleton, ChartSkeleton, InvoicesSkeleton } from "./skeletons";

export default function DashboardPage() {
  return (
    <main>
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      {/* Stats cards stream first (usually fast) */}
      <Suspense fallback={<CardsSkeleton />}>
        <StatsCards />
      </Suspense>

      <div className="grid grid-cols-2 gap-6 mt-6">
        {/* Chart and invoices stream independently */}
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChart />
        </Suspense>

        <Suspense fallback={<InvoicesSkeleton />}>
          <LatestInvoices />
        </Suspense>
      </div>
    </main>
  );
}
```

```tsx
// app/dashboard/revenue-chart.tsx
import { getRevenue } from "@/lib/data";

export async function RevenueChart() {
  // This can be slow - doesn't block other sections
  const revenue = await getRevenue();

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-lg font-semibold">Revenue</h2>
      {/* Chart implementation */}
    </div>
  );
}
```

```tsx
// app/dashboard/skeletons.tsx
export function CardsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return <div className="h-64 bg-gray-200 animate-pulse rounded-lg" />;
}

export function InvoicesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-12 bg-gray-200 animate-pulse rounded" />
      ))}
    </div>
  );
}
```

**Why good:** Each section streams independently - slow queries don't block fast ones, users see content progressively, skeleton states provide immediate feedback

### Good Example - Route-Level Loading State

```tsx
// app/dashboard/loading.tsx
import { CardsSkeleton, ChartSkeleton, InvoicesSkeleton } from "./skeletons";

export default function DashboardLoading() {
  return (
    <main>
      <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-8" />
      <CardsSkeleton />
      <div className="grid grid-cols-2 gap-6 mt-6">
        <ChartSkeleton />
        <InvoicesSkeleton />
      </div>
    </main>
  );
}
```

**Why good:** Automatic Suspense boundary for entire route, consistent loading experience, no manual Suspense setup needed at route level

---

## Pattern 3: Layouts

### Good Example - Dashboard Layout with Preserved Navigation

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
      {/* Sidebar navigation - persists across all dashboard pages */}
      <aside className="w-64 bg-gray-900 text-white p-4">
        <DashboardNav />
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Header with user menu */}
        <header className="h-16 border-b px-6 flex items-center justify-end">
          <UserMenu />
        </header>

        {/* Page content changes, layout persists */}
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
  { href: "/dashboard/customers", label: "Customers" },
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
          className={`block px-4 py-2 rounded ${
            pathname === item.href ? "bg-blue-600" : "hover:bg-gray-800"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

**Why good:** Layout persists when navigating between dashboard pages, sidebar doesn't re-render, user menu state preserved, only `{children}` changes

---

## Pattern 4: Error Handling

### Good Example - Segment Error Boundary

```tsx
// app/dashboard/invoices/error.tsx
"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function InvoicesError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to error reporting service
    console.error("Invoices error:", error);
  }, [error]);

  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-semibold text-red-600">
        Failed to load invoices
      </h2>
      <p className="text-gray-600 mt-2">
        {error.message || "An unexpected error occurred"}
      </p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Try again
      </button>
      {error.digest && (
        <p className="text-sm text-gray-400 mt-2">Error ID: {error.digest}</p>
      )}
    </div>
  );
}
```

**Why good:** Error isolated to invoices section (rest of dashboard works), reset allows retry without page reload, digest helps support debugging

### Good Example - Not Found with notFound()

```tsx
// app/dashboard/invoices/[id]/page.tsx
import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/data";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoicePage({ params }: PageProps) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) {
    notFound(); // Triggers not-found.tsx
  }

  return (
    <div>
      <h1>Invoice #{invoice.number}</h1>
      {/* Invoice details */}
    </div>
  );
}
```

```tsx
// app/dashboard/invoices/[id]/not-found.tsx
import Link from "next/link";

export default function InvoiceNotFound() {
  return (
    <div className="text-center p-6">
      <h2 className="text-xl font-semibold">Invoice Not Found</h2>
      <p className="text-gray-600 mt-2">
        The invoice you're looking for doesn't exist.
      </p>
      <Link
        href="/dashboard/invoices"
        className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded"
      >
        Back to Invoices
      </Link>
    </div>
  );
}
```

**Why good:** 404 specific to invoice context (not generic app 404), helpful navigation back to list, proper HTTP status code returned

---

## Pattern 5: Server-Only Code Protection

### Good Example - Protecting Sensitive Code

```tsx
// lib/data.ts
import "server-only"; // Build error if imported in Client Component

import { db } from "@/lib/db";

const DATABASE_SECRET = process.env.DATABASE_SECRET;

export async function getUsers() {
  // Safe to use secrets here - guaranteed server-only
  const users = await db.query.users.findMany();
  return users;
}

export async function getUserById(id: string) {
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, id),
  });
  return user;
}
```

```tsx
// app/users/page.tsx (Server Component)
import { getUsers } from "@/lib/data"; // Works - Server Component

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
// components/user-search.tsx (Client Component)
"use client";

// import { getUsers } from "@/lib/data"; // ERROR: Build fails
// "server-only" module prevents this import

export function UserSearch() {
  // Must use API route or server action instead
  const handleSearch = async (query: string) => {
    const response = await fetch(`/api/users/search?q=${query}`);
    // ...
  };

  return <input onChange={(e) => handleSearch(e.target.value)} />;
}
```

**Why good:** Build-time guarantee that secrets never reach client bundle, clear separation of server/client code, prevents accidental exposure

---

_For advanced patterns, see [metadata.md](metadata.md), [parallel-routes.md](parallel-routes.md), and [route-groups.md](route-groups.md)._
