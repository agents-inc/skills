# Package Architecture - Examples

---

## Workspace Structure

### Example: Turborepo Monorepo Structure

```
monorepo/
├── apps/
│   ├── web/                    # Next.js customer-facing app
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── admin/                  # Admin dashboard
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── ui/                     # Shared component library
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── button/
│   │   │   │   └── input/
│   │   │   └── styles/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── api-client/             # Shared API client
│   │   ├── src/
│   │   │   ├── generated/      # OpenAPI generated
│   │   │   └── client.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── config/                 # Shared configurations
│   │   ├── eslint-config.js
│   │   ├── tsconfig.base.json
│   │   └── package.json
│   └── types/                  # Shared TypeScript types
│       ├── src/
│       └── package.json
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Why:** Clear separation. Shared code reuse. Independent deployments. Scales with team size.

**Edge Cases:**

- Use workspace protocol for internal deps: `"@repo/ui": "workspace:*"`
- Build packages before apps with `dependsOn: ["^build"]`
- Consider publishing packages to private npm registry

---

### Example: Shared UI Package Configuration

```json
// packages/ui/package.json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    "./button": "./src/components/button/button.tsx",
    "./input": "./src/components/input/input.tsx",
    "./select": "./src/components/select/select.tsx"
  },
  "scripts": {
    "lint": "eslint src/",
    "type-check": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

```typescript
// packages/ui/src/components/button/button.tsx
export type ButtonProps = {
  variant?: "default" | "ghost" | "link";
  size?: "default" | "large" | "icon";
  // ... other props
};

export const Button = ({ variant, size, ...props }: ButtonProps) => {
  // Component implementation
};
```

```json
// apps/web/package.json
{
  "name": "web",
  "dependencies": {
    "@repo/ui": "*",
    "@repo/api-client": "*",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

**Why:** Explicit exports enable tree-shaking. Type safety across packages. No build step needed. Direct source imports prevent accessing internal implementation.

**Edge Cases:**

- Use TypeScript project references for better IDE performance
- Consider building packages for published libraries
- Use `*` for always-latest internal deps (or `workspace:*` with pnpm)

---

### Example: Feature-Based Folder Structure

```
apps/web/src/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── dashboard/
│   └── layout.tsx
├── features/                   # Feature slices
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm/
│   │   │   └── RegisterForm/
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useLogin.ts
│   │   ├── services/
│   │   │   └── auth-service.ts
│   │   └── types/
│   │       └── auth.types.ts
│   ├── products/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   └── checkout/
├── components/                 # Shared components
│   ├── Layout/
│   ├── ErrorBoundary/
│   └── PageLoader/
├── hooks/                      # Global hooks
│   ├── useDebounce.ts
│   └── useLocalStorage.ts
├── lib/                        # Utilities
│   ├── api-client.ts
│   ├── utils.ts
│   └── cn.ts
└── types/                      # Global types
    └── common.types.ts
```

**Why:** Colocation. Clear boundaries. Easy to find code. Scales to large teams.

**Edge Cases:**

- Keep feature imports one-way (features never import each other)
- Share code via hooks/components/lib, not between features
- Consider feature folders in packages/ for true independence

---

### Example: Shared Configuration Packages

```javascript
// packages/config/eslint-config.js
module.exports = {
  extends: ["next/core-web-vitals", "plugin:@typescript-eslint/recommended", "prettier"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "error",
  },
};
```

```json
// packages/config/tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true
  }
}
```

```json
// apps/web/tsconfig.json
{
  "extends": "@repo/config/tsconfig.base.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Why:** Single source of truth. Consistent rules across apps. Easy updates. Less duplication.

**Edge Cases:**

- Allow app-specific overrides when needed
- Keep base config minimal
- Version config packages for major changes

---

## Package Naming Conventions

_Examples coming soon_

---

## Dependency Boundaries

### Example: Internal Package Dependencies

```json
// packages/api-client/package.json
{
  "name": "@repo/api-client",
  "dependencies": {
    "@repo/types": "workspace:*"
  }
}

// packages/ui/package.json
{
  "name": "@repo/ui",
  "dependencies": {
    "@repo/types": "workspace:*"
  }
}

// apps/web/package.json
{
  "name": "web",
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/api-client": "workspace:*",
    "@repo/types": "workspace:*"
  }
}
```

**Dependency Graph:**

```
apps/web
  ├── @repo/ui → @repo/types
  ├── @repo/api-client → @repo/types
  └── @repo/types

apps/admin
  ├── @repo/ui → @repo/types
  ├── @repo/api-client → @repo/types
  └── @repo/types
```

**Why:** Shared types. No duplication. Correct build order. Clear dependencies.

**Edge Cases:**

- Avoid circular dependencies (packages can't depend on each other in a cycle)
- Use Turborepo's dependency graph to visualize
- Consider extracting common deps to reduce bundle size

---

## Import Conventions

### Example: Explicit Package Exports (Preferred)

**Pattern:** Use explicit `exports` field in package.json instead of barrel exports (index.ts)

```json
// packages/ui/package.json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    // Styles
    "./global.scss": "./src/styles/global.scss",
    "./variables.scss": "./src/styles/variables.scss",

    // Components (explicit paths)
    "./button": "./src/components/button/button.tsx",
    "./input": "./src/components/input/input.tsx",

    // Hooks (barrel export acceptable for small collection)
    "./hooks": "./src/hooks/index.ts",

    // Prevent access to other paths
    "./package.json": "./package.json"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

**Usage in apps:**

```typescript
// apps/web/src/components/LoginForm.tsx

// ✅ GOOD: Import from explicit exports
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";

// ❌ BAD: Import from internal paths (blocked by exports)
import { Button } from "@repo/ui/src/components/button/button";
```

**Corresponding TypeScript configuration:**

```json
// apps/web/tsconfig.json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "moduleResolution": "bundler",  // Supports exports field
    "paths": {
      "@/*": ["./src/*"]             // App-level path aliases
    }
  }
}
```

**Why:**

- **Tree-shaking:** Bundlers can eliminate unused exports more effectively
- **Clear API surface:** Only exported paths are accessible
- **Prevents internal imports:** Can't accidentally import internal implementation details
- **Better performance:** No barrel export re-exports that bundle everything
- **Explicit contracts:** Changes to internal structure don't break consumers
- **Runtime + IDE support:** Exports field works at runtime, TypeScript config provides IDE support

**Edge Cases:**

- TypeScript needs `moduleResolution: "bundler"` or `"node16"` for exports field support
- Use explicit paths for each component/utility - avoid wildcards
- Keep main/types fields for backward compatibility with older tools
- Exports field works at runtime, TypeScript config provides IDE support together they create a bulletproof import system

---

### Example: Barrel Exports (Legacy Pattern - Not Recommended)

**Anti-pattern:** Using index.ts to re-export everything

```typescript
// ❌ packages/ui/src/index.ts (DON'T DO THIS)
export { Button } from "./components/button/button";
export { Input } from "./components/input/input";
export { Select } from "./components/select/select";
export { Card } from "./components/card/card";
export { Modal } from "./components/modal/modal";
// ... 50 more exports

