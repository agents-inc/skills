# Cypress Component Testing with cy.mount()

> Component testing patterns for React components. See [core.md](core.md) for E2E patterns.

**Prerequisites**: Cypress component testing configured for your framework (React, Vue, Angular).

---

## Pattern 1: Basic Component Mounting

### Simple Component Test

```tsx
// src/components/button/button.tsx
interface ButtonProps {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}

export function Button({ label, onClick, disabled = false, variant = "primary" }: ButtonProps) {
  return (
    <button
      data-cy="button"
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

// cypress/component/button.cy.tsx
import { Button } from "../../src/components/button/button";

describe("Button Component", () => {
  it("renders with label", () => {
    cy.mount(<Button label="Click me" />);

    cy.getBySel("button").should("contain", "Click me");
  });

  it("calls onClick when clicked", () => {
    const onClickSpy = cy.spy().as("onClick");
    cy.mount(<Button label="Click me" onClick={onClickSpy} />);

    cy.getBySel("button").click();
    cy.get("@onClick").should("have.been.calledOnce");
  });

  it("is disabled when disabled prop is true", () => {
    cy.mount(<Button label="Click me" disabled />);

    cy.getBySel("button").should("be.disabled");
  });

  it("applies correct variant class", () => {
    cy.mount(<Button label="Delete" variant="danger" />);

    cy.getBySel("button").should("have.class", "btn-danger");
  });
});
```

**Why good:** Tests component in isolation, uses spies to verify callbacks, tests all prop variations

---

## Pattern 2: Testing with Context Providers

### Components with React Context

```tsx
// src/contexts/theme-context.tsx
import { createContext, useContext, type ReactNode } from "react";

interface ThemeContextValue {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export function ThemeProvider({ children, theme, toggleTheme }: ThemeContextValue & { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// src/components/theme-toggle/theme-toggle.tsx
import { useTheme } from "../../contexts/theme-context";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button data-cy="theme-toggle" onClick={toggleTheme}>
      {theme === "light" ? "Switch to Dark" : "Switch to Light"}
    </button>
  );
}

// cypress/component/theme-toggle.cy.tsx
import { ThemeToggle } from "../../src/components/theme-toggle/theme-toggle";
import { ThemeProvider } from "../../src/contexts/theme-context";

describe("ThemeToggle Component", () => {
  it("shows correct text for light theme", () => {
    const toggleSpy = cy.spy().as("toggleTheme");

    cy.mount(
      <ThemeProvider theme="light" toggleTheme={toggleSpy}>
        <ThemeToggle />
      </ThemeProvider>
    );

    cy.getBySel("theme-toggle").should("contain", "Switch to Dark");
  });

  it("shows correct text for dark theme", () => {
    cy.mount(
      <ThemeProvider theme="dark" toggleTheme={() => {}}>
        <ThemeToggle />
      </ThemeProvider>
    );

    cy.getBySel("theme-toggle").should("contain", "Switch to Light");
  });

  it("calls toggleTheme when clicked", () => {
    const toggleSpy = cy.spy().as("toggleTheme");

    cy.mount(
      <ThemeProvider theme="light" toggleTheme={toggleSpy}>
        <ThemeToggle />
      </ThemeProvider>
    );

    cy.getBySel("theme-toggle").click();
    cy.get("@toggleTheme").should("have.been.calledOnce");
  });
});
```

---

## Pattern 3: Custom Mount Command with Providers

### Reusable Mount with Global Providers

```tsx
// cypress/support/component.tsx
import { mount } from "cypress/react18";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../../src/contexts/theme-context";

interface MountOptions {
  theme?: "light" | "dark";
  routerPath?: string;
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

function TestProviders({ children, options }: { children: ReactNode; options: MountOptions }) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider theme={options.theme ?? "light"} toggleTheme={() => {}}>
          {children}
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

Cypress.Commands.add("mount", (component, options: MountOptions = {}) => {
  return mount(<TestProviders options={options}>{component}</TestProviders>);
});

// Type declaration
declare global {
  namespace Cypress {
    interface Chainable {
      mount(component: ReactNode, options?: MountOptions): Chainable<void>;
    }
  }
}

// Usage in tests
describe("Component with Providers", () => {
  it("uses dark theme", () => {
    cy.mount(<MyComponent />, { theme: "dark" });

    cy.getBySel("component").should("have.class", "dark-theme");
  });
});
```

