# Serialization & the $ Boundary

> Code examples for Qwik's serialization rules, the $ boundary, and how to handle non-serializable values. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand component$, useSignal, useStore from [core.md](core.md) first.

---

## The $ Boundary Explained

Every function ending in `$` is a **serialization boundary**. The Qwik optimizer splits code at each `$` into a separate lazy-loadable chunk. For this to work, everything the function captures from its lexical scope must be serializable - because Qwik needs to serialize the captured variables into the HTML and restore them later.

```
Server renders component → serializes state into HTML → client resumes
                                  ↓
              Only serializable values survive this step
```

---

## Pattern 1: What Crosses the Boundary

### Good Example - Serializable Captures

```tsx
import { component$, useSignal, $ } from "@builder.io/qwik";

const MAX_COUNT = 10; // Top-level constant - always accessible

export const Counter = component$(() => {
  const count = useSignal(0); // Signal - serializable
  const metadata = useStore({
    // Store - serializable
    lastClicked: null as string | null,
    history: [] as number[],
  });

  // This $() closure captures count and metadata
  // Both are serializable (Signal and Store) - this works
  const handleClick = $(() => {
    if (count.value < MAX_COUNT) {
      metadata.history.push(count.value);
      count.value++;
      metadata.lastClicked = new Date().toISOString(); // string - serializable
    }
  });

  return <button onClick$={handleClick}>{count.value}</button>;
});
```

**Why good:** `count` (Signal), `metadata` (Store), `MAX_COUNT` (top-level const), strings, numbers, arrays of primitives - all serializable across the `$` boundary

### Bad Example - Non-Serializable Captures

```tsx
import { component$, $ } from "@builder.io/qwik";

class ApiClient {
  constructor(private baseUrl: string) {}
  async fetch(path: string) {
    return fetch(this.baseUrl + path);
  }
}

export const DataFetcher = component$(() => {
  // Class instance - NOT serializable
  const client = new ApiClient("https://api.example.com");

  const handleFetch = $(() => {
    // RUNTIME ERROR: client is a class instance
    // Passes type-checking but fails when Qwik tries to serialize
    return client.fetch("/data");
  });

  return <button onClick$={handleFetch}>Fetch</button>;
});
```

**Why bad:** `client` is a class instance captured in the `$` closure. Qwik cannot serialize class instances. This passes TypeScript checking but throws at runtime when the framework tries to serialize the closure's captured state.

---

## Pattern 2: Top-Level Exports Are Always Accessible

### Good Example - Top-Level References

```tsx
import { component$, $ } from "@builder.io/qwik";

// Top-level exports are ALWAYS accessible across $ boundaries
// even if the value itself is non-serializable
const FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const API_ROUTES = {
  users: "/api/users",
  posts: "/api/posts",
} as const;

// Non-serializable function - but it's top-level, so it's fine
function computeHash(input: string): string {
  let hash = 0;
  for (const char of input) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return hash.toString(36);
}

export const PriceDisplay = component$<{ amount: number }>(({ amount }) => {
  return (
    <button
      onClick$={() => {
        // All of these work - they're top-level module references
        const formatted = FORMATTER.format(amount);
        const hash = computeHash(formatted);
        // All top-level references work: FORMATTER, computeHash, API_ROUTES
      }}
    >
      {FORMATTER.format(amount)}
    </button>
  );
});
```

**Why good:** Top-level module-scoped values (constants, functions, class instances) are always accessible in `$` closures because the optimizer references them by module path, not by serializing them. This is the key escape hatch for non-serializable values.

---

## Pattern 3: Handling Non-Serializable Values

### Good Example - noSerialize for Browser Objects

```tsx
import {
  component$,
  useSignal,
  useVisibleTask$,
  noSerialize,
  type NoSerialize,
} from "@builder.io/qwik";

export const CanvasDrawer = component$(() => {
  // noSerialize wraps a value to tell Qwik "don't try to serialize this"
  // The value is discarded during serialization and becomes undefined on resume
  const canvasCtx = useSignal<NoSerialize<CanvasRenderingContext2D>>();
  const canvasRef = useSignal<HTMLCanvasElement>();

  useVisibleTask$(() => {
    if (canvasRef.value) {
      const ctx = canvasRef.value.getContext("2d");
      if (ctx) {
        canvasCtx.value = noSerialize(ctx);
        // Draw something
        ctx.fillStyle = "#3b82f6";
        ctx.fillRect(0, 0, 100, 100);
      }
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={300}
      onClick$={() => {
        // After resuming from server HTML, canvasCtx.value is undefined
        // Must re-initialize in useVisibleTask$
        canvasCtx.value?.fillRect(
          Math.random() * 400,
          Math.random() * 300,
          10,
          10,
        );
      }}
    />
  );
});
```

**Why good:** `noSerialize()` wraps browser-only objects so they can be stored in signals/stores without causing serialization errors. The value becomes `undefined` after serialization/deserialization. `NoSerialize<T>` type makes this explicit in TypeScript.

