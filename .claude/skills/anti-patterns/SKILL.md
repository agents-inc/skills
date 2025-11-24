# Code Review & Anti-Patterns

**Auto-detection:** Code review, PR review, anti-patterns, code quality checks, best practices enforcement, refactoring guidance

**When to use:**

- Reviewing pull requests for common anti-patterns
- Identifying state management mistakes (server data in Zustand, Context for state)
- Catching performance anti-patterns (memoize everything, no lazy loading)
- Ensuring accessibility and security best practices

**Key patterns covered:**

- State management anti-patterns (server data in Zustand/Context, Context for state management)
- Component anti-patterns (God components >300 lines, missing ref forwarding, no className prop)
- Performance anti-patterns (premature memoization, importing entire libraries, no code splitting)
- Security anti-patterns (committed secrets, dangerouslySetInnerHTML with user input, no validation)

---

# Anti-Patterns

> **Quick Guide:** Common mistakes compiled from all frontend patterns. Review these to avoid pitfalls.

This document compiles all anti-patterns identified across the frontend standards documentation.

---

## State Management Anti-Patterns

**❌ NEVER:**

- Store server data in Zustand (use React Query instead)
- Store client UI state in React Query (use Zustand instead)
- Create unnecessary object references in Zustand selectors (causes re-renders)
- Use prop drilling instead of state management for global state
- Mutate state directly (use immutable updates)
- Create separate stores for related data (use one store with slices)

---

## TypeScript Anti-Patterns

**❌ NEVER:**

- Use `any` without explicit justification comment
- Use `@ts-ignore` or `@ts-expect-error` without explaining why
- Skip type definitions for exported functions
- Use implicit `any` (enable `strict` mode)
- Define types far from their usage
- Use `I` prefix for interfaces (e.g., `IProduct`)
- Use `interface` for component props (use `type` instead)

---

## Component Anti-Patterns

**❌ NEVER:**

- Create God components (> 300 lines, > 10 props)
- Skip ref forwarding on interactive elements
- Skip className exposure (prevents customization)
- Use prop spreading without type safety
- Use inline styles instead of design tokens
- Use cva for components with no variants (over-engineering)
- Use default exports in library components (use named exports)
- Mix casing (Button.tsx vs button.module.scss)

---

## Performance Anti-Patterns

**❌ NEVER:**

- Memoize everything (premature optimization has overhead)
- Skip memoization for expensive operations
- Use inline function definitions in JSX props (causes re-renders)
- Import entire libraries (`import _ from 'lodash'` instead of `import debounce from 'lodash/debounce'`)
- Skip lazy loading for routes
- Skip code splitting
- Not optimize images (missing WebP, lazy loading, responsive sizes)
- Block main thread with heavy computation (use web workers)
- Not measure performance before optimizing
- Set bundle size budgets (sizes grow unnoticed)

---

## Testing Anti-Patterns

**❌ NEVER:**

- Test implementation details (test behavior, not implementation)
- Use brittle selectors (prefer `getByRole`, `getByLabelText`)
- Skip MSW setup for API tests
- Skip integration tests (only unit tests)
- Have incomplete test coverage (< 80%)
- Test private methods directly
- Mock too much (integration tests should use real dependencies)
- Skip accessibility testing

---

## API & Data Fetching Anti-Patterns

**❌ NEVER:**

- Hardcode API URLs (use environment variables)
- Skip error handling for API calls
- Skip loading states
- Skip retry logic for transient failures
- Mutate cache directly (use React Query mutation helpers)
- Fetch data on every render (use caching)
- Not handle race conditions
- Skip request deduplication

---

## Styling Anti-Patterns

**❌ NEVER:**

- Use CSS-in-JS (styled-components, Emotion) - use SCSS Modules
- Use inline styles for anything other than dynamic values
- Hardcode colors/spacing (use design tokens)
- Create component variables unnecessarily
- Use className toggling for state (use data-attributes)
- Skip Ladle stories for design system components
- Use Tailwind classes directly in components (use design tokens)

---

## Accessibility Anti-Patterns

**❌ NEVER:**

- Remove focus outlines without replacement
- Use `div` or `span` for buttons/links
- Add click handlers on non-interactive elements without role/keyboard support
- Use color-only error indicators
- Use placeholder text as label replacement
- Disable form submit buttons (show validation errors instead)
- Auto-play audio/video without controls
- Open new windows without warning
- Create form inputs without labels
- Skip keyboard navigation support

