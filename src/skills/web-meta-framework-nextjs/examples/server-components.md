# Server vs Client Components

> Server Components are the default in App Router. This guide covers the boundary decision, composition patterns, and streaming. See [core.md](core.md) for more foundational patterns.

---

## When to Use Server Components (Default)

- Fetching data from databases or APIs
- Accessing backend resources (file system, environment variables)
- Keeping sensitive information on the server (API keys, tokens)
- Reducing client-side JavaScript bundle
- Rendering static content

## When to Use Client Components (`"use client"`)

- Adding interactivity with event handlers (`onClick`, `onChange`)
- Using React state (`useState`, `useReducer`)
- Using lifecycle effects (`useEffect`, `useLayoutEffect`)
- Using browser-only APIs (`localStorage`, `window`, `navigator`)
- Using custom hooks that depend on state or effects

---

## Pattern: Composition - Server Wrapping Client

The key pattern is Server Components at the top fetching data, passing it as props to small Client Components at the leaves.

### Good Example - Server parent, Client child

```tsx
// app/dashboard/page.tsx (Server Component - default)
import { getUser } from "@/lib/data";
import { UserProfile } from "./user-profile";

export default async function DashboardPage() {
  const user = await getUser(); // Server-side data fetch

  return (
    <div>
      <h1>Dashboard</h1>
      {/* Pass data as props to Client Component */}
      <UserProfile user={user} />
    </div>
  );
}
```

```tsx
// app/dashboard/user-profile.tsx (Client Component)
"use client";

import { useState } from "react";
import type { User } from "@/lib/types";

interface UserProfileProps {
  user: User;
}

export function UserProfile({ user }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div>
      <p>{user.name}</p>
      <button onClick={() => setIsEditing(!isEditing)}>
        {isEditing ? "Cancel" : "Edit"}
      </button>
    </div>
  );
}
```

**Why good:** Server Component fetches data without client-side JavaScript, Client Component handles only the interactive parts, minimal JavaScript shipped to browser

### Bad Example - Everything as Client Component

```tsx
// app/dashboard/page.tsx
"use client"; // BAD: Entire page is client-side

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/user")
      .then((res) => res.json())
      .then(setUser);
  }, []);

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>{user.name}</p>
    </div>
  );
}
```

**Why bad:** Ships unnecessary JavaScript to client, causes loading waterfall (HTML -> JS -> fetch -> render), poor SEO, no streaming benefits

---

## Pattern: Passing Server Components as Children

Client Components can receive Server Components as `children` props. This allows Server Components to render inside Client Component wrappers.

### Good Example - Provider wrapping Server content

```tsx
// app/providers.tsx
"use client";

import { ThemeProvider } from "@/lib/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
```

```tsx
// app/layout.tsx (Server Component)
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {/* children can be Server Components */}
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

**Why good:** Client Component wrapper (Providers) doesn't force children to be Client Components, Server Components passed as `children` retain server-side rendering

---

## Pattern: Streaming with Suspense

Streaming allows progressive rendering by sending HTML chunks as they become available. Use `loading.tsx` for route-level loading and `<Suspense>` for granular streaming.

### Good Example - Route-Level Loading with loading.tsx

```tsx
// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded mb-4" />
      <div className="h-64 bg-gray-200 rounded" />
    </div>
  );
}
```

**Why good:** Automatically wraps page in Suspense boundary, shows loading state immediately while data fetches, no manual Suspense setup needed

### Good Example - Granular Streaming with Suspense

```tsx
// app/dashboard/page.tsx
import { Suspense } from "react";
import { RevenueChart, RevenueChartSkeleton } from "./revenue-chart";
import { LatestInvoices, InvoicesSkeleton } from "./latest-invoices";

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Each section streams independently */}
      <Suspense fallback={<RevenueChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<InvoicesSkeleton />}>
        <LatestInvoices />
      </Suspense>
    </div>
  );
}
```

**Why good:** Slow data fetches don't block fast ones, users see content progressively, each section loads independently improving perceived performance

### When to Use loading.tsx vs Suspense

| Granularity                            | Solution                                             |
| -------------------------------------- | ---------------------------------------------------- |
| Entire route should show loading state | `loading.tsx`                                        |
| Multiple independent sections          | `<Suspense>` around each                             |
| Single slow component                  | `<Suspense>` around that component                   |
| Mix of both                            | `loading.tsx` for initial, `<Suspense>` for granular |

---

## Pattern: Server-Only Code Protection

Use the `server-only` package to guarantee code with secrets never reaches the client bundle.

```tsx
// lib/data.ts
import "server-only"; // Build error if imported in Client Component

export async function getUsers() {
  // Safe to use secrets here - guaranteed server-only
  const response = await fetch("https://api.example.com", {
    headers: { Authorization: `Bearer ${process.env.API_KEY}` },
  });
  return response.json();
}
```

**Why good:** Build-time guarantee that secrets never reach client bundle, clear separation of server/client code

---

_See [core.md](core.md) for more patterns including layouts, error handling, and dynamic routes._
