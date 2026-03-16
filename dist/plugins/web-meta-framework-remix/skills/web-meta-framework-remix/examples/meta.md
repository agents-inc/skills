# Remix - SEO Meta Examples

> Patterns for dynamic meta tags, Open Graph, and Twitter cards.

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

export async function loader({ params }: LoaderFunctionArgs) {
  const product = await db.product.findUnique({
    where: { id: params.productId },
  });

  if (!product) {
    throw new Response("Not Found", { status: 404 });
  }

  return json({ product });
}
```

**Why good:** Title and description from loader data, canonical URL prevents duplicate content, Open Graph and Twitter cards for social sharing, noindex for missing products, named constants for site config

---

## Key Concepts

### Meta Function Signature

```typescript
export const meta: MetaFunction<typeof loader> = ({
  data,
  params,
  location,
}) => {
  // data - loader response
  // params - URL params
  // location - current URL info
  return [{ title: "Page Title" }, { name: "description", content: "..." }];
};
```

### Common Meta Tags

| Tag           | Purpose               |
| ------------- | --------------------- |
| `title`       | Browser tab title     |
| `description` | Search engine snippet |
| `robots`      | Indexing instructions |
| `canonical`   | Preferred URL         |

### Open Graph Tags

| Property         | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `og:title`       | Social share title                       |
| `og:description` | Social share description                 |
| `og:image`       | Social share image                       |
| `og:type`        | Content type (website, article, product) |
| `og:url`         | Canonical URL for sharing                |

### Twitter Card Tags

| Name                  | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `twitter:card`        | Card type (summary, summary_large_image) |
| `twitter:title`       | Twitter-specific title                   |
| `twitter:description` | Twitter-specific description             |
| `twitter:image`       | Twitter-specific image                   |

### Link Tags in Meta

```typescript
// Canonical URL
{ tagName: "link", rel: "canonical", href: url }

// Alternate language
{ tagName: "link", rel: "alternate", hreflang: "es", href: "/es/page" }
```