---

## Build & Tooling Anti-Patterns

**❌ NEVER:**

- Skip linting configuration
- Use multiple icon libraries (use lucide-react)
- Import entire lucide-react package
- Use magic numbers anywhere (use named constants)
- Skip TypeScript strict mode
- Modify generated files manually (regenerate from source)
- Skip pre-commit hooks
- Not use Turborepo caching (wastes build time)

---

## Environment & Security Anti-Patterns

**❌ NEVER:**

- Commit secrets to repository
- Use `process.env.VARIABLE` directly without validation
- Hardcode environment values in code
- Share `.env` files via Slack/email
- Use production secrets in development
- Skip `.env.example` documentation
- Skip validation (missing variables cause runtime errors)
- Use different variable names across environments
- Not rotate secrets
- Expose secrets in client-side code (must use framework prefixes)
- Use `dangerouslySetInnerHTML` with user input

---

## File & Directory Anti-Patterns

**❌ NEVER:**

- Use PascalCase for file names (use kebab-case)
- Mix casing (Button.tsx and button.module.scss)
- Use default exports in libraries
- Create barrel files in components (use package.json exports)
- Import from internal paths instead of package exports
- Use relative imports for cross-package imports

---

## Monorepo Anti-Patterns

**❌ NEVER:**

- Have version mismatches across packages (use syncpack)
- Skip dependency synchronization
- Not declare environment variables in turbo.json
- Modify turbo cache manually
- Run full test suite on every PR (use affected detection)
- Not use remote caching (wastes CI time)
- Not use affected builds

---

## Quick Anti-Pattern Checklist

Review this checklist before submitting code:

**Code Quality:**

- [ ] No `any` without justification
- [ ] No magic numbers
- [ ] No hardcoded values
- [ ] Named exports only
- [ ] kebab-case file names

**Components:**

- [ ] Ref forwarding on interactive elements
- [ ] className prop exposed
- [ ] No God components (< 300 lines)
- [ ] Data-attributes for state styling
- [ ] Design tokens (no hardcoded colors/spacing)

**State & Data:**

- [ ] Server data in React Query
- [ ] UI state in Zustand
- [ ] Separate selectors (or `shallow` when destructuring)
- [ ] No prop drilling for global state

**Performance:**

- [ ] Lazy load routes
- [ ] No unnecessary memoization
- [ ] Optimized images
- [ ] No large libraries imported whole

**Testing:**

- [ ] MSW for API mocking
- [ ] Testing Library queries (getByRole)
- [ ] Integration tests
- [ ] Accessibility tests

**Security:**

- [ ] No committed secrets
- [ ] Validated environment variables
- [ ] No exposed API keys
- [ ] Input sanitization

**Accessibility:**

- [ ] Semantic HTML
- [ ] Keyboard navigation
- [ ] ARIA labels
- [ ] Focus management
- [ ] Screen reader support


---

# Anti-Patterns Observed - Examples

---

## State Management Anti-Patterns

### Example: Mixing Server State with Client State

```typescript
// ❌ BAD: Managing server data in useState
function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchProducts()
      .then(setProducts)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (id: string, updates: Partial<Product>) => {
    const updated = await updateProduct(id, updates);
    setProducts(prev =>
      prev.map(p => p.id === id ? updated : p)
    ); // Manual cache update!
  };

  return (
    <div>
      {loading && <Spinner />}
      {error && <ErrorMessage error={error} />}
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  );
}

// ✅ GOOD: TanStack Query for server state
function ProductList() {
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  const { mutate: updateProduct } = useMutation({
    mutationFn: (vars: { id: string; updates: Partial<Product> }) =>
      apiClient.updateProduct(vars.id, vars.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {products?.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onUpdate={(updates) => updateProduct({ id: product.id, updates })}
        />
      ))}
    </div>
  );
}
```

**Why:** TanStack Query handles caching, revalidation, loading states, error handling automatically. Prevents stale data. Better UX.

**Edge Cases:**

- Use optimistic updates for instant feedback
- Configure stale time based on data volatility
- Prefetch for better perceived performance

---

## TypeScript Anti-Patterns

### Example: Avoiding `any` Abuse

