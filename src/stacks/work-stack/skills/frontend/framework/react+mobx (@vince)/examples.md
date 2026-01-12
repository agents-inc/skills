# React Component Examples

> Complete code examples for React component patterns. See [SKILL.md](SKILL.md) for core concepts.

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

## Pattern 4: useTranslation for i18n

### Good Example - Using useTranslation hook

```typescript
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

### Bad Example - Hardcoded user-facing text

```typescript
export const SaveButton = () => {
  return (
    <button>Save</button>
  );
};
```

**Why bad:** hardcoded text won't be translated for international users, ESLint `i18next/no-literal-string` rule will warn

### Good Example - Translation with interpolation

```typescript
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

### Good Example - Direct t() import in hooks/utilities

```typescript
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

---

## Pattern 5: Custom Hooks with Stores

### Good Example - Custom hook accessing stores

```typescript
import { useRef, useState, useCallback } from "react";

import { useTranslation } from "react-i18next";

import { stores } from "stores";

import { createTeamApi } from "lib/APIs";

export const useCreateTeam = () => {
  const { notificationsStore, teamsStore, authStore } = stores;
  const { t } = useTranslation();

  const originRef = useRef<CreateTeamOrigin | null>(null);
  const [teamNameSuggestion, setTeamNameSuggestion] = useState<string>();
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const createTeam = useCallback(async (name: string) => {
    setIsLoading(true);
    try {
      const result = await createTeamApi(name);
      setTeam(result);
      return result;
    } catch {
      notificationsStore.addNotification({
        type: "danger",
        label: t("team.create.error"),
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [notificationsStore, t]);

  return {
    team,
    createTeam,
    isLoading,
    teamNameSuggestion,
    origin: originRef.current,
  };
};
```

**Why good:** stores accessed via singleton maintains MobX reactivity, notifications integrated for user feedback, translation for error messages

### Bad Example - Passing stores as parameters

```typescript
export const useCreateTeam = (notificationsStore, teamsStore) => {
  // ...
};

// In component:
const createTeam = useCreateTeam(stores.notificationsStore, stores.teamsStore);
```

**Why bad:** passing stores as parameters breaks MobX reactive chain, creates unnecessary coupling, harder to test, violates stores singleton pattern

---

## Pattern 6: Promise-Based Modal Pattern

### Good Example - Promise-based confirmation modal

```typescript
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

### Good Example - Using confirm modal in a flow

```typescript
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

---

## Pattern 9: Avoiding useEffect with MobX

### Good Example - Reaction in store, not useEffect

```typescript
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

### Bad Example - useEffect to react to MobX changes

```typescript
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

---

## Pattern 10: useMemo with MobX

### Good Example - Computed value in store

```typescript
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

### Bad Example - useMemo for MobX derived state

```typescript
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
