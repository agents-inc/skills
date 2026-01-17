# shadcn/ui - Theming Examples

> Complete CSS variable reference, custom colors, and theme-aware components.

---

## Complete Theme Configuration

### Default CSS Variables

```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Background colors */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    /* Card colors */
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    /* Popover colors */
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    /* Primary colors */
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;

    /* Secondary colors */
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    /* Muted colors */
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    /* Accent colors */
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    /* Destructive colors */
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    /* Border and input */
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;

    /* Border radius */
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;

    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;

    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;

    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;

    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Why good:** Complete reference for all CSS variables, HSL format enables easy color manipulation, dark mode uses same variable names

---

## Custom Brand Colors

### Adding Brand, Success, and Warning Colors

```css
/* Adding custom brand colors */
:root {
  /* Keep all default shadcn variables */

  /* Add custom brand colors */
  --brand: 262.1 83.3% 57.8%; /* Purple */
  --brand-foreground: 0 0% 100%;

  --success: 142.1 76.2% 36.3%; /* Green */
  --success-foreground: 0 0% 100%;

  --warning: 45.4 93.4% 47.5%; /* Amber */
  --warning-foreground: 0 0% 0%;
}

.dark {
  --brand: 263.4 70% 50.4%;
  --brand-foreground: 0 0% 100%;

  --success: 142.1 70.6% 45.3%;
  --success-foreground: 0 0% 100%;

  --warning: 45.4 93.4% 47.5%;
  --warning-foreground: 0 0% 0%;
}
```

### Extend Tailwind Config

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  // ... existing config
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },
    },
  },
};

export default config;
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

**Why good:** Foreground convention ensures readable text, custom colors follow same pattern as defaults, works with opacity modifiers

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

  // Get computed CSS variable value
  const getColor = (variable: string) => {
    if (typeof window === "undefined") return "";
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim();
  };

  const primaryColor = `hsl(${getColor("--primary")})`;

  return <Chart color={primaryColor} />;
}
```

**Why good:** Components automatically adapt to theme, opacity modifiers work with HSL colors, JavaScript access when needed for third-party libraries
