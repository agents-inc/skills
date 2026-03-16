# shadcn/ui - Theming Examples

> Custom colors, dark mode setup, and theme-aware components. See [core.md](core.md) for CSS structure basics.

**Prerequisites**: Understand the CSS variable naming convention (background/foreground pairs, OKLCH format) from SKILL.md Pattern 2.

---

## Custom Brand Colors (OKLCH)

Adding colors beyond the defaults requires three things: CSS variables in `:root` and `.dark`, and the `@theme inline` mapping.

```css
:root {
  /* Custom brand colors - add alongside default shadcn variables */
  --brand: oklch(0.627 0.265 303.9); /* Purple */
  --brand-foreground: oklch(1 0 0);

  --success: oklch(0.527 0.154 150.069); /* Green */
  --success-foreground: oklch(1 0 0);

  --warning: oklch(0.795 0.184 86.047); /* Amber */
  --warning-foreground: oklch(0.145 0 0);
}

.dark {
  --brand: oklch(0.627 0.265 303.9);
  --brand-foreground: oklch(1 0 0);

  --success: oklch(0.627 0.194 149.214);
  --success-foreground: oklch(1 0 0);

  --warning: oklch(0.795 0.184 86.047);
  --warning-foreground: oklch(0.145 0 0);
}

/* Map to Tailwind utilities */
@theme inline {
  /* ...existing mappings... */
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

### Usage

```tsx
<Button className="bg-brand text-brand-foreground hover:bg-brand/90">
  Brand Button
</Button>

<Badge className="bg-success text-success-foreground">
  Success
</Badge>
```

**Why good:** Custom colors follow same convention as defaults, opacity modifiers work (`/90`), dark mode automatic via `.dark` overrides

---

## Dark Mode Setup

### Theme Provider

```tsx
// providers.tsx
"use client";

// shadcn recommends next-themes for theme management
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}

// layout.tsx - suppressHydrationWarning prevents flash
import { Providers } from "./providers";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Theme Toggle with Dropdown

```tsx
"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          {/* Sun/Moon icons - use your icon solution */}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Why good:** Dropdown provides all theme options, system detection works automatically, `suppressHydrationWarning` prevents flash

---

## Theme-Aware Custom Components

### Using CSS Variables for Status Colors

```tsx
import { cn } from "@/lib/utils";

export function StatusCard({
  status,
}: {
  status: "success" | "warning" | "error";
}) {
  const statusColors = {
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    error: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className={cn("rounded-lg border p-4", statusColors[status])}>
      {/* Content automatically adapts to light/dark theme */}
    </div>
  );
}
```

### Reading Theme Colors in JavaScript

Only needed for third-party libraries (charts, canvas) that require color values programmatically.

```tsx
import { useTheme } from "next-themes";

export function ChartWrapper() {
  const { resolvedTheme } = useTheme();

  const getColor = (variable: string) => {
    if (typeof window === "undefined") return "";
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim();
  };

  // OKLCH values are already complete - no wrapper needed
  const primaryColor = getColor("--primary");

  return <ThirdPartyChart color={primaryColor} />;
}
```

**Why good:** Components adapt to theme automatically, JavaScript access only when truly needed, OKLCH values used directly

---

## Chart Configuration (Tailwind v4)

With Tailwind v4, theme colors include the color format. Remove any `hsl()` wrapper from older configs.

```typescript
// Tailwind v4 - OKLCH values include format, no wrapper needed
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;
```

**Why good:** Direct variable reference, no format wrapper confusion between HSL and OKLCH
