# Angular 19 New Features Examples

> Examples for linkedSignal, resource/rxResource, and afterRenderEffect APIs introduced in Angular 19. See [core.md](core.md) for signal basics.

---

## Pattern: linkedSignal for Writable Derived State

### Good Example - Selection that resets when options change

```typescript
// shipping-picker.component.ts
import { Component, signal, linkedSignal, input } from "@angular/core";

type ShippingMethod = {
  id: string;
  name: string;
  price: number;
  estimatedDays: number;
};

@Component({
  selector: "app-shipping-picker",
  standalone: true,
  template: `
    <div class="shipping-picker">
      <h3>Select Shipping Method</h3>
      @for (method of shippingOptions(); track method.id) {
        <label class="option" [class.selected]="selectedMethod()?.id === method.id">
          <input
            type="radio"
            [checked]="selectedMethod()?.id === method.id"
            (change)="selectedMethod.set(method)"
          />
          <span>{{ method.name }} - {{ method.price | currency }}</span>
          <small>{{ method.estimatedDays }} days</small>
        </label>
      }
    </div>
  `,
})
export class ShippingPickerComponent {
  // Shipping options can change (e.g., based on destination)
  shippingOptions = input.required<ShippingMethod[]>();

  // linkedSignal: auto-selects first option when options change,
  // but user can manually select a different option
  selectedMethod = linkedSignal(() => this.shippingOptions()[0]);
}
```

**Why good:** linkedSignal automatically resets selection when options change, but allows manual user selection via `.set()`, eliminates need for effect() + signal() combo

### Good Example - Preserving selection when source changes

```typescript
// product-filter.component.ts
import { Component, signal, linkedSignal, computed } from "@angular/core";

type Category = {
  id: string;
  name: string;
};

@Component({
  selector: "app-product-filter",
  standalone: true,
  template: `
    <select (change)="onCategoryChange($event)">
      @for (category of categories(); track category.id) {
        <option [value]="category.id" [selected]="selectedCategory()?.id === category.id">
          {{ category.name }}
        </option>
      }
    </select>
  `,
})
export class ProductFilterComponent {
  categories = signal<Category[]>([
    { id: "1", name: "Electronics" },
    { id: "2", name: "Clothing" },
  ]);

  // Advanced linkedSignal: preserve selection if still available
  selectedCategory = linkedSignal<Category[], Category | undefined>({
    source: this.categories,
    computation: (newCategories, previous) => {
      // Try to keep the same selection if it exists in new list
      const preserved = newCategories.find((c) => c.id === previous?.value?.id);
      return preserved ?? newCategories[0];
    },
  });

  onCategoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const category = this.categories().find((c) => c.id === target.value);
    if (category) {
      this.selectedCategory.set(category);
    }
  }
}
```

**Why good:** Uses advanced linkedSignal syntax with source/computation to preserve user selection when categories update, only resets if selected item no longer exists

### Bad Example - Manual synchronization instead of linkedSignal

```typescript
// BAD - Manual effect + signal combo
@Component({ ... })
export class ShippingPickerComponent {
  shippingOptions = input.required<ShippingMethod[]>();

  // Manual signal requires effect to sync
  selectedMethod = signal<ShippingMethod | null>(null);

  constructor() {
    // BAD: Manual synchronization
    effect(() => {
      const options = this.shippingOptions();
      if (options.length > 0) {
        this.selectedMethod.set(options[0]);
      }
    });
  }
}
```

**Why bad:** Requires separate effect() for synchronization, more boilerplate, harder to reason about timing, linkedSignal handles this declaratively

---

## Pattern: resource() for Async Data Fetching

### Good Example - Reactive data fetching with signals