// Usage:
import { Button, Input, Select } from "@repo/ui";
```

**Why this is problematic:**

- ❌ **Poor tree-shaking:** Bundler may include entire package even if you only use one component
- ❌ **Namespace pollution:** All exports compete for the same namespace
- ❌ **Slow rebuilds:** Changing any component invalidates the entire barrel
- ❌ **No API surface control:** Everything exported is accessible
- ❌ **Circular dependency risks:** Easy to create circular imports

**When barrel exports are acceptable:**

- ✅ Small utility packages (< 10 exports)
- ✅ Closely related functions that are always used together
- ✅ Type-only exports (TypeScript types don't affect bundle size)


### Example: Import Standards in Practice

```typescript
// ✅ GOOD: Package exports
import { Button } from "@repo/ui/button";
import { getUsers } from "@repo/api/users";
import { formatDate } from "@repo/utils/date";

// ✅ GOOD: App-level path aliases for internal code
import { LoginForm } from "@/components/LoginForm";
import { useAuth } from "@/hooks/useAuth";

// ❌ BAD: Relative imports across many directories
import { LoginForm } from "../../../components/LoginForm";

// ❌ BAD: Importing from internal package paths
import { Button } from "@repo/ui/src/components/button/button";

// ❌ BAD: Barrel imports from large packages
import { Button, Input, Select, Card } from "@repo/ui";
```

**Why:**

- Package exports for cross-package imports (clear boundaries)
- Path aliases for internal app imports (convenience)
- Avoid deep relative imports (hard to refactor)
- Avoid barrel imports from large packages (bundle bloat)

---

### Example: Enforcing Import Conventions with TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "paths": {
      "@repo/ui": ["../packages/ui/src/index.ts"],      // ❌ Avoid this
      "@repo/ui/*": ["../packages/ui/src/*"]            // ❌ Bypasses exports
    }
  }
}
```

