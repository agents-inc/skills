# MobX - Core Examples

> Store creation and React integration. See [SKILL.md](../SKILL.md) for the decision frameworks and red flags.

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
    // todos/filter -> observable, getters -> computed, methods -> action
    makeAutoObservable(this);
  }

  get activeTodos(): Todo[] {
    return this.todos.filter((todo) => todo.status === ACTIVE_STATUS);
  }

  get filteredTodos(): Todo[] {
    if (this.filter === "all") return this.todos;
    return this.todos.filter((todo) => todo.status === this.filter);
  }

  addTodo(title: string): void {
    this.todos.push({ id: crypto.randomUUID(), title, status: ACTIVE_STATUS });
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
}

const todoStore = new TodoStore();
export { todoStore, TodoStore };
```

**Why good:** One call infers every annotation, so the getters cache as computed values and the methods batch as actions without a line of annotation to keep in sync.

### Good Example - autoBind for Callback Safety

```typescript
// stores/counter-store.ts
import { makeAutoObservable } from "mobx";

const INITIAL_COUNT = 0;
const INCREMENT_STEP = 1;

class CounterStore {
  count = INITIAL_COUNT;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get doubled(): number {
    return this.count * 2;
  }

  increment(): void {
    this.count += INCREMENT_STEP;
  }

  reset(): void {
    this.count = INITIAL_COUNT;
  }
}

export { CounterStore };
```

**Why good:** `autoBind: true` binds every method, so `onClick={store.increment}` keeps its `this` without a `.bind` or an arrow wrapper at each call site.

### Good Example - Excluding an Injected Dependency

```typescript
// stores/user-store.ts
import { makeAutoObservable } from "mobx";
import type { TransportLayer } from "../transport-layer";

class UserStore {
  users: User[] = [];
  private transportLayer: TransportLayer;