---

## Pattern 4: Testing Form Components

### Form with Validation

```tsx
// src/components/login-form/login-form.tsx
import { useState } from "react";

interface LoginFormProps {
  onSubmit: (data: { email: string; password: string }) => void;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Invalid email";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 8) newErrors.password = "Password must be at least 8 characters";
    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length === 0) {
      onSubmit({ email, password });
    } else {
      setErrors(validationErrors);
    }
  };

  return (
    <form data-cy="login-form" onSubmit={handleSubmit}>
      <div>
        <input
          data-cy="email-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        {errors.email && <span data-cy="email-error">{errors.email}</span>}
      </div>
      <div>
        <input
          data-cy="password-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {errors.password && <span data-cy="password-error">{errors.password}</span>}
      </div>
      <button data-cy="submit-button" type="submit">
        Login
      </button>
    </form>
  );
}

// cypress/component/login-form.cy.tsx
import { LoginForm } from "../../src/components/login-form/login-form";

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "SecurePassword123";
const INVALID_EMAIL = "invalid-email";
const SHORT_PASSWORD = "short";

describe("LoginForm Component", () => {
  it("submits with valid data", () => {
    const onSubmitSpy = cy.spy().as("onSubmit");
    cy.mount(<LoginForm onSubmit={onSubmitSpy} />);

    cy.getBySel("email-input").type(VALID_EMAIL);
    cy.getBySel("password-input").type(VALID_PASSWORD);
    cy.getBySel("submit-button").click();

    cy.get("@onSubmit").should("have.been.calledWith", {
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });
  });

  it("shows email validation error", () => {
    cy.mount(<LoginForm onSubmit={() => {}} />);

    cy.getBySel("email-input").type(INVALID_EMAIL);
    cy.getBySel("password-input").type(VALID_PASSWORD);
    cy.getBySel("submit-button").click();

    cy.getBySel("email-error").should("contain", "Invalid email");
  });

  it("shows password length error", () => {
    cy.mount(<LoginForm onSubmit={() => {}} />);

    cy.getBySel("email-input").type(VALID_EMAIL);
    cy.getBySel("password-input").type(SHORT_PASSWORD);
    cy.getBySel("submit-button").click();

    cy.getBySel("password-error").should("contain", "at least 8 characters");
  });

  it("shows required field errors", () => {
    cy.mount(<LoginForm onSubmit={() => {}} />);

    cy.getBySel("submit-button").click();

    cy.getBySel("email-error").should("contain", "Email is required");
    cy.getBySel("password-error").should("contain", "Password is required");
  });

  it("clears errors on valid input", () => {
    cy.mount(<LoginForm onSubmit={() => {}} />);

    // Trigger errors
    cy.getBySel("submit-button").click();
    cy.getBySel("email-error").should("be.visible");

    // Fix errors
    cy.getBySel("email-input").type(VALID_EMAIL);
    cy.getBySel("password-input").type(VALID_PASSWORD);
    cy.getBySel("submit-button").click();

    cy.getBySel("email-error").should("not.exist");
    cy.getBySel("password-error").should("not.exist");
  });
});
```

---

## Pattern 5: Testing with API Mocking

### Component with Data Fetching

```tsx
// src/components/user-profile/user-profile.tsx
import { useEffect, useState } from "react";

interface User {
  id: string;
  name: string;
  email: string;
}

export function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch user");
        return res.json();
      })
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div data-cy="loading">Loading...</div>;
  if (error) return <div data-cy="error">{error}</div>;
  if (!user) return null;

  return (
    <div data-cy="user-profile">
      <h2 data-cy="user-name">{user.name}</h2>
      <p data-cy="user-email">{user.email}</p>
    </div>
  );
}

// cypress/component/user-profile.cy.tsx
import { UserProfile } from "../../src/components/user-profile/user-profile";

const MOCK_USER = {
  id: "user-123",
  name: "John Doe",
  email: "john@example.com",
};

describe("UserProfile Component", () => {
  it("displays user data after loading", () => {
    cy.intercept("GET", "/api/users/user-123", {
      statusCode: 200,
      body: MOCK_USER,
    }).as("getUser");

    cy.mount(<UserProfile userId="user-123" />);

    cy.getBySel("loading").should("be.visible");
    cy.wait("@getUser");
    cy.getBySel("loading").should("not.exist");
    cy.getBySel("user-name").should("contain", MOCK_USER.name);
    cy.getBySel("user-email").should("contain", MOCK_USER.email);
  });

  it("shows error on fetch failure", () => {
    cy.intercept("GET", "/api/users/user-123", {
      statusCode: 500,
      body: { error: "Server error" },
    }).as("getUser");

    cy.mount(<UserProfile userId="user-123" />);

    cy.wait("@getUser");
    cy.getBySel("error").should("contain", "Failed to fetch user");
  });
});
```

