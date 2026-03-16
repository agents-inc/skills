# Astro Components & Layouts

> Complete code examples for Astro component patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Component Props and TypeScript

### Good Example - Typed Props with Defaults

```astro
---
// src/components/Button.astro
interface Props {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  href?: string;
  disabled?: boolean;
}

const {
  variant = "primary",
  size = "md",
  href,
  disabled = false,
} = Astro.props;

const TAG = href ? "a" : "button";
---

<TAG
  class:list={["btn", `btn-${variant}`, `btn-${size}`]}
  href={href}
  disabled={disabled}
>
  <slot />
</TAG>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-secondary { background: #e5e7eb; color: #1f2937; }
  .btn-ghost { background: transparent; color: #3b82f6; }
  .btn-sm { padding: 0.25rem 0.75rem; font-size: 0.875rem; }
  .btn-md { padding: 0.5rem 1rem; font-size: 1rem; }
  .btn-lg { padding: 0.75rem 1.5rem; font-size: 1.125rem; }
</style>
```

**Why good:** Type-safe props with union types, sensible defaults, polymorphic tag based on props, scoped styles

### Bad Example - Untyped Props

```astro
---
// BAD: No types, no defaults
const { variant, size, href } = Astro.props;
---

<div class={variant} style={`font-size: ${size}`}>
  <slot />
</div>
```

**Why bad:** No TypeScript safety, no autocomplete, no validation of allowed values, inline styles instead of scoped CSS

---

## Pattern 2: Expressions and Conditional Rendering

### Good Example - Template Expressions

```astro
---
// src/components/UserCard.astro
interface Props {
  name: string;
  role: "admin" | "editor" | "viewer";
  avatarUrl?: string;
  lastLogin?: Date;
}

const { name, role, avatarUrl, lastLogin } = Astro.props;

const ROLE_LABELS = {
  admin: "Administrator",
  editor: "Editor",
  viewer: "Viewer",
} as const;

const isActive = lastLogin
  ? Date.now() - lastLogin.getTime() < 7 * 24 * 60 * 60 * 1000
  : false;
---

<div class="user-card">
  {avatarUrl ? (
    <img src={avatarUrl} alt={`${name}'s avatar`} />
  ) : (
    <div class="avatar-placeholder">{name[0]}</div>
  )}

  <h3>{name}</h3>
  <span class={`badge badge-${role}`}>{ROLE_LABELS[role]}</span>

  {lastLogin && (
    <p class:list={["status", { active: isActive, inactive: !isActive }]}>
      Last seen: {lastLogin.toLocaleDateString()}
    </p>
  )}
</div>
```

**Why good:** Named constants for labels, conditional rendering with ternary, `class:list` for dynamic classes, optional chaining for missing data

---

## Pattern 3: Layouts with Nested Composition

### Good Example - Nested Layout Pattern

```astro
---
// src/layouts/BaseLayout.astro
import { ClientRouter } from "astro:transitions";

interface Props {
  title: string;
  description?: string;
}

const { title, description = "My Astro Site" } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title}</title>
    <ClientRouter />
  </head>
  <body>
    <slot />
  </body>
</html>
```

```astro
---
// src/layouts/BlogLayout.astro
import BaseLayout from "./BaseLayout.astro";
import Sidebar from "../components/Sidebar.astro";

interface Props {
  title: string;
  pubDate: Date;
  author: string;
}

const { title, pubDate, author } = Astro.props;
---

<BaseLayout title={title}>
  <div class="blog-layout">
    <article>
      <header>
        <h1>{title}</h1>
        <p>By {author} on <time>{pubDate.toLocaleDateString()}</time></p>
      </header>
      <slot />
    </article>
    <Sidebar />
  </div>
</BaseLayout>
```

```astro
---
// src/pages/blog/my-post.astro
import BlogLayout from "../../layouts/BlogLayout.astro";
---

<BlogLayout title="My Post" pubDate={new Date("2025-01-15")} author="Vince">
  <p>Blog content goes here.</p>
</BlogLayout>
```

**Why good:** Layouts compose via nesting (BlogLayout wraps BaseLayout), each layout adds its own structure, page content fills the innermost slot

---

## Pattern 4: Scoped vs Global Styles

### Good Example - Scoped and Global Styles

```astro
---
// src/components/Card.astro
---

<div class="card">
  <slot />
</div>

<!-- Scoped by default: only affects this component -->
<style>
  .card {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1.5rem;
  }
</style>

<!-- Global styles when needed (use sparingly) -->
<style is:global>
  .card :global(a) {
    color: #3b82f6;
    text-decoration: underline;
  }
</style>
```

**Why good:** Scoped styles prevent leakage by default, `:global()` selector targets specific elements when needed, `is:global` used sparingly for slot content styling

---

## Pattern 5: Script Handling

### Good Example - Client-Side Scripts

```astro
---
// src/components/ThemeToggle.astro
---

<button id="theme-toggle" aria-label="Toggle theme">
  <span class="light-icon">&#9728;</span>
  <span class="dark-icon">&#9790;</span>
</button>

<!-- Bundled and deduped (runs once even if component used multiple times) -->
<script>
  const THEME_KEY = "theme";
  const DARK_CLASS = "dark";

  const toggle = document.getElementById("theme-toggle");
  toggle?.addEventListener("click", () => {
    const isDark = document.documentElement.classList.toggle(DARK_CLASS);
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  });
</script>
```

```astro
<!-- Inline script: not bundled, re-executes on each page with View Transitions -->
<script is:inline>
  // Runs on every navigation when using ClientRouter
  const theme = localStorage.getItem("theme");
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  }
</script>
```

**Why good:** Default scripts are bundled and tree-shaken, `is:inline` preserves script behavior across navigations, named constants for storage keys

---

_See [islands.md](islands.md) for interactive component patterns and [content.md](content.md) for content collection examples._
