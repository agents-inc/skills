# React Testing Library - Custom Render Examples

> Wrapping the app's providers once, and letting a test state its precondition. See [hooks.md](hooks.md) for the `wrapper` option on `renderHook`.

---

## The wrapper and the shadowed export

```typescript
// test-utils.tsx
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ThemeProvider } from "../contexts/theme-context";
import { AuthProvider } from "../contexts/auth-context";

function AllProviders({ children }: { children: ReactNode }) {
  // Nest in the same order the application does - a provider that reads another's
  // context breaks silently if the test tree inverts them
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
    </AuthProvider>
  );
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from "@testing-library/react";
export { customRender as render }; // must come after the star export to shadow it
```

**Why good:** the re-export means a test changes one import path and keeps every other name. The export order matters — `export *` first, then the override — because the later binding wins.

---

## Using it

```typescript
// components/__tests__/user-profile.test.tsx
import { render, screen } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import { UserProfile } from "../user-profile";

test("displays user information", async () => {
  render(<UserProfile userId="1" />); // providers already applied

  expect(await screen.findByText("John Doe")).toBeInTheDocument();
  expect(screen.getByText("john@example.com")).toBeInTheDocument();
});

test("allows editing profile", async () => {
  const user = userEvent.setup();
  render(<UserProfile userId="1" />);

  await screen.findByText("John Doe");
  await user.click(screen.getByRole("button", { name: /edit/i }));

  expect(screen.getByRole("form")).toBeInTheDocument();
});
```

---

## Per-test initial state

```typescript
// test-utils.tsx (extended)
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { AuthProvider, type AuthState } from "../contexts/auth-context";

interface ExtendedRenderOptions extends Omit<RenderOptions, "wrapper"> {
  initialAuthState?: Partial<AuthState>;
  route?: string;
}

function customRender(
  ui: ReactElement,
  { initialAuthState, route = "/", ...options }: ExtendedRenderOptions = {},
): RenderResult {
  window.history.pushState({}, "", route); // set before mounting, so the first render sees it

  function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider initialState={initialAuthState}>{children}</AuthProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

export { customRender as render };
export type { ExtendedRenderOptions };
```

```typescript
test("shows logout when authenticated", () => {
  render(<Header />, {
    initialAuthState: { user: { id: "1", name: "Test User" }, isAuthenticated: true },
    route: "/dashboard",
  });

  expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
});

test("shows login when not authenticated", () => {
  render(<Header />, {
    initialAuthState: { user: null, isAuthenticated: false },
  });

  expect(screen.getByRole("link", { name: /login/i })).toBeInTheDocument();
});
```

**Why good:** the precondition is an argument rather than three lines of setup, so the two tests differ only in the thing they are actually testing. The history push happens before `render` because a router provider reads the location during its first render and will not re-read it.

---

_Next: [hooks.md](hooks.md) for `renderHook`._
