# File-Based Routing

> Code examples for Astro routing - static routes, dynamic routes, rest parameters, SSR/SSG modes, API endpoints. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Static Routes

### Good Example - Project Structure to URL Mapping

```
src/pages/
├── index.astro            → /
├── about.astro            → /about
├── contact.astro          → /contact
├── blog/
│   ├── index.astro        → /blog
│   └── [id].astro         → /blog/:id
├── docs/
│   └── [...slug].astro    → /docs, /docs/*, /docs/*/*
├── api/
│   └── search.ts          → /api/search
└── _components/           → excluded (underscore prefix)
    └── helper.astro       → not a route
```

**Why good:** File structure mirrors URL structure, underscore prefix excludes helper files, nested directories create nested routes

---

## Pattern 2: Dynamic Routes with getStaticPaths

### Good Example - Blog Post Routes from Content Collection

```astro
---
// src/pages/blog/[id].astro
import { getCollection, render } from "astro:content";
import BlogLayout from "../../layouts/BlogLayout.astro";

export async function getStaticPaths() {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { id: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---

<BlogLayout title={post.data.title}>
  <Content />
</BlogLayout>
```

**Why good:** All paths defined at build time, post data passed as props (avoids re-fetching), drafts filtered out

### Good Example - Tag Pages with Multiple Parameters

```astro
---
// src/pages/tags/[tag].astro
import { getCollection } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  const uniqueTags = [...new Set(posts.flatMap((post) => post.data.tags))];

  return uniqueTags.map((tag) => ({
    params: { tag },
    props: {
      posts: posts.filter((post) => post.data.tags.includes(tag)),
    },
  }));
}

const { tag } = Astro.params;
const { posts } = Astro.props;
---

<h1>Posts tagged: {tag}</h1>
<ul>
  {posts.map((post) => (
    <li><a href={`/blog/${post.id}`}>{post.data.title}</a></li>
  ))}
</ul>
```

**Why good:** Generates a page per unique tag, pre-filtered posts passed as props, type-safe tag from params

---

## Pattern 3: Rest Parameters

### Good Example - Catch-All Documentation Routes

```astro
---
// src/pages/docs/[...slug].astro
import { getCollection, render } from "astro:content";

export async function getStaticPaths() {
  const docs = await getCollection("docs");
  return docs.map((doc) => ({
    params: { slug: doc.id || undefined }, // undefined matches /docs
    props: { doc },
  }));
}

const { doc } = Astro.props;
const { Content } = await render(doc);
---

<Content />
```

**Why good:** Matches any depth (`/docs`, `/docs/guide`, `/docs/api/reference`), `undefined` handles the root `/docs` path

---

## Pattern 4: Pagination

### Good Example - Paginated Blog List

```astro
---
// src/pages/blog/[...page].astro
import { getCollection } from "astro:content";
import type { GetStaticPaths } from "astro";

const POSTS_PER_PAGE = 12;

export const getStaticPaths = (async ({ paginate }) => {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  const sorted = posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
  return paginate(sorted, { pageSize: POSTS_PER_PAGE });
}) satisfies GetStaticPaths;

const { page } = Astro.props;
---

<h1>Blog (Page {page.currentPage} of {page.lastPage})</h1>

<ul>
  {page.data.map((post) => (
    <li>
      <a href={`/blog/${post.id}`}>{post.data.title}</a>
    </li>
  ))}
</ul>

<nav>
  {page.url.prev && <a href={page.url.prev}>Previous</a>}
  {page.url.next && <a href={page.url.next}>Next</a>}
</nav>
```

**Why good:** Named constant for page size, `paginate()` auto-generates numbered pages, navigation links from `page.url`, `satisfies` for type checking

---

## Pattern 5: On-Demand (SSR) Routes

### Good Example - Dynamic Page Without getStaticPaths

```astro
---
// src/pages/user/[id].astro
export const prerender = false; // Opt into SSR

const { id } = Astro.params;

const response = await fetch(`https://api.example.com/users/${id}`);
if (!response.ok) {
  return new Response(null, { status: 404, statusText: "User not found" });
}

const user = await response.json();
---

<h1>{user.name}</h1>
<p>{user.email}</p>
```

**Why good:** No `getStaticPaths` needed for SSR routes, HTTP status codes for error handling, data fetched per-request

### Good Example - Protected Route with Cookies

```astro
---
// src/pages/dashboard.astro
export const prerender = false;

const sessionToken = Astro.cookies.get("session")?.value;
if (!sessionToken) {
  return Astro.redirect("/login");
}

const user = await validateSession(sessionToken);
if (!user) {
  Astro.cookies.delete("session");
  return Astro.redirect("/login");
}
---

<h1>Welcome, {user.name}</h1>
```

**Why good:** Cookie-based auth check, redirect for unauthenticated users, session cleanup on invalid token

---

## Pattern 6: API Endpoints

### Good Example - REST API Endpoint

```typescript
// src/pages/api/posts.ts
export const prerender = false;

import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url }) => {
  const page = Number(url.searchParams.get("page")) || 1;
  const limit = Number(url.searchParams.get("limit")) || 10;

  const posts = await fetchPosts({ page, limit });

  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();

  if (!body.title || !body.content) {
    return new Response(
      JSON.stringify({ error: "Title and content are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const post = await createPost(body);
  return new Response(JSON.stringify(post), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
```

**Why good:** `prerender = false` enables dynamic endpoints, separate handlers per HTTP method, proper status codes, input validation

---

## Pattern 7: 404 Page

### Good Example - Custom 404

```astro
---
// src/pages/404.astro
import BaseLayout from "../layouts/BaseLayout.astro";
---

<BaseLayout title="Page Not Found">
  <div class="not-found">
    <h1>404</h1>
    <p>The page you're looking for doesn't exist.</p>
    <a href="/">Go back home</a>
  </div>
</BaseLayout>
```

**Why good:** Custom 404 matches site design, helpful navigation back to home, uses layout for consistent look

---

_See [content.md](content.md) for generating routes from content collections and [integrations.md](integrations.md) for View Transitions._
