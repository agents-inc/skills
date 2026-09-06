---
name: web-framework-react
description: Component architecture, hooks and React 19 patterns. Load when building or refactoring React components, custom hooks, forms, or async UI.
---

# React Patterns

> **Quick Guide:** React 19 settles four things this skill turns on — `ref` is a regular prop and `forwardRef` is redundant, form submission state comes from `useActionState`, `useFormStatus` reads the enclosing form only from a child component, and a ref callback may return a cleanup function. Components stay styling-agnostic by exposing `className` and expressing variants as `data-*` attributes.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — component shape, variant props, event handlers, accessible controls
- [examples/hooks.md](examples/hooks.md) — usePagination, useDebounce, useLocalStorage
- [examples/react-19-hooks.md](examples/react-19-hooks.md) — useActionState, useFormStatus, useOptimistic, use(), ref cleanup
- [reference.md](reference.md) — decision trees, anti-patterns with corrected code, component and hook checklists

---

## Which path applies

- **React rendered in the browser** — every pattern below applies as written, and form submission goes through `useActionState` in [examples/react-19-hooks.md](examples/react-19-hooks.md).
- **React rendered by a server framework** — submission and data loading belong to that framework's own server primitives, so skip Pattern 6 and take the component, hook, ref and error-boundary patterns unchanged.

---

<critical_requirements>

## Before writing React code

**Pass `ref` as a regular prop.** React 19 forwards it without `forwardRef`, which removes the wrapper and the manual `displayName`.

**Expose `className` on every reusable component.** It is the one seam a consumer has for styling a component this skill knows nothing about.

**Call `useFormStatus` from a component rendered inside the `<form>`.** Called in the component that renders the form it returns `pending: false` forever, with no error to show for it.

**Reach for `useActionState` when a form needs pending or error state.** It carries both, and `<form action={...}>` keeps working before hydration.

</critical_requirements>

---

**Auto-detection:** React 19, useActionState, useFormStatus, useOptimistic, use(), ref as prop, ref cleanup, forwardRef migration, React.ComponentProps, getDerivedStateFromError, componentDidCatch, useCallback, custom hook

**Applies to:**

- Component props, composition and variant APIs
- Migrating `forwardRef` components to ref-as-prop
- Form submission, optimistic updates and promise reading with the React 19 hooks
- Custom hooks for reusable stateful logic
- Error boundaries with retry

**Handled elsewhere:**

- Styling — a component takes `className` and exposes variants as `data-*`; which CSS approach fills them in is not its concern
- Client state that outlives a component, and server data with its caching and invalidation — components receive both as props and stay unaware of the source
- Routing, and the data a route loads
- Test doubles for the network

---

<patterns>

## Core patterns

### Pattern 1: Component shape

A reusable component spreads its element's own props, accepts `ref` directly, and expresses variants as `data-*` attributes any styling layer can target.

```typescript
export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "default" | "ghost" | "link";
  size?: "default" | "large" | "icon";
  ref?: React.Ref<HTMLButtonElement>;
};

export function Button({ variant = "default", size = "default", className, ref, ...props }: ButtonProps) {
  return <button className={className} data-variant={variant} data-size={size} ref={ref} {...props} />;
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Typed variant props

Give a component variant props once it has two or more visual dimensions. A component with one visual style takes `className` and nothing else — a union with a single member is an abstraction with no second case.

```typescript
export type AlertVariant = "info" | "warning" | "error" | "success";