```typescript
// ❌ BAD: Using any everywhere
function processData(data: any) {
  return data.map((item: any) => ({
    id: item.id,
    name: item.name.toUpperCase(), // No type safety!
  }));
}

// ✅ GOOD: Proper types
interface RawItem {
  id: string;
  name: string;
}

interface ProcessedItem {
  id: string;
  name: string;
}

function processData(data: RawItem[]): ProcessedItem[] {
  return data.map(item => ({
    id: item.id,
    name: item.name.toUpperCase(), // Type-safe!
  }));
}

// ✅ ACCEPTABLE: any with justification
function parseUnknownJSON(json: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return JSON.parse(json); // any is justified - unknown JSON structure
}

// ✅ BETTER: Use unknown instead of any when possible
function parseUnknownJSON(json: string): unknown {
  return JSON.parse(json); // Forces type checking before use
}
```

**Why:** Type safety prevents bugs. TypeScript's value is in catching errors. `any` disables all type checking.

**Edge Cases:**
- Use `unknown` when type is truly unknown
- Use type guards to narrow unknown types
- Document why `any` is necessary if used
- Consider generic types for flexible yet safe code

---

### Example: Interface vs Type for Props

```typescript
// ❌ BAD: Using interface for component props
interface ButtonProps {
  variant: "primary" | "secondary";
  onClick: () => void;
}

// ✅ GOOD: Use type for component props
type ButtonProps = {
  variant: "primary" | "secondary";
  onClick: () => void;
};

// ✅ GOOD: Use interface for API contracts and extensible types
interface User {
  id: string;
  name: string;
  email: string;
}

interface AdminUser extends User {
  role: "admin";
  permissions: string[];
}

// ✅ GOOD: Use type for unions and complex types
type Status = "idle" | "loading" | "success" | "error";

type ApiResponse<T> =
  | { status: "success"; data: T }
  | { status: "error"; error: string };
```

**Why:** Types are more flexible for component props. Interfaces are better for object contracts. Consistent pattern across codebase.

**Edge Cases:**
- Use interface when you need declaration merging
- Use type for union types and mapped types
- Be consistent within a file/module
- Both work for most cases - consistency matters most

---

### Example: Proper Type Inference

```typescript
// ❌ BAD: Redundant type annotations
const users: User[] = getUsers();
const count: number = users.length;
const first: User | undefined = users[0];

// ✅ GOOD: Let TypeScript infer
const users = getUsers(); // Type inferred from return type
const count = users.length; // Inferred as number
const first = users[0]; // Inferred as User | undefined

// ❌ BAD: Not annotating function returns
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ GOOD: Always annotate function return types
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

**Why:** Less noise in code. TypeScript is smart. Return type annotations catch errors and document intent.

**Edge Cases:**
- Annotate when inference is complex or wrong
- Always annotate public API function returns
- Let TypeScript infer local variables
- Use explicit types for complex generic inference

---

## Component Anti-Patterns

1: Prop Drilling Hell

```typescript
// ❌ BAD: Passing props through many layers
function App() {
  const [user, setUser] = useState<User>();
  return <Dashboard user={user} setUser={setUser} />;
}

function Dashboard({ user, setUser }: Props) {
  return <Sidebar user={user} setUser={setUser} />;
}

function Sidebar({ user, setUser }: Props) {
  return <UserMenu user={user} setUser={setUser} />;
}

function UserMenu({ user, setUser }: Props) {
  return <ProfileButton user={user} onUpdate={setUser} />;
}

// ✅ GOOD: Use Context for widely-used data
const UserContext = createContext<UserContextType | null>(null);

function App() {
  const [user, setUser] = useState<User>();
  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Dashboard />
    </UserContext.Provider>
  );
}

function ProfileButton() {
  const { user, setUser } = useContext(UserContext)!;
  return <button onClick={() => setUser(newUser)}>Update</button>;
}

// ✅ BETTER: Zustand for complex global state
import create from 'zustand';

const useUserStore = create<UserStore>(set => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));

function ProfileButton() {
  const { user, setUser } = useUserStore();
  return <button onClick={() => setUser(newUser)}>Update</button>;
}
```

**Why:** Prop drilling creates coupling. Makes refactoring hard. Context or state management scales better.

**Edge Cases:**

- Use context for truly global data only
- Consider composition for component-specific props
- State managers add bundle size - use when needed

---

### Example: Massive Uselessly Complex Components

```typescript
// ❌ BAD: 500-line component doing everything
function UserDashboard() {
  const [user, setUser] = useState<User>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUser().then(setUser);
    fetchPosts().then(setPosts);
    fetchComments().then(setComments);
  }, []);

  const handlePostSubmit = async (content: string) => {
    // 50 lines of logic
  };

  const handleCommentSubmit = async (postId: string, content: string) => {
    // 50 lines of logic
  };

  const filteredPosts = posts.filter(/* complex logic */);
  const sortedComments = comments.sort(/* complex logic */);

  return (
    <div>
      {/* 300 lines of JSX */}
      <UserProfile user={user} />
      <PostList posts={filteredPosts} />
      <CommentSection comments={sortedComments} />
      <PostForm onSubmit={handlePostSubmit} />
    </div>
  );
}

