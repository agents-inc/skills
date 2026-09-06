# Remix — Meta and SEO

> Head tags built from loader data: titles, Open Graph, Twitter cards, canonical URLs.

---

## Product Page Meta Tags

```typescript
// app/routes/products.$productId.tsx
import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

const SITE_NAME = "MyStore";
const DEFAULT_DESCRIPTION = "Quality products at great prices";
const BASE_URL = "https://mystore.com";

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
  if (!data?.product) {
    return [
      { title: `Product Not Found | ${SITE_NAME}` },
      { name: "robots", content: "noindex" },
    ];
  }

  const { product } = data;
  const title = `${product.name} | ${SITE_NAME}`;
  const description = product.description || DEFAULT_DESCRIPTION;
  const url = `${BASE_URL}/products/${params.productId}`;
  const imageUrl = product.imageUrl || `${BASE_URL}/default-product.jpg`;

  return [
    { title },
    { name: "description", content: description },

    // Open Graph
    { property: "og:title", content: product.name },
    { property: "og:description", content: description },
    { property: "og:type", content: "product" },
    { property: "og:url", content: url },
    { property: "og:image", content: imageUrl },
    { property: "og:site_name", content: SITE_NAME },

    // Twitter Card
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: product.name },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: imageUrl },

    // Canonical URL
    { tagName: "link", rel: "canonical", href: url },

    // Product-specific structured data hint
    { property: "product:price:amount", content: String(product.price) },
    { property: "product:price:currency", content: "USD" },
  ];
};

const HTTP_NOT_FOUND = 404;

export async function loader({ params }: LoaderFunctionArgs) {
  const product = await db.product.findUnique({
    where: { id: params.productId },
  });

  if (!product) {
    throw new Response("Not Found", { status: HTTP_NOT_FOUND });
  }

  return json({ product });
}
```

**Why good:** The `!data` branch is not defensive padding — `meta` runs with `undefined` data whenever
the loader threw, so without it the 404 page crashes while rendering its own head. `noindex` on that
branch keeps deleted products out of the search index, and the canonical URL keeps the same product
reached by two paths from competing with itself.

---

## The Function

```typescript
export const meta: MetaFunction<typeof loader> = ({
  data,
  params,
  location,
}) => {
  // data     — what the loader returned, or undefined if it threw
  // params   — URL parameters
  // location — the current URL
  return [{ title: "Page Title" }, { name: "description", content: "..." }];
};
```

A descriptor's key decides the tag it becomes: `title` becomes `<title>`, `name` and `property`
become `<meta>`, and `tagName: "link"` becomes `<link>` — which is the only way to emit a dynamic
`<link>`, since the `links` export cannot see loader data.

```typescript
{ tagName: "link", rel: "canonical", href: url }
{ tagName: "link", rel: "alternate", hreflang: "es", href: "/es/page" }
```

| Group        | The ones worth setting                                                |
| ------------ | --------------------------------------------------------------------- |
| Core         | `title`, `description`, `robots`, canonical link                      |
| Open Graph   | `og:title`, `og:description`, `og:image`, `og:type`, `og:url`         |
| Twitter card | `twitter:card`, and title/description/image where they differ from OG |
