# Error Boundaries - Testing Examples

> Extended testing examples for error boundaries. See [core.md](core.md) for core patterns.

**Prerequisites**: Understand the basic ErrorBoundary component and react-error-boundary library usage from core examples first.

---

## Pattern 5: Testing Error Boundary Behavior

### Good Example - Comprehensive Boundary Tests

```typescript
// src/components/error-boundary/error-boundary.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "./error-boundary";

// Component that throws on demand
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Content rendered successfully</div>;
}

describe("ErrorBoundary", () => {
  // Suppress console.error during tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Content rendered successfully")).toBeInTheDocument();
  });

  it("renders fallback UI when error occurs", () => {
    render(
      <ErrorBoundary fallback={<div>Error fallback</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Error fallback")).toBeInTheDocument();
    expect(screen.queryByText("Content rendered successfully")).not.toBeInTheDocument();
  });

  it("calls onError when error is caught", () => {
    const handleError = vi.fn();

    render(
      <ErrorBoundary onError={handleError} fallback={<div>Error</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(handleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it("resets error state when reset is called", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    const { rerender } = render(
      <ErrorBoundary
        fallbackRender={({ resetErrorBoundary }) => (
          <div>
            <span>Error occurred</span>
            <button onClick={resetErrorBoundary}>Reset</button>
          </div>
        )}
      >
        <ThrowingComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Error occurred")).toBeInTheDocument();

    // Fix the error condition
    shouldThrow = false;

    // Click reset button
    await user.click(screen.getByRole("button", { name: "Reset" }));

    // Re-render with fixed component
    rerender(
      <ErrorBoundary
        fallbackRender={({ resetErrorBoundary }) => (
          <div>
            <span>Error occurred</span>
            <button onClick={resetErrorBoundary}>Reset</button>
          </div>
        )}
      >
        <ThrowingComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Content rendered successfully")).toBeInTheDocument();
  });
});
```

**Why good:** Tests all key behaviors - normal render, error fallback, callback, reset, suppresses console.error to keep test output clean

---

### Good Example - Testing useErrorBoundary Hook

```typescript
// src/features/data-loader/data-loader.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "react-error-boundary";
import { DataLoaderContent } from "./data-loader";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("DataLoaderContent with error boundary", () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("shows error in boundary when fetch fails", async () => {
    const user = userEvent.setup();
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <div role="alert">Error: {error.message}</div>
        )}
      >
        <DataLoaderContent />
      </ErrorBoundary>
    );

    await user.click(screen.getByRole("button", { name: /load data/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });

  it("recovers when retry succeeds", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: "1", name: "Item 1" }]),
      });

    render(
      <ErrorBoundary
        fallbackRender={({ error, resetErrorBoundary }) => (
          <div role="alert">
            <span>Error: {error.message}</span>
            <button onClick={resetErrorBoundary}>Retry</button>
          </div>
        )}
      >
        <DataLoaderContent />
      </ErrorBoundary>
    );

    // Trigger error
    await user.click(screen.getByRole("button", { name: /load data/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    // Reset and retry
    await user.click(screen.getByRole("button", { name: /retry/i }));
    await user.click(screen.getByRole("button", { name: /load data/i }));

    await waitFor(() => {
      expect(screen.getByText("Item 1")).toBeInTheDocument();
    });
  });
});
```

**Why good:** Tests async error propagation via useErrorBoundary hook, tests recovery flow, proper mock setup and cleanup

---

### Good Example - Testing resetKeys Behavior

```typescript
// src/features/user-profile/user-profile.test.tsx
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "react-error-boundary";

function ProfileContent({ userId }: { userId: string }) {
  if (userId === "invalid") {
    throw new Error("Invalid user");
  }
  return <div>Profile for {userId}</div>;
}

describe("ErrorBoundary resetKeys", () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("auto-resets when resetKeys change", () => {
    const { rerender } = render(
      <ErrorBoundary
        resetKeys={["invalid"]}
        fallbackRender={() => <div>Error fallback</div>}
      >
        <ProfileContent userId="invalid" />
      </ErrorBoundary>
    );

    expect(screen.getByText("Error fallback")).toBeInTheDocument();

    // Change to valid user - boundary should reset due to resetKeys change
    rerender(
      <ErrorBoundary
        resetKeys={["valid-user"]}
        fallbackRender={() => <div>Error fallback</div>}
      >
        <ProfileContent userId="valid-user" />
      </ErrorBoundary>
    );

    expect(screen.getByText("Profile for valid-user")).toBeInTheDocument();
  });
});
```

**Why good:** Tests automatic reset behavior when route params change, useful for navigation-triggered resets

---

## Pattern 6: Test Utilities for Error Boundaries

### Good Example - Reusable Test Helpers

```typescript
// src/test-utils/error-boundary-helpers.ts
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "react-error-boundary";

/**
 * Render a component wrapped in an error boundary for testing
 */
export function renderWithErrorBoundary(
  ui: ReactNode,
  options?: {
    onError?: (error: Error) => void;
    fallbackText?: string;
  }
) {
  const { onError, fallbackText = "Error occurred" } = options ?? {};

  return render(
    <ErrorBoundary
      onError={onError}
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div role="alert" data-testid="error-boundary-fallback">
          <span>{fallbackText}</span>
          <span data-testid="error-message">{error.message}</span>
          <button onClick={resetErrorBoundary}>Reset</button>
        </div>
      )}
    >
      {ui}
    </ErrorBoundary>
  );
}

/**
 * Assert that an error boundary caught an error
 */
export function expectErrorBoundaryCaught(expectedMessage?: string) {
  expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();
  if (expectedMessage) {
    expect(screen.getByTestId("error-message")).toHaveTextContent(expectedMessage);
  }
}

/**
 * Assert that content rendered without error
 */
export function expectNoError() {
  expect(screen.queryByTestId("error-boundary-fallback")).not.toBeInTheDocument();
}
```

**Why good:** Reusable helpers reduce test boilerplate, consistent error boundary testing patterns across codebase

---

### Good Example - Using Test Helpers

```typescript
// src/features/chart/chart.test.tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithErrorBoundary,
  expectErrorBoundaryCaught,
  expectNoError,
} from "@/test-utils/error-boundary-helpers";
import { Chart } from "./chart";

describe("Chart", () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("renders chart with valid data", () => {
    renderWithErrorBoundary(<Chart data={[{ x: 1, y: 2 }]} />);

    expectNoError();
    expect(screen.getByRole("img", { name: /chart/i })).toBeInTheDocument();
  });

  it("catches error with invalid data", () => {
    const onError = vi.fn();
    // @ts-expect-error Testing invalid data
    renderWithErrorBoundary(<Chart data={null} />, { onError });

    expectErrorBoundaryCaught("Cannot read properties of null");
    expect(onError).toHaveBeenCalled();
  });

  it("recovers after reset", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithErrorBoundary(<Chart data={[]} />);

    // Initially throws with empty data
    expectErrorBoundaryCaught();

    // Click reset
    await user.click(screen.getByRole("button", { name: /reset/i }));

    // Re-render with valid data
    rerender(
      <ErrorBoundary fallbackRender={() => <div>Error</div>}>
        <Chart data={[{ x: 1, y: 2 }]} />
      </ErrorBoundary>
    );

    expectNoError();
  });
});
```

**Why good:** Clean, readable tests using helpers, consistent assertion patterns

---
