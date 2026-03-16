# Integrations & View Transitions

> Code examples for Astro integrations (React/Vue/Svelte), View Transitions, and Starlight. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Adding Framework Integrations

### Good Example - Adding React Support

```bash
# Automatic setup (recommended)
npx astro add react

# Add multiple integrations at once
npx astro add react tailwind sitemap
```

```javascript
// astro.config.mjs (manual setup)
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  integrations: [react(), tailwind()],
});
```

```tsx
// src/components/Counter.tsx (React component)
import { useState } from "react";

interface Props {
  initialCount?: number;
}

export function Counter({ initialCount = 0 }: Props) {
  const [count, setCount] = useState(initialCount);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

```astro
---
// src/pages/index.astro
import { Counter } from "../components/Counter";
---

<!-- React component as interactive island -->
<Counter client:load initialCount={5} />

<!-- Same component rendered as static HTML (no JavaScript) -->
<Counter initialCount={10} />
```

**Why good:** `astro add` handles config automatically, React components work as islands with client directives, same component can render static or interactive

---

## Pattern 2: View Transitions with ClientRouter

### Good Example - Full Page Transitions

```astro
---
// src/layouts/BaseLayout.astro
import { ClientRouter } from "astro:transitions";
import Navigation from "../components/Navigation.astro";

interface Props {
  title: string;
}

const { title } = Astro.props;
---

<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>{title}</title>
    <ClientRouter />
  </head>
  <body>
    <Navigation />
    <main>
      <slot />
    </main>
  </body>
</html>
```

```astro
---
// src/pages/blog/index.astro - Blog list page
import { getCollection } from "astro:content";
---

<ul>
  {posts.map((post) => (
    <li>
      <a href={`/blog/${post.id}`}>
        <!-- Name this element so it morphs to the post page -->
        <img
          src={post.data.heroImage}
          transition:name={`hero-${post.id}`}
        />
        <h2 transition:name={`title-${post.id}`}>
          {post.data.title}
        </h2>
      </a>
    </li>
  ))}
</ul>
```

```astro
---
// src/pages/blog/[id].astro - Blog post page
---

<!-- Same transition:name pairs elements for smooth morphing -->
<img
  src={post.data.heroImage}
  transition:name={`hero-${post.id}`}
/>
<h1 transition:name={`title-${post.id}`}>
  {post.data.title}
</h1>

<Content />
```

**Why good:** `<ClientRouter />` enables SPA-like navigation, `transition:name` pairs elements across pages for smooth morphing, no page flicker

---

## Pattern 3: Persisting State Across Navigations

### Good Example - Media Player That Persists

```astro
---
// src/components/AudioPlayer.astro
---

<!-- transition:persist keeps this element alive across navigations -->
<div class="audio-player" transition:persist="audio-player">
  <audio id="player" controls>
    <source src="/podcast.mp3" type="audio/mp3" />
  </audio>
</div>
```

```astro
---
// src/components/VideoSidebar.astro
import VideoPlayer from "./VideoPlayer"; // React component
---

<!-- Framework components persist their state too -->
<VideoPlayer
  client:load
  transition:persist
  transition:name="video-sidebar"
/>
```

**Why good:** Audio/video continues playing across page navigations, React component state preserved, no re-initialization

### Good Example - Persisting Theme Across Transitions

```astro
<!-- In layout - runs on every navigation -->
<script is:inline>
  // Restore theme immediately after DOM swap
  document.addEventListener("astro:after-swap", () => {
    const theme = localStorage.getItem("theme") ?? "light";
    document.documentElement.dataset.theme = theme;
  });
</script>
```

**Why good:** `astro:after-swap` fires after DOM replacement but before rendering, theme applied before user sees the page

---

## Pattern 4: Transition Animations

### Good Example - Custom Transition Animations

```astro
---
import { fade, slide } from "astro:transitions";
---

<!-- Built-in fade with custom duration -->
<header transition:animate={fade({ duration: "0.3s" })}>
  <h1>My Site</h1>
</header>

<!-- Built-in slide animation -->
<main transition:animate="slide">
  <slot />
</main>

<!-- No animation (instant swap) -->
<footer transition:animate="none">
  <p>Footer content</p>
</footer>
```

```astro
---
// Custom animation definition
const zoomIn = {
  forwards: {
    old: {
      name: "fadeOut",
      duration: "0.2s",
      easing: "ease-in",
    },
    new: {
      name: "zoomIn",
      duration: "0.3s",
      easing: "ease-out",
    },
  },
  backwards: {
    old: { name: "zoomOut", duration: "0.2s" },
    new: { name: "fadeIn", duration: "0.3s" },
  },
};
---

<div transition:animate={zoomIn}>
  <slot />
</div>

<style>
  @keyframes zoomIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  @keyframes zoomOut {
    from { transform: scale(1); opacity: 1; }
    to { transform: scale(0.95); opacity: 0; }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
</style>
```

**Why good:** Built-in animations cover common cases, custom animations use standard CSS keyframes, forwards/backwards handle browser history navigation

---

## Pattern 5: Navigation Control

### Good Example - Programmatic Navigation

```astro
<script>
  import { navigate } from "astro:transitions/client";

  // Programmatic navigation with View Transitions
  document.querySelector("#search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = new FormData(e.target as HTMLFormElement).get("q");
    navigate(`/search?q=${encodeURIComponent(String(query))}`);
  });
</script>

<!-- Force full page reload for specific links -->
<a href="/external-app" data-astro-reload>
  External App (full reload)
</a>

<!-- Replace history entry instead of pushing -->
<a href="/settings" data-astro-history="replace">
  Settings
</a>
```

**Why good:** `navigate()` triggers View Transitions programmatically, `data-astro-reload` opts out for specific links, `data-astro-history` controls browser history behavior

---

## Pattern 6: Starlight Documentation Sites

### Good Example - Setting Up Starlight

```bash
# Create new Starlight project
npm create astro@latest -- --template starlight
```

```javascript
// astro.config.mjs
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "My Docs",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/my-org/my-project",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "getting-started/introduction" },
            { label: "Installation", slug: "getting-started/installation" },
          ],
        },
        {
          label: "Guides",
          autogenerate: { directory: "guides" },
        },
      ],
    }),
  ],
});
```

```markdown
---
# src/content/docs/getting-started/introduction.md
title: Introduction
description: Get started with My Project
---

Welcome to My Project documentation!

## Quick Start

Install the package and get started in minutes.
```

**Why good:** Starlight handles documentation UX (search, nav, dark mode) out of the box, sidebar supports manual and auto-generated entries, Markdown content with frontmatter

---

_See [core.md](core.md) for Astro component patterns and [islands.md](islands.md) for interactive component examples._