// ✅ GOOD: Compose smaller, focused components
function UserDashboard() {
  return (
    <div className="dashboard">
      <UserProfileSection />
      <PostsSection />
      <CommentsSection />
    </div>
  );
}

function PostsSection() {
  const { posts, isLoading } = usePostsQuery();
  const { mutate: createPost } = useCreatePostMutation();

  if (isLoading) return <Spinner />;

  return (
    <section>
      <PostList posts={posts} />
      <PostForm onSubmit={createPost} />
    </section>
  );
}
```

**Why:** Single responsibility. Easier testing. Better reusability. Clearer code organization.

**Edge Cases:**

- Break down when component exceeds ~200 lines
- Extract custom hooks for complex logic
- Co-locate related components in feature folders

---

### Example: Overusing useEffect

```typescript
// ❌ BAD: useEffect for derived state
function ProductFilter({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('');
  const [filteredProducts, setFilteredProducts] = useState(products);

  useEffect(() => {
    setFilteredProducts(
      products.filter(p => p.name.includes(filter))
    );
  }, [products, filter]); // Unnecessary effect!

  return (
    <>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      <ProductList products={filteredProducts} />
    </>
  );
}

// ✅ GOOD: Calculate during render
function ProductFilter({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('');

  const filteredProducts = useMemo(
    () => products.filter(p => p.name.includes(filter)),
    [products, filter]
  );

  return (
    <>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      <ProductList products={filteredProducts} />
    </>
  );
}

// ✅ EVEN BETTER: Don't memoize unless proven slow
function ProductFilter({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState('');

  const filteredProducts = products.filter(p =>
    p.name.includes(filter)
  ); // Fast enough for most cases!

  return (
    <>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      <ProductList products={filteredProducts} />
    </>
  );
}
```

**Why:** useEffect is for synchronization with external systems. Derived state should compute during render. Simpler code. Fewer bugs.

**Edge Cases:**

- Use useMemo only for expensive computations
- Profile before optimizing
- Keep logic synchronous when possible

---

### Example: Index as Key in Lists

```typescript
// ❌ BAD: Using array index as key
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map((todo, index) => (
        <li key={index}>
          <TodoItem todo={todo} />
        </li>
      ))}
    </ul>
  );
}
// Problem: Reordering or deleting items causes bugs!

// ✅ GOOD: Use stable unique identifiers
function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <TodoItem todo={todo} />
        </li>
      ))}
    </ul>
  );
}

// ✅ FALLBACK: Generate stable IDs if needed
import { nanoid } from 'nanoid';

function TodoList({ todos }: { todos: TodoWithoutId[] }) {
  const [todosWithIds] = useState(() =>
    todos.map(todo => ({ ...todo, id: nanoid() }))
  );

  return (
    <ul>
      {todosWithIds.map(todo => (
        <li key={todo.id}>
          <TodoItem todo={todo} />
        </li>
      ))}
    </ul>
  );
}
```

**Why:** Index keys break when order changes. React can't track components correctly. Causes state bugs and performance issues.

**Edge Cases:**

- Index is OK if list never reorders/filters/deletes
- Use crypto.randomUUID() in browsers, nanoid elsewhere
- Backend should provide IDs ideally

---

## Performance Anti-Patterns

### Example: Over-Memoization

```typescript
// ❌ BAD: Memoizing everything unnecessarily
function ProductCard({ product }: { product: Product }) {
  const name = useMemo(() => product.name, [product.name]);
  const price = useMemo(() => `${product.price}`, [product.price]);
  const isExpensive = useMemo(() => product.price > 100, [product.price]);

  const handleClick = useCallback(() => {
    console.log(product.id);
  }, [product.id]);

  return (
    <div onClick={handleClick}>
      <h3>{name}</h3>
      <p>{price}</p>
      {isExpensive && <Badge>Premium</Badge>}
    </div>
  );
}

