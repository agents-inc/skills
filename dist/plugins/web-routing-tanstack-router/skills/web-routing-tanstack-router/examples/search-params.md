# TanStack Router -- Search Params Examples

> Search param validation with Zod, reading and updating search params, functional updaters, plain function validation, and search middleware. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Navigation](navigation.md) -- Link with search updater, useNavigate
- [Routes & Layouts](routes.md) -- complete route definitions with search params

---

## Zod Adapter: Basic Validation

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

const productsSearchSchema = z.object({
  page: fallback(z.number().min(1), DEFAULT_PAGE).default(DEFAULT_PAGE),
  pageSize: fallback(z.number().min(1).max(100), DEFAULT_PAGE_SIZE).default(
    DEFAULT_PAGE_SIZE,
  ),
  category: fallback(z.enum(["all", "electronics", "books", "clothing"]), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  sort: fallback(z.enum(["price", "name", "date"]), "date").default("date"),
});

export const Route = createFileRoute("/products/")({
  validateSearch: zodValidator(productsSearchSchema),
  component: ProductsPage,
});

function ProductsPage() {
  // Fully typed - { page: number, pageSize: number, category: string, q: string, sort: string }
  const search = Route.useSearch();

  return (
    <div>
      <p>
        Page {search.page}, showing {search.pageSize} per page
      </p>
      <p>Category: {search.category}</p>
    </div>
  );
}
```

**Why:** `fallback()` provides safe defaults for invalid/missing params instead of throwing errors. Zod schema gives full type inference to `useSearch()`. `.min()` and `.max()` validate bounds at the URL level. Named constants prevent magic numbers for defaults.

---

## Complete Product Listing with Filters

```typescript
// src/routes/products/index.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT = "newest";
const DEFAULT_CATEGORY = "all";
const MIN_PRICE = 0;
const MAX_PRICE = 10000;

const sortOptions = ["newest", "price-asc", "price-desc", "popular"] as const;
const categoryOptions = [
  "all",
  "electronics",
  "clothing",
  "books",
  "home",
] as const;

const productsSearchSchema = z.object({
  page: fallback(z.number().min(1), DEFAULT_PAGE).default(DEFAULT_PAGE),
  pageSize: fallback(z.number().min(1).max(100), DEFAULT_PAGE_SIZE).default(
    DEFAULT_PAGE_SIZE,
  ),
  sort: fallback(z.enum(sortOptions), DEFAULT_SORT).default(DEFAULT_SORT),
  category: fallback(z.enum(categoryOptions), DEFAULT_CATEGORY).default(
    DEFAULT_CATEGORY,
  ),
  minPrice: fallback(z.number().min(MIN_PRICE), MIN_PRICE).default(MIN_PRICE),
  maxPrice: fallback(z.number().max(MAX_PRICE), MAX_PRICE).default(MAX_PRICE),
  q: fallback(z.string(), "").default(""),
  inStock: fallback(z.boolean(), false).default(false),
});

type ProductsSearch = z.infer<typeof productsSearchSchema>;

export const Route = createFileRoute("/products/")({
  validateSearch: zodValidator(productsSearchSchema),
  loader: async ({ search }) => {
    const result = await fetchProducts(search);
    return { result };
  },
  component: ProductsPage,
});

function ProductsPage() {
  const { result } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const updateSearch = (updates: Partial<ProductsSearch>) => {
    navigate({
      search: (prev) => ({ ...prev, ...updates, page: DEFAULT_PAGE }),
    });
  };

  return (
    <div>
      {/* Filters */}
      <aside>
        <select
          value={search.category}
          onChange={(e) =>
            updateSearch({
              category: e.target.value as ProductsSearch["category"],
            })
          }
        >
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={search.sort}
          onChange={(e) =>
            updateSearch({ sort: e.target.value as ProductsSearch["sort"] })
          }
        >
          {sortOptions.map((sort) => (
            <option key={sort} value={sort}>
              {sort}
            </option>
          ))}
        </select>

        <label>
          <input
            type="checkbox"
            checked={search.inStock}
            onChange={(e) => updateSearch({ inStock: e.target.checked })}
          />
          In Stock Only
        </label>
      </aside>

      {/* Results */}
      <section>
        <p>
          {result.total} products found (page {search.page})
        </p>
        <ul>
          {result.items.map((product) => (
            <li key={product.id}>{product.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

---

## Updating Search Params: Declarative vs Imperative

```typescript
import { Link, useNavigate } from "@tanstack/react-router";
import { Route } from "./products";

function Pagination() {
  const { page } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const handleNextPage = () => {
    navigate({
      search: (prev) => ({ ...prev, page: prev.page + 1 }),
    });
  };

  return (
    <div>
      {/* Declarative - Link with search updater */}
      <Link
        from={Route.fullPath}
        search={(prev) => ({ ...prev, page: prev.page - 1 })}
      >
        Previous
      </Link>

      <span>Page {page}</span>

      {/* Imperative - navigate with search updater */}
      <button type="button" onClick={handleNextPage}>
        Next
      </button>
    </div>
  );
}
```

**Why:** Both Link and navigate support the same search updater pattern. `from` prop anchors type inference to the correct route's search schema. Functional updater `(prev) => ({...prev, ...})` preserves other search params.

---

## Plain Function Validation (No Zod)

```typescript
import type { SearchSchemaInput } from "@tanstack/react-router";

const DEFAULT_PAGE = 1;

export const Route = createFileRoute("/posts/")({
  validateSearch: (
    input: Record<string, unknown> & SearchSchemaInput,
  ): { page: number; tag?: string } => ({
    page: Number(input.page ?? DEFAULT_PAGE) || DEFAULT_PAGE,
    tag: typeof input.tag === "string" ? input.tag : undefined,
  }),
  component: PostsList,
});
```

**Why:** `SearchSchemaInput` marker type signals that input is optional (users navigate without search params). Plain function validation works without additional dependencies. Return type becomes the typed search schema.

---

## Search Middleware: Strip Defaults + Retain Params

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { retainSearchParams, stripSearchParams } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_SORT = "newest";

const searchSchema = z.object({
  page: fallback(z.number(), DEFAULT_PAGE).default(DEFAULT_PAGE),
  sort: fallback(z.string(), DEFAULT_SORT).default(DEFAULT_SORT),
  q: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/products/")({
  validateSearch: zodValidator(searchSchema),
  search: {
    middlewares: [
      // Keep search query when navigating to child routes
      retainSearchParams(["q"]),
      // Remove default values from URL (cleaner URLs)
      stripSearchParams({ page: DEFAULT_PAGE, sort: DEFAULT_SORT }),
    ],
  },
  loader: async ({ search }) => {
    const products = await fetchProducts(search);
    return { products };
  },
  component: ProductsPage,
});
```

**Why:** `stripSearchParams` keeps URLs clean by removing default values. `retainSearchParams` preserves important state across navigations. Both reduce URL clutter while maintaining full type safety.

---

## Bad Example: Reading Search Params Manually

```typescript
// BAD: Bypasses validation, loses type safety
function ProductsPage() {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get("page") || 1);

  return <p>Page {page}</p>;
}
```

**Why bad:** Bypasses `validateSearch` entirely losing all type safety. No default handling or validation. Breaks SSR compatibility. Does not react to URL changes.

---

## Decision: Zod Adapter vs Plain Function

```
Validating search params?
  +-- Complex schema with many fields?
  |   -> Zod adapter (zodValidator + fallback)
  +-- Simple 1-2 params?
  |   -> Plain validateSearch function
  +-- Need shared schema with forms?
  |   -> Zod adapter (share schema between route and form)
  +-- Zod 3.24.0+ / Zod 4+ with Standard Schema?
  |   -> Can use Zod directly without adapter (use `.catch()` for defaults)
```
