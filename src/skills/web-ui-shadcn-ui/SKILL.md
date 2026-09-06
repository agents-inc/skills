---
name: web-ui-shadcn-ui
description: shadcn/ui component library patterns, CLI usage, theming, customization
---

# shadcn/ui Component Patterns

> **Quick Guide:** shadcn/ui is a distribution rather than a dependency — `npx shadcn@latest add`
> writes component source into your repository and you own it from then on. Three consequences shape
> everything else: customisation means editing the file, not overriding it from outside; upgrades are
> a diff you review rather than a version bump; and the components arrive already composed out of a
> primitive library and utility CSS, which the source imports by name. Theme through CSS custom
> properties in OKLCH, merge classes through `cn()`, and lay fields out with `Field`, which replaced
> the form-library-coupled `Form`/`FormField` pattern.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — `components.json`, `cn()`, skeleton loading
- [examples/composition.md](examples/composition.md) — extending a component, responsive dialog/drawer
- [examples/forms.md](examples/forms.md) — `Field`, `FieldGroup`, `FieldSet`, the legacy `Form` pattern
- [examples/dialogs.md](examples/dialogs.md) — AlertDialog, Sheet, toasts
- [examples/data-table.md](examples/data-table.md) — table with sortable headers and row actions
- [examples/command-palette.md](examples/command-palette.md) — command menu with a keyboard shortcut
- [examples/theming.md](examples/theming.md) — custom OKLCH colours, dark mode, theme-aware components
- [reference.md](reference.md) — CLI commands, CSS variable table, anti-patterns, platform changes

---

## Which path applies

- **Which primitive library the components sit on.** `init --base radix` and `--base base` produce
  different component sources for the same registry entry. The shadcn-level API — the exported names,
  `cn()`, the variant props, `data-slot` — is identical either way, so everything in this skill holds;
  what differs is the primitive whose props you reach for when editing the source.
- **Field or the legacy Form.** New work uses `Field` and its siblings, which are layout only. A
  codebase already on `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` still works; those are
  bound to one form library and are not where new fields should go. Both are in
  [examples/forms.md](examples/forms.md).

---

<critical_requirements>

## Before writing shadcn/ui code

**Add components with `npx shadcn@latest add <name>`.** The CLI resolves the registry entry's
dependencies, installs the primitive packages it needs, writes the file to the path `components.json`
records, and rewrites imports to your configured aliases — none of which happens when source is
pasted from the documentation.

**Read the component source before changing its behaviour.** It is a file in your repository, not a
package boundary, so the answer to "can I change this" is always yes and the question worth asking is
what else imports it.

**Route every class through `cn()`, with the incoming `className` last.** It resolves conflicting
Tailwind utilities by keeping the last one, which is what makes a caller's `px-8` replace the
component's `px-4` instead of joining it in a specificity tie.

**Pair every new background colour with a foreground.** `--brand` without `--brand-foreground` leaves
text on that surface inheriting whatever came before, which usually passes in one theme and fails
contrast in the other. Add both, in `:root` and in `.dark`, plus the `@theme inline` mapping that
turns them into utilities.

**Prefer a variant to a one-off class.** A style that more than one caller needs belongs in the
component's variant map, where it is named and typed; a class list repeated at call sites is the
same decision made again each time.

</critical_requirements>

---

**Auto-detection:** shadcn/ui, shadcn, components.json, npx shadcn, shadcn@latest add, cn(),
data-slot, `@theme inline`, `--base radix`, `--base base`, Field, FieldLabel, FieldDescription,
FieldError, FieldGroup, FieldSet, FieldLegend, CommandDialog, SheetContent, AlertDialogAction,
`--primary-foreground`, `--sidebar-*`, `--chart-*`

**Applies to:**

- Getting components into a project and keeping them current — the CLI, `components.json`, diffs
- Editing owned component source: adding a variant, a prop, or a behaviour
- The theme contract — background/foreground pairs, OKLCH values, `@theme inline`, dark mode
- Composing the compound components the registry ships: Card, Dialog, Sheet, Tabs, Command, Field
- Choosing between the registry's overlapping components for a given interaction

**Handled elsewhere:**

- Utility-class authoring and the CSS pipeline — this skill settles which variables the components
  read; how the utility layer is configured and built is a separate concern
- The primitive library underneath — its own props, its `asChild` semantics and its accessibility
  contract belong to whichever primitive library the project selected
- Variant-map authoring as a general technique — this skill covers extending the variant maps that
  ship in the component source
- Form state, validation and submission — `Field` is layout and accessibility wiring, and holds no
  value

---

<philosophy>

shadcn/ui inverts the usual bargain. A component library gives you an API and keeps the source; this
gives you the source and keeps nothing. The registry is a starting point that stops being upstream
the moment the file lands.

That is why the CLI matters more than it looks. It is not a convenience wrapper around copy-paste —
it is the only thing that knows the registry entry's dependency graph, your alias configuration and
which primitive base you chose, and it is what makes `--diff` able to tell you later how far your
copy has drifted from the registry's.

**What the components are made of is named here as a fact of the composition.** The source the CLI
writes imports a primitive library, applies utility classes and declares a variant map — a skill that
would not name them could not describe the file the reader has open. Teaching those constituents is a
different job, and sits above under **Handled elsewhere**.

</philosophy>

---

<decision_framework>

## Choosing an overlay

```
Confirmation the user must answer?
└─ AlertDialog — no dismiss path except Cancel or Action

Form or detailed content?
├─ Wide viewport  → Dialog (centred)
└─ Narrow viewport → Drawer (rises from the bottom)
   Both at once → branch on a media query; see examples/composition.md

Editing in context, page still visible?
└─ Sheet — slides in from an edge

A short action or a single selection?
└─ Popover for content, DropdownMenu for a list of actions
```

