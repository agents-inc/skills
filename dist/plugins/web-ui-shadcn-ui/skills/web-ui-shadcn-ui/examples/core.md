# shadcn/ui - Core Examples

> Project configuration, `cn()` in full, and skeleton loading. See
> [theming.md](theming.md) for the colour system and [composition.md](composition.md) for extending a
> component.

---

## Project Setup

```bash
npx shadcn@latest init

# The prompts that matter:
#   Style        — "new-york"; the older "default" style is deprecated
#   Base color   — the neutral ramp everything else is measured against
#   CSS variables — yes, unless you have a reason; "no" hardcodes the palette
#                   into class names and gives up theming

npx shadcn@latest init --base radix       # choose the primitive library
npx shadcn@latest init --preset a1Dg5eFl  # apply a shared design-system preset
npx shadcn@latest init --monorepo
```

### components.json

Written by `init` and read by every later command. The `aliases` block is what lets the CLI rewrite a
registry payload's imports into paths your project resolves.

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

**Why good:** every generated file's imports come from this block, so the aliases are a contract
rather than a preference — change one here and the next `add` writes something inconsistent with what
is already on disk. `config: ""` is correct on Tailwind v4, where configuration lives in CSS rather
than in a config file. `cssVariables: true` is what makes the theme swappable at all.

---

## cn()

`clsx` handles the conditionals; `tailwind-merge` resolves conflicts between utilities of the same
kind, keeping the last.

```tsx
// lib/utils.ts — written by init
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Conditional classes

```tsx
import { cn } from "@/lib/utils";

<div className={cn("base-class", isActive && "active-class")} />

<div
  className={cn(
    "px-4 py-2 rounded-md",
    isDisabled && "opacity-50 cursor-not-allowed",
    isLoading && "animate-pulse",
    variant === "primary" && "bg-primary text-primary-foreground",
    variant === "secondary" && "bg-secondary text-secondary-foreground"
  )}
/>
```

### Why the incoming className goes last

```tsx
clsx("px-4", "px-6"); // "px-4 px-6" — both present; the winner depends on stylesheet order
cn("px-4", "px-6"); // "px-6"      — the conflict is resolved at call time

function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className, // last, so a caller's px-8 replaces the component's px-4
      )}
      {...props}
    />
  );
}
```

**Why good:** conflict resolution happens where the classes are combined, so the result is a single
deterministic string. Put `className` first and the component's own utilities win instead, which
makes every override look like it silently failed.

---

## Skeleton Loading

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

**Why good:** the skeleton mirrors the real layout's box sizes and nesting, so nothing shifts when
content arrives. Reusing `Card` and `CardHeader` rather than plain divs means the padding and radius
stay in step with the component if it is ever edited.
