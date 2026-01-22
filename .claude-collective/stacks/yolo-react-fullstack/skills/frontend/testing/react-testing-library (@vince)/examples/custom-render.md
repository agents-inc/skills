# React Testing Library - Custom Render Examples

> Custom render setup with providers and configurable state. Reference from [SKILL.md](../SKILL.md).

---

## Basic Custom Render Setup

```typescript
// Good Example - Full custom render with providers
// test-utils.tsx
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
// Import your app providers
import { ThemeProvider } from "../contexts/theme-context";
import { AuthProvider } from "../contexts/auth-context";

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry failed queries in tests
        gcTime: 0,    // Don't cache between tests
      },
    },
  });
}

interface AllProvidersProps {
  children: ReactNode;
}

function AllProviders({ children }: AllProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          {children}
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  // Add custom options here if needed
}

function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from @testing-library/react
export * from "@testing-library/react";
// Override render with custom render
export { customRender as render };
// Export for cases needing fresh client
export { createTestQueryClient };
```

**Why good:** Creates fresh QueryClient per test preventing cross-test pollution, disables retries for faster test failures, wraps all app providers in correct order

---

## Using Custom Render in Tests

```typescript
// Good Example - Using custom render
// components/__tests__/user-profile.test.tsx
import { screen, waitFor } from "../../test-utils"; // Import from custom utils
import { render } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import { UserProfile } from "../user-profile";

const MOCK_USER_NAME = "John Doe";
const MOCK_USER_EMAIL = "john@example.com";

describe("UserProfile", () => {
  test("displays user information", async () => {
    // Providers are automatically wrapped
    render(<UserProfile userId="1" />);

    // Wait for async data
    expect(await screen.findByText(MOCK_USER_NAME)).toBeInTheDocument();
    expect(screen.getByText(MOCK_USER_EMAIL)).toBeInTheDocument();
  });

  test("allows editing profile", async () => {
    const user = userEvent.setup();
    render(<UserProfile userId="1" />);

    // Wait for data to load
    await screen.findByText(MOCK_USER_NAME);

    // Click edit button
    await user.click(screen.getByRole("button", { name: /edit/i }));

    // Form should be visible
    expect(screen.getByRole("form")).toBeInTheDocument();
  });
});
```

**Why good:** Imports from custom test-utils, automatically has all providers, no boilerplate provider wrapping in each test

---

## Extended Custom Render with Initial State

```typescript
// Good Example - Custom render with configurable initial state
// test-utils.tsx (extended version)
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { AuthProvider, type AuthState } from "../contexts/auth-context";

interface ExtendedRenderOptions extends Omit<RenderOptions, "wrapper"> {
  initialAuthState?: Partial<AuthState>;
  route?: string;
}

function customRender(
  ui: ReactElement,
  {
    initialAuthState,
    route = "/",
    ...options
  }: ExtendedRenderOptions = {}
): RenderResult {
  // Set initial route if using router
  window.history.pushState({}, "Test page", route);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AuthProvider initialState={initialAuthState}>
        {children}
      </AuthProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

export { customRender as render };
export type { ExtendedRenderOptions };
```

---

## Using Custom Render with Options

```typescript
// Using custom render with options
import { render, screen } from "../../test-utils";

test("shows logout button when authenticated", async () => {
  render(<Header />, {
    initialAuthState: {
      user: { id: "1", name: "Test User" },
      isAuthenticated: true,
    },
    route: "/dashboard",
  });

  expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
});

test("shows login button when not authenticated", () => {
  render(<Header />, {
    initialAuthState: {
      user: null,
      isAuthenticated: false,
    },
  });

  expect(screen.getByRole("link", { name: /login/i })).toBeInTheDocument();
});
```

**Why good:** Allows configuring initial state per test, sets route for router-dependent components, maintains type safety with TypeScript

---

_For more patterns, see:_

- [core.md](core.md) - Query hierarchy
- [hooks.md](hooks.md) - Testing hooks with providers
- [async-testing.md](async-testing.md) - Async utilities
