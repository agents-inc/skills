# Cypress — Component Specs with `cy.mount()`

> Mounting a component instead of visiting a page. See [core.md](core.md) for the E2E half; the
> command API, selectors and `cy.intercept()` are identical in both.

Component specs live in `cypress/component`, are named `*.cy.tsx`, and need the `component` key in
`cypress.config.ts` naming the framework and bundler the project already uses:

```typescript
// cypress.config.ts
component: {
  devServer: { framework: "react", bundler: "vite" },
},
```

The component under test is the project's own; the examples below show only the spec side.

---

## Pattern 1: Mounting and asserting

```tsx
// cypress/component/button.cy.tsx
import { Button } from "../../src/components/button/button";

describe("Button", () => {
  it("renders its label", () => {
    cy.mount(<Button label="Click me" />);
    cy.getBySel("button").should("contain", "Click me");
  });

  it("reports clicks to the prop", () => {
    // cy.spy().as() gives the callback an alias, so it can be asserted on like any other.
    const onClick = cy.spy().as("onClick");
    cy.mount(<Button label="Click me" onClick={onClick} />);

    cy.getBySel("button").click();
    cy.get("@onClick").should("have.been.calledOnce");
  });

  it("respects the disabled prop", () => {
    cy.mount(<Button label="Click me" disabled />);
    cy.getBySel("button").should("be.disabled");
  });
});
```

**Why good:** each test mounts the component in exactly the state it is about, so a prop combination
that is hard to reach through the UI takes one line here.

---

## Pattern 2: A mount command that supplies providers

Where components expect context from the application shell, wrap it once rather than in every spec.

```tsx
// cypress/support/component.tsx
import { mount } from "cypress/react18";
import type { ReactNode } from "react";
import { ThemeProvider } from "../../src/contexts/theme-context";

interface MountOptions {
  theme?: "light" | "dark";
}

Cypress.Commands.add(
  "mount",
  (component: ReactNode, options: MountOptions = {}) =>
    mount(
      // Add the providers the app's own root renders: routing, theming, data access.
      <ThemeProvider theme={options.theme ?? "light"} toggleTheme={() => {}}>
        {component}
      </ThemeProvider>,
    ),
);

declare global {
  namespace Cypress {
    interface Chainable {
      mount(component: ReactNode, options?: MountOptions): Chainable<void>;
    }
  }
}
```

```tsx
cy.mount(<ThemeToggle />, { theme: "dark" });
cy.getBySel("theme-toggle").should("contain", "Switch to Light");
```

**Why good:** the options argument turns provider state into a test parameter, so covering both
themes is two mounts rather than two wrappers.

---

## Pattern 3: Driving a form through its states

```tsx
// cypress/component/login-form.cy.tsx
import { LoginForm } from "../../src/components/login-form/login-form";

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "SecurePassword123";

describe("LoginForm", () => {
  it("submits the collected values", () => {
    const onSubmit = cy.spy().as("onSubmit");
    cy.mount(<LoginForm onSubmit={onSubmit} />);

    cy.getBySel("email-input").type(VALID_EMAIL);
    cy.getBySel("password-input").type(VALID_PASSWORD);
    cy.getBySel("submit-button").click();

    cy.get("@onSubmit").should("have.been.calledWith", {
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });
  });

  it("reports the fields that failed validation", () => {
    cy.mount(<LoginForm onSubmit={() => {}} />);

    cy.getBySel("submit-button").click();
    cy.getBySel("email-error").should("contain", "Email is required");
    cy.getBySel("password-error").should("contain", "Password is required");
  });

  it("clears the errors once the input is valid", () => {
    cy.mount(<LoginForm onSubmit={() => {}} />);

    cy.getBySel("submit-button").click();
    cy.getBySel("email-error").should("be.visible");

    cy.getBySel("email-input").type(VALID_EMAIL);
    cy.getBySel("password-input").type(VALID_PASSWORD);
    cy.getBySel("submit-button").click();

    cy.getBySel("email-error").should("not.exist");
  });
});
```

**Why good:** the assertions describe what a user sees at each step, so they survive any refactor of
how the validation itself is implemented.

---

## Pattern 4: Stubbing requests a component makes

```tsx
// cypress/component/user-profile.cy.tsx
import { UserProfile } from "../../src/components/user-profile/user-profile";

const MOCK_USER = {
  id: "user-123",
  name: "John Doe",
  email: "john@example.com",
};

describe("UserProfile", () => {
  it("shows the loading state, then the data", () => {
    cy.intercept("GET", "/api/users/user-123", {
      statusCode: 200,
      body: MOCK_USER,
    }).as("getUser");

    cy.mount(<UserProfile userId="user-123" />);

    cy.getBySel("loading").should("be.visible");
    cy.wait("@getUser");
    cy.getBySel("user-name").should("contain", MOCK_USER.name);
  });

  it("shows the error state on a failed request", () => {
    cy.intercept("GET", "/api/users/user-123", { statusCode: 500 }).as(
      "getUser",
    );

    cy.mount(<UserProfile userId="user-123" />);

    cy.wait("@getUser");
    cy.getBySel("error").should("be.visible");
  });
});
```

**Why good:** `cy.intercept()` works the same in a component spec as in an E2E spec, so a loading
state and an error state are reachable without touching the component's internals.

---

## Pattern 5: Capturing a component's states

```tsx
it("captures the button variants", () => {
  cy.mount(
    <div style={{ display: "flex", gap: "8px", padding: "16px" }}>
      <Button label="Primary" variant="primary" />
      <Button label="Secondary" variant="secondary" />
      <Button label="Danger" variant="danger" />
    </div>,
  );

  cy.screenshot("button-variants");
});
```

**Why good:** mounting several variants side by side puts one image per component family in the
artifacts, rather than one per variant.
