---
name: frontend/react (@photoroom)
description: MobX observer, stores, i18n for Photoroom webapp
---

# React Component Patterns - Photoroom Webapp

> **Quick Guide:** Functional components with explicit TypeScript types. Use `observer()` for MobX reactivity. Use `type` for props (not interface). Use `useTranslation()` for i18n. Access stores via `stores` singleton. Named exports only (except App.tsx). Add `displayName` for React DevTools.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase component files, named exports, import ordering, `import type`, named constants)

**(You MUST wrap ALL components that read MobX observables with `observer()`)**

**(You MUST use `type` for props - NOT `interface` (ESLint enforced))**

**(You MUST use `useTranslation()` hook for ALL user-facing text)**

**(You MUST access stores via `stores` singleton - NEVER pass stores as props)**

**(You MUST use named exports - NO default exports except App.tsx)**

</critical_requirements>

---

**Auto-detection:** React components, observer, MobX, useTranslation, functional components, component patterns, props type

**When to use:**

- Building React components in the Photoroom webapp
- Components that read MobX observable state
- Components with user-facing text requiring translation
- Custom hooks that access stores
- Modal and confirmation patterns

**Key patterns covered:**

- Component structure with TypeScript types
- MobX observer wrapper for reactivity
- Props extending HTML attributes
- useTranslation for i18n
- Custom hooks with stores
- Promise-based modal pattern
- displayName convention

**When NOT to use:**

- Building stores (use `skill: frontend-mobx-state-work`)
- API integration (use `skill: frontend-api-work`)
- Styling patterns (use `skill: frontend-styling-work`)

---

<philosophy>

## Philosophy

React components in the Photoroom webapp are functional components with explicit TypeScript typing. MobX provides reactive state management - components reading observables must be wrapped with `observer()`. All user-facing text uses i18next translations. Stores are accessed via a singleton, never passed as props.

**Core principles:**

1. **Explicit typing** - Use `type` for props, not `interface`
2. **Reactive by design** - `observer()` wrapper for MobX integration
3. **Internationalized** - All text through `useTranslation()`
4. **Singleton stores** - Access via `stores` import, never props
5. **Named exports** - Tree-shakeable, consistent imports

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Basic Component Structure

Functional components with explicit TypeScript types and proper exports.

#### Type Definition

```typescript
// ✅ Good Example - Using type for props
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

```typescript
// ❌ Bad Example - Using interface
export interface AlertProps {
  severity?: AlertSeverity;
  children: React.ReactNode;
}

export default function Alert({ severity, children }) { ... }
```

**Why bad:** `interface` violates ESLint rule `@typescript-eslint/consistent-type-definitions`, default export prevents tree-shaking and violates project conventions, missing type annotations on function parameters

---

### Pattern 2: MobX Observer Wrapper

All components reading MobX observables MUST be wrapped with `observer()`.

#### Observer Implementation

```typescript
// ✅ Good Example - Component with observer wrapper
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

```typescript
// ❌ Bad Example - Missing observer wrapper
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

#### Observer with displayName

```typescript
// ✅ Good Example - Observer with displayName for DevTools
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

### Pattern 3: Props Extending HTML Attributes

Extend native HTML attributes for composability and prop spreading.

#### Props Extension Pattern

```typescript
// ✅ Good Example - Props extending HTML attributes
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

```typescript
// ❌ Bad Example - Not extending HTML attributes
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

### Pattern 4: useTranslation for i18n

All user-facing text must use translation keys via `useTranslation()` hook.

#### Basic Translation Usage

```typescript
// ✅ Good Example - Using useTranslation hook
import { useTranslation } from "react-i18next";

export const SaveButton = observer(() => {
  const { t } = useTranslation();

  return (
    <button>
      {t("common.save")}
    </button>
  );
});
```

**Why good:** `useTranslation()` hook reacts to language changes, text will update when user changes language, follows i18next conventions

