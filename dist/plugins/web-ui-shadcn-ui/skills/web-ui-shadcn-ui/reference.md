# shadcn/ui Reference

> CLI commands, the variable table, anti-patterns with code, and what changed recently. See
> [SKILL.md](SKILL.md) for the decisions and [examples/](examples/) for full implementations.

---

## Where a change belongs

| What you are changing                   | Where it goes                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| A colour, globally                      | The CSS variable, in `:root` and `.dark`, plus `@theme inline`                              |
| A style every instance should have      | The component's variant map, in its own source                                              |
| A style one call site needs             | `className` on that call site, merged through `cn()`                                        |
| Behaviour every instance should have    | The component source — a new prop, or a new default                                         |
| Behaviour only some call sites need     | A wrapper component around the registry one                                                 |
| Something the registry has no entry for | A new component following the same shape: variant map, `cn()`, `data-slot`, forwarded props |

---

## Anti-Patterns

### Overriding from outside instead of editing the source

```tsx
// WRONG — an inline style sits outside the theme entirely, in both modes
<Button style={{ backgroundColor: "#3b82f6" }}>Click me</Button>

// WRONG — a literal palette class ignores the theme and does not follow dark mode
<Button className="bg-blue-500 hover:bg-blue-600">Click me</Button>

// CORRECT — a named variant, declared once in the source you own
<Button variant="default">Click me</Button>

// CORRECT — a themed one-off, still going through cn()
<Button className={cn("bg-brand hover:bg-brand/90")}>Click me</Button>
```

### Pasting component source instead of adding it

```bash
# WRONG — copying from the documentation site
#   misses the registry entry's dependencies, does not install the primitive
#   packages, writes to the wrong path, and leaves imports pointing at aliases
#   the project has not configured

# CORRECT
npx shadcn@latest add button
npx shadcn@latest add card dialog field
```

### Conditional class strings where a variant belongs

```tsx
// WRONG — the variation is untyped, unnamed, and re-derived at every call site
<button
  className={`px-4 py-2 ${
    isPrimary ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
  }`}
>
  Click
</button>

// CORRECT — the axis already exists
<Button variant={isPrimary ? "default" : "secondary"}>Click</Button>

// CORRECT — extend the map when the axis does not have the value yet
variants: {
  variant: {
    brand: "bg-brand text-brand-foreground hover:bg-brand/90",
  },
}
```

### Replacing compound parts with plain elements

```tsx
// WRONG — loses the styling hooks, and in an overlay the behaviour too
<div className="card">
  <div className="card-header"><h2>{title}</h2></div>
</div>

// CORRECT
<Card>
  <CardHeader>
    <CardTitle>{title}</CardTitle>
  </CardHeader>
</Card>
```

### A background colour with no foreground

```css
/* WRONG — text on --brand inherits from wherever it happens to sit */
:root {
  --brand: oklch(0.627 0.265 303.9);
}

/* CORRECT — the pair, in both themes */
:root {
  --brand: oklch(0.627 0.265 303.9);
  --brand-foreground: oklch(1 0 0);
}

.dark {
  --brand: oklch(0.627 0.265 303.9);
  --brand-foreground: oklch(1 0 0);
}
```

### Nesting an interactive element instead of `asChild`

```tsx
// WRONG — an anchor inside a button: invalid HTML, and two focus stops
<Button>
  <Link href="/dashboard">Dashboard</Link>
</Button>

// CORRECT — the Button's props merge onto the link, which is the only element rendered
<Button asChild>
  <Link href="/dashboard">Dashboard</Link>
</Button>
```

---

## CLI Commands

```bash
npx shadcn@latest init                  # write components.json
npx shadcn@latest init --base radix     # choose the primitive library
npx shadcn@latest init --base base
npx shadcn@latest init --preset CODE    # apply a shared design-system preset
npx shadcn@latest init --template       # scaffold a whole project
npx shadcn@latest init --monorepo
npx shadcn@latest add [component]
npx shadcn@latest add button --dry-run  # preview without writing
npx shadcn@latest add button --diff     # your copy against the registry's
npx shadcn@latest add button --view     # print the registry payload
npx shadcn@latest add button --path=packages/ui/src/components
npx shadcn@latest info                  # resolved project context
npx shadcn@latest docs combobox         # component docs in the terminal
npx shadcn@latest migrate radix         # individual primitive packages → the unified one
```

---

## CSS Variables

| Variable                                     | Purpose                                             |
| -------------------------------------------- | --------------------------------------------------- |
| `--background` / `--foreground`              | Page surface and its text                           |
| `--primary` / `--primary-foreground`         | Primary action                                      |
| `--secondary` / `--secondary-foreground`     | Secondary action                                    |
| `--muted` / `--muted-foreground`             | Recessed surface and text                           |
| `--accent` / `--accent-foreground`           | Hover and highlight                                 |
| `--destructive` / `--destructive-foreground` | Danger                                              |
| `--border`                                   | Border colour                                       |
| `--input`                                    | Input border                                        |
| `--ring`                                     | Focus ring                                          |
| `--radius`                                   | Base radius; `-sm`/`-md`/`-lg`/`-xl` derive from it |
| `--chart-1` … `--chart-5`                    | Chart series palette                                |
| `--sidebar`, `--sidebar-*`                   | Sidebar surfaces                                    |

Values are OKLCH. `@theme inline` maps each one to a utility; a variable without that mapping exists
in CSS but not as a class.

---

## Recent Additions

| Component      | Purpose                               |
| -------------- | ------------------------------------- |
| `field`        | Form-library-agnostic field layout    |
| `spinner`      | Loading indicator                     |
| `kbd`          | Keyboard shortcut display             |
| `button-group` | Grouped button container              |
| `input-group`  | Input with leading or trailing addons |
| `item`         | Flex container for list and card rows |
| `empty`        | Empty-state display                   |

Each is added the usual way — `npx shadcn@latest add <name>` — and each works on either primitive
base.

---

## Migration Notes

**Unified primitive package.** The individual `@radix-ui/react-*` packages were consolidated into a
single `radix-ui`. Component source that predates the change imports from the old paths:

```tsx
// before
import * as DialogPrimitive from "@radix-ui/react-dialog";

// after
import { Dialog as DialogPrimitive } from "radix-ui";
```

`npx shadcn@latest migrate radix` rewrites these across the components you own.

**Choosing a primitive base.** `init --base radix` and `--base base` select which primitive library
the generated source sits on. The shadcn-level API is the same either way; the difference shows when
you edit a component and reach for a primitive's own props.

**RTL.** The CLI transforms physical CSS classes to their logical equivalents at install time, so
generated components lay out correctly in right-to-left locales without a second set of overrides.

**CLI v4.** Adds `docs`, `init --template`, `--preset`, and `registry:base` for distributing a whole
design system as one payload.

---

## Checklist

- [ ] Added through the CLI, not pasted
- [ ] Lives at the path `components.json` records
- [ ] Classes merged through `cn()`, incoming `className` last
- [ ] Colours read from CSS variables rather than literal palette classes
- [ ] New colours have a `-foreground` pair, in `:root` and `.dark`, and an `@theme inline` mapping
- [ ] Repeated variations live in the variant map, not at the call site
- [ ] `asChild` used wherever a trigger wraps another interactive element
- [ ] Custom components accept and forward `className`
- [ ] ARIA attributes the primitive supplied still reach the DOM

---

## Sources

- [Documentation](https://ui.shadcn.com/docs)
- [Theming](https://ui.shadcn.com/docs/theming)
- [CLI reference](https://ui.shadcn.com/docs/cli)
- [Changelog](https://ui.shadcn.com/docs/changelog)
