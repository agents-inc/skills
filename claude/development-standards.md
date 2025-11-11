## Brief overview

Core development standards. These standards complement the existing component styling and Storybook documentation. **ALWAYS START SIMPLE** - iterate and refactor based on actual needs, not anticipated complexity.

---

## TIER 1: CRITICAL PRINCIPLES (Always Follow)

### ALWAYS START SIMPLE

- **Begin with the simplest possible implementation** that solves the problem
- Iterate and refactor based on actual needs, not anticipated complexity
- Avoid over-engineering - add complexity only when proven necessary
- Test simple solutions first before adding abstractions
- **Example:** Use plain CSS Modules before reaching for cva; use basic components before creating wrapper patterns

### Client Directive Usage

- **Mark components as `"use client"` only when necessary:**
  - Components using React hooks (useState, useEffect, useRef, etc.)
  - Components with event handlers (onClick, onChange, etc.)
  - Components using browser APIs
  - Components wrapping Radix UI primitives that require client-side JavaScript
- **Keep server components by default** for better performance
- **Pattern:** Place `"use client"` at the top of the file, before imports

```tsx
"use client";

import * as React from "react";
import styles from "./component.module.scss";
```

### File Colocation Standard

- **Always colocate related files together:**
  - `component.tsx` - Component implementation
  - `component.module.scss` - Component styles
  - `component.stories.tsx` - Storybook documentation (for apps/client-next)
  - `component.x.tsx` - Ladle documentation (for packages/ui)
- **Directory structure:** Each component gets its own folder
- **Naming:** Use kebab-case for folders and files (`button/button.tsx`, not `Button/Button.tsx`)

### Import Path Aliases

- **Use `@/` alias for imports within apps/client-next:**

```tsx
import { Button } from "@/components/ui/button/button";
import { cn } from "@/lib/utils";
import styles from "./component.module.scss";
```

- **Use relative imports for packages/ui:**

```tsx
import { Button } from "../../components/button/button";
import styles from "./component.module.scss";
```

- **Never use deep relative paths** like `../../../` in apps/client-next when `@/` is available

---

## TIER 2: ARCHITECTURAL PATTERNS (Follow Consistently)

### TypeScript Type Patterns

- **Use `React.ComponentProps<"element">` for extending native HTML elements:**

```tsx
function Component({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(styles.component, className)} {...props} />;
}
```

- **Use `React.ComponentProps<typeof Primitive>` for Radix UI components:**

```tsx
function Switch({ ...props }: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  return <SwitchPrimitives.Root {...props} />;
}
```

- **Export component prop types:**

```tsx
export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };
```

- **Use `PropsWithChildren` for wrapper components:**

```tsx
export const Wrapper = (props: PropsWithChildren<{ className?: string }>) => (
  <div className={cn(styles.wrapper, props.className)}>{props.children}</div>
);
```

### Component Composition Patterns

- **Use compound components for related UI elements:**

```tsx
// Define subcomponents
Frame.Main = FrameMain;
Frame.Aside = FrameAside;
Frame.Aside.Block = FrameAsideBlock;

// Usage
<Frame>
  <Frame.Main>Content</Frame.Main>
  <Frame.Aside>
    <Frame.Aside.Block>Block</Frame.Aside.Block>
  </Frame.Aside>
</Frame>;
```

- **Export both component and variants** when using cva:

```tsx
export { Button, buttonVariants };
```

- **Use `asChild` prop pattern** for polymorphic components (via Radix Slot):

```tsx
const Comp = asChild ? Slot : "button";
return <Comp {...props} />;
```

### Data Attribute Conventions

- **Use `data-slot` for component identification:**

```tsx
<button data-slot="button" className={styles.button}>
<div data-slot="card-header" className={styles.cardHeader}>
```

- **Use `data-state` for component states:**

```tsx
<div data-state={isOpen ? "open" : "closed"}>

// In SCSS
&[data-state="open"] {
  background-color: var(--color-surface-strong);
}
```

