# shadcn/ui - Core Examples

> Essential setup and utility patterns for shadcn/ui projects.

---

## Project Setup Examples

### Complete Initialization

```bash
# Initialize a new shadcn/ui project
npx shadcn@latest init

# When prompted, select:
# - TypeScript: Yes
# - Style: New York (recommended; "default" style is deprecated)
# - Base color: Slate
# - Global CSS file: app/globals.css
# - CSS variables: Yes
# - Tailwind config: (leave blank for Tailwind v4)
# - Components alias: @/components
# - Utils alias: @/lib/utils
```

### components.json for Monorepo

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**Why good:** Explicit aliases make imports consistent, CSS variables enable theming, TypeScript ensures type safety, iconLibrary configures default icon set

---

## cn() Utility Examples

### Basic Class Merging

```tsx
import { cn } from "@/lib/utils";

// Conditional classes
<div className={cn("base-class", isActive && "active-class")} />

// Multiple conditions
<div
  className={cn(
    "px-4 py-2 rounded-md",
    isDisabled && "opacity-50 cursor-not-allowed",
    isLoading && "animate-pulse",
    variant === "primary" && "bg-primary text-primary-foreground",
    variant === "secondary" && "bg-secondary text-secondary-foreground"
  )}
/>

// Merging with consumer className
function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  );
}
```

### Tailwind Merge in Action

```tsx
// Without tailwind-merge (broken)
clsx("px-4", "px-6"); // "px-4 px-6" - both applied, unpredictable

// With cn() (correct)
cn("px-4", "px-6"); // "px-6" - later class wins

// Real example: consumer override
<Button className="px-8">Wide Button</Button>
// Results in "px-8" not "px-4 px-8"
```

**Why good:** `cn()` handles Tailwind class conflicts intelligently, consumer overrides work as expected, no duplicate utility classes in output

---

## Essential CSS Structure (Tailwind v4)

```css
/* globals.css - Tailwind v4 minimal setup */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --radius: 0.625rem;
  /* ... see theming.md for complete list */
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... dark mode overrides */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  /* ... see theming.md for complete list */
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Why good:** OKLCH format provides better perceptual uniformity, `@theme inline` maps CSS variables to Tailwind utilities, CSS variables enable theming

---

## Skeleton Loading Examples

### Card and List Skeletons

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-1/5" />
        <Skeleton className="h-4 w-4/5" />
      </CardHeader>
      <CardContent className="h-10" />
    </Card>
  );
}

export function UserListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Why good:** Skeleton matches actual content layout, smooth loading transition
