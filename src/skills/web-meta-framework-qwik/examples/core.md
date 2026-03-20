# Qwik Components & State

> Complete code examples for Qwik component patterns, state management, tasks, and events. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Component Props with TypeScript

### Good Example - Typed Props with Generic

```tsx
import { component$, Slot, type Signal } from "@builder.io/qwik";

interface AlertProps {
  variant: "info" | "warning" | "error" | "success";
  title: string;
  dismissible?: boolean;
  onDismiss$?: () => void;
}

export const Alert = component$<AlertProps>(
  ({ variant, title, dismissible = false, onDismiss$ }) => {
    return (
      <div class={`alert alert-${variant}`} role="alert">
        <strong>{title}</strong>
        <div class="alert-body">
          <Slot />
        </div>
        {dismissible && (
          <button class="alert-dismiss" onClick$={onDismiss$}>
            Close
          </button>
        )}
      </div>
    );
  },
);
```

**Why good:** Generic `component$<AlertProps>` gives typed props, callback prop uses `$` suffix convention for QRL typing, default value for optional prop, `<Slot />` for content projection

### Bad Example - Untyped, Missing component$

```tsx
// BAD: Not wrapped in component$
export const Alert = ({ variant, title }: any) => {
  return (
    <div class={`alert alert-${variant}`}>
      <strong>{title}</strong>
      <Slot /> {/* BREAKS - Slot only works in component$() */}
    </div>
  );
};
```

**Why bad:** No `component$` wrapper means hooks throw, `<Slot />` silently fails, optimizer cannot split, `any` type loses safety

---

## Pattern 2: useSignal for Primitive State

### Good Example - Signal-Based Toggle

```tsx
import { component$, useSignal, Slot } from "@builder.io/qwik";

export const Accordion = component$<{ title: string }>(({ title }) => {
  const isOpen = useSignal(false);

  return (
    <div class="accordion">
      <button
        onClick$={() => {
          isOpen.value = !isOpen.value;
        }}
        aria-expanded={isOpen.value}
      >
        {title}
        <span aria-hidden="true">{isOpen.value ? "\u25B2" : "\u25BC"}</span>
      </button>
      {isOpen.value && (
        <div class="accordion-content">
          <Slot />
        </div>
      )}
    </div>
  );
});
```

**Why good:** `useSignal` for a simple boolean, `.value` access is explicit, conditional rendering based on signal, accessible aria attributes

---

## Pattern 3: useStore for Complex State

### Good Example - Store with Nested Objects

```tsx
import { component$, useStore } from "@builder.io/qwik";

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

export const TodoList = component$(() => {
  const state = useStore({
    items: [] as TodoItem[],
    filter: "all" as "all" | "active" | "completed",
    newText: "",
  });

  const filteredItems = () => {
    switch (state.filter) {
      case "active":
        return state.items.filter((item) => !item.completed);
      case "completed":
        return state.items.filter((item) => item.completed);
      default:
        return state.items;
    }
  };

  return (
    <div>
      <form
        preventdefault:submit
        onSubmit$={() => {
          if (!state.newText.trim()) return;
          state.items.push({
            id: crypto.randomUUID(),
            text: state.newText,
            completed: false,
          });
          state.newText = "";
        }}
      >
        <input
          value={state.newText}
          onInput$={(_, el) => {
            state.newText = el.value;
          }}
        />
        <button type="submit">Add</button>
      </form>

      <div class="filters">
        {(["all", "active", "completed"] as const).map((f) => (
          <button
            key={f}
            class={{ active: state.filter === f }}
            onClick$={() => {
              state.filter = f;
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <ul>
        {filteredItems().map((item) => (
          <li key={item.id}>
            <input
              type="checkbox"
              checked={item.completed}
              onChange$={() => {
                item.completed = !item.completed;
              }}
            />
            <span class={{ completed: item.completed }}>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
```

**Why good:** `useStore` tracks `items` array mutations (push, property changes) automatically, filter state and items in one store, `preventdefault:submit` declaratively, `item.completed = !item.completed` mutates through the Proxy (reactive), `onInput$` second param gives the element directly

### Bad Example - Destructured Store

```tsx
// BAD: Destructuring kills reactivity
const { items, filter } = useStore({
  items: [],
  filter: "all",
});

// items and filter are now plain values, not reactive proxies
items.push({ id: "1", text: "test", completed: false }); // UI won't update
filter = "active"; // Assignment to const - and even if let, UI won't update
```

**Why bad:** Destructuring extracts values from the Proxy. `items` is now a plain array, `filter` is a plain string. Mutations bypass reactivity tracking entirely.

---

## Pattern 4: useTask$ with Cleanup and Tracking

### Good Example - Debounced Search with Cleanup

```tsx
import { component$, useSignal, useTask$ } from "@builder.io/qwik";

const DEBOUNCE_MS = 300;

export const AutoSave = component$(() => {
  const content = useSignal("");
  const saveStatus = useSignal<"idle" | "saving" | "saved">("idle");

  useTask$(({ track, cleanup }) => {
    const text = track(() => content.value);

    // Skip initial empty value
    if (!text) return;

    saveStatus.value = "idle";
    const timer = setTimeout(async () => {
      saveStatus.value = "saving";
      // Simulate save
      await new Promise((resolve) => setTimeout(resolve, 500));
      saveStatus.value = "saved";
    }, DEBOUNCE_MS);

    cleanup(() => clearTimeout(timer));
  });

  return (
    <div>
      <textarea
        value={content.value}
        onInput$={(_, el) => {
          content.value = el.value;
        }}
      />
      <span class={`status-${saveStatus.value}`}>
        {saveStatus.value === "saving" ? "Saving..." : ""}
        {saveStatus.value === "saved" ? "Saved" : ""}
      </span>
    </div>
  );
});
```

