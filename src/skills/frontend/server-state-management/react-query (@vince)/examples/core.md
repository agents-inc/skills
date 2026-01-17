# API Integration - Code Examples

> Core code examples for API client patterns. Reference from [SKILL.md](../SKILL.md).

**Extended examples:**
- [configuration.md](configuration.md) - Advanced headers, auth, environment-specific settings, timeouts, debounce
- [error-handling.md](error-handling.md) - Component-level, global, retry logic, error boundaries, custom errors

---

## Pattern 1: OpenAPI Schema Definition and Code Generation

### Generated Types (Auto-Generated)

```typescript
// packages/api/src/apiClient/types.gen.ts
export type Feature = {
  id: string;
  name: string;
  description: string;
  status: string;
};

export type GetFeaturesResponse = {
  features?: Feature[];
};
```

### Generated React Query Options (Auto-Generated)

```typescript
// packages/api/src/apiClient/@tanstack/react-query.gen.ts
import type { QueryObserverOptions } from "@tanstack/react-query";
import { getFeaturesQueryKey, getFeatures } from "./services.gen";
import type { GetFeaturesResponse } from "./types.gen";

// Auto-generated query options
export const getFeaturesOptions = (): QueryObserverOptions<GetFeaturesResponse> => ({
  queryKey: getFeaturesQueryKey(),
  queryFn: () => getFeatures(),
});
```

### Usage in Apps

```typescript
// apps/client-next/app/features.tsx
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";

export function FeaturesPage() {
  // Use generated query options - fully typed!
  const { data, isPending, error } = useQuery(getFeaturesOptions());

  if (isPending) return <Skeleton />;
  if (error) return <Error message={error.message} />;

  return (
    <ul>
      {data?.features?.map((feature) => (
        <li key={feature.id}>{feature.name}</li>
      ))}
    </ul>
  );
}

// Named export (project convention)
export { FeaturesPage };
```

### Bad Example - Anti-pattern

```typescript
// BAD: Manual type definition - duplicates OpenAPI schema
interface Feature {
  id: string;
  name: string;
}

// BAD: Custom React Query hook - should use generated getFeaturesOptions
function useFeatures() {
  return useQuery({
    queryKey: ["features"], // Manual key prone to typos
    queryFn: async () => {
      const res = await fetch("/api/v1/features"); // Magic string
      return res.json();
    },
  });
}

// BAD: Default export
export default FeaturesPage;
```

**Why bad:** Manual types drift from OpenAPI schema causing runtime errors, custom hooks create inconsistent patterns across the codebase, magic strings cause refactoring mistakes, default exports prevent tree-shaking

---

## Pattern 2: Client Configuration with Environment Variables

### Good Example - Basic Setup

```typescript
// apps/client-next/lib/query-provider.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { client } from "@repo/api/client";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: FIVE_MINUTES_MS,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Configure API client ONCE on initialization
  client.setConfig({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "",
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// Named export (project convention)
export { QueryProvider };
```

### Usage in Layout

```typescript
// apps/client-next/app/layout.tsx
import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query-provider";

export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

// Named export
export { RootLayout };
```

### Bad Example - Anti-pattern

```typescript
// BAD: Magic numbers for timeouts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300000, // What's this?
      refetchOnWindowFocus: false,
    },
  },
});

// BAD: Hardcoded URL
client.setConfig({
  baseUrl: "http://localhost:3000/api/v1", // Breaks in production
});
```

**Why bad:** Magic numbers require code diving to understand meaning, hardcoded URLs break when deploying to different environments, causes bugs when promoting code through environments

---

## Pattern 6: Type Safety with Generated Types

### Generated Types (Auto-Generated)

```typescript
// packages/api/src/apiClient/types.gen.ts (AUTO-GENERATED)
export type Feature = {
  id: string;
  name: string;
  description: string;
  status: string;
};

export type GetFeaturesResponse = {
  features?: Feature[];
};
```

### Good Example - Usage with Type Inference

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";
import type { Feature } from "@repo/api/types";

export function FeaturesPage() {
  const { data } = useQuery(getFeaturesOptions());

  // data is typed as GetFeaturesResponse | undefined
  // data.features is typed as Feature[] | undefined
  const features: Feature[] | undefined = data?.features;

  return (
    <ul>
      {features?.map((feature) => (
        <li key={feature.id}>{feature.name}</li> // Full autocomplete!
      ))}
    </ul>
  );
}

// Named export
export { FeaturesPage };
```

### Bad Example - Anti-pattern

```typescript
// BAD: Manual type definition - drifts from backend
interface Feature {
  id: string;
  name: string;
  // Missing 'description' and 'status' - causes runtime errors!
}

// BAD: Using 'any' - loses all type safety
const features: any = data?.features;
```

**Why bad:** Manual types drift from backend causing silent runtime errors, missing fields break UI, 'any' defeats TypeScript purpose creating production bugs

---

## Pattern 8: Integration with React Query Generated Hooks

### Customizing Generated Options

```typescript
import { useQuery } from "@tanstack/react-query";
import { getFeaturesOptions } from "@repo/api/reactQueries";

const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_SECONDS_MS = 30 * 1000;

export function Features() {
  const someCondition = true; // Your condition

  const { data } = useQuery({
    ...getFeaturesOptions(),
    // Override defaults
    staleTime: TEN_MINUTES_MS,
    refetchInterval: THIRTY_SECONDS_MS,
    enabled: someCondition, // Conditional fetching
  });

  return <div>{/* ... */}</div>;
}

// Named export
export { Features };
```

### Bad Example - Anti-pattern

```typescript
// BAD: Custom React Query hook - should use generated options
function useFeatures() {
  return useQuery({
    queryKey: ["features"], // Manual key prone to typos
    queryFn: async () => {
      const res = await fetch("/api/v1/features"); // Magic URL
      return res.json();
    },
    staleTime: 600000, // Magic number
  });
}
```

**Why bad:** Custom hooks create inconsistent patterns, manual query keys cause cache key collisions, magic URLs break on API changes, magic numbers hide caching policy

---

_Extended examples: [configuration.md](configuration.md) | [error-handling.md](error-handling.md)_
