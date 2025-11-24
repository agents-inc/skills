# Quick Reference for AI - Examples

---

## Essential Patterns

### Example: Complete Component Template

```typescript
// button.tsx
import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import styles from './button.module.scss';

const buttonVariants = cva(styles.button, {
  variants: {
    variant: {
      primary: styles.primary,
      secondary: styles.secondary,
      danger: styles.danger,
    },
    size: {
      sm: styles.sm,
      md: styles.md,
      lg: styles.lg,
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, children, loading, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        disabled={disabled || loading}
        data-loading={loading ? 'true' : undefined}
        {...props}
      >
        {loading ? 'Loading...' : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

```scss
// button.module.scss
@use '@repo/design-tokens' as *;

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: $font-family-base;
  font-weight: $font-weight-medium;
  border-radius: $border-radius-md;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid $color-focus;
    outline-offset: 2px;
  }

  &[data-loading='true'] {
    opacity: 0.7;
  }
}

.primary {
  background: $color-primary;
  color: $color-on-primary;

  &:hover:not(:disabled) {
    background: $color-primary-hover;
  }
}

.secondary {
  background: $color-secondary;
  color: $color-on-secondary;

  &:hover:not(:disabled) {
    background: $color-secondary-hover;
  }
}

.sm {
  height: $size-button-sm;
  padding: 0 $spacing-sm;
  font-size: $font-size-sm;
}

.md {
  height: $size-button-md;
  padding: 0 $spacing-md;
  font-size: $font-size-base;
}

.lg {
  height: $size-button-lg;
  padding: 0 $spacing-lg;
  font-size: $font-size-lg;
}
```

---

### Example: React Query + API Client Pattern

```typescript
// hooks/use-products.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Product, CreateProductData } from '@/types';

// Query keys
const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: string) => [...productKeys.lists(), { filters }] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

// List query
export function useProducts(filters?: string) {
  return useQuery({
    queryKey: productKeys.list(filters || 'all'),
    queryFn: () => apiClient.getProducts({ filters }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Detail query
export function useProduct(id: string) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => apiClient.getProduct({ id }),
    staleTime: 5 * 60 * 1000,
  });
}

// Create mutation
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductData) => apiClient.createProduct({ body: data }),
    onSuccess: () => {
      // Invalidate all product lists
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}

// Update mutation with optimistic update
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      apiClient.updateProduct({ id, body: data }),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: productKeys.detail(id) });

      // Snapshot previous value
      const previousProduct = queryClient.getQueryData(productKeys.detail(id));

      // Optimistically update
      queryClient.setQueryData(productKeys.detail(id), (old: Product | undefined) =>
        old ? { ...old, ...data } : old
      );

      return { previousProduct };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      queryClient.setQueryData(productKeys.detail(id), context?.previousProduct);
    },
    onSettled: (data, error, { id }) => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: productKeys.detail(id) });
    },
  });
}