**Why good:** `track()` explicitly declares the dependency, `cleanup()` cancels previous timer on re-run, named constant for debounce delay, status signal tracks save state

---

## Pattern 5: useVisibleTask$ for Browser-Only Code

### Good Example - Intersection Observer

```tsx
import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

const INTERSECTION_THRESHOLD = 0.1;

export const LazyImage = component$<{ src: string; alt: string }>(
  ({ src, alt }) => {
    const imgRef = useSignal<HTMLImageElement>();
    const isVisible = useSignal(false);

    useVisibleTask$(({ cleanup }) => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            isVisible.value = true;
            observer.disconnect();
          }
        },
        { threshold: INTERSECTION_THRESHOLD },
      );

      if (imgRef.value) {
        observer.observe(imgRef.value);
      }

      cleanup(() => observer.disconnect());
    });

    return (
      <img
        ref={imgRef}
        src={isVisible.value ? src : undefined}
        alt={alt}
        class={{ loaded: isVisible.value }}
      />
    );
  },
);
```

**Why good:** `useVisibleTask$` is correct here - IntersectionObserver requires browser APIs, `cleanup` disconnects observer, `ref` signal for DOM element access

### When to use useVisibleTask$

Only use `useVisibleTask$` when you need:

- Direct DOM manipulation (refs, measurements)
- Browser-only APIs (IntersectionObserver, ResizeObserver, geolocation)
- Third-party libraries requiring `window` or `document`
- Canvas/WebGL rendering

For everything else, prefer `useTask$` (server + client, blocks render) or `useComputed$` (synchronous derivation).

---

## Pattern 6: useResource$ for Async Data

### Good Example - Reactive Data Fetching

```tsx
import {
  component$,
  useSignal,
  useResource$,
  Resource,
} from "@builder.io/qwik";

interface SearchResult {
  id: string;
  title: string;
}

export const SearchResults = component$(() => {
  const query = useSignal("");

  const resultsResource = useResource$<SearchResult[]>(
    async ({ track, cleanup }) => {
      const searchTerm = track(() => query.value);
      if (!searchTerm) return [];

      const controller = new AbortController();
      cleanup(() => controller.abort());

      const res = await fetch(`/api/search?q=${searchTerm}`, {
        signal: controller.signal,
      });
      return res.json();
    },
  );

  return (
    <div>
      <input
        value={query.value}
        onInput$={(_, el) => {
          query.value = el.value;
        }}
      />

      <Resource
        value={resultsResource}
        onPending={() => <p>Searching...</p>}
        onResolved={(results) => (
          <ul>
            {results.map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
        )}
        onRejected={(error) => <p>Error: {error.message}</p>}
      />
    </div>
  );
});
```

**Why good:** `useResource$` does not block rendering (unlike `useTask$`), `<Resource>` component handles pending/resolved/rejected states, `AbortController` in `cleanup` cancels stale requests, `track()` makes it reactive to query changes

**Important:** During SSR, `<Resource>` pauses until resolved (no loading flicker). On the client, it shows `onPending` while fetching. Prefer `routeLoader$` for initial page data.

---

## Pattern 7: Event Handling Patterns

### Good Example - Multiple Event Patterns

```tsx
import { component$, useSignal, $, type QRL } from "@builder.io/qwik";

interface ButtonProps {
  onClick$?: QRL<(detail: { count: number }) => void>;
}

export const ClickTracker = component$<ButtonProps>(({ onClick$ }) => {
  const count = useSignal(0);

  // Extracted handler with $() wrapper
  const handleClick = $(() => {
    count.value++;
    onClick$?.({ count: count.value });
  });

  return (
    <div>
      <button onClick$={handleClick}>Clicked {count.value} times</button>

      {/* Multiple handlers on one event */}
      <button
        onClick$={[
          $(() => {
            count.value++;
          }),
          $(() => {
            onClick$?.({ count: count.value });
          }),
        ]}
      >
        Multi-handler
      </button>

      {/* Global event listeners via attributes */}
      <div
        window:onResize$={() => {
          /* handle resize */
        }}
        document:onKeyDown$={(e) => {
          if (e.key === "Escape") {
            /* handle escape */
          }
        }}
      >
        Listens to window resize and document keydown
      </div>
    </div>
  );
});
```

**Why good:** Custom event callback uses `QRL` type for serialization, `$()` wraps extracted handlers, array syntax for multiple handlers, `window:` and `document:` prefixes for global listeners

---

## Pattern 8: Scoped Styles

### Good Example - useStylesScoped$

```tsx
import { component$, Slot, useStylesScoped$ } from "@builder.io/qwik";

export const StyledCard = component$(() => {
  useStylesScoped$(`
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1.5rem;
    }

    .card-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    /* Break out of scoping for Slot content */
    .card-body :global(a) {
      color: #3b82f6;
      text-decoration: underline;
    }
  `);

  return (
    <div class="card">
      <h2 class="card-title">
        <Slot name="title" />
      </h2>
      <div class="card-body">
        <Slot />
      </div>
    </div>
  );
});
```

**Why good:** `useStylesScoped$` scopes styles to component (no leakage), `:global()` breaks out for styling projected Slot content, lazy-loaded with the component

**Gotcha:** `useStylesScoped$` adds emoji-based class selectors for scoping. If this causes issues with testing tools or CSS parsers, use CSS Modules (`import styles from "./card.module.css"`) as an alternative.

---

_See [routing.md](routing.md) for routeLoader$, routeAction$, and server$ patterns. See [serialization.md](serialization.md) for $ boundary rules._
