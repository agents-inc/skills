# SolidJS - Resource Examples

> createResource for async data fetching, plus SolidStart patterns with createAsync and query. See [SKILL.md](../SKILL.md) for concepts.

---

## SolidStart - createAsync with query (Recommended)

### Good Example - Route data with query and createAsync

```typescript
// routes/users/[id].tsx - SolidStart file-based routing
import { createAsync, query, type RouteDefinition } from '@solidjs/router';
import { Suspense, ErrorBoundary, Show, type Component } from 'solid-js';

interface User {
  id: string;
  name: string;
  email: string;
}

// Define the query with caching (replaces deprecated 'cache')
const getUserQuery = query(async (userId: string) => {
  'use server'; // Runs on server

  const response = await fetch(`https://api.example.com/users/${userId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }

  return response.json() as Promise<User>;
}, 'user');

// Preload function for route-level data loading
export const route: RouteDefinition = {
  preload: ({ params }) => getUserQuery(params.id)
};

// Page component
const UserPage: Component = () => {
  const params = useParams();

  // createAsync is the recommended async primitive (thin wrapper over createResource)
  // Will be the standard in Solid 2.0
  const user = createAsync(() => getUserQuery(params.id));

  return (
    <ErrorBoundary fallback={(err) => <div>Error: {err.message}</div>}>
      <Suspense fallback={<div class="skeleton">Loading user...</div>}>
        <Show when={user()}>
          {(userData) => (
            <div class="user-profile">
              <h1>{userData().name}</h1>
              <p>{userData().email}</p>
            </div>
          )}
        </Show>
      </Suspense>
    </ErrorBoundary>
  );
};

export default UserPage;
```

**Why good:** `query` provides caching and deduplication, `createAsync` is recommended for Solid 2.0, preload enables SSR data fetching, `'use server'` runs on server only

### Good Example - Multiple queries with actions

```typescript
import { createAsync, query, action, useAction, revalidate } from '@solidjs/router';
import { Show, For, type Component } from 'solid-js';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

// Query for fetching todos
const getTodosQuery = query(async () => {
  'use server';
  const response = await fetch('https://api.example.com/todos');
  return response.json() as Promise<Todo[]>;
}, 'todos');

// Action for mutations (automatically revalidates queries)
const toggleTodoAction = action(async (id: string) => {
  'use server';
  await fetch(`https://api.example.com/todos/${id}/toggle`, {
    method: 'POST'
  });
  // Actions automatically revalidate all active queries by default
}, 'toggleTodo');

const addTodoAction = action(async (text: string) => {
  'use server';
  await fetch('https://api.example.com/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
}, 'addTodo');

const TodoApp: Component = () => {
  const todos = createAsync(() => getTodosQuery());
  const toggleTodo = useAction(toggleTodoAction);
  const addTodo = useAction(addTodoAction);

  let inputRef: HTMLInputElement;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const text = inputRef.value.trim();
    if (text) {
      await addTodo(text);
      inputRef.value = '';
    }
  };

  return (
    <div class="todo-app">
      <form onSubmit={handleSubmit}>
        <input ref={inputRef!} type="text" placeholder="Add todo..." />
        <button type="submit">Add</button>
      </form>

      <ul>
        <For each={todos()} fallback={<li>Loading...</li>}>
          {(todo) => (
            <li classList={{ completed: todo.completed }}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
              />
              <span>{todo.text}</span>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
};

export { TodoApp };
```

**Why good:** `action` for server mutations with automatic revalidation, `useAction` for calling actions, queries deduplicate across components

### Bad Example - Using deprecated cache API

```typescript
// BAD: 'cache' is deprecated since Solid Router v0.15.0
import { cache, createAsync } from '@solidjs/router';

// DEPRECATED - will be removed
const getUser = cache(async (id: string) => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}, 'user');

// Use 'query' instead:
import { query } from '@solidjs/router';

const getUserQuery = query(async (id: string) => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}, 'user');
```

**Why bad:** `cache` is deprecated since Solid Router v0.15.0, use `query` instead for the same functionality

---

## Basic Resource - User Profile

### Good Example - Resource with loading and error states

```typescript
import { createResource, Show, Switch, Match, Suspense, ErrorBoundary, type Component } from 'solid-js';

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

const fetchUser = async (id: string): Promise<User> => {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }
  return response.json();
};

