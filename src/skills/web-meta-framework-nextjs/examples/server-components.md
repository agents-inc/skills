# Server vs Client Components

> The boundary decision, composition patterns, and streaming. Routing, layouts, error handling and
> server-only code are in [core.md](core.md).

---

## Choosing the side

| Server Component (default)                         | Client Component (`"use client"`)       |
| -------------------------------------------------- | --------------------------------------- |
| Reading from a database or API                     | Event handlers (`onClick`, `onChange`)  |
| Reaching backend resources and environment values  | React state (`useState`, `useReducer`)  |
| Holding API keys and tokens                        | Lifecycle effects (`useEffect`)         |
| Rendering static content with no client cost       | Browser APIs (`localStorage`, `window`) |
| Anything that does not need the three on the right | Custom hooks built on state or effects  |

---

## Pattern 1: Server parent, Client child

```tsx
// app/products/page.tsx — Server Component, the default
import { ProductCard } from "./product-card";

export default async function ProductsPage() {
  const products = await getProducts(); // direct data access, no client JavaScript

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

```tsx
// app/products/product-card.tsx
"use client";

import { useState } from "react";
import type { Product } from "./types";

export function ProductCard({ product }: { product: Product }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={isHovered ? "scale-105" : "scale-100"}
    >
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </div>
  );
}
```

**Why good:** The page ships no JavaScript for the fetch or the list; only the hover behaviour
crosses to the browser.

### Bad Example — the whole page as a Client Component

```tsx
// app/products/page.tsx
"use client"; // BAD: the entire page is now client-side

import { useEffect, useState } from "react";
import type { Product } from "./types";

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
    <div>
      {products.map((product) => (
        <div key={product.id}>{product.name}</div>
      ))}
    </div>
  );
}
```

**Why bad:** Three round trips before anything renders (HTML, then JS, then the fetch), the content
is invisible to crawlers, and none of it can stream.

---

## Pattern 2: Passing Server Components as children

A Client Component may wrap Server Components, as long as they arrive through `children` rather than
being imported inside it.

```tsx
// app/providers.tsx
"use client";

import { ThemeProvider } from "./theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
```

```tsx
// app/layout.tsx — a Server Component
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Why good:** The provider is the only thing that becomes client-side. `children` is already rendered
when it arrives, so the subtree keeps its server rendering.

---

## Pattern 3: Streaming with Suspense

```tsx
// app/dashboard/page.tsx
import { Suspense } from "react";
import { RevenueChart } from "./revenue-chart";
import { LatestInvoices } from "./latest-invoices";
import { CardsSkeleton, ChartSkeleton, InvoicesSkeleton } from "./skeletons";

export default function DashboardPage() {
  return (
    <main>
      <h1>Dashboard</h1>

      <Suspense fallback={<CardsSkeleton />}>
        <StatsCards />
      </Suspense>

      <div className="grid grid-cols-2 gap-6 mt-6">
        {/* Chart and invoices resolve independently of each other */}
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
export async function RevenueChart() {
  const revenue = await getRevenue(); // slow, and blocks nothing else
  return <div>{/* chart */}</div>;
}
```

```tsx
// app/dashboard/skeletons.tsx
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

**Why good:** A three-second query and a one-second query no longer take four seconds between them,
and each section shows a placeholder shaped like its final content.

### Route-level loading state

```tsx
// app/dashboard/loading.tsx
import { CardsSkeleton, ChartSkeleton, InvoicesSkeleton } from "./skeletons";

export default function DashboardLoading() {
  return (
    <main>
      <CardsSkeleton />
      <div className="grid grid-cols-2 gap-6 mt-6">
        <ChartSkeleton />
        <InvoicesSkeleton />
      </div>
    </main>
  );
}
```

**Why good:** Next.js wraps `page.tsx` in a Suspense boundary for you, so the whole route has a
loading state without a boundary written by hand. The decision tree for picking between the two is in
[reference.md](../reference.md).

---

_Routing, layouts, error handling and `server-only` are in [core.md](core.md)._