```typescript
// user-profile.component.ts
import { Component, input, resource, computed } from "@angular/core";

type User = {
  id: string;
  name: string;
  email: string;
  avatar: string;
};

const API_BASE_URL = "/api";

@Component({
  selector: "app-user-profile",
  standalone: true,
  template: `
    @switch (userResource.status()) {
      @case ("loading") {
        <div class="loading">Loading user profile...</div>
      }
      @case ("error") {
        <div class="error">
          <p>Failed to load user: {{ userResource.error() }}</p>
          <button (click)="userResource.reload()">Retry</button>
        </div>
      }
      @case ("resolved") {
        @if (userResource.hasValue()) {
          <div class="profile">
            <img [src]="userResource.value().avatar" [alt]="userResource.value().name" />
            <h1>{{ userResource.value().name }}</h1>
            <p>{{ userResource.value().email }}</p>
          </div>
        }
      }
    }
  `,
})
export class UserProfileComponent {
  // User ID from route or parent
  userId = input.required<string>();

  // Resource automatically refetches when userId changes
  userResource = resource({
    params: () => ({ id: this.userId() }),
    loader: async ({ params, abortSignal }) => {
      const response = await fetch(`${API_BASE_URL}/users/${params.id}`, {
        signal: abortSignal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json() as Promise<User>;
    },
  });
}
```

**Why good:** resource() auto-refetches when userId signal changes, provides built-in loading/error states, abortSignal handles race conditions, declarative template with status checks

### Good Example - rxResource with HttpClient

```typescript
// posts.component.ts
import { Component, signal, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { rxResource } from "@angular/core/rxjs-interop";

type Post = {
  id: number;
  title: string;
  body: string;
};

const API_BASE_URL = "/api";
const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: "app-posts",
  standalone: true,
  template: `
    <div class="posts">
      <div class="filters">
        <input
          type="text"
          [value]="searchQuery()"
          (input)="onSearchChange($event)"
          placeholder="Search posts..."
        />
      </div>

      @if (postsResource.isLoading()) {
        <div class="loading">Loading posts...</div>
      }

      @if (postsResource.hasValue()) {
        @for (post of postsResource.value(); track post.id) {
          <article class="post">
            <h2>{{ post.title }}</h2>
            <p>{{ post.body }}</p>
          </article>
        } @empty {
          <p>No posts found</p>
        }
      }

      @if (postsResource.error(); as error) {
        <div class="error">
          <p>Error: {{ error }}</p>
          <button (click)="postsResource.reload()">Retry</button>
        </div>
      }
    </div>
  `,
})
export class PostsComponent {
  private http = inject(HttpClient);

  searchQuery = signal("");
  page = signal(1);

  // rxResource for Observable-based loading
  postsResource = rxResource({
    params: () => ({
      query: this.searchQuery(),
      page: this.page(),
    }),
    loader: ({ params }) => {
      return this.http.get<Post[]>(`${API_BASE_URL}/posts`, {
        params: {
          q: params.query,
          _page: params.page.toString(),
          _limit: DEFAULT_PAGE_SIZE.toString(),
        },
      });
    },
  });

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
    this.page.set(1); // Reset to first page on search
  }
}
```

**Why good:** rxResource integrates with Angular's HttpClient and interceptors, auto-cancels previous requests when params change, reactive params trigger refetch

### Bad Example - Manual async handling

```typescript
// BAD - Manual async handling
@Component({ ... })
export class UserProfileComponent {
  userId = input.required<string>();

  user = signal<User | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    // BAD: Manual effect for data fetching
    effect(() => {
      const id = this.userId();
      this.loading.set(true);
      this.error.set(null);

      fetch(`/api/users/${id}`)
        .then(res => res.json())
        .then(data => this.user.set(data))
        .catch(err => this.error.set(err.message))
        .finally(() => this.loading.set(false));
    });
  }
}
```

**Why bad:** Manual loading/error state management, no request cancellation (race conditions), effect() used for data fetching instead of resource()

---

## Pattern: afterRenderEffect for DOM Operations

### Good Example - Measuring DOM elements