  constructor(transportLayer: TransportLayer) {
    makeAutoObservable(this, { transportLayer: false });
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

**Why good:** The override map keeps MobX from deep-converting a transport client that was never meant to be observed, and injecting it keeps the store testable.

### Bad Example - No makeAutoObservable Call

```typescript
class BrokenStore {
  count = 0;

  constructor() {
    // MISSING: makeAutoObservable(this)
  }

  increment(): void {
    this.count++;
  }
}
```

**Why bad:** The properties stay plain JavaScript, so nothing subscribes and no component reading this store ever re-renders. The same omission in a factory function fails the same way.

---

## Pattern 2: Store Creation with makeObservable

### Good Example - Explicit Annotations for a Base Class

```typescript
// stores/base-entity-store.ts
import { makeObservable, observable, computed, action } from "mobx";

interface Entity {
  id: string;
  name: string;
}

class BaseEntityStore<T extends Entity> {
  entities: T[] = [];
  isLoading = false;

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

**Why good:** A class meant to be extended has to annotate explicitly — `makeAutoObservable` refuses any class in an inheritance chain.

### Good Example - Subclass Extending the Base Store

```typescript
// stores/product-store.ts
import { makeObservable, observable, computed, action } from "mobx";
import { BaseEntityStore } from "./base-entity-store";
import type { Entity } from "./base-entity-store";

const LOW_STOCK_THRESHOLD = 10;

interface Product extends Entity {
  price: number;
  stock: number;
}

class ProductStore extends BaseEntityStore<Product> {
  selectedProductId: string | null = null;

  constructor() {
    super();
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

**Why good:** `super()` sets up the base observables and the subclass annotates only what it adds.

> **Overriding a member:** a subclass that replaces a parent method, computed or flow annotates it `override` rather than `action`/`computed`/`flow` — `{ removeEntity: override }`. New members use the normal annotations.

### Bad Example - makeAutoObservable on a Subclass

```typescript
class BrokenProductStore extends BaseEntityStore<Product> {
  constructor() {
    super();
    makeAutoObservable(this); // THROWS at construction
  }
}
```

**Why bad:** `makeAutoObservable` throws on any class that extends another, and the throw happens at construction rather than at the first observation — so it surfaces as a blank screen rather than a stale one.

---

## Pattern 3: Factory Function Stores

```typescript
// stores/timer-store.ts
import { makeAutoObservable } from "mobx";

const INITIAL_SECONDS = 0;
const SECONDS_PER_MINUTE = 60;

interface TimerStore {
  secondsPassed: number;
  readonly minutesPassed: number;
  tick: () => void;
  reset: () => void;
}

function createTimerStore(): TimerStore {
  return makeAutoObservable({
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
}

export { createTimerStore };
export type { TimerStore };
```

**Why good:** No `this` binding to get wrong and no `new` at the call site; `makeAutoObservable` infers the same annotations on a plain object as on a class, and a closure can hide members the returned interface does not name.

---

## Pattern 4: React Integration with observer

### Good Example - Observer Component

```typescript
// components/todo-list.tsx
import { observer } from "mobx-react-lite";
import { todoStore } from "../stores/todo-store";

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

**Why good:** `observer` records exactly which observables were read during the render — here two computed values — and re-renders on those alone. The named function expression is what React DevTools shows.

### Good Example - Pass Observable Objects, Not Primitives

```typescript
// components/todo-item.tsx
import { observer } from "mobx-react-lite";
import type { Todo } from "../stores/todo-store";
import { todoStore, COMPLETED_STATUS } from "../stores/todo-store";

interface TodoItemProps {
  todo: Todo;
}

export const TodoItem = observer(function TodoItem({ todo }: TodoItemProps) {
  return (
    <li data-completed={todo.status === COMPLETED_STATUS}>
      <span>{todo.title}</span>
      <button onClick={() => todoStore.toggleTodo(todo.id)}>Toggle</button>
    </li>
  );
});
```

**Why good:** The property reads happen inside this component, so editing one todo re-renders one row instead of the whole list. Passing `todo.title` as a prop would move the read up to the parent and re-render every row.

### Bad Example - Missing observer

```typescript
export const BrokenTodoCount = () => {
  return <span>{todoStore.activeTodos.length} active todos</span>;
};
```

**Why bad:** Nothing subscribes to the read, so the count renders once and then never changes. This is the most common MobX bug, and it looks like a data problem rather than a wiring one.

### Bad Example - Dereferencing Outside the Component

```typescript
import { observer } from "mobx-react-lite";
import { timerStore } from "../stores/timer-store";

const secondsPassed = timerStore.secondsPassed; // read once, at module load

export const BrokenTimerView = observer(function BrokenTimerView() {
  return <span>Seconds: {secondsPassed}</span>;
});
```

**Why bad:** The read happened at module evaluation, outside any tracked function, so `secondsPassed` is a frozen number. `observer` tracks reads during render, not variables that once held observables.

### Good Example - Store Access via React Context

```typescript
// context/store-context.tsx
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { todoStore } from "../stores/todo-store";
import type { TodoStore } from "../stores/todo-store";

const StoreContext = createContext<TodoStore | null>(null);

function useStore(): TodoStore {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return store;
}

function StoreProvider({ children }: { children: ReactNode }) {
  return <StoreContext.Provider value={todoStore}>{children}</StoreContext.Provider>;
}

export { StoreProvider, useStore };
```

**Why good:** The context value is the store reference, which never changes — so this is injection, and none of Context's re-render cost applies. Reactivity comes from `observer`, not from the provider. The hook throws rather than handing back `null`, so a missing provider fails at the first read.

---

## Pattern 5: useLocalObservable for Local Component State

### Good Example - Complex Local State

```typescript
// components/multi-step-form.tsx
import { observer, useLocalObservable } from "mobx-react-lite";
import type { FormEvent } from "react";

const FIRST_STEP = 0;
const TOTAL_STEPS = 3;
const PERCENTAGE_MAX = 100;

export const MultiStepForm = observer(function MultiStepForm() {
  const formState = useLocalObservable(() => ({
    currentStep: FIRST_STEP,
    name: "",
    email: "",

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
        case 0:
          return this.name.length > 0;
        case 1:
          return this.email.includes("@");
        default:
          return true;
      }
    },

    nextStep(): void {
      if (this.currentStep < TOTAL_STEPS - 1) this.currentStep++;
    },

    prevStep(): void {
      if (this.currentStep > FIRST_STEP) this.currentStep--;
    },
  }));

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
  };

  return (
    <form onSubmit={handleSubmit}>
      <progress value={formState.progress} max={PERCENTAGE_MAX} />
      <button type="button" onClick={formState.prevStep} disabled={formState.isFirstStep}>
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

**Why good:** Four derivations off two fields, each cached and each recomputed only when its own inputs move. The equivalent in `useState` is four values to keep in step by hand.

**Where it stops paying:** a single boolean. `useLocalObservable(() => ({ isOpen: false, toggle() {...} }))` is more machinery than `useState` for the same behaviour. Reach for it when there are computed values to derive.
