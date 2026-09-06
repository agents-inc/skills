# SolidJS - Core Reactivity Examples

> Signals, effects, and memos. See [SKILL.md](../SKILL.md) for concepts.

---

## Signals - Counter with Bounds

### Good Example - Counter with validation

```typescript
import { createSignal, type Component } from 'solid-js';

const MIN_COUNT = 0;
const MAX_COUNT = 100;
const INITIAL_COUNT = 0;

const BoundedCounter: Component = () => {
  const [count, setCount] = createSignal(INITIAL_COUNT);

  const increment = () => {
    setCount(c => Math.min(c + 1, MAX_COUNT));
  };

  const decrement = () => {
    setCount(c => Math.max(c - 1, MIN_COUNT));
  };

  const reset = () => {
    setCount(INITIAL_COUNT);
  };

  // This runs once, not on every update
  console.log('BoundedCounter created');

  return (
    <div class="counter">
      <button onClick={decrement} disabled={count() <= MIN_COUNT}>-</button>
      <span>{count()}</span>
      <button onClick={increment} disabled={count() >= MAX_COUNT}>+</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
};

export { BoundedCounter };
```

**Why good:** `disabled={count() <= MIN_COUNT}` is a reactive expression, so the button enables and disables itself without anything re-running the component. The `console.log` fires once, at creation — a render counter placed there would measure nothing.

### Bad Example - Signal read as a value

```typescript
import { createSignal } from 'solid-js';

const Counter = () => {
  const [count, setCount] = createSignal(0);

  // BAD: the body runs once, so this logs the function at creation and never again
  console.log('Render count:', count);

  // BAD: comparing the getter itself — always false
  const isMax = count >= 100; // should be count() >= 100

  return (
    <div>
      {/* BAD: renders the function's source, and subscribes to nothing */}
      <span>{count}</span>
      {/* BAD: isMax was computed once, outside any tracking scope */}
      <button disabled={isMax}>+</button>
    </div>
  );
};
```

**Why bad:** every one of these compiles. Without the call there is no read, so there is no dependency and no update — and `isMax` is a plain boolean fixed at creation.

---

## Effects - Document Title Sync

### Good Example - Title sync with cleanup

```typescript
import { createSignal, createEffect, onCleanup, type Component } from 'solid-js';

const DocumentTitleSync: Component<{ defaultTitle: string }> = (props) => {
  const [pageTitle, setPageTitle] = createSignal(props.defaultTitle);

  // Effect automatically tracks pageTitle()
  createEffect(() => {
    const title = pageTitle();
    document.title = title;

    // Cleanup: restore default on unmount
    onCleanup(() => {
      document.title = props.defaultTitle;
    });
  });

  return (
    <input
      type="text"
      value={pageTitle()}
      onInput={(e) => setPageTitle(e.currentTarget.value)}
      placeholder="Page title"
    />
  );
};

export { DocumentTitleSync };
```

**Why good:** the `onCleanup` is registered inside the effect, so it runs before each re-run as well as on disposal — the title is restored whether the component goes away or the value simply changes.

### Good Example - Window resize listener

```typescript
import { createSignal, createEffect, onCleanup, type Component } from 'solid-js';

const DEBOUNCE_MS = 100;

const WindowSize: Component = () => {
  const [width, setWidth] = createSignal(window.innerWidth);
  const [height, setHeight] = createSignal(window.innerHeight);

  createEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWidth(window.innerWidth);
        setHeight(window.innerHeight);
      }, DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize);

    // MUST clean up event listener
    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    });
  });

  return (
    <div>
      Window: {width()}x{height()}
    </div>
  );
};

export { WindowSize };
```

**Why good:** the cleanup clears the pending timeout as well as removing the listener. Removing only the listener leaves a timer already scheduled, which still fires once after the component is gone.

### Bad Example - Missing cleanup

```typescript
import { createSignal, createEffect } from 'solid-js';

const WindowSize = () => {
  const [width, setWidth] = createSignal(0);

  createEffect(() => {
    // BAD: No cleanup - event listener leaks!
    window.addEventListener('resize', () => {
      setWidth(window.innerWidth);
    });

    // BAD: Interval never cleared
    setInterval(() => {
      console.log('Width:', width());
    }, 1000);
  });

  return <span>{width()}</span>;
};
```

**Why bad:** Event listener never removed (memory leak), interval never cleared, closure over stale signal read

---

## Effects - Explicit Dependencies with on()

### Good Example - Track specific dependencies

