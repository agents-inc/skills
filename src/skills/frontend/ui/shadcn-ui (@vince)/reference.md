# shadcn/ui Reference

> Decision frameworks, anti-patterns, and red flags for shadcn/ui development. See [SKILL.md](SKILL.md) for core concepts and [examples.md](examples.md) for code examples.

---

## Decision Framework

### When to Use shadcn/ui vs Other Options

```
Need UI components?
├─ Do you want full control over component source?
│   ├─ YES → shadcn/ui is ideal
│   └─ NO → Consider a traditional component library
├─ Are you using Tailwind CSS?
│   ├─ YES → shadcn/ui integrates perfectly
│   └─ NO → Consider other options or add Tailwind
├─ Do you need accessible components?
│   └─ YES → shadcn/ui (built on Radix) provides this
└─ Do you need a specific design system (Material, etc.)?
    ├─ YES → Use that design system's library
    └─ NO → shadcn/ui works with any design
```

### Component Addition Decision

```
Need a new component?
├─ Is it in shadcn/ui registry?
│   ├─ YES → npx shadcn@latest add [component]
│   └─ NO → Build custom component following shadcn patterns
├─ Does component need customization?
│   ├─ Styling only → Use CSS variables or cn()
│   ├─ Behavior change → Modify the component source
│   └─ Major change → Create wrapper or new component
└─ Is it a one-off component?
    ├─ YES → Build without variant system
    └─ NO → Follow shadcn variant patterns
```

### Theming Decision

```
Need to change appearance?
├─ Is it a global color change?
│   └─ Modify CSS variables in globals.css
├─ Is it a component-specific style?
│   ├─ All instances → Modify component source
│   └─ One instance → Use className prop with cn()
├─ Is it dark mode?
│   └─ Update variables in .dark class
└─ Is it a new color?
    └─ Add new CSS variable (follow naming convention)
```

### Dialog vs Sheet vs Drawer

```
Need to display content in an overlay?
├─ Is it a confirmation or alert?
│   └─ AlertDialog (blocks interaction until response)
├─ Is it a form or detailed content?
│   ├─ On desktop → Dialog (centered modal)
│   └─ On mobile → Drawer (slides from bottom)
├─ Is it contextual editing (list item, settings)?
│   └─ Sheet (slides from side)
├─ Does it need to stay open while interacting with page?
│   └─ Sheet (side panel pattern)
└─ Is it a quick action or selection?
    └─ Popover or DropdownMenu
```

### Form Component Selection

```
Building a form field?
├─ Is it text input?
│   ├─ Single line → Input
│   ├─ Multi-line → Textarea
│   └─ Sensitive → Input type="password"
├─ Is it a selection?
│   ├─ Few options (2-5) → RadioGroup or Tabs
│   ├─ Many options → Select or Combobox
│   └─ Multiple selections → Checkbox group
├─ Is it a boolean?
│   ├─ On/off setting → Switch
│   └─ Agreement/Terms → Checkbox
└─ Is it a date/time?
    └─ Calendar or DatePicker
```

---

## RED FLAGS

### High Priority Issues

