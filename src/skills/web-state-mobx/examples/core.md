# MobX - Core Examples

> Essential patterns for MobX store creation and React integration. See [SKILL.md](../SKILL.md) for concepts and decision frameworks.

**Additional Examples:**

- [Advanced Patterns](advanced.md) - Computed values, actions, async, reactions
- [Architecture Patterns](architecture.md) - Root store, TypeScript, performance

---

## Pattern 1: Store Creation with makeAutoObservable

### Good Example - Basic Store

```typescript
// stores/todo-store.ts
import { makeAutoObservable } from "mobx";

const ACTIVE_STATUS = "active" as const;
const COMPLETED_STATUS = "completed" as const;

interface Todo {
  id: string;
  title: string;
  status: typeof ACTIVE_STATUS | typeof COMPLETED_STATUS;
}

class TodoStore {
  todos: Todo[] = [];
  filter: typeof ACTIVE_STATUS | typeof COMPLETED_STATUS | "all" = "all";

  constructor() {
    // Infers: todos -> observable, filter -> observable,
    // activeTodos -> computed, addTodo/removeTodo/setFilter -> action
    makeAutoObservable(this);
  }

  get activeTodos(): Todo[] {
    return this.todos.filter((todo) => todo.status === ACTIVE_STATUS);
  }

  get completedTodos(): Todo[] {
    return this.todos.filter((todo) => todo.status === COMPLETED_STATUS);
  }

  get filteredTodos(): Todo[] {
    if (this.filter === "all") return this.todos;
    return this.todos.filter((todo) => todo.status === this.filter);
  }

  addTodo(title: string): void {
    this.todos.push({
      id: crypto.randomUUID(),
      title,
      status: ACTIVE_STATUS,
    });
  }

  removeTodo(id: string): void {
    this.todos = this.todos.filter((todo) => todo.id !== id);
  }

  toggleTodo(id: string): void {
    const todo = this.todos.find((t) => t.id === id);
    if (todo) {
      todo.status =
        todo.status === ACTIVE_STATUS ? COMPLETED_STATUS : ACTIVE_STATUS;
    }
  }

  setFilter(filter: typeof ACTIVE_STATUS | typeof COMPLETED_STATUS | "all"): void {
    this.filter = filter;
  }
}

const todoStore = new TodoStore();
export { todoStore, TodoStore };
```

**Why good:** `makeAutoObservable` auto-infers all annotations, getters become cached computed values, methods become batched actions, named constants avoid magic strings, named exports follow conventions

### Good Example - makeAutoObservable with autoBind

```typescript
// stores/counter-store.ts
import { makeAutoObservable } from "mobx";

const INITIAL_COUNT = 0;
const INCREMENT_STEP = 1;
const DOUBLE_MULTIPLIER = 2;

class CounterStore {
  count = INITIAL_COUNT;

  constructor() {
    // autoBind: true binds all methods to `this` automatically
    // Safe to pass methods as callbacks: onClick={store.increment}
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get doubled(): number {
    return this.count * DOUBLE_MULTIPLIER;
  }

  increment(): void {
    this.count += INCREMENT_STEP;
  }

  decrement(): void {
    this.count -= INCREMENT_STEP;
  }

  reset(): void {
    this.count = INITIAL_COUNT;
  }
}

export { CounterStore };
```

**Why good:** `autoBind: true` auto-binds all methods so `store.increment` is safe as a callback without `.bind(this)` or arrow wrappers, named constants for initial values and step

### Good Example - makeAutoObservable with Overrides

```typescript
// stores/user-store.ts
import { makeAutoObservable } from "mobx";
import type { TransportLayer } from "../transport-layer";

class UserStore {
  users: User[] = [];
  // Not observable - injected dependency
  private transportLayer: TransportLayer;

  constructor(transportLayer: TransportLayer) {
    makeAutoObservable(this, {
      // Exclude transportLayer from observability
      transportLayer: false,
    });
    this.transportLayer = transportLayer;
  }

  get userCount(): number {
    return this.users.length;
  }

  addUser(user: User): void {
    this.users.push(user);
  }
}

export { UserStore };
```

**Why good:** Override map excludes non-observable dependencies from tracking, transport layer is injected for testability, explicit exclusion prevents MobX from trying to make non-serializable objects observable

