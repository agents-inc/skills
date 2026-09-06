# shadcn/ui - Theming Examples

> Custom colours, dark mode, and components that follow the theme. See [core.md](core.md) for
> `components.json` and the `cssVariables` setting this all depends on.

**Prerequisites:** the background/foreground pairing and the OKLCH format, from SKILL.md Pattern 2.

---

## Custom Brand Colours

A new colour is three declarations, not one: the variables in `:root`, their overrides in `.dark`,
and the `@theme inline` mapping that turns them into utilities. Miss the third and `bg-brand` does
not exist; miss the second and the colour is stuck at its light value in dark mode.

```css
:root {
  --brand: oklch(0.627 0.265 303.9);
  --brand-foreground: oklch(1 0 0);

  --success: oklch(0.527 0.154 150.069);
  --success-foreground: oklch(1 0 0);

  --warning: oklch(0.795 0.184 86.047);
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

@theme inline {
  /* …existing mappings… */
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

```tsx
<Button className="bg-brand text-brand-foreground hover:bg-brand/90">
  Brand Button
</Button>

<Badge className="bg-success text-success-foreground">Success</Badge>
```

**Why good:** the custom colours follow the same pairing as the built-ins, so the opacity modifier
(`/90`) and dark mode both work without special handling. `--success` differs between the two themes
and `--brand` does not — which is a deliberate choice per colour, since a brand colour is usually
fixed while a status colour needs contrast against a changing surface.

---

## Dark Mode

### The provider contract

shadcn/ui reads the theme from a class on the document root — `.dark` — and nothing more. Any
provider satisfying these four points works:

1. Sets a class on `<html>`, rather than a data attribute or an inline style
2. Offers light, dark and "follow the system" as distinct states
3. Applies the class before first paint, so there is no flash of the wrong theme
4. Pairs with `suppressHydrationWarning` on `<html>`, because a server render cannot know which class
   the client will apply and React would otherwise report the mismatch

```tsx
export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* whichever provider meets the four points above */}
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

### Theme toggle

The toggle itself is shadcn components over whatever the provider exposes.

```tsx
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle({
  setTheme,
}: {
  setTheme: (theme: "light" | "dark" | "system") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          {/* Sun and moon glyphs from your icon set */}
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

**Why good:** "System" is a third state rather than the absence of a choice — a user who has picked
light explicitly should stay in light when their OS flips at sunset. `sr-only` names an
icon-only button, which is otherwise announced as "button" and nothing else.

---

## Theme-Aware Custom Components

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

  return <div className={cn("rounded-lg border p-4", statusColors[status])} />;
}
```

**Why good:** one colour token drives the surface, the text and the border at three opacities, so a
change to `--success` moves all three together. Nothing here branches on the theme, because the
variables already did.

### Reading a theme colour in JavaScript

Only needed where something outside CSS — a canvas, a charting library — wants a colour value rather
than a class.

```tsx
function themeColor(variable: string) {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
}

// OKLCH values are complete as they stand — no format wrapper
const primaryColor = themeColor("--primary");
```

**Why good:** reading from the document root picks up whichever theme class is currently applied, so
one call covers both. The `window` guard is what keeps it from throwing during a server render.

---

## Chart Configuration

Theme colours carry their own format, so the variable is used directly. An `hsl()` wrapper — correct
in older setups where the variables held bare channel values — now produces an invalid colour.

```typescript
const chartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies ChartConfig;
```
