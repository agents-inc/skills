# Remix - Core Examples

> Essential Remix patterns for file-based routing, loaders, actions, and error boundaries.

---

## File-Based Routing

### Dynamic Route with Loader

```typescript
// app/routes/products.$productId.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

const HTTP_NOT_FOUND = 404;

export async function loader({ params }: LoaderFunctionArgs) {
  const product = await db.product.findUnique({
    where: { id: params.productId },
    include: { category: true },
  });

  if (!product) {
    throw json(
      { message: "Product not found" },
      { status: HTTP_NOT_FOUND }
    );
  }

  return json({ product });
}

export default function ProductPage() {
  const { product } = useLoaderData<typeof loader>();

  return (
    <article>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <span>Category: {product.category.name}</span>
    </article>
  );
}
```

**Why good:** Type-safe params access, throws Response for 404 (triggers ErrorBoundary), loader data fully typed via `typeof loader`, named constant for HTTP status

### Bad Example - Missing Error Handling

```typescript
// WRONG - No null check, no error handling
export async function loader({ params }: LoaderFunctionArgs) {
  const product = await db.product.findUnique({
    where: { id: params.productId },
  });
  // product could be null - will crash when accessing properties
  return json({ product });
}

export default function ProductPage() {
  const { product } = useLoaderData<typeof loader>();
  return <h1>{product.name}</h1>; // Crashes if product is null
}
```

**Why bad:** No null check leads to runtime crash, should throw 404 Response when product not found, no type safety for null case

---

## Route File Naming

```
app/routes/
├── _index.tsx              # / (root index)
├── about.tsx               # /about
├── products.tsx            # /products (layout or page)
├── products._index.tsx     # /products (index when products.tsx is layout)
├── products.$productId.tsx # /products/:productId
├── api.health.ts           # /api/health (resource route - no default export)
├── admin.tsx               # /admin (layout)
├── admin._index.tsx        # /admin (index)
├── admin.users.tsx         # /admin/users
└── _auth.login.tsx         # /login (pathless layout with _auth.tsx)
```

### Key Conventions

| Pattern           | Purpose                          |
| ----------------- | -------------------------------- |
| `$param`          | Dynamic segment                  |
| `_index`          | Index route                      |
| `_layout`         | Pathless layout (no URL segment) |
| `layout_`         | Escape parent layout             |
| `.`               | Nested route separator           |
| No default export | Resource route (API)             |

---

## Essential Hooks

| Hook                             | Purpose                           |
| -------------------------------- | --------------------------------- |
| `useLoaderData<typeof loader>()` | Access loader data with types     |
| `useActionData<typeof action>()` | Access action response            |
| `useNavigation()`                | Track navigation/submission state |
| `useSearchParams()`              | Read/write URL search params      |
| `useFetcher()`                   | Submit without navigation         |
| `useRouteError()`                | Get error in ErrorBoundary        |
