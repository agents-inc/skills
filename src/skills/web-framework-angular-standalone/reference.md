# Angular Standalone Reference

> Decision trees, anti-patterns with the corrected code beside them, API and syntax tables, and the component checklist. See [SKILL.md](SKILL.md) for the patterns and red flags, and [examples/](examples/) for full code.

---

## Decision trees

### When to Use signal() vs computed() vs linkedSignal()

```
Is this value derived from other signals?
├─ YES → Does it need to be manually writable too?
│   ├─ YES → Use linkedSignal() ✓ (Angular 19+)
│   │   (writable + auto-updates when source changes)
│   └─ NO → Use computed() ✓
│       (memoized, read-only, recalculates only when deps change)
└─ NO → Is this value that needs to be modified?
    ├─ YES → Use signal() ✓
    │   (writable, use .set() or .update())
    └─ NO → Use a plain constant
```

### When to Use effect() vs afterRenderEffect()

```
Do you need to perform side effects when signals change?
├─ YES → Is it DOM manipulation that needs post-render timing?
│   ├─ YES → Use afterRenderEffect() ✓ (Angular 19+)
│   │   (runs after DOM updates, supports phases for optimization)
│   └─ NO → Is it modifying other signals?
│       ├─ YES → Consider linkedSignal() or computed() instead
│       │   (Note: Angular 19 allows signal writes in effect() by default)
│       └─ NO → Use effect() ✓
│           (logging, analytics, localStorage, external API calls)
└─ NO → Don't use effect()
```

**Note:** In Angular 19, the `allowSignalWrites` flag was removed. Writing signals in effects is now allowed by default, but it's still recommended to use `linkedSignal()` or `computed()` for derived state.

### When to Use @defer

```
Is the component above the fold (visible on initial load)?
├─ YES → DON'T defer (hurts LCP)
└─ NO → Is it a heavy component (large bundle)?
    ├─ YES → @defer (on viewport) ✓
    └─ NO → Is it triggered by user interaction?
        ├─ YES → @defer (on interaction) ✓
        └─ NO → Is it conditionally shown?
            ├─ YES → @defer (when condition()) ✓
            └─ NO → Consider @defer (on idle) or don't defer
```

### input() vs model() vs inject()

```
Is data coming from parent component?
├─ YES → Does child need to modify the value?
│   ├─ YES → Use model() ✓ (two-way binding)
│   └─ NO → Use input() ✓ (one-way binding)
└─ NO → Is data from a service?
    ├─ YES → Use inject() ✓
    └─ NO → Is it local component state?
        └─ YES → Use signal() ✓
```

### When to Use resource() / rxResource() / httpResource() (Angular 19+, Experimental)

```
Do you need to fetch async data that depends on signals?
├─ YES → Is it for GET requests (read-only data)?
│   ├─ YES → Are you using Angular's HttpClient (need interceptors)?
│   │   ├─ YES → Use httpResource() ✓ (19.2+, simplest API)
│   │   └─ NO → Do you prefer Observables?
│   │       ├─ YES → Use rxResource() ✓
│   │       └─ NO → Use resource() ✓ (Promise-based)
│   └─ NO → Use traditional HttpClient (resource is read-only)
└─ NO → Use traditional HttpClient or fetch
```

**Note:** `resource()`, `rxResource()`, and `httpResource()` are experimental in Angular 19. Do not use them for POST/PUT/DELETE operations.

### @if vs @switch

```
How many conditions are you checking?
├─ 1-2 conditions → @if / @else ✓
└─ 3+ conditions on same expression → @switch ✓
```

### Control Flow: @for track Strategy

```
Do items have unique IDs?
├─ YES → track item.id ✓ (recommended)
└─ NO → Are items primitive values?
    ├─ YES → track $index (acceptable for small, static lists)
    └─ NO → Add a unique identifier to your data model
```

---

## Anti-patterns

> The one-line statement of each of these is in [SKILL.md](SKILL.md)'s `<red_flags>`; what this section adds is the corrected code.

### Mutating Signal Values Directly

Signals require immutable updates. Direct mutation doesn't trigger change detection.

```typescript
// WRONG - Direct mutation
items = signal<string[]>([]);

addItem(item: string): void {
  this.items().push(item); // Mutation doesn't trigger updates!
}

// CORRECT - Immutable update
addItem(item: string): void {
  this.items.update((items) => [...items, item]);
}
```

### Deriving state inside an effect

Angular 19 removed `allowSignalWrites`, so a signal write inside an `effect()` is permitted — and an effect that writes back to the signal it reads still re-triggers itself. Derived state belongs in `computed()`, or `linkedSignal()` where it must also be writable.

