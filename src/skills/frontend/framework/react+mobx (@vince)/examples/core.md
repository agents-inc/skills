# React + MobX - Core Examples

> Essential patterns for React components with MobX. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**
- [mobx-reactivity.md](mobx-reactivity.md) - Avoiding useEffect/useMemo with MobX
- [hooks.md](hooks.md) - Custom hooks with stores
- [i18n.md](i18n.md) - useTranslation patterns
- [patterns.md](patterns.md) - Promise-based modal pattern

---

## Pattern 1: Basic Component Structure

### Good Example - Using type for props

```typescript
export type AlertProps = {
  severity?: AlertSeverity;
  children: React.ReactNode;
};

export const Alert = ({ severity = "warning", children }: AlertProps) => {
  const { outerClassNames, icon: Icon } = severityVariants[severity];

  return (
    <div className={clsx("flex w-full items-center gap-2", outerClassNames)}>
      <Icon className="h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
};
```

**Why good:** `type` is enforced by ESLint, explicit props typing enables autocomplete and compile-time checking, default parameter value documents expected behavior, named export enables tree-shaking

### Bad Example - Using interface

```typescript
export interface AlertProps {
  severity?: AlertSeverity;
  children: React.ReactNode;
}

export default function Alert({ severity, children }) { ... }
```

**Why bad:** `interface` violates ESLint rule `@typescript-eslint/consistent-type-definitions`, default export prevents tree-shaking and violates project conventions, missing type annotations on function parameters

---

## Pattern 2: MobX Observer Wrapper

### Good Example - Component with observer wrapper

```typescript
import { observer } from "mobx-react-lite";

import { stores } from "stores";

export const UserStatus = observer(() => {
  const { authStore } = stores;

  return (
    <div>
      {authStore.isLoggedIn ? "Logged in" : "Guest"}
    </div>
  );
});
```

**Why good:** `observer()` enables MobX reactivity so component re-renders when `isLoggedIn` changes, stores accessed via singleton maintains reactive chain, no need for useEffect to sync state

### Bad Example - Missing observer wrapper

```typescript
import { stores } from "stores";

export const UserStatus = () => {
  const { authStore } = stores;

  return (
    <div>
      {authStore.isLoggedIn ? "Logged in" : "Guest"}
    </div>
  );
};
// Component won't re-render when isLoggedIn changes!
```

**Why bad:** without `observer()`, React doesn't know to re-render when MobX observables change, component will show stale data, requires page reload to see updated state

### Good Example - Observer with displayName for DevTools

```typescript
import { observer } from "mobx-react-lite";

import { stores } from "stores";

export const LightPromoBanner = observer(() => {
  const { authStore, entitlementsStore } = stores;

  if (entitlementsStore.isPro) return null;

  return (
    <div className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 p-4">
      <h3>Upgrade to Pro</h3>
      {/* Banner content */}
    </div>
  );
});

LightPromoBanner.displayName = "LightPromoBanner";
```

**Why good:** `displayName` makes component identifiable in React DevTools, observer components don't infer name automatically, helps debugging in production builds where names are minified

---

## Pattern 3: Props Extending HTML Attributes

### Good Example - Props extending HTML attributes

```typescript
export type LightPromoBannerProps = {
  title?: string;
  subtitle?: string;
  image?: React.ReactNode;
  className?: string;
  cta?: React.ReactNode;
  onClick?: () => void;
  onDismiss?: (event: React.MouseEvent<HTMLButtonElement>) => void;
} & React.HTMLAttributes<HTMLDivElement>;

export const LightPromoBanner = ({
  title,
  subtitle,
  className,
  ...rest
}: LightPromoBannerProps) => {
  return (
    <div className={clsx("base-classes", className)} {...rest}>
      {/* content */}
    </div>
  );
};
```

**Why good:** extending `HTMLAttributes` allows consumers to pass any valid div props, `className` prop enables custom styling, rest spread passes through HTML attributes like `id`, `data-*`, `aria-*`

### Bad Example - Not extending HTML attributes

```typescript
export type LightPromoBannerProps = {
  title?: string;
  className?: string;
};

export const LightPromoBanner = ({ title, className }: LightPromoBannerProps) => {
  return (
    <div className={className}>
      {title}
    </div>
  );
};
// Can't pass id, data-testid, aria-label, etc.
```

**Why bad:** consumers can't pass standard HTML attributes, breaks accessibility by blocking `aria-*` props, prevents testing by blocking `data-testid`

---

## Pattern 7: displayName Convention

### Good Example - displayName on observer component

```typescript
export const LightPromoBanner = observer(() => {
  // Component implementation
});

LightPromoBanner.displayName = "LightPromoBanner";
```

**Why good:** observer HOC obscures component name in DevTools, displayName restores proper identification, helps debugging in production

### Bad Example - Missing displayName

```typescript
export const LightPromoBanner = observer(() => {
  // Component implementation
});
// Shows as "Observer" in React DevTools
```

**Why bad:** component shows as generic "Observer" in React DevTools, makes debugging difficult, can't identify component in component tree

### Good Example - displayName with forwardRef

```typescript
import { forwardRef } from "react";

export type InputProps = {
  label?: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className, ...props }, ref) => {
    return (
      <div>
        {label && <label>{label}</label>}
        <input ref={ref} className={clsx("input-base", className)} {...props} />
      </div>
    );
  }
);

Input.displayName = "Input";
```

**Why good:** forwardRef also obscures component name, displayName required for proper DevTools identification

---

## Pattern 8: Component File Naming

### File Naming Convention

```
src/
├── components/
│   ├── Alert.tsx              # Component file - PascalCase
│   ├── ConfirmModal.tsx       # Multi-word component
│   └── LightPromoBanner/
│       ├── LightPromoBanner.tsx
│       └── LightPromoBanner.stories.tsx
├── hooks/
│   ├── useExport.ts           # Hook file - camelCase with use prefix
│   └── useCreateTeam.ts
└── utils/
    ├── array.ts               # Utility file - camelCase
    └── date.ts
```

**Why good:** PascalCase matches React component naming convention, easy to identify components vs utilities, stories colocated with component
