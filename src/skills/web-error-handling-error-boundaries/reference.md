# Error Boundaries Reference

> Lookup tables and checklists. Decisions and red flags are in [SKILL.md](SKILL.md); code is in [examples/](examples/).

---

## What a boundary catches

| Where the error is thrown             | Caught?                                 |
| ------------------------------------- | --------------------------------------- |
| `render()`                            | Yes                                     |
| Constructor                           | Yes                                     |
| Lifecycle methods                     | Yes                                     |
| `getDerivedStateFromProps`            | Yes                                     |
| The boundary's own render             | No — escapes to the parent boundary     |
| Event handler                         | No — `try`/`catch`, then `showBoundary` |
| `setTimeout` / callback               | No — `try`/`catch` in the callback      |
| `async`/`await` or a rejected promise | No — `.catch()`, then `showBoundary`    |
| Server rendering                      | No — the rendering framework handles it |

## Lifecycle methods

| Method                     | Phase  | Returns / does             | Side effects |
| -------------------------- | ------ | -------------------------- | ------------ |
| `getDerivedStateFromError` | Render | New state for the fallback | Not allowed  |
| `componentDidCatch`        | Commit | Logging and reporting      | Allowed      |

## `react-error-boundary` props

| Prop                | Type                           | Purpose                         |
| ------------------- | ------------------------------ | ------------------------------- |
| `fallback`          | `ReactNode`                    | Static fallback UI              |
| `FallbackComponent` | `ComponentType<FallbackProps>` | Component that renders fallback |
| `fallbackRender`    | `(props) => ReactNode`         | Render prop for fallback        |
| `onError`           | `(error, info) => void`        | Reporting callback              |
| `onReset`           | `(details) => void`            | Runs when the boundary resets   |
| `resetKeys`         | `unknown[]`                    | Values whose change resets it   |

`FallbackProps` carries `error: Error` and `resetErrorBoundary: (...args: unknown[]) => void`.

Choosing among the three: `fallback` where the UI is static and needs neither the error nor the
reset; `FallbackComponent` where the same fallback serves several boundaries; `fallbackRender` for a
one-off that closes over something in scope. Only the last two receive `FallbackProps`.

## React 19 root error options

Accepted by both `createRoot` and `hydrateRoot`.

| Option               | Called when                                      |
| -------------------- | ------------------------------------------------ |
| `onCaughtError`      | A boundary caught the error                      |
| `onUncaughtError`    | No boundary caught it                            |
| `onRecoverableError` | React recovered on its own (hydration, suspense) |

Each handler receives `(error, errorInfo)`, where `errorInfo` carries
`componentStack: string | null`.

`captureOwnerStack()` returns the chain of components that **created** the element, rather than the
tree position `componentStack` gives. Development only — `null` in production.

---

## Checklists

**Boundary**

- [ ] `getDerivedStateFromError` returns state and does nothing else
- [ ] `componentDidCatch` reports through an injected callback rather than a hard-coded client
- [ ] Reset is reachable — a callback, `resetKeys`, or both
- [ ] Placed per feature area as well as at the root

**Fallback UI**

- [ ] `role="alert"`
- [ ] Retry is a `<button>`
- [ ] Says what failed, not just that something did
- [ ] Error details shown in development only

**Coverage**

- [ ] Children render when nothing throws
- [ ] The fallback replaces them when something does
- [ ] `onError` fires with the error and the component stack
- [ ] Reset restores the children once the throwing condition is gone
- [ ] A `resetKeys` change resets without user action