### Bad Example - Missing makeAutoObservable

```typescript
// stores/broken-store.ts
class BrokenStore {
  count = 0;

  // MISSING: makeAutoObservable(this) in constructor!
  constructor() {
    // Store properties will NOT be observable
    // Components using this store will NEVER re-render
  }

  increment(): void {
    this.count++;
  }
}

export default BrokenStore; // BAD: default export
```

**Why bad:** Without `makeAutoObservable` or `makeObservable`, properties are plain JS (not observable), components will never re-render on changes, default export violates conventions

---

## Pattern 2: Store Creation with makeObservable

### Good Example - Explicit Annotations (Required for Inheritance)

```typescript
// stores/base-entity-store.ts
import { makeObservable, observable, computed, action } from "mobx";

const INITIAL_LOADING_STATE = false;

interface Entity {
  id: string;
  name: string;
}

// Base class MUST use makeObservable (makeAutoObservable forbids super/subclass)
class BaseEntityStore<T extends Entity> {
  entities: T[] = [];
  isLoading = INITIAL_LOADING_STATE;

  constructor() {
    makeObservable(this, {
      entities: observable,
      isLoading: observable,
      entityCount: computed,
      setLoading: action,
      addEntity: action,
      removeEntity: action,
    });
  }

  get entityCount(): number {
    return this.entities.length;
  }

  setLoading(loading: boolean): void {
    this.isLoading = loading;
  }

  addEntity(entity: T): void {
    this.entities.push(entity);
  }

  removeEntity(id: string): void {
    this.entities = this.entities.filter((e) => e.id !== id);
  }
}

export { BaseEntityStore };
export type { Entity };
```

**Why good:** Explicit annotations required because class is designed for inheritance, each property/method clearly annotated, generic type parameter for reusable base store, named constant for initial state

### Good Example - Subclass Extending Base Store

```typescript
// stores/product-store.ts
import { makeObservable, observable, computed, action } from "mobx";
import { BaseEntityStore } from "./base-entity-store";

const LOW_STOCK_THRESHOLD = 10;

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

class ProductStore extends BaseEntityStore<Product> {
  selectedProductId: string | null = null;

  constructor() {
    super(); // Base class sets up its own observables
    makeObservable(this, {
      selectedProductId: observable,
      selectedProduct: computed,
      lowStockProducts: computed,
      selectProduct: action,
    });
  }

  get selectedProduct(): Product | undefined {
    return this.entities.find((p) => p.id === this.selectedProductId);
  }

  get lowStockProducts(): Product[] {
    return this.entities.filter((p) => p.stock < LOW_STOCK_THRESHOLD);
  }

  selectProduct(id: string | null): void {
    this.selectedProductId = id;
  }
}

export { ProductStore };
```

**Why good:** Subclass uses `makeObservable` (required for inheritance), calls `super()` for base class setup, adds its own annotations for new properties, named constant for stock threshold

### Bad Example - makeAutoObservable on Subclass

```typescript
// stores/broken-product-store.ts
import { makeAutoObservable } from "mobx";
import { BaseEntityStore } from "./base-entity-store";

class BrokenProductStore extends BaseEntityStore<Product> {
  selectedProductId: string | null = null;

  constructor() {
    super();
    // THROWS: makeAutoObservable cannot be used on subclasses!
    makeAutoObservable(this);
  }
}

export { BrokenProductStore };
```

**Why bad:** `makeAutoObservable` throws at runtime on classes that extend another class, must use `makeObservable` with explicit annotations for any class using inheritance

---

## Pattern 3: Factory Function Stores

### Good Example - Factory Function with makeAutoObservable

```typescript
// stores/timer-store.ts
import { makeAutoObservable } from "mobx";

const INITIAL_SECONDS = 0;
const TICK_INTERVAL_MS = 1000;
const SECONDS_PER_MINUTE = 60;

interface TimerStore {
  secondsPassed: number;
  readonly minutesPassed: number;
  tick: () => void;
  reset: () => void;
}

function createTimerStore(): TimerStore {
  const store = makeAutoObservable({
    secondsPassed: INITIAL_SECONDS,

    get minutesPassed(): number {
      return Math.floor(this.secondsPassed / SECONDS_PER_MINUTE);
    },

    tick(): void {
      this.secondsPassed++;
    },

    reset(): void {
      this.secondsPassed = INITIAL_SECONDS;
    },
  });

  return store;
}

export { createTimerStore };
export type { TimerStore };
```

