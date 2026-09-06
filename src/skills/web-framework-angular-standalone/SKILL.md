---
name: web-framework-angular-standalone
description: Angular 17–19 standalone components, signals, built-in control flow, inject() DI, the resource API. Load when writing or migrating Angular components.
---

# Angular Standalone Patterns

> **Quick Guide:** Components are standalone and declare their own `imports`; NgModules are opt-in. State is signals — `signal()`, `computed()`, `linkedSignal()` for derived state you also write to, `effect()` only for genuine side effects and `afterRenderEffect()` for DOM work. Communication is `input()`, `output()` and `model()`. Templates use `@if`, `@for` (always with `track`), `@switch` and `@defer`, none of which need an import. Dependencies come from `inject()`.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — a complete standalone component, signals, control flow, parent-child communication
- [examples/dependency-injection.md](examples/dependency-injection.md) — `inject()`, `InjectionToken`, injection options
- [examples/model.md](examples/model.md) — `model()` two-way binding, and when `input()` + `output()` is the better fit
- [examples/defer.md](examples/defer.md) — every `@defer` trigger, with prefetch and placeholder timing
- [examples/angular-19-features.md](examples/angular-19-features.md) — `linkedSignal()`, `resource()`, `rxResource()`, `afterRenderEffect()` phases
- [examples/rxjs.md](examples/rxjs.md) — `toSignal()`, `toObservable()`, and which of the two a problem wants
- [reference.md](reference.md) — decision trees, anti-patterns with corrected code, API and syntax tables, component checklist

---

## Which path applies

- **Angular 19** — `standalone: true` is the default, so the flag is noise; write `standalone: false` only for a component that genuinely belongs to an NgModule.
- **Angular 17–18** — the same patterns apply, but `standalone: true` is stated explicitly on every component, directive and pipe.
- **Signal APIs by version** — `linkedSignal()` and `afterRenderEffect()` land in 19, `httpResource()` in 19.2, and the resource family is still experimental. [examples/angular-19-features.md](examples/angular-19-features.md) marks each one.

---

<critical_requirements>

## Before writing Angular code

**Declare inputs and outputs with `input()`, `output()` and `model()`.** They are signals, so a `computed()` can depend on an input directly and no `ngOnChanges` is needed to notice it changed.

**Take dependencies with `inject()` in a field initialiser.** It works outside a constructor — in a function, a route guard, a factory — where constructor parameters cannot reach.

**Write templates with `@if`, `@for`, `@switch` and `@defer`.** They need no import, narrow types better than the structural directives, and `@for` has `@empty` and the `$index`/`$first`/`$last` context built in.

**Give every `@for` a `track` expression.** Without a stable key Angular rebuilds the rows rather than moving them, which loses focus and element state along with the performance.

**Update a signal through `.set()` or `.update()` returning a new reference.** Equality is `Object.is`, so mutating the array or object in place leaves the reference unchanged and nothing is notified.

**Use `linkedSignal()` for derived state that is also writable.** It recomputes from its source and still accepts a direct write, which is what a pair of signals kept in step by an `effect()` was imitating.

</critical_requirements>

---

**Auto-detection:** Angular standalone component, signal, computed, effect, linkedSignal, resource, rxResource, httpResource, input(), output(), model(), @if, @for, @switch, @defer, inject(), InjectionToken, provideRouter, bootstrapApplication, afterRenderEffect, afterNextRender, DestroyRef, toSignal, toObservable, viewChild, viewChildren

**Applies to:**

- Standalone components, their `imports` array and their providers
- Signal state: `signal`, `computed`, `linkedSignal`, `effect`, `afterRenderEffect`
- Component communication with `input`, `output` and `model`
- Built-in control flow and `@defer` lazy loading
- Dependency injection with `inject()` and injection tokens
- Application bootstrap and standalone route configuration
- The resource API, and interop between signals and observables

**Handled elsewhere:**

- Styling — a component names its `styles` or `styleUrl` and settles nothing about what goes in them
- Application-wide state stores layered above component signals
- Server-state caching and invalidation policy
- Test doubles for the network

