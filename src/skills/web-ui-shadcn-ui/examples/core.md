# shadcn/ui - Core Examples

> Essential setup and utility patterns for shadcn/ui projects.

---

## Project Setup

### Initialization

```bash
# Initialize a new shadcn/ui project
npx shadcn@latest init

# When prompted, select:
# - Style: New York (recommended; "default" style is deprecated)
# - Base color: Slate, Gray, Zinc, Neutral, Stone, Mauve, Olive, Mist, Taupe
# - CSS variables: Yes
# - Tailwind config: (leave blank for Tailwind v4)

# With options (CLI v4)
npx shadcn@latest init --base radix      # Specify primitive library
npx shadcn@latest init --preset a1Dg5eFl # Use shared design system preset
npx shadcn@latest init --monorepo        # Monorepo setup
```

### components.json

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
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

**Why good:** Explicit aliases for consistent imports, CSS variables enable theming, iconLibrary configures default icon set

---

## cn() Utility Examples

### Conditional Classes

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

// Component with consumer className override
function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className  // Consumer's classes always last - overrides work
      )}
      {...props}
    />
  );
}
```

### Tailwind Merge Behavior

```tsx
// Without tailwind-merge (broken)
clsx("px-4", "px-6"); // "px-4 px-6" - both applied, unpredictable

// With cn() (correct)
cn("px-4", "px-6"); // "px-6" - later class wins

// Real example: consumer override works correctly
<Button className="px-8">Wide Button</Button>;
// Internal "px-4" replaced by "px-8", not both applied
```

**Why good:** `cn()` resolves Tailwind class conflicts intelligently, consumer overrides work as expected

---

## Skeleton Loading

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

**Why good:** Skeleton matches actual content layout dimensions, provides smooth loading transition