export function Alert({ variant = "info", className, ref, ...props }: AlertProps) {
  return <div ref={ref} className={className} data-variant={variant} {...props} />;
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Event handler naming

`handle` prefixes an internal handler (`handleNameChange`), `on` prefixes a callback prop (`onSelect`), and each handler types its event — `FormEvent<HTMLFormElement>`, `ChangeEvent<HTMLInputElement>` — so a wrong field access fails at compile time.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Custom hooks

Logic that calls hooks and renders nothing is a `use`-prefixed hook rather than a component: pagination state, debounced values, persisted preferences.

Full code: [examples/hooks.md](examples/hooks.md)

---

### Pattern 5: Error boundaries with retry

A boundary catches render errors and hands back a reset function, so a transient failure costs one section rather than the page. Place one around each feature area, not only the root.

```typescript
interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}
```

A boundary is a class because there is no hook form of `getDerivedStateFromError`. Placement, recovery and fallback design are a subject of their own and are settled outside this skill.

---

### Pattern 6: useActionState for form submission

The hook returns the action's last result, the action to hand `<form action={...}>`, and a pending flag — replacing three `useState` calls and their reset logic.

```typescript
async function updateProfile(prevState: string | null, formData: FormData) {
  try {
    await saveProfile({ name: formData.get("name") as string });
    return null;
  } catch {
    return "Failed to save profile";
  }
}

const [error, submitAction, isPending] = useActionState(updateProfile, null);
```

Full code: [examples/react-19-hooks.md](examples/react-19-hooks.md)

---

### Pattern 7: useFormStatus for submit buttons

A submit button reads the enclosing form's pending state itself, so one button component serves every form and no form passes the flag down.

```typescript
import { useFormStatus } from "react-dom";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Submitting..." : children}
    </button>
  );
}
```

Full code: [examples/react-19-hooks.md](examples/react-19-hooks.md)

---

### Pattern 8: useOptimistic for instant feedback

Render the expected result immediately and let React revert it if the request fails. The setter is called inside `startTransition`.

```typescript
const [optimisticItems, addOptimistic] = useOptimistic(
  items,
  (state, update: Item) => [...state, { ...update, pending: true }],
);

startTransition(async () => {
  addOptimistic(newItem);
  await saveItem(newItem);
});
```

Full code: [examples/react-19-hooks.md](examples/react-19-hooks.md)

---

### Pattern 9: use() for promises and context

`use()` reads a promise or a context during render and, unlike `useContext`, may be called after an early return. A promise suspends until it resolves, so the caller sits under `<Suspense>` and a rejection is caught by an error boundary.

```typescript
function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise);
  return <ul>{comments.map((c) => <li key={c.id}>{c.text}</li>)}</ul>;
}

<Suspense fallback={<p>Loading...</p>}>
  <Comments commentsPromise={fetchComments()} />
</Suspense>
```

Full code: [examples/react-19-hooks.md](examples/react-19-hooks.md)

---

### Pattern 10: Ref callback cleanup

A ref callback may return a cleanup function, which runs on unmount — replacing the `useRef` + `useEffect` pair for DOM setup.

```typescript
<video
  ref={(video) => {
    if (!video) return;
    video.play();
    return () => {
      video.pause();
      video.currentTime = 0;
    };
  }}
  src={src}
/>
```

Full code: [examples/react-19-hooks.md](examples/react-19-hooks.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `useFormStatus` called in the component that renders `<form>` — `pending` stays false and the button never disables; call it from a child
- `use()` inside `try`/`catch` — it throws to suspend, so the catch swallows the suspension; wrap the caller in an error boundary instead
- The `useOptimistic` setter called outside a transition or a form action — React rejects the call, so the optimistic value never lands
- Browser APIs read during render under SSR — guard with `typeof window !== "undefined"` or move the read into an effect
- An error boundary relied on for event-handler, async or SSR errors — it catches render errors only, so those paths carry their own `try`/`catch`

**Surprising behaviour:**

- A ref callback returning anything but a cleanup function is a type error in React 19, and the callback is no longer called with `null` on unmount
- `useOptimistic` reverts on failure by itself, so a manual rollback fights it
- `useCallback` around a handler passed to a child that is not memoised costs an allocation and buys nothing; the React Compiler makes the wrapper redundant either way
- `forwardRef` still compiles, so nothing flags the wrapper and its `displayName` as dead weight
- A component without `className` cannot be styled by its consumer at all

</red_flags>