// Delete mutation
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteProduct({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}
```

**Usage in component:**

```typescript
function ProductList() {
  const { data: products, isLoading, error } = useProducts();
  const { mutate: deleteProduct } = useDeleteProduct();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!products?.length) return <EmptyState />;

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>
          {product.name}
          <button onClick={() => deleteProduct(product.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

---

### Example: Zustand Store with Slices

```typescript
// stores/use-app-store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// UI Slice
interface UISlice {
  isSidebarOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const createUISlice = (set: any): UISlice => ({
  isSidebarOpen: false,
  theme: 'light',
  toggleSidebar: () => set((state: any) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setTheme: (theme) => set({ theme }),
});

// User Slice
interface UserSlice {
  user: { id: string; name: string } | null;
  setUser: (user: UserSlice['user']) => void;
  logout: () => void;
}

const createUserSlice = (set: any): UserSlice => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
});

// Notification Slice
interface NotificationSlice {
  notifications: Array<{ id: string; message: string; type: 'info' | 'error' | 'success' }>;
  addNotification: (notification: Omit<NotificationSlice['notifications'][0], 'id'>) => void;
  removeNotification: (id: string) => void;
}

const createNotificationSlice = (set: any): NotificationSlice => ({
  notifications: [],
  addNotification: (notification) =>
    set((state: any) => ({
      notifications: [...state.notifications, { ...notification, id: Date.now().toString() }],
    })),
  removeNotification: (id) =>
    set((state: any) => ({
      notifications: state.notifications.filter((n: any) => n.id !== id),
    })),
});

// Combined Store
type AppStore = UISlice & UserSlice & NotificationSlice;

export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set) => ({
        ...createUISlice(set),
        ...createUserSlice(set),
        ...createNotificationSlice(set),
      }),
      {
        name: 'app-store',
        partialize: (state) => ({
          // Only persist theme and user
          theme: state.theme,
          user: state.user,
        }),
      }
    )
  )
);

// Selectors with shallow comparison
import { shallow } from 'zustand/shallow';

export const useUI = () =>
  useAppStore(
    (state) => ({
      isSidebarOpen: state.isSidebarOpen,
      theme: state.theme,
      toggleSidebar: state.toggleSidebar,
      setTheme: state.setTheme,
    }),
    shallow
  );

export const useUser = () =>
  useAppStore(
    (state) => ({
      user: state.user,
      setUser: state.setUser,
      logout: state.logout,
    }),
    shallow
  );

export const useNotifications = () =>
  useAppStore(
    (state) => ({
      notifications: state.notifications,
      addNotification: state.addNotification,
      removeNotification: state.removeNotification,
    }),
    shallow
  );
```

---

### Example: Custom Hook Pattern

```typescript
// hooks/use-pagination.ts
import { useState, useMemo } from 'react';

interface UsePaginationProps {
  totalItems: number;
  itemsPerPage: number;
  initialPage?: number;
}

export function usePagination({ totalItems, itemsPerPage, initialPage = 1 }: UsePaginationProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = useMemo(
    () => Math.ceil(totalItems / itemsPerPage),
    [totalItems, itemsPerPage]
  );

  const startIndex = useMemo(
    () => (currentPage - 1) * itemsPerPage,
    [currentPage, itemsPerPage]
  );

  const endIndex = useMemo(
    () => Math.min(startIndex + itemsPerPage, totalItems),
    [startIndex, itemsPerPage, totalItems]
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    goToNextPage,
    goToPrevPage,
    goToFirstPage,
    goToLastPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}

// Usage
function ProductList({ products }: { products: Product[] }) {
  const { currentPage, totalPages, startIndex, endIndex, goToPage, hasNextPage, hasPrevPage } =
    usePagination({
      totalItems: products.length,
      itemsPerPage: 10,
    });

  const visibleProducts = products.slice(startIndex, endIndex);

  return (
    <div>
      <ul>
        {visibleProducts.map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>

      <div>
        <button onClick={() => goToPage(currentPage - 1)} disabled={!hasPrevPage}>
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button onClick={() => goToPage(currentPage + 1)} disabled={!hasNextPage}>
          Next
        </button>
      </div>
    </div>
  );
}
```

---

### Example: Error Boundary with Retry

```typescript
// components/error-boundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './button';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <div role="alert" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <pre style={{ color: 'red', marginTop: '1rem' }}>{this.state.error.message}</pre>
          <Button onClick={this.reset} style={{ marginTop: '1rem' }}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage with custom fallback
<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <h1>Oops!</h1>
      <p>{error.message}</p>
      <button onClick={reset}>Retry</button>
    </div>
  )}
  onError={(error) => {
    // Send to error tracking service
    console.error('Error tracked:', error);
  }}
>
  <App />
</ErrorBoundary>;
```

---

### Example: Testing Library Pattern (Complete)

```typescript
// product-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { ProductForm } from './product-form';

describe('ProductForm', () => {
  test('submits valid product data', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    render(<ProductForm onSuccess={onSuccess} />);

    // Fill form
    await user.type(screen.getByLabelText(/product name/i), 'New Product');
    await user.type(screen.getByLabelText(/price/i), '29.99');
    await user.type(screen.getByLabelText(/description/i), 'A great product');

    // Submit
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Assert API was called
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Product',
          price: 29.99,
          description: 'A great product',
        })
      );
    });
  });

  test('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<ProductForm onSuccess={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/price is required/i)).toBeInTheDocument();
  });

  test('handles API errors', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/products', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    render(<ProductForm onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/product name/i), 'New Product');
    await user.type(screen.getByLabelText(/price/i), '29.99');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/failed to create product/i)).toBeInTheDocument();
  });

  test('disables submit button while submitting', async () => {
    const user = userEvent.setup();
    render(<ProductForm onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText(/product name/i), 'New Product');
    await user.type(screen.getByLabelText(/price/i), '29.99');

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
  });

  test('is keyboard accessible', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<ProductForm onSuccess={onSuccess} />);

    // Tab through form
    await user.tab();
    expect(screen.getByLabelText(/product name/i)).toHaveFocus();

    await user.keyboard('Product Name');
    await user.tab();
    expect(screen.getByLabelText(/price/i)).toHaveFocus();

    await user.keyboard('19.99');
    await user.tab();
    expect(screen.getByLabelText(/description/i)).toHaveFocus();

    await user.keyboard('Description');
    await user.tab();
    expect(screen.getByRole('button', { name: /submit/i })).toHaveFocus();

    // Submit with Enter
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
```

---

## Critical Do's

### ✅ Do: Use React Query for Server State

```typescript
// ✅ GOOD: React Query handles caching, revalidation, loading states
function ProductList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => apiClient.getProducts(),
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return <ul>{data?.map((product) => <li key={product.id}>{product.name}</li>)}</ul>;
}
```

### ✅ Do: Validate Environment Variables with Zod

```typescript
// ✅ GOOD: Type-safe environment variables
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_ENVIRONMENT: z.enum(['development', 'staging', 'production']),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
});

// Usage: env.NEXT_PUBLIC_API_URL (typed!)
```

### ✅ Do: Forward Refs on Interactive Elements

```typescript
// ✅ GOOD: Ref forwarding for focus management
export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...props} />;
});

// Usage
function Form() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return <Input ref={inputRef} />;
}
```

### ✅ Do: Use MSW for API Mocking

```typescript
// ✅ GOOD: MSW for realistic API mocking
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/products', () => {
    return HttpResponse.json([{ id: '1', name: 'Product 1' }]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Critical Don'ts

### ❌ Don't: Store Server Data in Zustand

```typescript
// ❌ BAD: Manually managing server state
const useProductStore = create((set) => ({
  products: [],
  loading: false,
  fetchProducts: async () => {
    set({ loading: true });
    const products = await apiClient.getProducts();
    set({ products, loading: false });
  },
}));

// ✅ GOOD: Use React Query for server state
const { data: products, isLoading } = useQuery({
  queryKey: ['products'],
  queryFn: () => apiClient.getProducts(),
});
```

### ❌ Don't: Skip Shallow for Multiple Zustand Selects

```typescript
// ❌ BAD: Causes unnecessary re-renders
const { user, theme } = useAppStore((state) => ({
  user: state.user,
  theme: state.theme,
}));
// Re-renders on ANY state change!

// ✅ GOOD: Use shallow comparison
import { shallow } from 'zustand/shallow';

const { user, theme } = useAppStore(
  (state) => ({
    user: state.user,
    theme: state.theme,
  }),
  shallow
);
// Only re-renders when user or theme change!
```

### ❌ Don't: Use `any` Without Justification

```typescript
// ❌ BAD: No type safety
function processData(data: any) {
  return data.map((item: any) => item.name);
}

// ✅ GOOD: Proper types
interface Item {
  id: string;
  name: string;
}

function processData(data: Item[]): string[] {
  return data.map((item) => item.name);
}
```

### ❌ Don't: Memoize Everything

```typescript
// ❌ BAD: Unnecessary memoization overhead
function Component({ name }: { name: string }) {
  const uppercaseName = useMemo(() => name.toUpperCase(), [name]);
  const length = useMemo(() => name.length, [name]);

  return (
    <div>
      {uppercaseName} ({length})
    </div>
  );
}

// ✅ GOOD: Simple calculations don't need memoization
function Component({ name }: { name: string }) {
  const uppercaseName = name.toUpperCase(); // Fast enough!
  const length = name.length;

  return (
    <div>
      {uppercaseName} ({length})
    </div>
  );
}
```

---

## File-Scoped Commands

### Example: Fast Feedback Loop

```bash
# Watch mode for development
bun vitest watch src/components/button.test.tsx

# Type check while editing
bun tsc --noEmit --watch

# Lint and fix on save
bun eslint src/components/button.tsx --fix

# Format on save
bun prettier --write src/components/button.tsx
```

### Example: Turborepo Affected Detection

```bash
# Test only affected packages since main
bun turbo test --filter=...[origin/main]

# Build only affected packages
bun turbo build --filter=...[origin/main]

# Example output:
# • Packages in scope: @repo/ui, @repo/api-client
# • Packages not in scope: @repo/database (no changes)
```

### Example: Package-Scoped Operations

```bash
# Run all checks for specific package
bun --filter @repo/ui run lint
bun --filter @repo/ui run type-check
bun --filter @repo/ui run test
bun --filter @repo/ui run build

# Run checks for multiple packages
bun --filter @repo/ui --filter @repo/api-client test

# Run checks for all packages
bun turbo test