**Why this is bad:** TypeScript paths bypass the package.json exports field, allowing access to internal paths.

**Better approach:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
    // Don't map @repo/* - let package.json exports handle it
  }
}
```

**Why:** Let the package.json exports field be the single source of truth for what's importable.

---

## Versioning Strategy

_Examples coming soon_

---

## UI Library Organization

### Example: Four-Tier Component Hierarchy

The UI library should be organized in a clear hierarchy from simple to complex:

**Primitives → Components → Patterns → Templates**

```
packages/ui/src/
├── primitives/              # Tier 1: Basic building blocks (ESSENTIAL)
│   └── skeleton/
│       ├── skeleton.tsx
│       └── skeleton.module.scss
├── components/              # Tier 2: Reusable UI elements (ESSENTIAL)
│   ├── button/
│   │   ├── button.tsx
│   │   ├── button.module.scss
│   │   └── button.stories.tsx
│   ├── switch/
│   ├── select/
│   └── info/
├── patterns/                # Tier 3: Composed features (RECOMMENDED)
│   ├── feature/
│   │   ├── feature.tsx
│   │   ├── feature.module.scss
│   │   └── feature.stories.tsx
│   ├── navigation/
│   ├── socials/
│   └── appSwitcher/
└── templates/               # Tier 4: Page layouts (RECOMMENDED)
    └── frame/
        ├── frame.tsx
        ├── frame.module.scss
        └── frame.stories.tsx
```

**Why:** Clear progression from simple to complex. Easy to find components. Encourages reuse and composition.

**Edge Cases:**

- Primitives and Components are **essential** - every UI library needs these
- Patterns and Templates are **recommended** but optional for smaller projects
- Don't over-engineer - if your project is small, Primitives + Components may be enough
- Move components up the hierarchy as they prove useful across the codebase

---

### Example: Tier 1 - Primitives

**Purpose:** Most basic UI building blocks with minimal logic

```typescript
// packages/ui/src/primitives/skeleton/skeleton.tsx
import clsx from "clsx";
import styles from "./skeleton.module.scss";

export type SkeletonProps = {
  className?: string;
};

export const Skeleton = ({ className }: SkeletonProps) => {
  return <div className={clsx(styles.skeleton, className)} />;
};
```

```scss
// packages/ui/src/primitives/skeleton/skeleton.module.scss
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-subtle) 25%,
    var(--color-surface-base) 50%,
    var(--color-surface-subtle) 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Characteristics:**

- ✅ Highly reusable, single responsibility
- ✅ No business logic, pure presentation
- ✅ Minimal dependencies
- ✅ Used by Components and Patterns

**When to use:** Basic visual elements that appear everywhere (loading states, dividers, spacers)

---

### Example: Tier 2 - Components

**Purpose:** Reusable UI components with self-contained behavior

```typescript
// packages/ui/src/components/button/button.tsx
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import clsx from "clsx";
import React from "react";
import styles from "./button.module.scss";

const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: clsx(styles.btn, styles.btnDefault),
      ghost: clsx(styles.btn, styles.btnGhost),
      link: clsx(styles.btn, styles.btnLink),
    },
    size: {
      default: clsx(styles.btn, styles.btnSizeDefault),
      large: clsx(styles.btn, styles.btnSizeLarge),
      icon: clsx(styles.btn, styles.btnSizeIcon),
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={clsx(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { buttonVariants };
```