```typescript
// ❌ Bad Example - Hardcoded user-facing text
export const SaveButton = () => {
  return (
    <button>Save</button>
  );
};
```

**Why bad:** hardcoded text won't be translated for international users, ESLint `i18next/no-literal-string` rule will warn

#### Translation with Parameters

```typescript
// ✅ Good Example - Translation with interpolation
import { useTranslation } from "react-i18next";

export const ExportProgress = observer(({ count }: { count: number }) => {
  const { t } = useTranslation();

  return (
    <span>
      {t("export.notification.loading", { count })}
    </span>
  );
});
```

**Why good:** translation key with interpolation allows dynamic values, count parameter is properly typed

#### Inline t() for Non-Component Code

```typescript
// ✅ Good Example - Direct t() import in hooks/utilities
import { t } from "i18next";

import { stores } from "stores";

export const useExport = () => {
  const { notificationsStore } = stores;

  const showError = () => {
    notificationsStore.addNotification({
      type: "danger",
      label: t("export.error.failed"),
    });
  };

  return { showError };
};
```

**Why good:** direct `t` import works in non-component code where hooks can't be used, appropriate for utilities and notification messages

**When not to use:** In React components, always prefer `useTranslation()` hook as it reacts to language changes.

---

### Pattern 5: Custom Hooks with Stores

Extract reusable logic into custom hooks that access stores.

#### Hook with Store Access

```typescript
// ✅ Good Example - Custom hook accessing stores
import { useRef, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { stores } from "stores";

import { createTeamApi } from "lib/APIs";

export const useCreateTeam = () => {
  const { notificationsStore, teamsStore, authStore } = stores;
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const originRef = useRef<CreateTeamOrigin | null>(null);
  const [teamNameSuggestion, setTeamNameSuggestion] = useState<string>();

  const {
    data: team,
    mutateAsync: createTeam,
    isPending: createTeamIsLoading,
    reset: resetCreateTeamMutation,
  } = useMutation({
    mutationFn: async (name: string) => createTeamApi(name),
    onError: () => {
      notificationsStore.addNotification({
        type: "danger",
        label: t("team.create.error"),
      });
    },
  });

  return {
    team,
    startCreateTeam,
    createTeam,
    createTeamIsLoading,
    completeCreateTeam,
    teamNameSuggestion,
    origin: originRef.current,
  };
};
```

**Why good:** stores accessed via singleton maintains MobX reactivity, React Query handles server state, notifications integrated for user feedback, translation for error messages

```typescript
// ❌ Bad Example - Passing stores as parameters
export const useCreateTeam = (notificationsStore, teamsStore) => {
  // ...
};

// In component:
const createTeam = useCreateTeam(stores.notificationsStore, stores.teamsStore);
```

**Why bad:** passing stores as parameters breaks MobX reactive chain, creates unnecessary coupling, harder to test, violates stores singleton pattern

---

### Pattern 6: Promise-Based Modal Pattern

Use `useConfirmModal` for confirmation flows that return promises.

#### useConfirmModal Implementation

```typescript
// ✅ Good Example - Promise-based confirmation modal
import { useCallback, useMemo, useRef, useState } from "react";

import { noop } from "lodash";

export type UseConfirmModalProps<T> = {
  defaultConfirmValue?: T;
  defaultCancelValue?: T;
  defaultIsOpen?: boolean;
};

export const useConfirmModal = <T,>({
  defaultConfirmValue,
  defaultCancelValue,
  defaultIsOpen = false,
}: UseConfirmModalProps<T> = {}) => {
  const [isOpen, setIsOpen] = useState(defaultIsOpen);
  const resolveRef = useRef<(value: [boolean, T | undefined]) => void>(noop);

  const openConfirmModal = useCallback(() => {
    return new Promise<[boolean, T | undefined]>((resolve) => {
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  return useMemo(() => [
    openConfirmModal,
    {
      isOpen,
      onConfirm: (value?: T) => {
        resolveRef.current([true, value ?? defaultConfirmValue]);
        setIsOpen(false);
      },
      onCancel: (value?: T) => {
        resolveRef.current([false, value ?? defaultCancelValue]);
        setIsOpen(false);
      },
    },
  ] as const, [openConfirmModal, isOpen, defaultConfirmValue, defaultCancelValue]);
};
```

