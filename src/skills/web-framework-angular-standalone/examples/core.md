# Angular Standalone Examples

> Complete code examples for Angular 17+ standalone component patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Advanced patterns:** See other files in this folder for @defer, DI configuration, model(), and RxJS interop.

---

## Pattern 1: Standalone Component

### Good Example - Complete standalone component

```typescript
// product-card.component.ts
import { Component, input, output, computed } from "@angular/core";
import { CurrencyPipe, DatePipe } from "@angular/common";

export type Product = {
  id: string;
  name: string;
  price: number;
  description: string;
  inStock: boolean;
  createdAt: Date;
};

const LOW_STOCK_THRESHOLD = 10;
const DISCOUNT_PERCENTAGE = 0.1;

@Component({
  selector: "app-product-card",
  standalone: true,
  imports: [CurrencyPipe, DatePipe],
  template: `
    <article class="product-card" [class.out-of-stock]="!product().inStock">
      <header>
        <h2>{{ product().name }}</h2>
        @if (isDiscounted()) {
          <span class="badge">{{ discountPercentage }}% OFF</span>
        }
      </header>

      <p class="description">{{ product().description }}</p>

      <footer>
        <div class="pricing">
          @if (isDiscounted()) {
            <span class="original-price">{{ product().price | currency }}</span>
            <span class="sale-price">{{ discountedPrice() | currency }}</span>
          } @else {
            <span class="price">{{ product().price | currency }}</span>
          }
        </div>

        <div class="actions">
          @if (product().inStock) {
            <button (click)="addToCart.emit(product())">Add to Cart</button>
          } @else {
            <button disabled>Out of Stock</button>
          }
          <button (click)="viewDetails.emit(product().id)">Details</button>
        </div>

        <time class="created">
          Added: {{ product().createdAt | date: "mediumDate" }}
        </time>
      </footer>
    </article>
  `,
})
export class ProductCardComponent {
  // Required input
  product = input.required<Product>();

  // Optional input with default
  isDiscounted = input(false);

  // Outputs
  addToCart = output<Product>();
  viewDetails = output<string>();

  // Constants exposed for template
  readonly discountPercentage = DISCOUNT_PERCENTAGE * 100;

  // Computed value
  discountedPrice = computed(() => {
    return this.product().price * (1 - DISCOUNT_PERCENTAGE);
  });
}
```

**Why good:** standalone: true with explicit imports, signal-based inputs/outputs, computed for derived values, named constants for business logic, @if control flow for conditionals, proper TypeScript types

### Bad Example - Legacy patterns

```typescript
// product-card.component.ts
import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-product-card",
  // Missing standalone: true
  template: `
    <article *ngIf="product" class="product-card">
      <h2>{{ product.name }}</h2>
      <span *ngIf="isDiscounted">10% OFF</span>
      <p>{{ product.price * 0.9 | currency }}</p>
      <button (click)="addToCart.emit(product)">Add</button>
    </article>
  `,
})
export class ProductCardComponent {
  @Input() product!: Product; // Legacy decorator
  @Input() isDiscounted = false;
  @Output() addToCart = new EventEmitter<Product>(); // Legacy EventEmitter
}
```

**Why bad:** missing standalone: true requires NgModule, @Input/@Output are legacy patterns without signal reactivity, \*ngIf requires CommonModule import, magic number 0.9 in template, non-null assertion hides potential errors

---

## Pattern 2: Signals

### Good Example - Writable signals with update patterns

