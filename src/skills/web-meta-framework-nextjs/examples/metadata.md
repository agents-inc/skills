# Next.js App Router — Metadata and SEO

> Metadata, Open Graph and static generation of dynamic routes. See [core.md](core.md) for routing
> and layouts.

---

## Pattern: Static Metadata with Template

### Good Example — Root Layout with Metadata Template

```tsx
// app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://acme.com"),
  title: {
    template: "%s | Acme Dashboard",
    default: "Acme Dashboard",
  },
  description: "Manage your business with Acme Dashboard",
  openGraph: {
    siteName: "Acme Dashboard",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/dashboard/invoices/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoices", // Becomes "Invoices | Acme Dashboard"
  description: "View and manage your invoices",
};

export default function InvoicesPage() {
  return <h1>Invoices</h1>;
}
```

**Why good:** The template gives every child page consistent branding for the cost of one `title`
string, and `metadataBase` resolves the relative image paths below it.

---

## Pattern: Dynamic Metadata with generateMetadata

### Good Example — Blog Post with Dynamic Metadata

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata, ResolvingMetadata } from "next";
import { getAllPosts, getPost } from "../../../lib/data";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: "Post Not Found" };
  }

  // Extend parent images
  const previousImages = (await parent).openGraph?.images || [];

  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: post.author.name }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
        ...previousImages,
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage],
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPost(slug);
  // Render post...
}
```

**Why good:** `getPost` runs once even though both functions call it — `fetch` is memoised across
`generateMetadata` and the page. `generateStaticParams` makes every post static at build time, and
the missing-post branch keeps the metadata valid for a slug that no longer exists.

---

_Routing and layouts are in [core.md](core.md); the Server/Client boundary is in
[server-components.md](server-components.md)._