- **Not using CLI for installation** - Manual copy leads to missing dependencies and inconsistent setup
- **Modifying CSS variables incorrectly** - Breaking OKLCH format (e.g., wrapping values in `hsl()` when they're already OKLCH)
- **Not using cn() utility** - Direct className concatenation breaks Tailwind class merging
- **Missing components.json** - CLI commands will fail without proper configuration
- **Hardcoding colors in components** - Use CSS variables for theme consistency

### Medium Priority Issues

- **Not using semantic color names** - Using `--gray-500` instead of `--muted-foreground` in components
- **Overriding styles with !important** - Use cn() and proper class ordering instead
- **Not exposing className prop** - Custom components should accept className for customization
- **Ignoring accessibility attributes** - Radix provides them, but custom extensions may break them
- **Not updating both :root and .dark** - New colors need both light and dark mode definitions

### Common Mistakes

- **Forgetting suppressHydrationWarning** - Causes hydration mismatch with theme provider
- **Not wrapping async actions in try/catch** - Toast errors need proper error handling
- **Using inline styles over CSS variables** - Breaks theming system
- **Not providing default values for variants** - Causes undefined className issues
- **Placing components outside ui/ directory** - Breaks CLI update commands

### Gotchas & Edge Cases

- **CSS variable format (Tailwind v4)** - Store with `oklch()`: `--primary: oklch(0.205 0 0)`, use directly: `bg-primary` via `@theme inline` mapping
- **Foreground convention** - `--primary-foreground` is text color ON `--primary` background, not the opposite
- **Server components** - Some components need "use client" directive for interactivity
- **Button asChild prop** - Use when wrapping with Link component to avoid nested buttons
- **FormField requires defaultValue** - Controlled inputs need initial values defined
- **Select component** - Requires both onValueChange and defaultValue for controlled usage
- **Toast positioning** - Toaster component position affects all toasts globally
- **React 19** - No forwardRef needed; ref is now a regular prop
- **data-slot attributes** - shadcn/ui components now include `data-slot` for enhanced styling capabilities
- **Chart config (Tailwind v4)** - Use `var(--chart-1)` directly, no `hsl()` wrapper needed

---

## Anti-Patterns

### Direct Style Overrides

Use CSS variables and cn() instead of inline styles or style prop overrides.

```tsx
// WRONG - Inline styles break theming
<Button style={{ backgroundColor: "#3b82f6" }}>Click me</Button>

// WRONG - Hardcoded Tailwind classes
<Button className="bg-blue-500 hover:bg-blue-600">Click me</Button>

// CORRECT - Use CSS variables (update in globals.css)
<Button variant="default">Click me</Button>

// CORRECT - Use cn() for conditional overrides
<Button className={cn("bg-brand hover:bg-brand/90")}>Click me</Button>
```

### Manual Component Copy

Use the CLI instead of manually copying component code.

```bash
# WRONG - Manual copy from documentation
# Copy-pasting code from ui.shadcn.com

# CORRECT - Use CLI
npx shadcn@latest add button
npx shadcn@latest add card dialog form
```

**Why CLI matters:** CLI resolves dependencies automatically, installs required Radix packages, creates proper file structure, adds utils if missing.

### Ignoring the Variant System

Use the variant system for component variations instead of conditional classes.

```tsx
// WRONG - Ad-hoc conditional classes
<button
  className={`px-4 py-2 ${
    isPrimary ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
  }`}
>
  Click
</button>

// CORRECT - Use variant props
<Button variant={isPrimary ? "default" : "secondary"}>Click</Button>

// CORRECT - Add new variant to component if needed
const buttonVariants = cva("...", {
  variants: {
    variant: {
      default: "...",
      secondary: "...",
      brand: "bg-brand text-brand-foreground hover:bg-brand/90", // New variant
    },
  },
});
```

### Breaking Composition Patterns

Maintain compound component patterns when customizing.

```tsx
// WRONG - Breaking compound structure
<div className="card">
  <div className="card-header">
    <h2>{title}</h2>
  </div>
</div>

// CORRECT - Use compound components
<Card>
  <CardHeader>
    <CardTitle>{title}</CardTitle>
  </CardHeader>
</Card>

// CORRECT - Extend, don't replace
function ProductCard({ title, price, ...props }) {
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>${price}</CardDescription>
      </CardHeader>
    </Card>
  );
}
```

### Missing Foreground Colors

Always define foreground colors when adding new background colors.

```css
/* WRONG - Background without foreground */
:root {
  --brand: 262 83% 58%;
  /* Missing --brand-foreground */
}

/* CORRECT - Pair background with foreground */
:root {
  --brand: 262 83% 58%;
  --brand-foreground: 0 0% 100%;
}

.dark {
  --brand: 263 70% 50%;
  --brand-foreground: 0 0% 100%;
}
```

### Not Using asChild for Polymorphism

Use asChild prop to compose with other components like Link.

```tsx
// WRONG - Nested interactive elements
<Button>
  <Link href="/dashboard">Dashboard</Link>
</Button>

// WRONG - Lost button styles
<Link href="/dashboard" className="...lots of button classes...">
  Dashboard
</Link>

// CORRECT - asChild merges components
<Button asChild>
  <Link href="/dashboard">Dashboard</Link>
</Button>
```

---

## Quick Reference

### CLI Commands

```bash
# Initialize project
npx shadcn@latest init

# Add components
npx shadcn@latest add [component]
npx shadcn@latest add button card dialog

# List available components
npx shadcn@latest add

# Add with specific path (monorepo)
npx shadcn@latest add button --path=packages/ui/src/components
```

### Essential CSS Variables (Tailwind v4 OKLCH)

| Variable | Purpose |
|----------|---------|
| `--background` | Page background |
| `--foreground` | Default text color |
| `--primary` | Primary action background |
| `--primary-foreground` | Text on primary |
| `--secondary` | Secondary action background |
| `--muted` | Subtle backgrounds |
| `--muted-foreground` | Subtle text |
| `--destructive` | Danger/error background |
| `--border` | Border color |
| `--input` | Input border color |
| `--ring` | Focus ring color |
| `--radius` | Border radius base |
| `--chart-1` through `--chart-5` | Chart color palette |
| `--sidebar` | Sidebar background |
| `--sidebar-foreground` | Sidebar text |
| `--sidebar-primary` | Sidebar primary action |

**Computed radius variables (via @theme inline):**
- `--radius-sm`: `calc(var(--radius) - 4px)`
- `--radius-md`: `calc(var(--radius) - 2px)`
- `--radius-lg`: `var(--radius)`
- `--radius-xl`: `calc(var(--radius) + 4px)`

### Component Import Pattern

```tsx
// Button
import { Button } from "@/components/ui/button";

// Card (compound)
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Dialog (compound)
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Form (compound)
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
```

### Component Checklist

- [ ] Used CLI to add component (`npx shadcn@latest add`)
- [ ] Component is in `components/ui/` directory
- [ ] Using `cn()` for class merging
- [ ] CSS variables used for colors (not hardcoded)
- [ ] Foreground color defined for new backgrounds
- [ ] Both `:root` and `.dark` updated for new colors
- [ ] Using variant system for component variations
- [ ] `asChild` used when composing with Link
- [ ] Accessibility attributes preserved
- [ ] `className` prop exposed on custom components

### Theming Checklist (Tailwind v4)

- [ ] `components.json` has `cssVariables: true`
- [ ] Colors defined in OKLCH format (e.g., `oklch(0.205 0 0)`)
- [ ] All colors have foreground pair
- [ ] `.dark` class has all color overrides
- [ ] `@theme inline` section maps variables to Tailwind utilities
- [ ] `@custom-variant dark` defined for dark mode
- [ ] ThemeProvider wraps application
- [ ] `suppressHydrationWarning` on html element
- [ ] Theme toggle component added
- [ ] Chart variables (`--chart-1` through `--chart-5`) defined if using charts
- [ ] Sidebar variables defined if using sidebar component

---

## Sources

- [shadcn/ui Official Documentation](https://ui.shadcn.com/docs)
- [shadcn/ui Theming Guide](https://ui.shadcn.com/docs/theming)
- [shadcn/ui Dark Mode Guide](https://ui.shadcn.com/docs/dark-mode)
- [shadcn/ui Form Components](https://ui.shadcn.com/docs/components/form)
- [Tailwind v4 Migration](https://ui.shadcn.com/docs/tailwind-v4)
- [Vercel Academy - Anatomy of shadcn/ui](https://vercel.com/academy/shadcn-ui/extending-shadcn-ui-with-custom-components)
- [shadcn/ui Best Practices](https://shadcraft.com/blog/the-complete-beginner-s-guide-to-shadcn-ui)