```typescript
import { createSignal, createEffect, on } from 'solid-js';

const SearchLogger = () => {
  const [query, setQuery] = createSignal('');
  const [filter, setFilter] = createSignal('all');
  const [sortOrder, setSortOrder] = createSignal('asc');

  // Only log when query changes, not filter or sortOrder
  createEffect(on(query, (currentQuery, previousQuery) => {
    console.log(`Query changed: "${previousQuery}" → "${currentQuery}"`);

    // These reads don't add dependencies
    console.log('Current filter:', filter());
    console.log('Current sort:', sortOrder());
  }));

  // Track multiple specific dependencies
  createEffect(on([query, filter], ([q, f], [prevQ, prevF]) => {
    console.log('Search or filter changed');
    // sortOrder() doesn't trigger this effect
  }));

  return (
    <div>
      <input value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
      <select value={filter()} onChange={(e) => setFilter(e.currentTarget.value)}>
        <option value="all">All</option>
        <option value="active">Active</option>
      </select>
    </div>
  );
};

export { SearchLogger };
```

**Why good:** `on()` moves dependency selection out of the callback, so `filter()` and `sortOrder()` can be read for their current values without becoming triggers. It also hands back the previous value, which auto-tracking has no way to give you.

---

## Memos - Filtered and Sorted List

### Good Example - Chained memos

```typescript
import { createSignal, createMemo, For, type Component } from 'solid-js';

interface Item {
  id: number;
  name: string;
  category: string;
  price: number;
}

const ItemList: Component<{ items: Item[] }> = (props) => {
  const [searchTerm, setSearchTerm] = createSignal('');
  const [category, setCategory] = createSignal<string | null>(null);
  const [sortBy, setSortBy] = createSignal<'name' | 'price'>('name');

  // Memo 1: Filter by search term
  const searchFiltered = createMemo(() => {
    const term = searchTerm().toLowerCase();
    if (!term) return props.items;
    return props.items.filter(item =>
      item.name.toLowerCase().includes(term)
    );
  });

  // Memo 2: Filter by category (chains from searchFiltered)
  const categoryFiltered = createMemo(() => {
    const cat = category();
    if (!cat) return searchFiltered();
    return searchFiltered().filter(item => item.category === cat);
  });

  // Memo 3: Sort (chains from categoryFiltered)
  const sortedItems = createMemo(() => {
    const items = [...categoryFiltered()];
    const sort = sortBy();
    return items.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      return a.price - b.price;
    });
  });

  // Categories derived from original items
  const categories = createMemo(() => {
    const cats = new Set(props.items.map(item => item.category));
    return Array.from(cats);
  });

  return (
    <div>
      <input value={searchTerm()} onInput={(e) => setSearchTerm(e.currentTarget.value)} />
      <ul>
        <For each={sortedItems()}>
          {(item) => <li>{item.name} — {item.price}</li>}
        </For>
      </ul>
      <p>Showing {sortedItems().length} of {props.items.length} items</p>
    </div>
  );
};

export { ItemList };
```

**Why good:** the chain means typing in the search box invalidates all three stages, while changing the sort order invalidates only the last one. `categories` reads `props.items` directly rather than the filtered list, so narrowing the search does not empty the dropdown it feeds.

### Bad Example - No memoization

```typescript
import { createSignal, For } from 'solid-js';

const ItemList = (props) => {
  const [searchTerm, setSearchTerm] = createSignal('');

  // BAD: computed once, at creation — searchTerm() is read outside any tracking scope
  const filtered = props.items.filter(item =>
    item.name.includes(searchTerm())
  );

  // BAD: sorted once too, from a list that never changes
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ul>
      {/* BAD: Using map instead of For */}
      {sorted.map(item => <li>{item.name}</li>)}
    </ul>
  );
};
```

**Why bad:** the component body runs once, so `filtered` and `sorted` are plain arrays fixed at creation — typing in the box changes nothing. `createMemo` is what makes them re-run at all, and `<For>` is what keys the rows once they do.

---

## Batch Updates

### Good Example - Batch multiple signal updates

```typescript
import { createSignal, batch, type Component } from 'solid-js';

interface User {
  firstName: string;
  lastName: string;
  email: string;
}

const UserForm: Component = () => {
  const [firstName, setFirstName] = createSignal('');
  const [lastName, setLastName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const loadUser = async (userId: string) => {
    setIsSubmitting(true);
    const user: User = await fetchUser(userId);

    // Batch updates - single reactive update cycle
    batch(() => {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setEmail(user.email);
      setIsSubmitting(false);
    });
  };

  const reset = () => {
    batch(() => {
      setFirstName('');
      setLastName('');
      setEmail('');
    });
  };

  return (
    <form>
      <input value={firstName()} onInput={(e) => setFirstName(e.currentTarget.value)} />
      <input value={lastName()} onInput={(e) => setLastName(e.currentTarget.value)} />
      <input value={email()} onInput={(e) => setEmail(e.currentTarget.value)} />
      <button type="button" onClick={reset}>Reset</button>
    </form>
  );
};

export { UserForm };
```

**Why good:** without `batch`, each setter runs every effect and memo that reads it — a four-field load recomputes the derived values four times and paints three intermediate states on the way.

---

## See Also

- [components.md](components.md) - Component patterns and props handling
- [stores.md](stores.md) - createStore for complex state
- [resources.md](resources.md) - createResource for async data