---

<philosophy>

## Philosophy

Standalone removed the second declaration site. A component names what it uses in its own `imports`, so the dependency graph is readable from the component and a lazy route can point at a component rather than at a module wrapping one.

Signals then removed the second question. Change detection used to ask "what might have changed?" and walk the tree; a signal records who read it, so an update notifies exactly those consumers. That is why the guidance keeps pushing work down the chain: `computed()` where a value is derived, `linkedSignal()` where it is derived and writable, `effect()` only where something outside the graph has to happen — and `afterRenderEffect()` where that something is the DOM, because it runs in phases that keep reads and writes from thrashing layout.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Standalone component

A component declares its own imports and communicates through signal functions.

```typescript
@Component({
  selector: "app-user-card",
  imports: [DatePipe],
  template: `
    <h2>{{ user().name }}</h2>
    <time>{{ user().createdAt | date: "mediumDate" }}</time>
    <button (click)="edit.emit(user())">Edit</button>
  `,
})
export class UserCardComponent {
  user = input.required<User>();
  edit = output<User>();
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Signals

```typescript
count = signal(0);
doubleCount = computed(() => this.count() * 2);

this.count.set(5);
this.count.update((value) => value + 1);

items = signal<Item[]>([]);
this.items.update((items) => [...items, newItem]);
```

`computed()` is memoised and lazy; a method with the same body recomputes on every template read. Reserve `effect()` for logging, analytics, storage and other work outside the signal graph.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: linkedSignal for writable derived state

```typescript
options = input.required<Option[]>();
selected = linkedSignal(() => this.options()[0]);
```

`selected` follows `options` and still accepts `selected.set(...)` from a click. Its computation form takes the previous value, which is how a selection survives a source change instead of resetting.

Full code: [examples/angular-19-features.md](examples/angular-19-features.md)

---

### Pattern 4: Inputs, outputs and model

```typescript
placeholder = input("Search...");
minLength = input.required<number>();
query = model("");
search = output<string>();

isValidSearch = computed(() => this.query().length >= this.minLength());
```

`model()` gives the parent `[(query)]`. Reach for it where the child genuinely owns the edit; `input()` plus `output()` keeps the flow one-way and is the better default.

Full code: [examples/model.md](examples/model.md)

---

### Pattern 5: Control flow

```html
@switch (state()) { @case ("loading") {
<div>Loading…</div>
} @case ("error") { <button (click)="retry.emit()">Retry</button> } @case
("success") { @for (user of users(); track user.id; let i = $index) {
<li>{{ i + 1 }}. {{ user.name }}</li>
} @empty {
<li>No users found</li>
} } }
```

`@if (user(); as user)` binds the narrowed value, so the signal is called once rather than in every expression beneath it.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: @defer

```html
@defer (on viewport) {
<app-heavy-chart />
} @placeholder (minimum 200ms) {
<div class="chart-skeleton"></div>
} @loading (after 100ms; minimum 500ms) {
<div class="spinner"></div>
} @error {
<div>Failed to load chart</div>
}
```

`@placeholder` reserves the space, and the `after`/`minimum` timings on `@loading` are what stop a fast load flashing a spinner. Defer what is below the fold, behind an interaction, or conditional — never what is visible on arrival, which trades bundle size for LCP.

Full code: [examples/defer.md](examples/defer.md)

---

### Pattern 7: Dependency injection

```typescript
@Injectable({ providedIn: "root" })
export class UserService {
  private http = inject(HttpClient);
  private config = inject(CONFIG_TOKEN, { optional: true });
}
```

`inject()` also takes `{ skipSelf: true }` to start at the parent injector and `{ self: true }` to refuse to leave the current one. It must run in an injection context — a field initialiser or a constructor — never inside a method.

Full code: [examples/dependency-injection.md](examples/dependency-injection.md)

---

### Pattern 8: Bootstrap and routes

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(PreloadAllModules),
    ),
    provideHttpClient(),
  ],
};

bootstrapApplication(AppComponent, appConfig);

export const routes: Routes = [
  {
    path: "users/:id",
    loadComponent: () =>
      import("./users/user-detail.component").then(
        (m) => m.UserDetailComponent,
      ),
  },
];
```