const UserProfile: Component<{ userId: string }> = (props) => {
  // createResource with source signal
  const [user, { refetch, mutate }] = createResource(
    () => props.userId,
    fetchUser
  );

  return (
    <div class="user-profile">
      <Switch>
        <Match when={user.loading}>
          <div class="skeleton">
            <div class="skeleton-avatar" />
            <div class="skeleton-text" />
          </div>
        </Match>

        <Match when={user.error}>
          <div class="error" role="alert">
            <p>Error: {user.error.message}</p>
            <button onClick={refetch}>Try Again</button>
          </div>
        </Match>

        <Match when={user()}>
          {(userData) => (
            <div class="profile-card">
              <img src={userData().avatar} alt={userData().name} />
              <h2>{userData().name}</h2>
              <p>{userData().email}</p>
              <button onClick={refetch}>Refresh</button>
            </div>
          )}
        </Match>
      </Switch>
    </div>
  );
};

// Wrapper with Suspense and ErrorBoundary
const UserProfilePage: Component<{ userId: string }> = (props) => {
  return (
    <ErrorBoundary fallback={(err) => <div>Error: {err.message}</div>}>
      <Suspense fallback={<div class="loading">Loading user...</div>}>
        <UserProfile userId={props.userId} />
      </Suspense>
    </ErrorBoundary>
  );
};

export { UserProfile, UserProfilePage };
```

**Why good:** Source signal auto-refetches when userId changes, Switch handles all states, refetch available for manual refresh, ErrorBoundary wraps Suspense

---

## Resource with Dependent Fetch

### Good Example - Chained resources

```typescript
import { createSignal, createResource, Show, For, Suspense, type Component } from 'solid-js';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
}

const fetchCategories = async (): Promise<Category[]> => {
  const response = await fetch('/api/categories');
  return response.json();
};

const fetchProducts = async (categoryId: string): Promise<Product[]> => {
  const response = await fetch(`/api/categories/${categoryId}/products`);
  return response.json();
};

const ProductCatalog: Component = () => {
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null);

  // Categories load immediately
  const [categories] = createResource(fetchCategories);

  // Products only fetch when category is selected
  const [products] = createResource(
    selectedCategory,  // Returns null when not selected (skips fetch)
    fetchProducts
  );

  return (
    <div class="catalog">
      <div class="categories">
        <h3>Categories</h3>
        <Suspense fallback={<div>Loading categories...</div>}>
          <For each={categories()}>
            {(category) => (
              <button
                classList={{ active: selectedCategory() === category.id }}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            )}
          </For>
        </Suspense>
      </div>

      <div class="products">
        <Show when={selectedCategory()} fallback={<p>Select a category</p>}>
          <Suspense fallback={<div>Loading products...</div>}>
            <Show when={products()?.length} fallback={<p>No products</p>}>
              <For each={products()}>
                {(product) => (
                  <div class="product-card">
                    <h4>{product.name}</h4>
                    <p>${product.price.toFixed(2)}</p>
                  </div>
                )}
              </For>
            </Show>
          </Suspense>
        </Show>
      </div>
    </div>
  );
};

export { ProductCatalog };
```

**Why good:** Products resource depends on selectedCategory, null source skips fetch, separate Suspense boundaries for independent loading

---

## Optimistic Updates with mutate

### Good Example - Optimistic todo toggle

```typescript
import { createResource, For, type Component } from 'solid-js';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

const fetchTodos = async (): Promise<Todo[]> => {
  const response = await fetch('/api/todos');
  return response.json();
};