// ✅ GOOD: Only memoize when necessary
function ProductCard({ product }: { product: Product }) {
  // Simple operations - no memoization needed
  const price = `${product.price}`;
  const isExpensive = product.price > 100;

  // Only memoize if this component re-renders often with same product
  const handleClick = useCallback(() => {
    console.log(product.id);
  }, [product.id]);

  return (
    <div onClick={handleClick}>
      <h3>{product.name}</h3>
      <p>{price}</p>
      {isExpensive && <Badge>Premium</Badge>}
    </div>
  );
}

// ✅ WHEN TO MEMOIZE: Expensive computations
function DataGrid({ data }: { data: Item[] }) {
  // This is expensive - memoize it!
  const sortedAndFiltered = useMemo(() => {
    return data
      .filter(item => item.active)
      .sort((a, b) => a.priority - b.priority)
      .map(item => ({
        ...item,
        computed: heavyComputation(item), // Expensive operation
      }));
  }, [data]);

  return <VirtualList items={sortedAndFiltered} />;
}
```

**Why:** Memoization has overhead. Most operations are fast. Profile first, optimize later. Premature optimization wastes time.

**Edge Cases:**
- Memoize expensive computations (> 5ms)
- Memoize to prevent child re-renders
- Use React DevTools Profiler to identify issues
- Consider React.memo for expensive components

---

### Example: Bundle Size Anti-Patterns

```typescript
// ❌ BAD: Importing entire lodash
import _ from 'lodash';

const debounced = _.debounce(search, 300);
const uniqueItems = _.uniq(items);

// ✅ GOOD: Import specific functions
import debounce from 'lodash/debounce';
import uniq from 'lodash/uniq';

const debounced = debounce(search, 300);
const uniqueItems = uniq(items);

// ✅ BETTER: Use native methods when possible
const debounced = debounce(search, 300); // lodash still needed
const uniqueItems = [...new Set(items)]; // Native!

// ❌ BAD: Importing entire icon library
import * as Icons from 'lucide-react';

function MyComponent() {
  return <Icons.Heart />;
}

// ✅ GOOD: Import specific icons
import { Heart, Star, Check } from 'lucide-react';

function MyComponent() {
  return <Heart />;
}

// ❌ BAD: Not lazy loading routes
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

const routes = [
  { path: '/', component: Home },
  { path: '/dashboard', component: Dashboard },
  { path: '/settings', component: Settings },
];

// ✅ GOOD: Lazy load routes
import { lazy } from 'react';

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

const routes = [
  { path: '/', component: Home },
  { path: '/dashboard', component: Dashboard },
  { path: '/settings', component: Settings },
];
```

**Why:** Smaller bundles load faster. Users don't download unused code. Better Core Web Vitals. Improved mobile experience.

**Edge Cases:**
- Monitor bundle size in CI
- Use webpack-bundle-analyzer to find bloat
- Consider tree-shaking support when choosing libraries
- Lazy load heavy components (charts, editors)

---

## Testing Anti-Patterns

### Example: Testing Implementation Details

```typescript
// ❌ BAD: Testing implementation details
import { render } from '@testing-library/react';
import Counter from './Counter';

test('counter uses useState', () => {
  const { container } = render(<Counter />);
  const component = container.firstChild;

  // Testing React internals - brittle!
  expect(component).toHaveProperty('_reactInternals');
});

test('increments internal state', () => {
  const { container } = render(<Counter />);

  // Accessing private state - breaks on refactor
  const instance = container.querySelector('[data-testid="counter"]');
  expect(instance.__reactInternalState.count).toBe(0);
});

// ✅ GOOD: Testing behavior from user's perspective
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('increments counter when button clicked', async () => {
  const user = userEvent.setup();
  render(<Counter />);

  // Test what users see and do
  expect(screen.getByText('Count: 0')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /increment/i }));

  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

**Why:** Implementation can change without breaking functionality. Tests should verify behavior, not internal structure. User-focused tests are more valuable.

**Edge Cases:**
- Use React Testing Library queries (getByRole, getByLabelText)
- Avoid querySelector unless absolutely necessary
- Test accessibility as part of behavior
- Focus on user interactions and outcomes

---

### Example: Brittle Selectors