**Important:** `noSerialize` values are lost on resume. You must re-initialize them (typically in `useVisibleTask$`).

---

## Pattern 4: Minimizing Closure Captures

### Good Example - Lean Closures

```tsx
import { component$, useStore, $ } from "@builder.io/qwik";

interface AppState {
  users: Array<{ id: string; name: string; email: string; role: string }>;
  settings: { theme: string; locale: string; notifications: boolean };
  ui: { sidebarOpen: boolean; activeTab: string };
}

export const UserList = component$(() => {
  const state = useStore<AppState>({
    users: [],
    settings: { theme: "dark", locale: "en", notifications: true },
    ui: { sidebarOpen: true, activeTab: "users" },
  });

  // BAD: Captures entire state store - forces serialization of everything
  const handleDeleteBad = $((userId: string) => {
    state.users = state.users.filter((u) => u.id !== userId);
    // state.settings and state.ui are captured too, even though unused
  });

  // GOOD: Capture only what you need via a focused reference
  const users = state.users; // Reference to the reactive array
  const handleDeleteGood = $((userId: string) => {
    const index = users.findIndex((u) => u.id === userId);
    if (index >= 0) {
      users.splice(index, 1);
    }
  });

  return (
    <ul>
      {state.users.map((user) => (
        <li key={user.id}>
          {user.name}
          <button onClick$={() => handleDeleteGood(user.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
});
```

**Why good:** The "good" handler captures only `users` (a reference to one store property), not the entire `state` store. Qwik serializes less data, leading to smaller HTML payloads and faster resume.

---

## Pattern 5: Functions as Props (QRL Pattern)

### Good Example - Passing Callbacks Between Components

```tsx
import { component$, useSignal, Slot, $, type QRL } from "@builder.io/qwik";

// Callback props MUST use QRL type for serialization
interface ConfirmDialogProps {
  title: string;
  onConfirm$: QRL<() => void>;
  onCancel$: QRL<() => void>;
}

export const ConfirmDialog = component$<ConfirmDialogProps>(
  ({ title, onConfirm$, onCancel$ }) => {
    return (
      <div class="dialog-backdrop">
        <div class="dialog">
          <h2>{title}</h2>
          <Slot /> {/* Dialog body content */}
          <div class="dialog-actions">
            <button onClick$={onCancel$}>Cancel</button>
            <button onClick$={onConfirm$}>Confirm</button>
          </div>
        </div>
      </div>
    );
  },
);

// Usage
export const DeleteButton = component$<{ itemId: string }>(({ itemId }) => {
  const showDialog = useSignal(false);

  return (
    <>
      <button
        onClick$={() => {
          showDialog.value = true;
        }}
      >
        Delete
      </button>

      {showDialog.value && (
        <ConfirmDialog
          title="Delete Item?"
          onConfirm$={$(() => {
            // Perform deletion
            // Perform deletion with itemId
            showDialog.value = false;
          })}
          onCancel$={$(() => {
            showDialog.value = false;
          })}
        >
          <p>This action cannot be undone.</p>
        </ConfirmDialog>
      )}
    </>
  );
});
```

**Why good:** Callback props use `QRL<() => void>` type, not plain function type. Props ending in `$` are automatically treated as QRLs. The parent wraps callbacks in `$()` to create serializable function references.

### Bad Example - Plain Function Props

```tsx
// BAD: Plain function type in props
interface DialogProps {
  onConfirm: () => void; // NOT serializable across $ boundary
}

// BAD: Passing plain arrow function
<Dialog onConfirm={() => doSomething()} />; // Serialization error
```

**Why bad:** Plain functions cannot be serialized. Use `QRL<() => void>` type and `$()` wrapper. Name the prop with `$` suffix (`onConfirm$`) by convention.

---

## Serialization Rules Summary

| Value Type                                            | Serializable | How to Handle                      |
| ----------------------------------------------------- | ------------ | ---------------------------------- |
| Primitives (string, number, boolean, null, undefined) | Yes          | Use directly                       |
| Plain objects, arrays                                 | Yes          | Contents must also be serializable |
| Date, RegExp, Map, Set, BigInt                        | Yes          | Built-in support                   |
| Promise                                               | Yes          | Qwik serializes pending state      |
| Signal, Store                                         | Yes          | Framework-managed                  |
| Error, JSX nodes                                      | Yes          |                                    |
| Top-level module references                           | Yes\*        | Referenced by path, not serialized |
| Class instances                                       | **No**       | Use plain objects or noSerialize() |
| Functions/closures                                    | **No**       | Wrap in $() to create QRL          |
| DOM elements                                          | **No**       | Use refs + useVisibleTask$         |
| Symbol                                                | **No**       |                                    |

\*Top-level exports are accessible across $ boundaries even if non-serializable, because the optimizer references them by module import path rather than serializing the value.

---

_See [core.md](core.md) for component and state patterns. See [routing.md](routing.md) for server-side data loading._