**Why good:** Factory function avoids `this`/`new` complexity, `makeAutoObservable` infers all annotations on plain objects, getters become computed, methods become actions, named constants, typed return interface

### Bad Example - Factory Without makeAutoObservable

```typescript
// stores/broken-timer.ts
function createBrokenTimer() {
  return {
    secondsPassed: 0,
    tick() {
      this.secondsPassed++; // Not observable - won't trigger re-renders
    },
  };
}

export default createBrokenTimer; // BAD: default export
```

**Why bad:** Plain object is NOT observable, mutations will not trigger reactions or component re-renders, default export violates conventions, no type annotation on return value

---

## Pattern 4: React Integration with observer

### Good Example - Observer Component

```typescript
// components/todo-list.tsx
import { observer } from "mobx-react-lite";
import { todoStore } from "../stores/todo-store";

// observer tracks which observables are read during render
// and re-renders ONLY when those specific values change
export const TodoList = observer(function TodoList() {
  return (
    <div>
      <h2>Todos ({todoStore.activeTodos.length})</h2>
      <ul>
        {todoStore.filteredTodos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </ul>
    </div>
  );
});
```

**Why good:** Named function expression gives proper name in React DevTools, `observer` tracks `activeTodos.length` and `filteredTodos` reads, component only re-renders when those specific computed values change

### Good Example - Pass Observable Objects, Not Primitives

```typescript
// components/todo-item.tsx
import { observer } from "mobx-react-lite";
import type { Todo } from "../stores/todo-store";
import { todoStore, COMPLETED_STATUS } from "../stores/todo-store";

interface TodoItemProps {
  todo: Todo; // Pass the observable object, NOT extracted primitives
}

// Each TodoItem only re-renders when ITS todo changes
export const TodoItem = observer(function TodoItem({ todo }: TodoItemProps) {
  return (
    <li data-completed={todo.status === COMPLETED_STATUS}>
      <span>{todo.title}</span>
      <button onClick={() => todoStore.toggleTodo(todo.id)}>Toggle</button>
      <button onClick={() => todoStore.removeTodo(todo.id)}>Remove</button>
    </li>
  );
});
```

**Why good:** Receives the observable `todo` object (not destructured primitives), MobX tracks `todo.title` and `todo.status` reads within this specific component, only this item re-renders when its todo changes

### Bad Example - Missing observer

```typescript
// components/broken-todo-count.tsx

// MISSING observer wrapper!
export const BrokenTodoCount = () => {
  // This reads observables but component is NOT wrapped in observer
  // It will render once and NEVER update when todos change
  return <span>{todoStore.activeTodos.length} active todos</span>;
};
```

**Why bad:** Without `observer`, MobX has no way to track observable reads or trigger re-renders, component renders once with initial value and never updates

### Bad Example - Destructuring Primitives Before observer

```typescript
// components/broken-timer-view.tsx
import { observer } from "mobx-react-lite";
import { timerStore } from "../stores/timer-store";

// BAD: Destructuring primitive OUTSIDE the observer component
const secondsPassed = timerStore.secondsPassed; // Captured once, never updates

export const BrokenTimerView = observer(function BrokenTimerView() {
  // `secondsPassed` is a plain number, not a tracked observable read
  return <span>Seconds: {secondsPassed}</span>;
});
```

**Why bad:** Primitive value extracted outside the observer component is a plain number (not an observable reference), MobX cannot track it, display will be frozen at the value when module loaded

### Good Example - Store Access via React Context

```typescript
// context/store-context.tsx
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { todoStore } from "../stores/todo-store";
import type { TodoStore } from "../stores/todo-store";

// Context for dependency injection ONLY (not state management)
const StoreContext = createContext<TodoStore | null>(null);

function useStore(): TodoStore {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return store;
}

function StoreProvider({ children }: { children: ReactNode }): JSX.Element {
  return (
    <StoreContext.Provider value={todoStore}>
      {children}
    </StoreContext.Provider>
  );
}

export { StoreProvider, useStore };
```