```typescript
// WRONG - the effect reads count and writes count
constructor() {
  effect(() => {
    if (this.count() > 10) {
      this.count.set(10);
    }
  });
}

// CORRECT - derived read-only value
maxCount = computed(() => Math.min(this.count(), 10));
```

### Using ngOnChanges with Signal Inputs

Signal inputs don't trigger ngOnChanges. Use effect() instead.

```typescript
// WRONG - ngOnChanges won't fire for signal inputs
ngOnChanges(changes: SimpleChanges): void {
  if (changes['userId']) {
    this.loadUser(changes['userId'].currentValue);
  }
}

// CORRECT - Use effect() to react to input changes
userId = input.required<string>();

constructor() {
  effect(() => {
    this.loadUser(this.userId());
  });
}
```

### Deferring Above-the-Fold Content

Deferring visible content hurts Core Web Vitals.

```typescript
// WRONG - Hero section is above the fold
@Component({
  template: `
    @defer (on viewport) {
      <app-hero-section />  <!-- Visible immediately, shouldn't defer -->
    }
  `
})

// CORRECT - Only defer below-the-fold content
@Component({
  template: `
    <app-hero-section />  <!-- Loads immediately -->

    @defer (on viewport) {
      <app-comments />  <!-- Below fold, safe to defer -->
    }
  `
})
```

### Legacy Structural Directives