## Choosing a field control

```
Text            → Input, or Textarea when it wraps
Two to five options, all worth showing → RadioGroup
Many options    → Select, or Combobox when it needs filtering
Several at once → Checkbox per option
A setting that takes effect immediately → Switch
An agreement or a term to accept        → Checkbox
A date          → Calendar, or DatePicker with a trigger

Whatever the control, wrap it in Field — not the legacy FormField.
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Installing and inspecting components

The CLI is the interface to the registry. `--dry-run`, `--diff` and `--view` all answer questions
about a component without writing anything, which is what makes reviewing an upgrade possible.

```bash
npx shadcn@latest init                  # writes components.json
npx shadcn@latest add button card dialog
npx shadcn@latest add button --diff     # how far your copy has drifted
npx shadcn@latest info                  # the resolved project context
```

Full command list: [reference.md](reference.md)

### Pattern 2: The theme contract

Every colour is a pair — a surface and the text that sits on it — declared in `:root`, overridden in
`.dark`, and exposed as a utility through `@theme inline`. A new colour needs all three or it exists
in only one of the two themes, or in none of the utilities.

```css
:root {
  --brand: oklch(0.627 0.265 303.9);
  --brand-foreground: oklch(1 0 0);
}

@theme inline {
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
}
```

`--brand-foreground` is the text colour used _on_ `--brand`, not a brand-coloured text — the naming
reads the opposite way round to most conventions, and getting it backwards produces invisible text.

Full code: [examples/theming.md](examples/theming.md)

### Pattern 3: `cn()` and why order matters

`cn()` is conflict resolution, not concatenation. Two utilities from the same group collapse to the
last one, so the incoming `className` goes last and a caller's override actually wins.

```tsx
cn("px-4", "px-8"); // → "px-8", not "px-4 px-8"

<div className={cn("rounded-lg border bg-card shadow-sm", className)} />;
```

Plain string concatenation leaves both classes in the list, and which one renders then depends on
their order in the generated stylesheet rather than on the call site.

Full code: [examples/core.md](examples/core.md)

### Pattern 4: Extending a component through its variant map

Each shipped component declares its styles as a variant map — a base class list plus named `variant`
and `size` axes, with the prop types derived from the map. You add a variant by editing that map in
your own source; there is no augmentation API because none is needed.

```tsx
variants: {
  variant: {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    brand: "bg-brand text-brand-foreground hover:bg-brand/90",  // added
  },
}

<Button variant="brand">Subscribe</Button>;
```

Adding a behavioural prop works the same way — see the loading button in
[examples/composition.md](examples/composition.md).

### Pattern 5: `Field` for form layout

`Field` and its siblings carry the label, description, error slot and the ARIA wiring between them,
and hold no value of their own. That is what makes them work with any form library, with server
actions, or with nothing at all.

```tsx
<Field data-invalid={hasError}>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" aria-invalid={hasError} />
  <FieldDescription>We will never share your email.</FieldDescription>
  {hasError && <FieldError errors={errors} />}
</Field>
```

The contract is those three points: `data-invalid` on `Field`, `aria-invalid` on the control, and
`FieldError` rendered only when there is an error. `FieldGroup`, `FieldSet` and `FieldLegend` group
fields; `orientation` switches label placement.

Full code: [examples/forms.md](examples/forms.md)

### Pattern 6: Composing the compound components

Card, Dialog, Sheet, Tabs and Command are each a set of parts. Wrap them to build something specific;
replacing the parts with plain elements loses the styling hooks and, in the overlays, the behaviour.

```tsx
function ProductCard({ title, price }: ProductCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>${price}</CardDescription>
      </CardHeader>
    </Card>
  );
}
```

`asChild` on a trigger merges it onto your child rather than nesting inside it, which is what keeps a
`Button` wrapping a link from rendering an anchor inside a button.

Full code: [examples/dialogs.md](examples/dialogs.md), [examples/command-palette.md](examples/command-palette.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- No `components.json` — every CLI command fails, since it is where the aliases, the style and the
  primitive base are recorded
- A background colour added without its `-foreground` pair — text on that surface inherits, and the
  result usually passes in one theme and fails contrast in the other
- A colour added to `:root` but not to `.dark`, or not mapped in `@theme inline` — it exists in one
  theme, or in no utility
- `hsl()` wrapped around a value that is already `oklch(...)` — an invalid colour, so the declaration
  is dropped and the element falls back to whatever it inherited
- A `Button` containing a link rather than `asChild` onto it — an anchor nested in a button is
  invalid HTML and reaches keyboard users as one confusing control
- A `Select` given neither `value` nor `defaultValue` while `onValueChange` is wired — it never
  displays a selection

**Surprising behaviour:**

- `--primary-foreground` is the text colour _on_ `--primary`, not a primary-coloured text
- Concatenating class strings instead of using `cn()` leaves both conflicting utilities present, so
  which one wins depends on stylesheet order rather than on the call site
- Editing a component in `components/ui/` is the intended workflow; `--diff` is how you later see
  what you changed against the registry
- Under React 19 the shipped components take `ref` as an ordinary prop and mark their parts with
  `data-slot` rather than exporting a class name to target
- A theme provider that reads the system preference needs `suppressHydrationWarning` on `<html>`,
  because the server cannot know which class the client will apply
- `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` still work and are still bound to one
  form library — `Field` is where new fields go
- Chart colours are read as `var(--chart-1)` directly; the `hsl()` wrapper older setups used is now
  wrong rather than merely redundant

</red_flags>
