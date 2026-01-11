---
name: frontend/react+mobx (@photoroom)
description: MobX observer, stores, i18n for Photoroom webapp
---

# React Component Patterns - Photoroom Webapp

> **Quick Guide:** Functional components with explicit TypeScript types. Use `observer()` for MobX reactivity. Use `type` for props (not interface). Use `useTranslation()` for i18n. Access stores via `stores` singleton. Named exports only (except App.tsx). Add `displayName` for React DevTools.

**Detailed Resources:**
- For code examples, see [examples.md](examples.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

<critical_requirements>

## CRITICAL: Before Using This Skill

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

Functional components with explicit TypeScript types and proper exports. Use `type` for props (ESLint enforced), default parameter values, and named exports.

See [examples.md](examples.md#pattern-1-basic-component-structure) for good/bad examples.

---

### Pattern 2: MobX Observer Wrapper

All components reading MobX observables MUST be wrapped with `observer()`. Add `displayName` for React DevTools debugging.

See [examples.md](examples.md#pattern-2-mobx-observer-wrapper) for implementation examples.

---

### Pattern 3: Props Extending HTML Attributes

Extend native HTML attributes for composability and prop spreading. This enables consumers to pass `id`, `data-*`, `aria-*` attributes.

See [examples.md](examples.md#pattern-3-props-extending-html-attributes) for implementation patterns.

---

### Pattern 4: useTranslation for i18n

All user-facing text must use translation keys via `useTranslation()` hook in components, or direct `t()` import in utilities/hooks.

See [examples.md](examples.md#pattern-4-usetranslation-for-i18n) for translation patterns.

---

### Pattern 5: Custom Hooks with Stores

Extract reusable logic into custom hooks that access stores via the singleton.

See [examples.md](examples.md#pattern-5-custom-hooks-with-stores) for hook patterns.

---

### Pattern 6: Promise-Based Modal Pattern

Use `useConfirmModal` for confirmation flows that return promises.

See [examples.md](examples.md#pattern-6-promise-based-modal-pattern) for modal implementation.

---

### Pattern 7: displayName Convention

Add `displayName` to components wrapped with `observer()` or `forwardRef()` for React DevTools debugging.

See [examples.md](examples.md#pattern-7-displayname-convention) for displayName patterns.

---

### Pattern 8: Component File Naming

PascalCase for component files, camelCase with `use` prefix for hooks, camelCase for utilities.

See [examples.md](examples.md#pattern-8-component-file-naming) for file naming conventions.

---

### Pattern 9: Avoiding useEffect with MobX

Use MobX reactions in stores instead of useEffect in components for side effects responding to observable changes.

**When useEffect IS appropriate:** URL parameter handling, focus management, integration with non-MobX libraries, browser API cleanup.

See [examples.md](examples.md#pattern-9-avoiding-useeffect-with-mobx) for reaction patterns.

---

### Pattern 10: useMemo with MobX

Use MobX computed values instead of useMemo for derived state. MobX computed values are automatically cached.

See [examples.md](examples.md#pattern-10-usememo-with-mobx) for computed patterns.

</patterns>

---

<integration>

## Integration Guide

**Integrates with:**

- **MobX**: Components reading observables must use `observer()` wrapper
- **Data fetching solutions**: Server state management, integrated in custom hooks with stores
- **i18next**: All user-facing text via `useTranslation()` or `t()`
- **Styling solution**: Class composition via utilities like `clsx`
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

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST wrap ALL components that read MobX observables with `observer()`)**

**(You MUST use `type` for props - NOT `interface` (ESLint enforced))**

**(You MUST use `useTranslation()` hook for ALL user-facing text)**

**(You MUST access stores via `stores` singleton - NEVER pass stores as props)**

**(You MUST use named exports - NO default exports except App.tsx)**

**Failure to follow these rules will break MobX reactivity, fail ESLint checks, and block internationalization.**

</critical_reminders>