```typescript
// auto-resize-textarea.component.ts
import {
  Component,
  ElementRef,
  signal,
  afterRenderEffect,
  viewChild,
} from "@angular/core";

const MIN_HEIGHT_PX = 40;
const PADDING_PX = 8;

@Component({
  selector: "app-auto-resize-textarea",
  standalone: true,
  template: `
    <textarea
      #textarea
      [value]="content()"
      (input)="onInput($event)"
      [style.height.px]="height()"
    ></textarea>
  `,
  styles: [`
    textarea {
      resize: none;
      overflow: hidden;
      min-height: ${MIN_HEIGHT_PX}px;
    }
  `],
})
export class AutoResizeTextareaComponent {
  textareaRef = viewChild.required<ElementRef<HTMLTextAreaElement>>("textarea");

  content = signal("");
  height = signal(MIN_HEIGHT_PX);

  constructor() {
    // afterRenderEffect runs after DOM updates
    afterRenderEffect({
      // Read phase: measure DOM
      read: () => {
        const textarea = this.textareaRef().nativeElement;
        // Reset height to measure scrollHeight accurately
        textarea.style.height = "auto";
        const scrollHeight = textarea.scrollHeight;
        return scrollHeight;
      },
      // Write phase: apply measurement
      write: (scrollHeight: number) => {
        const newHeight = Math.max(MIN_HEIGHT_PX, scrollHeight + PADDING_PX);
        this.height.set(newHeight);
      },
    });
  }

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.content.set(target.value);
  }
}
```

**Why good:** Uses read/write phases to avoid layout thrashing, afterRenderEffect runs after Angular finishes DOM updates, proper separation of measurement and mutation

### Good Example - Third-party library integration

```typescript
// chart.component.ts
import {
  Component,
  ElementRef,
  input,
  afterRenderEffect,
  viewChild,
  inject,
  DestroyRef,
} from "@angular/core";

type ChartData = {
  labels: string[];
  values: number[];
};

@Component({
  selector: "app-chart",
  standalone: true,
  template: `<canvas #chartCanvas></canvas>`,
})
export class ChartComponent {
  private destroyRef = inject(DestroyRef);

  canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>("chartCanvas");
  data = input.required<ChartData>();

  private chartInstance: Chart | null = null;

  constructor() {
    // afterRenderEffect for third-party library that needs DOM
    afterRenderEffect(() => {
      const canvas = this.canvasRef().nativeElement;
      const chartData = this.data();

      // Destroy previous instance
      if (this.chartInstance) {
        this.chartInstance.destroy();
      }

      // Create new chart (Chart.js or similar)
      this.chartInstance = new Chart(canvas, {
        type: "bar",
        data: {
          labels: chartData.labels,
          datasets: [{ data: chartData.values }],
        },
      });
    });

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.chartInstance?.destroy();
    });
  }
}
```

**Why good:** afterRenderEffect ensures canvas element exists in DOM, re-runs when data() signal changes, proper cleanup with DestroyRef

### Bad Example - Using effect() for DOM operations

```typescript
// BAD - effect() for DOM operations
@Component({ ... })
export class AutoResizeTextareaComponent {
  textareaRef = viewChild.required<ElementRef<HTMLTextAreaElement>>("textarea");
  content = signal("");

  constructor() {
    // BAD: effect() runs before DOM is updated
    effect(() => {
      const content = this.content();
      const textarea = this.textareaRef().nativeElement;
      // DOM may not be updated yet!
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }
}
```

**Why bad:** effect() may run before Angular updates the DOM, no phase separation causes layout thrashing, afterRenderEffect is designed for this use case

---

## Resource API Status Reference

| Status | Description | Signals |
|--------|-------------|---------|
| `'idle'` | No valid request | `value()` = undefined |
| `'loading'` | Initial load | `isLoading()` = true |
| `'reloading'` | Reloading same params | `isLoading()` = true, `value()` = previous |
| `'resolved'` | Success | `hasValue()` = true |
| `'error'` | Failed | `error()` = Error |
| `'local'` | Manually set | After `.set()` or `.update()` |

---

## linkedSignal vs computed vs effect

| Feature | `computed()` | `linkedSignal()` | `effect()` |
|---------|-------------|------------------|------------|
| Writable | No | Yes | N/A |
| Auto-updates | Yes | Yes | Yes |
| Use case | Read-only derived | Writable derived | Side effects |
| Returns | Signal | WritableSignal | EffectRef |
