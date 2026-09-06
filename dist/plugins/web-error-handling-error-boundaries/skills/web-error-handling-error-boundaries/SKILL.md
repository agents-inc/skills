---
name: web-error-handling-error-boundaries
description: Error boundary patterns, fallback UI, reset/retry, react-error-boundary library, React 19 createRoot error hooks
---

# React Error Boundaries

> **Quick Guide:** A boundary catches errors thrown during render, in lifecycle methods and in constructors, and swaps the subtree for fallback UI. It never sees event-handler, async or server-render errors — those reach it only when something calls `showBoundary()`. Boundaries are class components, because `getDerivedStateFromError` and `componentDidCatch` have no hook equivalent. React 19 adds `onCaughtError`, `onUncaughtError` and `onRecoverableError` on `createRoot`, which log rather than render and are silently ignored on React 18.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — the class boundary, `react-error-boundary` usage, `resetKeys`, `useErrorBoundary`, granular placement
- [examples/react-19-hooks.md](examples/react-19-hooks.md) — `createRoot`/`hydrateRoot` error options, `captureOwnerStack()`, error filtering
- [examples/recovery.md](examples/recovery.md) — retry limits, exponential backoff, error classification
- [examples/testing.md](examples/testing.md) — what makes a boundary testable, and the fixtures that do it
- [reference.md](reference.md) — what boundaries catch, lifecycle and prop tables, checklists

---

## Which path applies

- **No boundary dependency wanted** — write the class yourself; `getDerivedStateFromError` plus
  `componentDidCatch` is the whole API, and [examples/core.md](examples/core.md) has it in full.
- **`react-error-boundary` is available** — take `resetKeys`, `useErrorBoundary` and the
  `FallbackProps` type rather than reimplementing them, and follow
  [examples/core.md](examples/core.md).
- **React 19, and the question is logging rather than UI** — the three `createRoot` options report
  every error including the ones no boundary caught; see
  [examples/react-19-hooks.md](examples/react-19-hooks.md).

---

<critical_requirements>

## Before writing error boundary code

**Return new state from `getDerivedStateFromError` and put every side effect in `componentDidCatch`.** The first runs during render, where a fetch or a log call breaks React's phase rules; the second runs at commit, where they are safe.

**Wrap each feature area in its own boundary as well as the root.** A single root boundary turns one failing widget into a blank page, and the fallback can say what failed only when it sits beside the thing that failed.

**Give the fallback a way back — a reset callback, `resetKeys`, or both.** Without one the only recovery a user has is a full page reload, which costs them everything they had typed.

**Put `role="alert"` on the fallback and make its controls real buttons.** The subtree vanishing is silent otherwise, and a screen reader user gets no announcement that anything went wrong.

**Route async and event-handler failures through `showBoundary()`.** A boundary cannot see a rejected promise, so an unhandled one leaves the UI showing stale content with no error state at all.

</critical_requirements>

---

**Auto-detection:** error boundary, ErrorBoundary, getDerivedStateFromError, componentDidCatch, fallback UI, react-error-boundary, useErrorBoundary, showBoundary, error fallback, onCaughtError, onUncaughtError, onRecoverableError, captureOwnerStack, FallbackProps, resetKeys

**Applies to:**

- Catching render-phase errors and showing fallback UI in their place
- Reset and retry after a caught error, including retry limits and backoff
- Deciding where boundaries go and how coarse each one should be
- Centralised error reporting from the React root

**Handled elsewhere:**

- Errors thrown in server rendering — the rendering framework decides what a failed render sends to the client, and no client boundary is mounted yet.
- Request failures in a data layer — a boundary sees them only if something rethrows or calls `showBoundary()`; retry and cache invalidation belong to whatever fetches.
- Field-level validation feedback — an invalid form field is expected input, so it renders inline rather than replacing the subtree.
- The monitoring destination — `onError` and the root handlers hand you an error and a component stack, and where those go is the reporting tool's concern.

---

<philosophy>

## Philosophy

A render error that no boundary catches unmounts the entire tree: React tears the root down rather
than leave a half-rendered document on screen, so one thrown error anywhere becomes a blank page.

A boundary buys **isolation** against that: the blast radius is the subtree the nearest boundary
wraps, so where the boundaries sit decides how much of the page a single bug costs. That makes
placement the real decision — recovery, fallback wording and logging all follow from it.

Boundaries do not replace `try`/`catch`; they cover the one region `try`/`catch` cannot reach, which
is React's own render.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Class-based boundary