- **Use `data-active` for active states:**

```tsx
<li data-active={isActive}>

// In SCSS
&[data-active="true"] {
  color: var(--color-text-inverted);
}
```

- **Use `data-expanded` for expandable components:**

```tsx
<div data-expanded={isExpanded}>

// In SCSS
&[data-expanded="true"] {
  background-color: var(--color-surface-strong);
}
```

### Environment Variable Management

- **Use Zod for environment variable validation:**

```tsx
import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});
```

- **Create getter functions** instead of direct access:

```tsx
export function getClientEnv() {
  return clientSchema.parse(process.env);
}
```

- **Prefix client-side variables** with `NEXT_PUBLIC_`
- **Validate on access**, not on build

---

## TIER 3: CODE QUALITY STANDARDS (Maintain Consistency)

### CSS Reset and Base Styles

- **Use aggressive CSS reset** (apps/client-next/components/style/reset.scss):
  - Reset all elements to `unset`
  - Set `box-sizing: border-box` globally
  - Use `font-size: 62.5%` on html for rem calculations (1rem = 10px)
  - Reset buttons with `all: unset`
- **Import order for global styles:**

```scss
@use "./reset.scss";
@use "./design-tokens.scss";
@use "./utility-classes.scss";
```

### Dark Mode Implementation

- **Use SCSS mixin for dark theme:**

```scss
@use "./mixins.scss" as theme;

.dark {
  @include theme.dark-theme;
}
```

- **Define dark mode overrides in mixins.scss**, not inline
- **Use semantic color tokens** that automatically adapt to theme

### TanStack Table Patterns

- **Define column types separately:**

```tsx
export type Job = {
  id: number;
  status: "unread" | "read" | "applied";
  country: string;
  companyName: string;
  role: string;
};
```

- **Use `ColumnDef<TData, TValue>[]` for columns**
- **Create reusable header components:**

```tsx
const HeaderButton = ({ column, children }: PropsWithChildren<{ column: Column<any> }>) => (
  <Button onClick={() => column.toggleSorting()}>{children}</Button>
);
```

- **Implement standard table features:**
  - Sorting (`getSortedRowModel`)
  - Filtering (`getFilteredRowModel`)
  - Column visibility (`onColumnVisibilityChange`)
  - Row selection (`onRowSelectionChange`)
- **Use `flexRender` for cells and headers**

### Utility Class Patterns

- **Minimize utility classes** - prefer component-specific styles
- **Only create utilities for truly global patterns:**

```scss
.w-full {
  width: 100%;
}
```

- **Use `:global()` in SCSS modules** when targeting utility classes:

```scss
&:global(.border-b) {
  padding-bottom: var(--space-12);
}
```

- **Prefer design tokens over utilities** whenever possible

---

## TIER 4: OPTIMIZATION & BEST PRACTICES (Apply When Relevant)

### Monorepo Package Management

- **Use workspace protocol (`*`) for local packages:**

```json
"@repo/ui": "*"
```

- **Run `bun run deps:check`** before committing to catch version mismatches
- **Use `syncpack` to maintain consistent versions** across workspaces
- **Manual package exports** in packages/ui/package.json:

```json
"exports": {
  "./button": "./src/components/button/button.tsx"
}
```

- **Run `sync-package-exports` script** after adding new components to @repo/ui

### SCSS Module Patterns

- **Use `@use` instead of `@import`:**

```scss
@use "./mixins.scss" as theme;
@use "../../components/button/button.module.scss";
```

- **Use `@extend` for shared styles:**

```scss
%ghost-btn-hover {
  background-color: var(--color-background-base);
}

.button:hover {
  @extend %ghost-btn-hover;
}
```

- **Namespace mixins** when importing:

```scss
@use "./mixins.scss" as theme;
@include theme.dark-theme;
```

### Performance Patterns