const updateTodoApi = async (id: string, completed: boolean): Promise<Todo> => {
  const response = await fetch(`/api/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed })
  });
  return response.json();
};

const TodoList: Component = () => {
  const [todos, { mutate, refetch }] = createResource(fetchTodos);

  const toggleTodo = async (id: string) => {
    const currentTodos = todos();
    if (!currentTodos) return;

    const todoIndex = currentTodos.findIndex(t => t.id === id);
    if (todoIndex === -1) return;

    const todo = currentTodos[todoIndex];
    const newCompleted = !todo.completed;

    // Optimistic update - instant UI feedback
    mutate(prev =>
      prev?.map(t => t.id === id ? { ...t, completed: newCompleted } : t)
    );

    try {
      // Actual API call
      await updateTodoApi(id, newCompleted);
    } catch (error) {
      // Revert on failure
      mutate(prev =>
        prev?.map(t => t.id === id ? { ...t, completed: !newCompleted } : t)
      );
      console.error('Failed to update todo:', error);
    }
  };

  const addTodo = async (text: string) => {
    const tempId = `temp-${Date.now()}`;

    // Optimistic add
    mutate(prev => [
      ...(prev ?? []),
      { id: tempId, text, completed: false }
    ]);

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const newTodo: Todo = await response.json();

      // Replace temp with real todo
      mutate(prev =>
        prev?.map(t => t.id === tempId ? newTodo : t)
      );
    } catch (error) {
      // Remove optimistic todo on failure
      mutate(prev => prev?.filter(t => t.id !== tempId));
      console.error('Failed to add todo:', error);
    }
  };

  return (
    <div class="todo-list">
      <input
        type="text"
        placeholder="Add todo..."
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
            addTodo(e.currentTarget.value.trim());
            e.currentTarget.value = '';
          }
        }}
      />

      <ul>
        <For each={todos()} fallback={<li>Loading...</li>}>
          {(todo) => (
            <li classList={{ completed: todo.completed, pending: todo.id.startsWith('temp-') }}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
              />
              <span>{todo.text}</span>
            </li>
          )}
        </For>
      </ul>

      <button onClick={refetch}>Refresh</button>
    </div>
  );
};

export { TodoList };
```

**Why good:** `mutate` for instant optimistic updates, revert on error, temporary IDs for new items, loading state via classList

---

## Search with Debounce

### Good Example - Debounced search resource

```typescript
import { createSignal, createResource, createMemo, For, Show, type Component } from 'solid-js';

interface SearchResult {
  id: string;
  title: string;
  description: string;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

const searchApi = async (query: string): Promise<SearchResult[]> => {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  return response.json();
};

// Custom debounced signal hook
function createDebouncedSignal<T>(initialValue: T, delay: number) {
  const [value, setValue] = createSignal(initialValue);
  const [debouncedValue, setDebouncedValue] = createSignal(initialValue);

  let timeoutId: ReturnType<typeof setTimeout>;

  const setDebouncedInput = (newValue: T) => {
    setValue(() => newValue);
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      setDebouncedValue(() => newValue);
    }, delay);
  };

  return [value, debouncedValue, setDebouncedInput] as const;
}

const SearchPage: Component = () => {
  const [query, debouncedQuery, setQuery] = createDebouncedSignal('', DEBOUNCE_MS);

  // Source returns null if query too short (skips fetch)
  const searchSource = createMemo(() => {
    const q = debouncedQuery();
    return q.length >= MIN_QUERY_LENGTH ? q : null;
  });

  const [results, { loading }] = createResource(searchSource, searchApi);

  const showResults = () =>
    query().length >= MIN_QUERY_LENGTH && !loading && results();

  return (
    <div class="search-page">
      <div class="search-input">
        <input
          type="search"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search..."
        />
        <Show when={loading}>
          <span class="spinner" />
        </Show>
      </div>

      <Show when={query().length > 0 && query().length < MIN_QUERY_LENGTH}>
        <p class="hint">Type at least {MIN_QUERY_LENGTH} characters to search</p>
      </Show>

      <Show when={showResults()}>
        <div class="results">
          <p class="count">{results()?.length ?? 0} results</p>
          <For each={results()} fallback={<p>No results found</p>}>
            {(result) => (
              <article class="result">
                <h3>{result.title}</h3>
                <p>{result.description}</p>
              </article>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export { SearchPage };
```

**Why good:** Debounced input prevents excessive API calls, minimum query length check, loading indicator, memo for conditional fetch source

---

## Parallel Resources

### Good Example - Dashboard with multiple data sources

```typescript
import { createResource, Suspense, type Component } from 'solid-js';

interface DashboardData {
  stats: { revenue: number; users: number; orders: number };
  recentOrders: { id: string; total: number }[];
  topProducts: { name: string; sales: number }[];
}

// Individual fetchers
const fetchStats = async () => {
  const response = await fetch('/api/dashboard/stats');
  return response.json();
};

const fetchRecentOrders = async () => {
  const response = await fetch('/api/dashboard/recent-orders');
  return response.json();
};

const fetchTopProducts = async () => {
  const response = await fetch('/api/dashboard/top-products');
  return response.json();
};

// Individual section components
const StatsSection: Component = () => {
  const [stats] = createResource(fetchStats);

  return (
    <div class="stats-grid">
      <div class="stat">
        <span class="label">Revenue</span>
        <span class="value">${stats()?.revenue.toLocaleString()}</span>
      </div>
      <div class="stat">
        <span class="label">Users</span>
        <span class="value">{stats()?.users.toLocaleString()}</span>
      </div>
      <div class="stat">
        <span class="label">Orders</span>
        <span class="value">{stats()?.orders.toLocaleString()}</span>
      </div>
    </div>
  );
};

const RecentOrdersSection: Component = () => {
  const [orders] = createResource(fetchRecentOrders);

  return (
    <div class="recent-orders">
      <h3>Recent Orders</h3>
      <ul>
        {orders()?.map(order => (
          <li>Order #{order.id}: ${order.total.toFixed(2)}</li>
        ))}
      </ul>
    </div>
  );
};

const TopProductsSection: Component = () => {
  const [products] = createResource(fetchTopProducts);

  return (
    <div class="top-products">
      <h3>Top Products</h3>
      <ul>
        {products()?.map(product => (
          <li>{product.name}: {product.sales} sales</li>
        ))}
      </ul>
    </div>
  );
};

// Dashboard with parallel loading
const Dashboard: Component = () => {
  return (
    <div class="dashboard">
      <h1>Dashboard</h1>

      {/* Each section loads independently */}
      <Suspense fallback={<div class="skeleton stats-skeleton" />}>
        <StatsSection />
      </Suspense>

      <div class="dashboard-grid">
        <Suspense fallback={<div class="skeleton orders-skeleton" />}>
          <RecentOrdersSection />
        </Suspense>

        <Suspense fallback={<div class="skeleton products-skeleton" />}>
          <TopProductsSection />
        </Suspense>
      </div>
    </div>
  );
};

export { Dashboard };
```

**Why good:** Each section fetches independently, separate Suspense boundaries for parallel streaming, fast sections show immediately

---

## Resource with Abort Controller

### Good Example - Cancellable fetch

```typescript
import { createSignal, createResource, onCleanup, type Component } from 'solid-js';

interface Article {
  id: string;
  title: string;
  content: string;
}

const fetchArticle = async (
  id: string,
  { signal }: { signal: AbortSignal }
): Promise<Article> => {
  const response = await fetch(`/api/articles/${id}`, { signal });
  if (!response.ok) throw new Error('Failed to fetch article');
  return response.json();
};

const ArticleViewer: Component = () => {
  const [articleId, setArticleId] = createSignal('1');

  const [article] = createResource(articleId, async (id, info) => {
    const controller = new AbortController();

    // Cleanup aborts in-flight request when id changes
    onCleanup(() => controller.abort());

    return fetchArticle(id, { signal: controller.signal });
  });

  const articles = ['1', '2', '3', '4', '5'];

  return (
    <div class="article-viewer">
      <nav class="article-nav">
        {articles.map(id => (
          <button
            classList={{ active: articleId() === id }}
            onClick={() => setArticleId(id)}
          >
            Article {id}
          </button>
        ))}
      </nav>

      <article class="article-content">
        {article.loading && <div class="loading">Loading article...</div>}
        {article.error && <div class="error">Error: {article.error.message}</div>}
        {article() && (
          <>
            <h1>{article()!.title}</h1>
            <div>{article()!.content}</div>
          </>
        )}
      </article>
    </div>
  );
};

export { ArticleViewer };
```

**Why good:** AbortController cancels in-flight requests on source change, prevents race conditions, onCleanup handles abort

---

## Bad Example - Manual State Management

```typescript
// BAD: Manual loading/error state instead of createResource
const BadDataFetching = () => {
  const [data, setData] = createSignal(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);

  createEffect(async () => {
    setLoading(true);
    setError(null);
    try {
      // BAD: Async in effect loses tracking context
      const response = await fetch('/api/data');
      setData(await response.json());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  });

  // BAD: No Suspense integration
  return (
    <div>
      {loading() && <div>Loading...</div>}
      {error() && <div>Error!</div>}
      {data() && <div>{data().name}</div>}
    </div>
  );
};
```

**Why bad:** Manual state management is verbose and error-prone, async in createEffect loses tracking, no Suspense/ErrorBoundary integration

---

## See Also

- [core.md](core.md) - Signals, effects, and memos
- [components.md](components.md) - Component patterns
- [stores.md](stores.md) - createStore for complex state
