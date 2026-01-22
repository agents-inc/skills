# Testing - Ladle Story Examples

> Component documentation stories for design system. Reference from [SKILL.md](../SKILL.md).

---

## Design System Component Story

```typescript
// Good Example - Design system component stories
// packages/ui/src/components/button/button.stories.tsx
import type { Story } from "@ladle/react";
import { Button, type ButtonProps } from "./button";

export const Default: Story<ButtonProps> = () => (
  <Button>Default Button</Button>
);

export const Variants: Story<ButtonProps> = () => (
  <div style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
    <Button variant="default">Default</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="link">Link</Button>
  </div>
);

export const Sizes: Story<ButtonProps> = () => (
  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
    <Button size="default">Default Size</Button>
    <Button size="large">Large Size</Button>
    <Button size="icon">Icon</Button>
  </div>
);

export const Disabled: Story<ButtonProps> = () => (
  <Button disabled>Disabled Button</Button>
);

export const AsChild: Story<ButtonProps> = () => (
  <Button asChild>
    <a href="/link">Link styled as Button</a>
  </Button>
);
```

**Why good:** Shows all variants and states for design system components, helps designers and developers understand component capabilities, serves as visual regression testing base, demonstrates common use cases

```typescript
// Bad Example - Creating stories for app-specific features
// apps/client-next/app/features.stories.tsx  <- DON'T DO THIS
export const FeaturesPage = () => { ... };
```

**Why bad:** App-specific features aren't reusable design system components, stories are for shared component libraries not one-off pages, wastes time documenting non-reusable code

---

_For more patterns, see:_

- [core.md](core.md) - E2E and Unit testing essentials
- [integration.md](integration.md) - Integration tests with network mocking
- [anti-patterns.md](anti-patterns.md) - What NOT to test
