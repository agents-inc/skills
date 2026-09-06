# React Testing Library - Hook Testing Examples

> `renderHook`, `rerender`, `unmount`, wrappers, and hooks that throw. See [custom-render.md](custom-render.md) for the provider wrapper these reuse.

> `fn()` and `spyOn()` below stand for your test runner's mock-function and spy factories.

---

## Reading and updating hook state

```typescript
import { renderHook, act } from "@testing-library/react";
import { useCounter } from "./use-counter";

describe("useCounter", () => {
  test("initializes with the given value", () => {
    const { result } = renderHook(() => useCounter(10));

    expect(result.current.count).toBe(10);
  });

  test("increments", () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  test("respects a custom step", () => {
    const { result } = renderHook(() => useCounter(0, { step: 5 }));

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(5);
  });
});
```

**Why good:** state updates go through `act`, so React has flushed by the time `result.current` is read. Reading `result.current` fresh after each update matters — it is a getter onto the latest render, and a value copied into a local before the `act` is the old one.

---

## rerender and unmount

```typescript
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "./use-local-storage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("reads an existing value", () => {
    localStorage.setItem("draft", JSON.stringify("saved"));

    const { result } = renderHook(() => useLocalStorage("draft", "initial"));

    expect(result.current[0]).toBe("saved");
  });

  test("writes through on change", () => {
    const { result } = renderHook(() => useLocalStorage("draft", "initial"));

    act(() => {
      result.current[1]("updated");
    });

    expect(localStorage.getItem("draft")).toBe(JSON.stringify("updated"));
    expect(result.current[0]).toBe("updated");
  });

  test("re-reads when the key prop changes", () => {
    const { result, rerender } = renderHook(
      ({ key }) => useLocalStorage(key, "initial"),
      { initialProps: { key: "draft" } },
    );

    expect(result.current[0]).toBe("initial");

    localStorage.setItem("other", JSON.stringify("updated"));
    rerender({ key: "other" }); // same hook instance, new props

    expect(result.current[0]).toBe("updated");
  });

  test("detaches its storage listener on unmount", () => {
    const removeListener = spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useLocalStorage("draft", "initial"));

    unmount();

    expect(removeListener).toHaveBeenCalledWith(
      "storage",
      expect.any(Function),
    );
  });
});
```

**Why good:** `rerender` keeps the hook mounted, so this covers the props-changed path rather than a fresh mount that would pass regardless. The unmount test asserts on something observable outside the hook — a cleanup test that only calls `unmount()` and asserts nothing is a test of nothing.

---

## Hooks that need context

```typescript
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { useAuth, AuthProvider } from "./auth-context";

const MOCK_USER = { id: "1", name: "Test User", email: "test@example.com" };

describe("useAuth", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  test("starts unauthenticated", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  test("logs in", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(MOCK_USER); // async act, for an async transition
    });

    expect(result.current.user).toEqual(MOCK_USER);
    expect(result.current.isAuthenticated).toBe(true);
  });
});
```

---

## Hooks that throw

```typescript
import { renderHook } from "@testing-library/react";
import { useRequiredContext } from "./use-required-context";

test("throws outside its provider", () => {
  // React logs the error before rethrowing; silence it so the run stays readable
  const consoleError = spyOn(console, "error").mockImplementation(() => {});

  expect(() => renderHook(() => useRequiredContext())).toThrow(
    "useRequiredContext must be used within Provider",
  );

  consoleError.mockRestore();
});
```

**Why good:** the guard clause is the hook's contract, so it deserves a test. Restoring the console spy afterwards keeps a genuine error in a later test visible.

---

_Next: [accessibility.md](accessibility.md), or back to [core.md](core.md)._