New control flow syntax is preferred over *ngIf/*ngFor/\*ngSwitch.

```typescript
// WRONG - Legacy syntax
@Component({
  imports: [CommonModule], // Required for *ngIf
  template: `
    <div *ngIf="loading; else content">Loading...</div>
    <ng-template #content>
      <li *ngFor="let item of items; trackBy: trackByFn">{{ item }}</li>
    </ng-template>
  `
})

// CORRECT - Built-in control flow
@Component({
  // No CommonModule needed
  template: `
    @if (loading()) {
      <div>Loading...</div>
    } @else {
      @for (item of items(); track item.id) {
        <li>{{ item }}</li>
      }
    }
  `
})
```

### Constructor Injection (Legacy)

Use inject() function for cleaner, more flexible DI.

```typescript
// WRONG - Constructor injection
export class UserService {
  constructor(
    private http: HttpClient,
    @Optional() @Inject(CONFIG_TOKEN) private config: Config,
  ) {}
}

// CORRECT - inject() function
export class UserService {
  private http = inject(HttpClient);
  private config = inject(CONFIG_TOKEN, { optional: true });
}
```

### @Input Decorators (Legacy)

Use input() and output() functions for signal-based component communication.

```typescript
// WRONG - Legacy decorators
@Component({ ... })
export class UserCardComponent {
  @Input() user!: User;
  @Output() select = new EventEmitter<User>();
}

// CORRECT - Signal-based functions
@Component({ standalone: true, ... })
export class UserCardComponent {
  user = input.required<User>();
  select = output<User>();
}
```

---

## API and syntax tables

### Signal methods

| Method                  | Purpose                       | Example                                     |
| ----------------------- | ----------------------------- | ------------------------------------------- |
| `signal(value)`         | Create writable signal        | `count = signal(0)`                         |
| `.set(value)`           | Replace value                 | `count.set(5)`                              |
| `.update(fn)`           | Update based on previous      | `count.update(n => n + 1)`                  |
| `.asReadonly()`         | Get read-only version         | `readonly = count.asReadonly()`             |
| `computed(fn)`          | Derive from signals           | `double = computed(() => count() * 2)`      |
| `effect(fn)`            | Side effects                  | `effect(() => console.log(count()))`        |
| `linkedSignal(fn)`      | Writable derived signal (v19) | `selected = linkedSignal(() => items()[0])` |
| `afterRenderEffect(fn)` | DOM-related effects (v19)     | `afterRenderEffect(() => measure(el))`      |

### Input/Output Functions

| Function               | Purpose         | Example                                          |
| ---------------------- | --------------- | ------------------------------------------------ |
| `input()`              | Optional input  | `name = input('')`                               |
| `input.required()`     | Required input  | `id = input.required<string>()`                  |
| `input({ transform })` | Transform input | `age = input(0, { transform: numberAttribute })` |
| `output()`             | Event emitter   | `click = output<void>()`                         |
| `output.emit(value)`   | Emit event      | `click.emit()`                                   |
| `model()`              | Two-way binding | `value = model('')`                              |

### Control Flow Syntax

| Syntax                                | Purpose       | Example                                   |
| ------------------------------------- | ------------- | ----------------------------------------- |
| `@if (cond)`                          | Conditional   | `@if (loading()) { ... }`                 |
| `@else`                               | Else branch   | `@if (...) { } @else { }`                 |
| `@else if (cond)`                     | Else if       | `@if (...) { } @else if (...) { }`        |
| `@for (item of items; track item.id)` | Loop          | `@for (user of users(); track user.id)`   |
| `@empty`                              | Empty state   | `@for (...) { } @empty { No items }`      |
| `@switch (expr)`                      | Switch        | `@switch (status()) { @case ('ok') { } }` |
| `@case (value)`                       | Switch case   | `@case ('loading') { ... }`               |
| `@default`                            | Default case  | `@default { Unknown }`                    |
| `@defer (trigger)`                    | Lazy load     | `@defer (on viewport) { ... }`            |
| `@placeholder`                        | Before load   | `@placeholder { Loading... }`             |
| `@loading`                            | While loading | `@loading { Spinner }`                    |
| `@error`                              | On error      | `@error { Failed }`                       |

### @for Context Variables

| Variable | Type      | Description      |
| -------- | --------- | ---------------- |
| `$index` | `number`  | Zero-based index |
| `$first` | `boolean` | First item       |
| `$last`  | `boolean` | Last item        |
| `$even`  | `boolean` | Even index       |
| `$odd`   | `boolean` | Odd index        |
| `$count` | `number`  | Total items      |

### @defer Triggers

| Trigger          | When it loads                             |
| ---------------- | ----------------------------------------- |
| `on idle`        | Browser idle (default)                    |
| `on viewport`    | Element enters viewport                   |
| `on interaction` | User clicks/taps placeholder              |
| `on hover`       | User hovers placeholder                   |
| `on immediate`   | Immediately after parent renders          |
| `on timer(ms)`   | After specified delay                     |
| `when condition` | When expression becomes true              |
| `prefetch on X`  | Prefetch on trigger, load on main trigger |

### Resource API (Angular 19+, Experimental)

| Function/Property                | Purpose                          | Example                                                               |
| -------------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| `resource({ params, loader })`   | Async data with signals          | `resource({ params: () => ({ id: userId() }), loader: fetchUser })`   |
| `rxResource({ params, loader })` | Observable-based resource        | `rxResource({ params: () => ({ id }), loader: () => http.get(...) })` |
| `httpResource(() => url)`        | HttpClient-based resource (19.2) | `httpResource<User>(() => \`/api/users/\${id()}\`)`                   |
| `.value()`                       | Get loaded value                 | `users.value()`                                                       |
| `.hasValue()`                    | Type guard for value             | `@if (users.hasValue()) { ... }`                                      |
| `.error()`                       | Get error if failed              | `users.error()`                                                       |
| `.isLoading()`                   | Check loading state              | `@if (users.isLoading()) { ... }`                                     |
| `.status()`                      | Get ResourceStatus               | `users.status() === 'resolved'`                                       |
| `.reload()`                      | Re-fetch data                    | `users.reload()`                                                      |

### afterRenderEffect Phases (Angular 19+)

| Phase            | Receives              | Purpose                   | When to use                |
| ---------------- | --------------------- | ------------------------- | -------------------------- |
| `earlyRead`      | nothing               | Read DOM before mutations | Measurements before writes |
| `write`          | `Signal<earlyRead T>` | Mutate DOM                | Setting properties, styles |
| `mixedReadWrite` | `Signal<write T>`     | Read + write (default)    | Avoid if possible          |
| `read`           | `Signal<prior T>`     | Read DOM after mutations  | Final measurements         |

Each phase receives the previous phase's return value wrapped in a `Signal`. Prefer `earlyRead` + `write` over `mixedReadWrite`.

### Component Checklist

- [ ] Component is standalone (default in Angular 19, no flag needed)
- [ ] Uses `input()` / `input.required()` for inputs
- [ ] Uses `output()` for events
- [ ] Uses `model()` for two-way binding
- [ ] Uses `inject()` for dependency injection
- [ ] Uses `@if`, `@for`, `@switch` control flow
- [ ] Uses `track` in all `@for` loops
- [ ] Uses `computed()` for derived read-only values
- [ ] Uses `linkedSignal()` for writable derived values (Angular 19+)
- [ ] Uses `effect()` only for side effects (not DOM ops)
- [ ] Uses `afterRenderEffect()` for DOM operations (Angular 19+)
- [ ] Uses `resource()` / `rxResource()` / `httpResource()` for reactive async data fetching (Angular 19+, experimental)