The two lifecycle methods split by phase: `getDerivedStateFromError` is pure and returns state,
`componentDidCatch` is where reporting goes.

```typescript
static getDerivedStateFromError(error: Error): State {
  return { hasError: true, error };
}

componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
  this.props.onError?.(error, errorInfo);
}
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: `react-error-boundary`

A `FallbackComponent` receives `error` and `resetErrorBoundary`, so the retry control lives wherever
the design wants it. `onError` keeps reporting out of the fallback.

```typescript
<ErrorBoundary FallbackComponent={ErrorFallback} onError={report}>
  <Dashboard />
</ErrorBoundary>;

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}
```

The prop table is in [reference.md](reference.md); full code in [examples/core.md](examples/core.md).

### Pattern 3: `showBoundary()` for async failures

An async throw never reaches a boundary on its own. `useErrorBoundary` hands you the trigger.

```typescript
const { showBoundary } = useErrorBoundary();

const load = async () => {
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    showBoundary(error);
  }
};
```

Use it where the failure should replace the subtree. Leave it alone where the error has inline UI of
its own, such as a field-level validation message.

Full code: [examples/core.md](examples/core.md)

### Pattern 4: `resetKeys` for automatic reset

Changing any listed value clears the error and re-renders the children, which is what navigation and
record-switching want.

```typescript
<ErrorBoundary FallbackComponent={ErrorFallback} resetKeys={[currentPath]}>
  <PageContent path={currentPath} />
</ErrorBoundary>
```

Comparison is shallow, so an object or array key needs a stable reference or the boundary resets on
every render.

### Pattern 5: Granular placement

Each widget gets its own boundary and its own fallback text; the root boundary catches whatever the
inner ones do not.

```typescript
<ErrorBoundary fallback={<p>Chart unavailable</p>} onError={report}>
  <ChartWidget />
</ErrorBoundary>
<ErrorBoundary fallback={<p>Table unavailable</p>} onError={report}>
  <DataTable />
</ErrorBoundary>
```

One boundary around all three widgets means the first failure takes the other two with it.

There is an upper bound: the unit is the feature area a user would recognise as having failed on its
own. A boundary around every component adds class components and fallback text nobody reads, and
splits one failure into a page of small broken panels rather than one honest message.

Full code: [examples/core.md](examples/core.md)

### Pattern 6: Fallback UI

The fallback is UI a user meets at their worst moment: announce it, offer a way out, and keep the
stack trace for development.

```typescript
<div role="alert">
  <h2>Something went wrong</h2>
  {isDevelopment && <pre>{error.message}</pre>}
  <button onClick={resetErrorBoundary}>Try again</button>
</div>
```

A `<span onClick>` retry is unreachable by keyboard, and a raw stack in production leaks internals.

Full code: [examples/core.md](examples/core.md)

### Pattern 7: React 19 root error options

`createRoot` takes three handlers that report rather than render, including for errors no boundary
caught. They complement boundaries rather than replacing them.

```typescript
const root = createRoot(container, {
  onCaughtError: (error, info) => report("caught", error, info.componentStack),
  onUncaughtError: (error, info) =>
    report("uncaught", error, info.componentStack),
  onRecoverableError: (error, info) =>
    report("recoverable", error, info.componentStack),
});
```

Full code: [examples/react-19-hooks.md](examples/react-19-hooks.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Side effects in `getDerivedStateFromError` — it runs during render, so a fetch or a `setState` there breaks React's phase rules — report from `componentDidCatch` instead.
- A boundary wrapping itself — a boundary never catches its own render error, and the throw escapes to the parent boundary or to the root — keep the fallback trivial.
- An unstable `resetKeys` entry — the shallow compare sees a new array or object every render and resets the boundary continuously — memoise the value or key on a primitive.
- `<span onClick={reset}>` as the retry control — not focusable and not activated by Enter or Space — use `<button>`.

**Surprising behaviour:**

- Async and event-handler throws never reach a boundary; without `showBoundary()` they vanish.
- The innermost boundary wins, so a wide root fallback appears only when every inner one was missed.
- SSR hydration errors surface as recoverable rather than caught, and a client boundary may never see them.
- Development hot reload trips boundaries that production never would.
- `onCaughtError` runs after the boundary's own `componentDidCatch`, not before it.
- `onRecoverableError` often carries the original throw on `error.cause`.
- `captureOwnerStack()` returns `null` outside development.
- The three root options are silently ignored on React 18 — no warning, no error, no logging.

</red_flags>
