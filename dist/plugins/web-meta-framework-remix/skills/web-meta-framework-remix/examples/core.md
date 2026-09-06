# Remix — Core

> A route module end to end, and how the routes directory maps to URLs. Layouts and pathless routes
> are in [nested-routes.md](nested-routes.md); the hooks table is in
> [reference.md](../reference.md).

---

## A Route Module End to End

```typescript
// app/routes/products.$productId.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

const HTTP_NOT_FOUND = 404;

export async function loader({ params }: LoaderFunctionArgs) {
  const product = await getProduct(params.productId);

  if (!product) {
    throw json({ message: "Product not found" }, { status: HTTP_NOT_FOUND });
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

**Why good:** The throw is what makes `product` non-null in the component — there is no branch for the
missing case because the request never reaches the component. `typeof loader` carries the return type
across, so renaming a field is a compile error rather than `undefined` on screen.

### Bad Example — returning the nullable value

```typescript
// WRONG
export async function loader({ params }: LoaderFunctionArgs) {
  const product = await getProduct(params.productId);
  return json({ product }); // product may be null
}

export default function ProductPage() {
  const { product } = useLoaderData<typeof loader>();
  return <h1>{product.name}</h1>; // crashes on a missing product
}
```

**Why bad:** The response is a 200 carrying `null`, so crawlers index a broken page, the component
crashes at render, and the `ErrorBoundary` sees a `TypeError` rather than the 404 that actually
happened.

---

## The Routes Directory

```
app/routes/
├── _index.tsx              # /
├── about.tsx               # /about
├── products.tsx            # /products — a layout if it renders <Outlet />
├── products._index.tsx     # /products, when products.tsx is the layout
├── products.$productId.tsx # /products/:productId
├── api.health.ts           # /api/health — no default export, so a resource route
├── admin.tsx               # /admin layout
├── admin._index.tsx        # /admin
├── admin.users.tsx         # /admin/users
└── _auth.login.tsx         # /login, inside the pathless _auth.tsx layout
```

A `.` in a filename is the nesting separator, so `admin.users.tsx` is a child of `admin.tsx` rather
than a file called "admin.users". The naming table is in [SKILL.md](../SKILL.md); layouts and
pathless routes are worked through in [nested-routes.md](nested-routes.md).