`loadComponent` lazy-loads a component with no wrapper module. `withComponentInputBinding()` binds route and query params straight to `input()` signals, so a route component needs no `ActivatedRoute` — a query param that may be absent is typed `input<string | undefined>()`.

---

### Pattern 9: Async data with resource()

```typescript
userResource = resource({
  params: () => ({ id: this.userId() }),
  loader: async ({ params, abortSignal }) => {
    const response = await fetch(`/api/users/${params.id}`, {
      signal: abortSignal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as User;
  },
});
```

The resource re-runs when `params` changes and aborts the superseded request, so the signal-plus-effect combination that used to race is not needed. Guard reads with `hasValue()`, which narrows the type as well as the state. `rxResource()` takes an observable loader and `httpResource()` (19.2) goes through `HttpClient` and its interceptors.

Full code: [examples/angular-19-features.md](examples/angular-19-features.md)

---

### Pattern 10: Lifecycle and DOM effects

```typescript
private destroyRef = inject(DestroyRef);
private elementRef = inject(ElementRef);
width = signal(0);

constructor() {
  afterNextRender(() => {
    const observer = new ResizeObserver(([entry]) => this.width.set(entry.contentRect.width));
    observer.observe(this.elementRef.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  });
}
```

| Legacy hook          | Signal-era replacement                       |
| -------------------- | -------------------------------------------- |
| `ngOnInit`           | field initialiser, or `effect()`             |
| `ngOnChanges`        | `effect()` reading the `input()` signal      |
| `ngAfterViewInit`    | `afterNextRender()`                          |
| `ngAfterViewChecked` | `afterRender()` (`afterEveryRender()` in 20) |
| `ngOnDestroy`        | `DestroyRef.onDestroy()`                     |
| DOM side effects     | `afterRenderEffect()` with explicit phases   |

Full code: [examples/angular-19-features.md](examples/angular-19-features.md)

---

### Pattern 11: Observable interop

```typescript
users = toSignal(this.userService.getUsers(), { initialValue: [] });
count$ = toObservable(this.count);
```

`toSignal()` needs an `initialValue` for any source that has not emitted yet; without one the signal's type includes `undefined` and a template read before the first emission throws.

Full code: [examples/rxjs.md](examples/rxjs.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A signal's value mutated in place — `items().push(x)` leaves the reference identical, so `Object.is` reports no change and nothing re-renders
- `inject()` called from a method — it needs an injection context, and throws outside one
- `toSignal()` without `initialValue` on a source that has not emitted — reads before the first emission fail
- `resource()`, `rxResource()` or `httpResource()` used for a write — all three are read-only; a POST, PUT or DELETE goes through `HttpClient`
- `resource.value()` read without checking `hasValue()` — the guard is what narrows away the loading and error states
- `@for` without `track` — Angular tears down and rebuilds each row, discarding focus, scroll position and animation state
- A cleanup function returned from `effect()` — the return value is ignored, so a timer or subscription opened there leaks on every re-run; teardown goes in the `onCleanup` callback the effect body is handed as its argument

**Surprising behaviour:**

- `standalone: true` is the default from 19, so writing it is harmless noise while writing nothing is correct — the two look identical in review
- `@defer` renders its `@placeholder` during server rendering and ignores every trigger there
- `linkedSignal()` resets to its computed value whenever the source changes; preserving a user's choice needs the computation form that receives the previous value
- `allowSignalWrites` was removed in 19 and writing a signal inside an `effect()` is now allowed — which makes an effect-maintained derived value compile quietly where it used to complain
- `afterRenderEffect()` defaults to the `mixedReadWrite` phase, the one that thrashes layout; name `earlyRead` and `write` instead
- `signal()` compares with `Object.is`, so two structurally equal objects count as a change unless a custom `equal` is supplied
- Effects run during change detection from 19, not as microtasks, so ordering assumptions from earlier versions no longer hold

</red_flags>