**Why good:** async/await flow for modal confirmation, generic type enables custom return values, tuple return with `as const` preserves types

#### useConfirmModal Usage

```typescript
// ✅ Good Example - Using confirm modal in a flow
import { useTranslation } from "react-i18next";

import { ConfirmModal } from "components/ConfirmModal";

import { useConfirmModal } from "hooks/useConfirmModal";

export const DeleteButton = observer(() => {
  const { t } = useTranslation();
  const [openConfirm, confirmProps] = useConfirmModal();

  const handleDelete = async () => {
    const [confirmed] = await openConfirm();

    if (confirmed) {
      await deleteItem();
    }
  };

  return (
    <>
      <button onClick={handleDelete}>
        {t("common.delete")}
      </button>
      <ConfirmModal
        {...confirmProps}
        title={t("delete.confirm.title")}
        message={t("delete.confirm.message")}
      />
    </>
  );
});
```

**Why good:** clean async/await flow, modal state encapsulated in hook, spread props pattern for modal configuration

---

### Pattern 7: displayName Convention

Add `displayName` to components for React DevTools debugging.

#### displayName Pattern

```typescript
// ✅ Good Example - displayName on observer component
export const LightPromoBanner = observer(() => {
  // Component implementation
});

LightPromoBanner.displayName = "LightPromoBanner";
```

**Why good:** observer HOC obscures component name in DevTools, displayName restores proper identification, helps debugging in production

```typescript
// ❌ Bad Example - Missing displayName
export const LightPromoBanner = observer(() => {
  // Component implementation
});
// Shows as "Observer" in React DevTools
```

**Why bad:** component shows as generic "Observer" in React DevTools, makes debugging difficult, can't identify component in component tree

#### displayName for forwardRef

```typescript
// ✅ Good Example - displayName with forwardRef
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

### Pattern 8: Component File Naming

PascalCase for component files, matching component name.

#### File Naming Convention

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

---

### Pattern 9: Avoiding useEffect with MobX

Use MobX reactions in stores instead of useEffect in components.

#### MobX Reaction Pattern

```typescript
// ✅ Good Example - Reaction in store, not useEffect
// In store constructor:
class Store {
  constructor() {
    makeAutoObservable(this);

    reaction(
      () => this.isLoaded,
      (isLoaded) => {
        if (isLoaded) {
          this.doSomething();
        }
      }
    );
  }
}

