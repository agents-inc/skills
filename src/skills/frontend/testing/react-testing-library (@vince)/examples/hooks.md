# React Testing Library - Hook Testing Examples

> Testing custom hooks with renderHook. Reference from [SKILL.md](../SKILL.md).

---

## Basic Hook Testing

```typescript
// Good Example - Testing custom hooks
import { renderHook, act } from "@testing-library/react";
import { useCounter } from "./use-counter";

const INITIAL_COUNT = 0;
const CUSTOM_INITIAL = 10;
const CUSTOM_STEP = 5;

describe("useCounter", () => {
  test("initializes with default value", () => {
    const { result } = renderHook(() => useCounter());

    expect(result.current.count).toBe(INITIAL_COUNT);
    expect(typeof result.current.increment).toBe("function");
    expect(typeof result.current.decrement).toBe("function");
  });

  test("initializes with custom value", () => {
    const { result } = renderHook(() => useCounter(CUSTOM_INITIAL));

    expect(result.current.count).toBe(CUSTOM_INITIAL);
  });

  test("increments count", () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  test("decrements count", () => {
    const { result } = renderHook(() => useCounter(CUSTOM_INITIAL));

    act(() => {
      result.current.decrement();
    });

    expect(result.current.count).toBe(CUSTOM_INITIAL - 1);
  });

  test("respects custom step", () => {
    const { result } = renderHook(() =>
      useCounter(INITIAL_COUNT, { step: CUSTOM_STEP })
    );

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(CUSTOM_STEP);
  });
});
```

**Why good:** Uses act() for state updates, accesses result.current for current value, tests initialization and interactions separately

---

## Hook with Rerender and Unmount

```typescript
// Good Example - Testing hook lifecycle
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "./use-local-storage";

const STORAGE_KEY = "test-key";
const INITIAL_VALUE = "initial";
const UPDATED_VALUE = "updated";

describe("useLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("initializes from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(UPDATED_VALUE));

    const { result } = renderHook(() =>
      useLocalStorage(STORAGE_KEY, INITIAL_VALUE)
    );

    expect(result.current[0]).toBe(UPDATED_VALUE);
  });

  test("updates localStorage on change", () => {
    const { result } = renderHook(() =>
      useLocalStorage(STORAGE_KEY, INITIAL_VALUE)
    );

    act(() => {
      result.current[1](UPDATED_VALUE);
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(UPDATED_VALUE));
    expect(result.current[0]).toBe(UPDATED_VALUE);
  });

  test("responds to key changes on rerender", () => {
    const { result, rerender } = renderHook(
      ({ key }) => useLocalStorage(key, INITIAL_VALUE),
      { initialProps: { key: STORAGE_KEY } }
    );

    expect(result.current[0]).toBe(INITIAL_VALUE);

    // Change the key
    localStorage.setItem("other-key", JSON.stringify(UPDATED_VALUE));
    rerender({ key: "other-key" });

    expect(result.current[0]).toBe(UPDATED_VALUE);
  });

  test("cleans up on unmount", () => {
    const { result, unmount } = renderHook(() =>
      useLocalStorage(STORAGE_KEY, INITIAL_VALUE)
    );

    // Unmount to trigger cleanup
    unmount();

    // Verify cleanup behavior (depends on hook implementation)
    // This is where you'd test any cleanup effects
  });
});
```

**Why good:** Tests rerender with changing props, tests unmount behavior, uses act() for all state updates

---

## Hook with Context Provider

```typescript
// Good Example - Hook requiring context
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { useAuth, AuthProvider } from "./auth-context";

const MOCK_USER = { id: "1", name: "Test User", email: "test@example.com" };

describe("useAuth", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  test("provides authentication state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test("handles login", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(MOCK_USER);
    });

    expect(result.current.user).toEqual(MOCK_USER);
    expect(result.current.isAuthenticated).toBe(true);
  });

  test("handles logout", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login first
    await act(async () => {
      await result.current.login(MOCK_USER);
    });

    // Then logout
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
```

**Why good:** Wraps hook with required context provider, uses async act() for async operations, tests the hook's public API

---

## Hook That Throws Errors

```typescript
// Good Example - Testing hooks that throw
import { renderHook } from "@testing-library/react";
import { useRequiredContext } from "./use-required-context";

const ERROR_MESSAGE = "useRequiredContext must be used within Provider";

describe("useRequiredContext", () => {
  test("throws when used outside provider", () => {
    // Suppress console.error for expected error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useRequiredContext());
    }).toThrow(ERROR_MESSAGE);

    consoleSpy.mockRestore();
  });

  test("works within provider", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RequiredProvider>{children}</RequiredProvider>
    );

    const { result } = renderHook(() => useRequiredContext(), { wrapper });

    expect(result.current).toBeDefined();
  });
});
```

**Why good:** Tests error cases by wrapping renderHook in expect().toThrow(), suppresses expected console errors for cleaner test output

---

_For more patterns, see:_
- [custom-render.md](custom-render.md) - Custom render with providers
- [async-testing.md](async-testing.md) - Async utilities
