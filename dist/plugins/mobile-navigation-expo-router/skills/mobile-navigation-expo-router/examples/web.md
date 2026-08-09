# Web: Static Rendering and Head Metadata

> Static rendering, SEO, and head metadata for web output. See [SKILL.md](../SKILL.md) for decisions, [core.md](core.md) for navigation basics.

---

## Enabling Static Rendering

```json
// app.json
{
  "expo": {
    "web": {
      "output": "static"
    }
  }
}
```

Static rendering generates individual HTML files at build time. Each route becomes a separate `.html` file for SEO and fast initial loads.

```bash
# Development
npx expo start

# Production export
npx expo export --platform web
# Generates dist/ directory -- deploy to any static host
```

---

## Head Metadata

Use the `Head` component from `expo-router/head` to manage `<title>` and `<meta>` tags per page:

```typescript
// app/about.tsx
import Head from "expo-router/head";
import { Text, View, StyleSheet } from "react-native";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>About Us | MyApp</title>
        <meta name="description" content="Learn about our mission and team." />
        <meta property="og:title" content="About Us" />
        <meta property="og:description" content="Learn about our mission." />
      </Head>
      <View style={styles.container}>
        <Text style={styles.heading}>About Us</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 32, fontWeight: "bold" },
});
```

**Note:** `Head` renders on web only. On native platforms, it is a no-op. This is safe to include in universal components.

---

## Dynamic Head Metadata

```typescript
// app/posts/[id].tsx
import Head from "expo-router/head";
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function PostPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // In a real app, fetch post data based on id
  const title = `Post ${id}`;

  return (
    <>
      <Head>
        <title>{title} | MyBlog</title>
        <meta name="description" content={`Read post ${id}`} />
      </Head>
      <View style={{ flex: 1, padding: 16 }}>
        <Text>{title}</Text>
      </View>
    </>
  );
}
```

---

## generateStaticParams for Dynamic Routes

Dynamic routes (`[id].tsx`) require `generateStaticParams` to pre-render pages at build time. Without it, dynamic routes are not included in the static output.

```typescript
// app/posts/[id].tsx
import { useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { Text, View } from "react-native";

// Runs at BUILD TIME in Node.js -- no React Native APIs available
export async function generateStaticParams(): Promise<Record<string, string>[]> {
  const posts = await fetchAllPosts(); // API call, file read, etc.
  return posts.map((post) => ({ id: post.id }));
  // Generates: /posts/1.html, /posts/2.html, ...
}

export default function PostPage() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      <Head>
        <title>Post {id}</title>
      </Head>
      <View style={{ flex: 1, padding: 16 }}>
        <Text>Post {id}</Text>
      </View>
    </>
  );
}
```

**Key constraint:** `generateStaticParams` runs in Node.js during the build. It can access `process.cwd()`, environment variables, and the filesystem -- but NOT browser APIs, React Native APIs, or native modules.

---

## Root HTML Customization

Create `app/+html.tsx` to customize the HTML wrapper for all pages. This runs in Node.js only.

```typescript
// app/+html.tsx
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* ScrollViewStyleReset prevents overflow issues with React Native Web */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## Static vs Server Output

| Feature                 | `"static"`                            | `"server"`                             |
| ----------------------- | ------------------------------------- | -------------------------------------- |
| Output                  | Individual `.html` files              | Server bundle + client bundle          |
| Dynamic routes          | Requires `generateStaticParams`       | Rendered on request                    |
| API routes (`+api.ts`)  | Not available                         | Available                              |
| Deployment              | Any static host (Netlify, Vercel, S3) | Requires server (EAS Hosting, Node.js) |
| SEO                     | Excellent (pre-rendered HTML)         | Good (SSR on request)                  |
| React Server Components | No                                    | Yes (experimental)                     |

Choose `"static"` for content sites, marketing pages, and blogs. Choose `"server"` when you need API routes, dynamic server-rendered pages, or React Server Components.