// In component - just read state:
export const MyComponent = observer(() => {
  const { myStore } = stores;

  return <div>{myStore.isLoaded ? "Ready" : "Loading"}</div>;
});
```

**Why good:** side effects handled in store where logic belongs, component stays simple and declarative, no duplicate reactive systems

```typescript
// ❌ Bad Example - useEffect to react to MobX changes
export const MyComponent = observer(() => {
  const { myStore } = stores;

  useEffect(() => {
    if (myStore.isLoaded) {
      doSomething();
    }
  }, [myStore.isLoaded]);

  return <div>{myStore.isLoaded ? "Ready" : "Loading"}</div>;
});
```

**Why bad:** creates duplicate reactive system (MobX + useEffect), side effect logic scattered across components, harder to test and maintain

**When useEffect IS appropriate:**

- URL parameter handling
- Focus management after renders
- Integration with non-MobX libraries
- Browser API cleanup (resize observers, intersection observers)

---

### Pattern 10: useMemo with MobX

Use MobX computed values instead of useMemo for derived state.

#### Computed in Store Pattern

```typescript
// ✅ Good Example - Computed value in store
class Store {
  items: Item[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  get activeItems() {
    return this.items.filter(item => item.active);
  }
}

// In component - read computed directly:
export const ItemList = observer(() => {
  const { store } = stores;

  return (
    <ul>
      {store.activeItems.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
});
```

**Why good:** MobX `computed` values are automatically cached and only recalculate when dependencies change, no need for dependency array management

```typescript
// ❌ Bad Example - useMemo for MobX derived state
export const ItemList = observer(() => {
  const { store } = stores;

  const activeItems = useMemo(() => {
    return store.items.filter(item => item.active);
  }, [store.items]);

  return (
    <ul>
      {activeItems.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
});
```

**Why bad:** useMemo with MobX creates redundant memoization, MobX already tracks dependencies and caches computed values, dependency array management is error-prone

</patterns>

---

<anti_patterns>

## Anti-Patterns

### ❌ Missing observer() Wrapper

Components that read MobX observables without `observer()` will not re-render when state changes.

```typescript
// ❌ Anti-pattern - No observer wrapper
export const UserStatus = () => {
  const { authStore } = stores;
  return <div>{authStore.isLoggedIn ? "Logged in" : "Guest"}</div>;
};
// Component shows stale data - requires page reload to update
```

**Fix:** Wrap with `observer()` from `mobx-react-lite`.

---

### ❌ Using interface for Props

ESLint enforces `type` for props definitions via `@typescript-eslint/consistent-type-definitions`.

```typescript
// ❌ Anti-pattern - interface for props
export interface ButtonProps {
  label: string;
}
```

**Fix:** Use `type` instead:
```typescript
export type ButtonProps = {
  label: string;
};
```

---

### ❌ Passing Stores as Props

Passing stores as props breaks the MobX reactive chain and creates unnecessary coupling.

```typescript
// ❌ Anti-pattern - Stores as props
export const useCreateTeam = (notificationsStore, teamsStore) => { ... };
const hook = useCreateTeam(stores.notificationsStore, stores.teamsStore);
```

**Fix:** Access stores via the singleton:
```typescript
export const useCreateTeam = () => {
  const { notificationsStore, teamsStore } = stores;
  // ...
};
```

---

### ❌ useEffect for MobX State Changes

Using useEffect to react to MobX observable changes creates a duplicate reactive system.

```typescript
// ❌ Anti-pattern - useEffect with MobX
useEffect(() => {
  if (myStore.isLoaded) doSomething();
}, [myStore.isLoaded]);
```

**Fix:** Use `reaction()` in the store constructor instead.

---

### ❌ useMemo for MobX Derived State

MobX computed values already cache and track dependencies automatically.

```typescript
// ❌ Anti-pattern - useMemo with MobX
const activeItems = useMemo(() => store.items.filter(i => i.active), [store.items]);
```

**Fix:** Create a computed getter in the store:
```typescript
get activeItems() {
  return this.items.filter(item => item.active);
}
```

---

### ❌ Hardcoded User-Facing Text

All user-facing strings must use translation keys for internationalization.

```typescript
// ❌ Anti-pattern - Hardcoded text
<button>Save</button>
```

**Fix:** Use `useTranslation()`:
```typescript
const { t } = useTranslation();
<button>{t("common.save")}</button>
```

---

### ❌ Default Exports

Default exports prevent tree-shaking and violate project conventions.

```typescript
// ❌ Anti-pattern - Default export
export default function Button() { ... }
```

**Fix:** Use named exports:
```typescript
export const Button = () => { ... };
```

**Exception:** `App.tsx` may use default export.

</anti_patterns>

---

<decision_framework>

## Decision Framework

### When to Use observer()

```
Does component read MobX observable state?
├─ YES → Wrap with observer() ✓
└─ NO → Standard component (no wrapper needed)
```

### When to Use useTranslation vs t()

```
Is this a React component?
├─ YES → Use useTranslation() hook ✓
└─ NO → Is it a hook that could be in component context?
    ├─ YES → Use useTranslation() hook ✓
    └─ NO → Use direct t() import
```

### When to Use useEffect

```
Is the side effect in response to MobX state change?
├─ YES → Use reaction() in store instead
└─ NO → Is it synchronizing with external system?
    ├─ YES → useEffect is appropriate ✓
    └─ NO → Is it cleanup (event listeners, subscriptions)?
        ├─ YES → useEffect is appropriate ✓
        └─ NO → Evaluate if effect is needed at all
```

### When to Add displayName

```
Is component wrapped with observer()?
├─ YES → Add displayName ✓
└─ NO → Is component wrapped with forwardRef()?
    ├─ YES → Add displayName ✓
    └─ NO → displayName optional (name inferred)
```

### Type vs Interface

```
Defining props or local types?
├─ Use type ✓ (ESLint enforced)
└─ Exception: Declaration merging in .d.ts files → interface allowed
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **MobX**: Components reading observables must use `observer()` wrapper
- **React Query**: Use for server state, integrated in custom hooks with stores
- **i18next**: All user-facing text via `useTranslation()` or `t()`
- **Tailwind + clsx**: Primary styling approach for class composition
- **@photoroom/ui**: Design system components from shared package
- **@photoroom/icons**: Icon components (not lucide-react)

**Store Access:**

```typescript
import { stores } from "stores";

const { authStore, teamsStore, notificationsStore } = stores;
```

**Icon Usage:**

```typescript
import { ExclamationTriangleIcon } from "@photoroom/icons/lib/monochromes";

<ExclamationTriangleIcon className="h-4 w-4" />
```

**Replaces / Conflicts with:**

- **useState for derived state**: Use MobX computed values in stores
- **useEffect for MobX reactions**: Use `reaction()` in store constructors
- **useMemo for MobX derived data**: Use MobX computed (automatic caching)
- **interface for props**: Use `type` (ESLint enforced)

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Missing `observer()` wrapper on components reading MobX state (component won't re-render)
- ❌ Using `interface` for props (ESLint error - use `type`)
- ❌ Hardcoded user-facing text without translation (blocks internationalization)
- ❌ Passing stores as props instead of using singleton (breaks reactive chain)
- ❌ Default exports except App.tsx (prevents tree-shaking)

**Medium Priority Issues:**

- Missing `displayName` on observer/forwardRef components (breaks DevTools debugging)
- Using `useEffect` to sync MobX state (creates duplicate reactive system)
- Using `useMemo` for MobX derived state (redundant - use computed in store)
- Using `t` import in components instead of `useTranslation()` hook (won't react to language changes)
- Using lucide-react instead of @photoroom/icons (inconsistent with design system)

**Common Mistakes:**

- Syncing MobX state to local state with useState (unnecessary - read directly)
- Forgetting to destructure stores from singleton
- Missing translation keys for dynamic content
- Not extending HTML attributes on wrapper components

**Gotchas & Edge Cases:**

- `observer()` components don't infer displayName - must set manually
- Direct `t()` import doesn't react to language changes - use in hooks/utilities only
- MobX observables lose reactivity when destructured to primitives outside observer
- `useTranslation()` returns stable `t` function - no need to memoize
- Stories files exempt from `i18next/no-literal-string` rule

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST wrap ALL components that read MobX observables with `observer()`)**

**(You MUST use `type` for props - NOT `interface` (ESLint enforced))**

**(You MUST use `useTranslation()` hook for ALL user-facing text)**

**(You MUST access stores via `stores` singleton - NEVER pass stores as props)**

**(You MUST use named exports - NO default exports except App.tsx)**

**Failure to follow these rules will break MobX reactivity, fail ESLint checks, and block internationalization.**

</critical_reminders>