```typescript
// shopping-cart.component.ts
import { Component, signal, computed, effect } from "@angular/core";
import { CurrencyPipe } from "@angular/common";

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

const TAX_RATE = 0.08;
const FREE_SHIPPING_THRESHOLD = 100;

@Component({
  selector: "app-shopping-cart",
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <div class="cart">
      <h2>Shopping Cart ({{ itemCount() }} items)</h2>

      @for (item of items(); track item.id) {
        <div class="cart-item">
          <span>{{ item.name }}</span>
          <span>{{ item.price | currency }} x {{ item.quantity }}</span>
          <button (click)="incrementQuantity(item.id)">+</button>
          <button (click)="decrementQuantity(item.id)">-</button>
          <button (click)="removeItem(item.id)">Remove</button>
        </div>
      } @empty {
        <p>Your cart is empty</p>
      }

      @if (items().length > 0) {
        <div class="totals">
          <p>Subtotal: {{ subtotal() | currency }}</p>
          <p>Tax ({{ taxRatePercent }}%): {{ tax() | currency }}</p>
          @if (qualifiesForFreeShipping()) {
            <p class="free-shipping">Free Shipping!</p>
          } @else {
            <p>
              Add {{ amountToFreeShipping() | currency }} more for free shipping
            </p>
          }
          <p class="total">Total: {{ total() | currency }}</p>
        </div>

        <button (click)="clearCart()">Clear Cart</button>
      }
    </div>
  `,
})
export class ShoppingCartComponent {
  // Writable signal
  items = signal<CartItem[]>([]);

  // Constants for template
  readonly taxRatePercent = TAX_RATE * 100;

