# Performance Examples - Lazy Route Loading

> Code-splitting with TanStack Router lazy routes for bundle optimization. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Related patterns**: See other files in this folder:
- [core.md](core.md) - Essential MobX computed and observer patterns
- [cleanup.md](cleanup.md) - WebGL and MobxQuery resource cleanup
- [optimization.md](optimization.md) - Virtualization, shallow observables, avoiding premature optimization

---

## Pattern 3: Lazy Route Loading

### Good: Lazy route file

```typescript
// File: create.lazy.tsx
import { createLazyFileRoute } from "@tanstack/react-router";

import { CreatePage } from "containers/CreatePage";

export const Route = createLazyFileRoute("/create")({
  component: CreatePage,
});
```

**Why good:** Route component bundled separately and loaded on-demand, reduces initial bundle size, faster initial page load, TanStack Router handles loading automatically

### Bad: Non-lazy route for large feature

```typescript
// File: create.tsx (missing .lazy suffix)
import { createFileRoute } from "@tanstack/react-router";

import { CreatePage } from "containers/CreatePage";

export const Route = createFileRoute("/create")({
  component: CreatePage,
});
```

**Why bad:** Entire CreatePage and all its imports included in initial bundle, slower initial page load, wasted bandwidth if user never visits route

**When to use:** Secondary routes that are not part of the critical user path.

**When not to use:** Root layout, primary entry routes, routes with data requirements in loader.
