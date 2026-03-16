# Remix - Loader Examples

> Patterns for data loading with authentication, pagination, and caching.

---

## Protected Route with Pagination

```typescript
// app/routes/admin.users.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";

const DEFAULT_PAGE = 1;
const PAGE_SIZE = 25;
const HTTP_FORBIDDEN = 403;

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);

  if (!session.userId) {
    return redirect("/login");
  }

  const user = await db.user.findUnique({ where: { id: session.userId } });

  if (!user?.isAdmin) {
    throw json(
      { message: "Admin access required" },
      { status: HTTP_FORBIDDEN }
    );
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || DEFAULT_PAGE;
  const search = url.searchParams.get("search") || "";

  const where = search
    ? { name: { contains: search, mode: "insensitive" as const } }
    : {};

  const [users, totalCount] = await Promise.all([
    db.user.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return json({ users, page, totalPages, search });
}

export default function AdminUsers() {
  const { users, page, totalPages, search } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleSearch = (value: string) => {
    setSearchParams((prev) => {
      prev.set("search", value);
      prev.set("page", "1");
      return prev;
    });
  };

  return (
    <div>
      <input
        type="search"
        defaultValue={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search users..."
      />

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{new Date(user.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <nav aria-label="Pagination">
        <span>Page {page} of {totalPages}</span>
      </nav>
    </div>
  );
}
```

**Why good:** Authentication redirects unauthenticated users, authorization throws 403 for non-admins, parallel database queries with Promise.all, URL search params for shareable state, named constants for pagination

---

## Loader with Caching Headers

```typescript
// app/routes/api.products.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

const CACHE_MAX_AGE_SECONDS = 60;
const STALE_WHILE_REVALIDATE_SECONDS = 300;

export async function loader({ request }: LoaderFunctionArgs) {
  const products = await db.product.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return json(
    { products },
    {
      headers: {
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    },
  );
}
```

**Why good:** HTTP caching via standard headers, named constants for cache durations, stale-while-revalidate improves perceived performance