**Why good:** Context used purely for dependency injection (the store value never changes), custom hook with error boundary for missing provider, named exports

### Good Example - Using Store via Context Hook

```typescript
// components/todo-summary.tsx
import { observer } from "mobx-react-lite";
import { useStore } from "../context/store-context";

export const TodoSummary = observer(function TodoSummary() {
  const store = useStore();

  return (
    <div>
      <p>Total: {store.todos.length}</p>
      <p>Active: {store.activeTodos.length}</p>
      <p>Completed: {store.completedTodos.length}</p>
    </div>
  );
});
```

**Why good:** Store accessed via dependency injection hook, `observer` tracks all observable reads, component re-renders only when these specific computed values change

---

## Pattern 5: useLocalObservable for Local Component State

### Good Example - Complex Local State

```typescript
// components/multi-step-form.tsx
import { observer, useLocalObservable } from "mobx-react-lite";
import type { FormEvent } from "react";

const FIRST_STEP = 0;
const NAME_STEP = 1;
const EMAIL_STEP = 2;
const TOTAL_STEPS = 3;
const PERCENTAGE_MAX = 100;

export const MultiStepForm = observer(function MultiStepForm() {
  const formState = useLocalObservable(() => ({
    currentStep: FIRST_STEP,
    name: "",
    email: "",
    plan: "free" as "free" | "pro" | "enterprise",

    get isFirstStep(): boolean {
      return this.currentStep === FIRST_STEP;
    },

    get isLastStep(): boolean {
      return this.currentStep === TOTAL_STEPS - 1;
    },

    get progress(): number {
      return ((this.currentStep + 1) / TOTAL_STEPS) * PERCENTAGE_MAX;
    },

    get isValid(): boolean {
      switch (this.currentStep) {
        case FIRST_STEP:
          return this.name.length > 0;
        case NAME_STEP:
          return this.email.includes("@");
        case EMAIL_STEP:
          return true;
        default:
          return false;
      }
    },

    nextStep(): void {
      if (this.currentStep < TOTAL_STEPS - 1) {
        this.currentStep++;
      }
    },

    prevStep(): void {
      if (this.currentStep > FIRST_STEP) {
        this.currentStep--;
      }
    },

    setField(field: "name" | "email" | "plan", value: string): void {
      this[field] = value as never;
    },
  }));

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    // Submit form data
  };

  return (
    <form onSubmit={handleSubmit}>
      <progress value={formState.progress} max={PERCENTAGE_MAX} />
      <p>
        Step {formState.currentStep + 1} of {TOTAL_STEPS}
      </p>
      {/* Step content based on formState.currentStep */}
      <button
        type="button"
        onClick={formState.prevStep}
        disabled={formState.isFirstStep}
      >
        Back
      </button>
      <button
        type="button"
        onClick={formState.nextStep}
        disabled={!formState.isValid || formState.isLastStep}
      >
        Next
      </button>
    </form>
  );
});
```

**Why good:** Complex local state with multiple computed derivations (`progress`, `isValid`, `isFirstStep`, `isLastStep`), state is scoped to this component, computed values auto-cache, methods batch mutations, named constants for step configuration

### Bad Example - useLocalObservable for Simple State

```typescript
// components/over-engineered-toggle.tsx
import { observer, useLocalObservable } from "mobx-react-lite";

// BAD: useLocalObservable is overkill for simple boolean state
export const OverEngineeredToggle = observer(function OverEngineeredToggle() {
  const state = useLocalObservable(() => ({
    isOpen: false,
    toggle(): void {
      this.isOpen = !this.isOpen;
    },
  }));

  return <button onClick={state.toggle}>{state.isOpen ? "Close" : "Open"}</button>;
});
```

**Why bad:** `useLocalObservable` adds MobX overhead for a simple boolean toggle, `useState` with a setter is simpler and more idiomatic React, only use `useLocalObservable` when you need computed values or complex local state

**When to use:** Complex local state with multiple computed derivations, wizard/multi-step forms, local state that benefits from MobX reactivity.

**When not to use:** Simple boolean toggles, single-value state, anything that `useState` handles cleanly.
