# shadcn/ui - Theming Examples

> Complete CSS variable reference, custom colors, and theme-aware components.

---

## Complete Theme Configuration (Tailwind v4)

### Default CSS Variables with OKLCH

```css
/* globals.css - Tailwind v4 with OKLCH colors */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* Background colors */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);

  /* Card colors */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);

  /* Popover colors */
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);

  /* Primary colors */
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);

  /* Secondary colors */
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);

  /* Muted colors */
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);

  /* Accent colors */
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);

  /* Destructive colors */
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.577 0.245 27.325);

  /* Border and input */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  /* Chart colors */
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);

  /* Border radius */
  --radius: 0.625rem;

  /* Sidebar colors */
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);

  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);

  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);

  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);

  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);

  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);

  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);

  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.637 0.237 25.331);

  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);

  /* Chart colors (dark) */
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);

  /* Sidebar colors (dark) */
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.439 0 0);
}

/* Map CSS variables to Tailwind utilities */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
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

**Why good:** Complete reference for all CSS variables, OKLCH format provides better perceptual uniformity than HSL, `@theme inline` maps variables to Tailwind utilities, dark mode uses same variable names

---

## Custom Brand Colors

### Adding Brand, Success, and Warning Colors (OKLCH)

```css
/* Adding custom brand colors with OKLCH */
:root {
  /* Keep all default shadcn variables */

  /* Add custom brand colors */
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
```

### Extend @theme inline (Tailwind v4)

```css
/* Add to @theme inline section */
@theme inline {
  /* ... existing color mappings ... */
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

### Chart Configuration (Tailwind v4)

With Tailwind v4, theme colors now include the color format, so remove the `hsl()` wrapper:

```typescript
// Tailwind v4 - no hsl() wrapper needed
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)", // No hsl() wrapper
  },
  mobile: {
    label: "Mobile",
    color: "var(--chart-2)", // No hsl() wrapper
  },
} satisfies ChartConfig;
```

**Why good:** Foreground convention ensures readable text, custom colors follow same pattern as defaults, works with opacity modifiers, OKLCH provides better perceptual uniformity

---

## Complete Dark Mode Setup

### Provider Configuration

```tsx
// providers.tsx
"use client";

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

// layout.tsx
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

import { Moon, Sun, Monitor } from "lucide-react";
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
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Why good:** Dropdown provides all theme options, icons animate smoothly between states, sr-only text ensures accessibility

---

## Theme-Aware Components

### Using CSS Variables in Custom Components

```tsx
// Component that responds to theme automatically
export function StatusCard({ status }: { status: "success" | "warning" | "error" }) {
  const statusColors = {
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    error: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className={cn("rounded-lg border p-4", statusColors[status])}>
      {/* Content */}
    </div>
  );
}
```

### Dynamic Theme Colors

```tsx
// Reading theme in JavaScript (when needed)
import { useTheme } from "next-themes";

export function DynamicChart() {
  const { resolvedTheme } = useTheme();

  // Get computed CSS variable value (Tailwind v4 with OKLCH)
  const getColor = (variable: string) => {
    if (typeof window === "undefined") return "";
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim();
  };

  // OKLCH values are already complete - no wrapper needed
  const primaryColor = getColor("--primary");

  return <Chart color={primaryColor} />;
}
```

**Why good:** Components automatically adapt to theme, OKLCH values include full color format, JavaScript access when needed for third-party libraries