- **Use `React.useMemo` for expensive calculations:**

```tsx
const total = React.useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [data]);
```

- **Use `React.useCallback` for event handlers passed to children**
- **Lazy load heavy components** when appropriate
- **Use `passive: true` for scroll listeners**
- **Avoid inline object/array creation** in render

### Accessibility Patterns

- **Always provide `aria-label` for icon-only buttons:**

```tsx
<button aria-label="Close dialog">
  <XIcon />
</button>
```

- **Use semantic HTML** (`<main>`, `<aside>`, `<nav>`)
- **Ensure keyboard navigation** works for interactive elements
- **Use `displayName` for React components:**

```tsx
Switch.displayName = "Switch";
```

- **Follow Radix UI accessibility patterns** when using primitives

### Commented Code Management

- **Use TODO comments with context:**

```tsx
// TODO: use css var instead of hardcoded value
const { elementRef, isStuck } = useSticky(8);
```

- **Keep commented code blocks** for features in progress:

```tsx
{
  /* <GroupdCard>
  <StackedBarCardInteractive />
</GroupdCard> */
}
```

- **Remove commented code** before marking features as complete
- **Use descriptive comments** for complex logic

---

## TIER 5: PROJECT-SPECIFIC CONVENTIONS (Context-Aware)

### Next.js App Router Patterns

- **Use App Router** (`app/` directory), not Pages Router
- **Colocate components** with routes when route-specific
- **Use `layout.tsx`** for shared layouts
- **Import global styles in root layout:**

```tsx
import "@repo/ui/global.scss";
import "../components/style/global.scss";
```

- **Use `metadata` export** for SEO:

```tsx
export const metadata: Metadata = {
  title: "Page Title",
  description: "Page description",
};
```

### Chart Component Patterns

- **Use Recharts** for data visualization
- **Define chart config with design tokens:**

```tsx
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig;
```

- **Use `React.useMemo` for chart data calculations**
- **Provide interactive controls** for chart filtering

### Storybook vs Ladle

- **Use Storybook** (`.stories.tsx`) for `apps/client-next` components
- **Use Ladle** (`.x.tsx`) for `packages/ui` components
- **Both should use `StoryWrapper`** for consistent backgrounds
- **Follow existing Storybook standards** from `.claude/storybook-standards.md`

### Build Configuration

- **TypeScript strict mode enabled** across all packages
- **ESLint with flat config** (eslint.config.js)
- **Prettier for formatting** - use `@repo/prettier-config`
- **Turbo for build orchestration**
- **tsup for library builds** (packages/ui)
- **Bun as package manager** (not npm/yarn/pnpm)

---

## Quick Reference: Creating a New Component

**When creating a new component:**

1. ✅ Start simple - basic implementation first
2. ✅ Colocate files (component.tsx + component.module.scss + stories)
3. ✅ Use `@/` imports in apps/client-next
4. ✅ Add `"use client"` only if needed
5. ✅ Use `React.ComponentProps<"element">` for types
6. ✅ Add `data-slot` attribute
7. ✅ Export component and types
8. ✅ Follow existing styling standards from `.claude/component-styling-standards.md`

**When adding interactivity:**

1. ✅ Mark as `"use client"`
2. ✅ Use `data-state` for state-based styling
3. ✅ Cleanup effects properly
4. ✅ Use passive listeners for scroll/resize
5. ✅ Memoize expensive calculations

**When working with tables:**

1. ✅ Define type for row data
2. ✅ Use `ColumnDef<TData, TValue>[]`
3. ✅ Implement sorting, filtering, visibility
4. ✅ Use `flexRender` for cells

**When styling:**

1. ✅ Follow `.claude/component-styling-standards.md`
2. ✅ Use design tokens from `design-tokens.scss`
3. ✅ Use `@use` not `@import`
4. ✅ Apply dark theme with mixin
5. ✅ Use `data-*` attributes for state styling