```typescript
// ❌ BAD: Brittle CSS selectors
test('shows user name', () => {
  render(<UserProfile user={mockUser} />);

  const name = document.querySelector('.user-profile > .header > .name > span');
  expect(name).toHaveTextContent('John Doe');
});

// ❌ BAD: Test IDs everywhere
test('shows user name', () => {
  render(<UserProfile user={mockUser} />);

  expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
});

// ✅ GOOD: Semantic queries (priority order)
test('shows user name', () => {
  render(<UserProfile user={mockUser} />);

  // 1. Prefer getByRole
  expect(screen.getByRole('heading', { name: /john doe/i })).toBeInTheDocument();

  // 2. Or getByLabelText for form fields
  // 3. Or getByText for non-interactive elements
  // 4. Or getByTestId as last resort
});

// ✅ GOOD: Query by accessible labels
test('can submit form', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();

  render(<ContactForm onSubmit={onSubmit} />);

  // Use labels - ensures accessibility!
  await user.type(screen.getByLabelText(/name/i), 'John Doe');
  await user.type(screen.getByLabelText(/email/i), 'john@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(onSubmit).toHaveBeenCalledWith({
    name: 'John Doe',
    email: 'john@example.com',
  });
});
```

**Why:** Semantic queries match how users interact. Tests also verify accessibility. More resilient to refactoring. Better developer experience.

**Edge Cases:**
- Use data-testid for complex dynamic content
- Prefer text matching for static content
- Use screen.logTestingPlaygroundURL() to find best queries
- Follow Testing Library query priority

---

### Example: Not Using MSW for API Tests

```typescript
// ❌ BAD: Mocking fetch directly
import { vi } from 'vitest';

test('loads user data', async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({ id: '1', name: 'John' }),
    })
  ) as any;

  render(<UserProfile userId="1" />);

  await waitFor(() => {
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  // Cleanup issues, type errors, hard to maintain
});

// ✅ GOOD: Use MSW for API mocking
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/users/:userId', ({ params }) => {
    return HttpResponse.json({
      id: params.userId,
      name: 'John Doe',
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('loads user data', async () => {
  render(<UserProfile userId="1" />);

  expect(await screen.findByText('John Doe')).toBeInTheDocument();
});

test('handles error state', async () => {
  server.use(
    http.get('/api/users/:userId', () => {
      return new HttpResponse(null, { status: 500 });
    })
  );

  render(<UserProfile userId="1" />);

  expect(await screen.findByText(/error loading user/i)).toBeInTheDocument();
});
```

**Why:** MSW works at network level. No need to mock fetch/axios. Test real API client. Supports both tests and development. Standard industry practice.

**Edge Cases:**
- Set up MSW handlers in test setup file
- Use server.use() for per-test overrides
- Test loading states, error states, empty states
- Mock GraphQL with graphql from MSW

---

### Example: Incomplete Test Coverage

```typescript
// ❌ BAD: Only testing happy path
test('creates user', async () => {
  const user = userEvent.setup();
  render(<UserForm onSubmit={mockSubmit} />);

  await user.type(screen.getByLabelText(/name/i), 'John');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(mockSubmit).toHaveBeenCalled();
});

// ✅ GOOD: Test all paths and edge cases
describe('UserForm', () => {
  test('submits valid data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<UserForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'John Doe',
      email: 'john@example.com',
    });
  });

  test('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<UserForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });

  test('shows error for invalid email', async () => {
    const user = userEvent.setup();
    render(<UserForm onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/email/i), 'invalid-email');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
  });

  test('disables submit button while submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<UserForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/name/i), 'John');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
  });

  test('shows API error message', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => Promise.reject(new Error('Server error')));
    render(<UserForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/name/i), 'John');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/server error/i)).toBeInTheDocument();
  });

  test('is keyboard accessible', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<UserForm onSubmit={onSubmit} />);

    // Tab through form
    await user.tab();
    expect(screen.getByLabelText(/name/i)).toHaveFocus();

    await user.keyboard('John Doe');
    await user.tab();
    expect(screen.getByLabelText(/email/i)).toHaveFocus();

    await user.keyboard('john@example.com');
    await user.tab();
    expect(screen.getByRole('button', { name: /submit/i })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalled();
  });
});
```

**Why:** Edge cases cause production bugs. Validation prevents bad data. Error handling improves UX. Accessibility is not optional. Complete coverage prevents regressions.

**Edge Cases:**
- Test loading states
- Test error states
- Test empty states
- Test keyboard navigation
- Test screen reader announcements
- Aim for > 80% coverage