---

## Pattern 6: Testing Component Interactions

### List Component with Selection

```tsx
// src/components/product-list/product-list.tsx
import { useState } from "react";

interface Product {
  id: string;
  name: string;
  price: number;
}

interface ProductListProps {
  products: Product[];
  onSelect: (product: Product) => void;
}

export function ProductList({ products, onSelect }: ProductListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (product: Product) => {
    setSelectedId(product.id);
    onSelect(product);
  };

  return (
    <ul data-cy="product-list">
      {products.map((product) => (
        <li
          key={product.id}
          data-cy="product-item"
          data-cy-product-id={product.id}
          data-selected={selectedId === product.id}
          onClick={() => handleSelect(product)}
        >
          <span data-cy="product-name">{product.name}</span>
          <span data-cy="product-price">${product.price.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}

// cypress/component/product-list.cy.tsx
import { ProductList } from "../../src/components/product-list/product-list";

const MOCK_PRODUCTS = [
  { id: "prod-1", name: "Widget A", price: 19.99 },
  { id: "prod-2", name: "Widget B", price: 29.99 },
  { id: "prod-3", name: "Widget C", price: 39.99 },
];

describe("ProductList Component", () => {
  it("renders all products", () => {
    cy.mount(<ProductList products={MOCK_PRODUCTS} onSelect={() => {}} />);

    cy.getBySel("product-item").should("have.length", 3);
  });

  it("calls onSelect with product when clicked", () => {
    const onSelectSpy = cy.spy().as("onSelect");
    cy.mount(<ProductList products={MOCK_PRODUCTS} onSelect={onSelectSpy} />);

    cy.getBySel("product-item").first().click();

    cy.get("@onSelect").should("have.been.calledWith", MOCK_PRODUCTS[0]);
  });

  it("highlights selected product", () => {
    cy.mount(<ProductList products={MOCK_PRODUCTS} onSelect={() => {}} />);

    cy.getBySel("product-item").eq(1).click();

    cy.getBySel("product-item").eq(1).should("have.attr", "data-selected", "true");
    cy.getBySel("product-item").eq(0).should("have.attr", "data-selected", "false");
    cy.getBySel("product-item").eq(2).should("have.attr", "data-selected", "false");
  });

  it("displays product names and prices", () => {
    cy.mount(<ProductList products={MOCK_PRODUCTS} onSelect={() => {}} />);

    cy.getBySel("product-item")
      .first()
      .within(() => {
        cy.getBySel("product-name").should("contain", "Widget A");
        cy.getBySel("product-price").should("contain", "$19.99");
      });
  });
});
```

---

## Pattern 7: Visual Testing

### Screenshot Comparison

```tsx
describe("Visual Component Tests", () => {
  it("button variants match design", () => {
    cy.mount(
      <div style={{ display: "flex", gap: "8px", padding: "16px" }}>
        <Button label="Primary" variant="primary" />
        <Button label="Secondary" variant="secondary" />
        <Button label="Danger" variant="danger" />
      </div>
    );

    cy.screenshot("button-variants");
  });

  it("form states match design", () => {
    cy.mount(<LoginForm onSubmit={() => {}} />);

    // Default state
    cy.screenshot("login-form-default");

    // Error state
    cy.getBySel("submit-button").click();
    cy.screenshot("login-form-errors");

    // Filled state
    cy.getBySel("email-input").type("user@example.com");
    cy.getBySel("password-input").type("password123");
    cy.screenshot("login-form-filled");
  });
});
```

---

_See [core.md](core.md) for E2E patterns and [accessibility.md](accessibility.md) for accessibility testing._
