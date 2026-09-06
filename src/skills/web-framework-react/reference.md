# React Reference

> Decision trees, the React 18 → 19 migration table, and review checklists. See [SKILL.md](SKILL.md) for the patterns and red flags, and [examples/](examples/) for full code.

---

## Decision trees

### Accepting a ref

```
Does the component need ref access?
├─ YES → Does it expose a DOM element?
│   ├─ YES → Add `ref` to props and pass it to the element
│   └─ NO  → Expose named methods with useImperativeHandle
└─ NO → Do not accept a ref prop
```

### Variant props

```
Does the component have visual variants?
├─ YES → Two or more dimensions (colour and size)?
│   ├─ YES → Typed union props, rendered as data-* attributes
│   └─ NO  → One prop with three or more values, or nothing
└─ NO → className alone
```

### useCallback

```
Is the handler passed to a child?
├─ YES → Is that child wrapped in React.memo?
│   ├─ YES → useCallback earns its place
│   └─ NO  → Skip it — identity does not affect a DOM element
└─ NO → Skip it
```

### Custom hook or component

```
Is this reusable logic?
├─ YES → Does it render UI?
│   ├─ YES → Component
│   └─ NO  → Does it call hooks?
│       ├─ YES → Custom hook
│       └─ NO  → Plain function, no `use` prefix
└─ NO → Leave it inline
```

### Which form hook

```
Handling a form submission?
├─ Needs pending or error state → useActionState
├─ Needs the pending flag in a nested component → useFormStatus, from a child of <form>
├─ Needs the result on screen before the server replies → useOptimistic
└─ None of these → <form action={fn}> on its own
```

---

## React 18 → 19 migration

| React 18                                        | React 19                                  | Notes                                                                          |
| ----------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| `forwardRef((props, ref) => …)` + `displayName` | `ref` as a regular prop                   | The wrapper still compiles; nothing flags it                                   |
| `useState` for pending, error and result        | `useActionState`                          | Also restores submission before hydration, which `onSubmit` cannot             |
| Pending flag drilled to a submit button         | `useFormStatus` in the button             | Returns `false` if called in the component rendering `<form>`                  |
| `useRef` + `useEffect` for DOM setup            | Ref callback returning a cleanup function | The callback is no longer called with `null`; TypeScript rejects other returns |
| `useContext(Ctx)`                               | `use(Ctx)`                                | Legal after an early return; `useContext` still works                          |
| `<Ctx.Provider value={…}>`                      | `<Ctx value={…}>`                         | The provider form is deprecated                                                |

---

## Review checklists

### Component

- [ ] Accepts `ref` as a regular prop where it exposes a DOM element
- [ ] Exposes `className`
- [ ] Variant props only where two or more visual dimensions exist, surfaced as `data-*`
- [ ] Interactive elements have an accessible name

### React 19 form hooks

- [ ] `useActionState` where a form needs pending or error state
- [ ] `useFormStatus` called from a child of `<form>`
- [ ] `useOptimistic` setters inside a transition or a form action
- [ ] `use()` callers sit under `<Suspense>` and inside an error boundary

### Hook

- [ ] `use` prefix, and it actually calls hooks
- [ ] Dependency arrays name every reactive value read
- [ ] Timers, subscriptions and observers are cleaned up
- [ ] Browser APIs are guarded for server rendering
