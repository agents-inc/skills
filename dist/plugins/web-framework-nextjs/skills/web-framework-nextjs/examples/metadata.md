# Next.js App Router - Metadata and SEO

> Examples for configuring metadata, Open Graph, and SEO optimization. See [core.md](core.md) for foundational patterns.

---

## Pattern: Static Metadata with Template

### Good Example - Root Layout with Metadata Template

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

**Why good:** Title template ensures consistent branding, child pages just specify their title, metadataBase handles URL composition

---

## Pattern: Dynamic Metadata with generateMetadata

### Good Example - Blog Post with Dynamic Metadata

```tsx
// app/blog/[slug]/page.tsx
import type { Metadata, ResolvingMetadata } from "next";
import { getPost, getAllPosts } from "@/lib/data";

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

**Why good:** Fetch request automatically memoized (shared with page), type-safe metadata, Open Graph and Twitter cards configured, static params for build-time generation

---

_See [core.md](core.md) for Server/Client Components, Streaming, Layouts, and Error Handling patterns._