  // Computed signals (read-only, memoized)
  itemCount = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0),
  );

  subtotal = computed(() =>
    this.items().reduce((sum, item) => sum + item.price * item.quantity, 0),
  );

  tax = computed(() => this.subtotal() * TAX_RATE);

  total = computed(() => this.subtotal() + this.tax());

  qualifiesForFreeShipping = computed(
    () => this.subtotal() >= FREE_SHIPPING_THRESHOLD,
  );

  amountToFreeShipping = computed(() =>
    Math.max(0, FREE_SHIPPING_THRESHOLD - this.subtotal()),
  );

  constructor() {
    // Effect for side effects (logging, analytics, etc.)
    effect(() => {
      const count = this.itemCount();
      console.log(`Cart updated: ${count} items, total: ${this.total()}`);
    });
  }

  addItem(item: Omit<CartItem, "quantity">): void {
    this.items.update((items) => {
      const existing = items.find((i) => i.id === item.id);
      if (existing) {
        return items.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...items, { ...item, quantity: 1 }];
    });
  }

  incrementQuantity(id: string): void {
    this.items.update((items) =>
      items.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  }

  decrementQuantity(id: string): void {
    this.items.update((items) =>
      items
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  removeItem(id: string): void {
    this.items.update((items) => items.filter((item) => item.id !== id));
  }

  clearCart(): void {
    this.items.set([]);
  }
}
```

**Why good:** signal() for mutable state, computed() for derived values with automatic memoization, effect() for side effects, update() for immutable state changes, named constants for business rules, proper @for with track

### Bad Example - Signals without proper patterns

```typescript
// shopping-cart.component.ts
export class ShoppingCartComponent {
  items = signal<CartItem[]>([]);

  // BAD: Mutating signal value directly
  addItem(item: CartItem): void {
    this.items().push(item); // Mutation doesn't trigger updates!
  }

  // BAD: Computed without memoization benefit
  getTotal(): number {
    return this.items().reduce((sum, i) => sum + i.price, 0);
  }

  // BAD: Effect with side effects that modify signals
  constructor() {
    effect(() => {
      if (this.items().length > 10) {
        this.items.set(this.items().slice(0, 10)); // Signal write in effect!
      }
    });
  }
}
```

**Why bad:** mutating signal value directly doesn't trigger reactivity, method instead of computed() loses memoization, writing to signals inside effect() causes infinite loops or errors

---

## Pattern 3: Control Flow

### Good Example - @for with track and context variables

```typescript
// task-list.component.ts
import { Component, signal } from "@angular/core";

type Task = {
  id: string;
  title: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
};

@Component({
  selector: "app-task-list",
  standalone: true,
  template: `
    <div class="task-list">
      <h2>Tasks ({{ tasks().length }})</h2>

      @for (
        task of tasks();
        track task.id;
        let idx = $index, first = $first, last = $last, even = $even
      ) {
        <div
          class="task"
          [class.first]="first"
          [class.last]="last"
          [class.even]="even"
          [class.completed]="task.completed"
        >
          <span class="index">{{ idx + 1 }}.</span>
          <input
            type="checkbox"
            [checked]="task.completed"
            (change)="toggleTask(task.id)"
          />
          <span class="title">{{ task.title }}</span>

          @switch (task.priority) {
            @case ("high") {
              <span class="priority high">!!!</span>
            }
            @case ("medium") {
              <span class="priority medium">!!</span>
            }
            @case ("low") {
              <span class="priority low">!</span>
            }
          }

          <button (click)="deleteTask(task.id)">Delete</button>
        </div>
      } @empty {
        <p class="empty-state">No tasks yet. Add one above!</p>
      }
    </div>
  `,
})
export class TaskListComponent {
  tasks = signal<Task[]>([
    { id: "1", title: "Learn signals", completed: false, priority: "high" },
    {
      id: "2",
      title: "Migrate to standalone",
      completed: true,
      priority: "medium",
    },
  ]);

  toggleTask(id: string): void {
    this.tasks.update((tasks) =>
      tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  }

  deleteTask(id: string): void {
    this.tasks.update((tasks) => tasks.filter((t) => t.id !== id));
  }
}
```

**Why good:** track by unique id for efficient updates, $index/$first/$last/$even context variables, @empty for empty state, @switch for multi-case conditionals, no CommonModule needed

### Bad Example - Legacy structural directives

```typescript
// task-list.component.ts
@Component({
  selector: "app-task-list",
  imports: [CommonModule], // Required for *ngFor, *ngIf
  template: `
    <div *ngIf="tasks.length > 0; else emptyState">
      <div
        *ngFor="let task of tasks; let i = index; trackBy: trackById"
        class="task"
      >
        <span>{{ i + 1 }}. {{ task.title }}</span>
        <ng-container [ngSwitch]="task.priority">
          <span *ngSwitchCase="'high'">!!!</span>
          <span *ngSwitchCase="'medium'">!!</span>
          <span *ngSwitchDefault>!</span>
        </ng-container>
      </div>
    </div>
    <ng-template #emptyState>
      <p>No tasks</p>
    </ng-template>
  `,
})
export class TaskListComponent {
  tasks: Task[] = [];

  trackById(index: number, task: Task): string {
    return task.id;
  }
}
```

**Why bad:** requires CommonModule import, trackBy needs separate function, ng-template syntax is verbose, less type narrowing than built-in control flow

---

## Pattern 4: Component Communication

### Good Example - Parent-child communication with signals

```typescript
// child: todo-item.component.ts
@Component({
  selector: "app-todo-item",
  standalone: true,
  template: `
    <div [class.completed]="todo().completed">
      <input
        type="checkbox"
        [checked]="todo().completed"
        (change)="toggle.emit(todo().id)"
      />
      <span>{{ todo().text }}</span>
      <button (click)="remove.emit(todo().id)">Delete</button>
    </div>
  `,
})
export class TodoItemComponent {
  todo = input.required<Todo>();
  toggle = output<string>();
  remove = output<string>();
}

// parent: todo-list.component.ts
@Component({
  selector: "app-todo-list",
  standalone: true,
  imports: [TodoItemComponent],
  template: `
    <input
      #newTodo
      type="text"
      placeholder="Add todo..."
      (keyup.enter)="addTodo(newTodo.value); newTodo.value = ''"
    />
    @for (todo of todos(); track todo.id) {
      <app-todo-item
        [todo]="todo"
        (toggle)="toggleTodo($event)"
        (remove)="removeTodo($event)"
      />
    } @empty {
      <p>No todos yet!</p>
    }
  `,
})
export class TodoListComponent {
  todos = signal<Todo[]>([]);

  addTodo(text: string): void {
    if (!text.trim()) return;
    this.todos.update((todos) => [
      ...todos,
      { id: crypto.randomUUID(), text: text.trim(), completed: false },
    ]);
  }

  toggleTodo(id: string): void {
    this.todos.update((todos) =>
      todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  }

  removeTodo(id: string): void {
    this.todos.update((todos) => todos.filter((t) => t.id !== id));
  }
}
```

**Why good:** input.required() ensures todo is always provided, output() provides type-safe events, parent handles state mutations, @for with track for efficient updates, template reference variable for input