**Characteristics:**

- ✅ Reusable across features
- ✅ Self-contained logic (variants, states)
- ✅ Accepts props for customization
- ❌ No business domain knowledge
- ❌ Doesn't fetch data

**When to use:** Interactive UI elements (buttons, inputs, modals, cards, badges, alerts)

---

### Example: Tier 3 - Patterns

**Purpose:** Higher-level compositions combining Components for specific use cases

```typescript
// packages/ui/src/patterns/feature/feature.tsx
import { Switch } from "@radix-ui/react-switch";
import clsx from "clsx";
import { useState } from "react";
import styles from "./feature.module.scss";

export type FeatureProps = {
  id: string;
  title: string;
  status: string;
  description: string;
};

export const Feature = ({ id, title, status, description }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li
      className={styles.feature}
      onClick={() => setIsExpanded(!isExpanded)}
      data-expanded={isExpanded}
    >
      <div className={styles.header}>
        <h3>{title}</h3>
        <Switch                           // ← Uses Component
          id={`${id}-switch`}
          checked={status === "done"}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {isExpanded && (
        <p className={styles.description}>{description}</p>
      )}
    </li>
  );
};
```

**Characteristics:**

- ✅ Composes multiple Components
- ✅ Domain-specific (knows about "features")
- ✅ More complex behavior
- ✅ Encapsulates common UI patterns
- ⚠️ May have some business logic

**When to use:** Repeating UI patterns, complex widgets, domain-specific compositions

---

### Example: Tier 4 - Templates

**Purpose:** Page-level layouts and structures

```typescript
// packages/ui/src/templates/frame/frame.tsx
import clsx from "clsx";
import { Navigation } from "../../patterns/navigation/navigation";
import { Socials } from "../../patterns/socials/socials";
import styles from "./frame.module.scss";

export type FrameProps = {
  children: React.ReactNode;
  className?: string;
};

export const Frame = ({ children, className }: FrameProps) => {
  return (
    <div className={clsx(styles.frame, className)}>
      <header className={styles.header}>
        <Navigation />                    // ← Uses Pattern
      </header>
      <main className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <Socials />                       // ← Uses Pattern
      </footer>
    </div>
  );
};
```

**Characteristics:**

- ✅ Defines page structure
- ✅ Handles layout concerns
- ✅ Composes Patterns and Components
- ⚠️ Accepts children/slots for content

**When to use:** Page layouts, app shells, consistent page structures


### Example: Composition Across Tiers

```typescript
// How tiers compose together in practice

// Template uses Patterns
<Frame>                       // Tier 4: Template
  <Navigation />              // Tier 3: Pattern
  {children}
</Frame>

// Pattern uses Components and Primitives
<Feature>                     // Tier 3: Pattern
  <Switch />                  // Tier 2: Component
  <Skeleton />                // Tier 1: Primitive
</Feature>

// Component uses Primitives
<Button>                      // Tier 2: Component
  <Skeleton />                // Tier 1: Primitive (loading state)
</Button>
```

**Why:** Each tier builds on the previous, creating a natural composition hierarchy. Changes to lower tiers cascade up predictably.

---

### Example: Decision Tree - Where Does My Component Go?

```
Creating a new UI element?
│
├─ Is it a basic visual element with no logic?
│  └─→ Primitives/ (skeleton, divider, spacer)
│
├─ Is it a reusable UI element used across many features?
│  └─→ Components/ (button, input, card, modal, badge)
│
├─ Does it combine components for a specific use case?
│  └─→ Patterns/ (feature list item, user profile card, search bar)
│
└─ Is it a page layout or structure?
   └─→ Templates/ (page frame, dashboard layout, auth layout)
```

**Edge Cases:**

- **Start simple:** When in doubt, start in Components. Move to Patterns when you find yourself repeating the composition
- **Avoid premature abstraction:** Don't create a Pattern until you've used the composition at least 2-3 times
- **Templates are optional:** Small apps may not need Templates - just use Patterns directly in pages
- **Domain language:** Pattern names should use your domain language ("Feature", "Navigation") while Component names should be generic ("Button", "Card")
