# Cypress E2E Testing Examples

> Core code examples for Cypress E2E patterns. Reference from [SKILL.md](../SKILL.md).

**Extended examples:**
- [intercept.md](intercept.md) - API mocking with cy.intercept()
- [custom-commands.md](custom-commands.md) - Custom commands, TypeScript types
- [fixtures-data.md](fixtures-data.md) - Fixtures and test data management
- [component-testing.md](component-testing.md) - Component testing with cy.mount()
- [accessibility.md](accessibility.md) - Accessibility testing with cypress-axe
- [ci-cd.md](ci-cd.md) - GitHub Actions, Docker integration

---

## Pattern 1: Complete User Flow

### E-Commerce Checkout Flow

```typescript
// cypress/e2e/checkout/checkout-flow.cy.ts

// Test data constants
const PRODUCT_URL = "/products/wireless-headphones";
const CART_URL = "/cart";
const CHECKOUT_URL = "/checkout";
const ORDER_SUCCESS_URL = "/order/success";

const TEST_USER = {
  email: "customer@example.com",
  name: "John Doe",
  address: "123 Main St",
  city: "San Francisco",
  zip: "94102",
};

const TEST_CARD = {
  number: "4242424242424242",
  expiry: "12/28",
  cvc: "123",
};

describe("Checkout Flow", () => {
  beforeEach(() => {
    // Mock payment API for determinism
    cy.intercept("POST", "/api/payments", {
      statusCode: 200,
      body: { success: true, orderId: "order-123" },
    }).as("processPayment");
  });

  it("completes purchase with valid payment", () => {
    // Navigate to product
    cy.visit(PRODUCT_URL);

    // Add to cart
    cy.getBySel("add-to-cart-button").click();
    cy.getBySel("cart-notification").should("contain", "Added to cart");

    // Go to cart
    cy.getBySel("cart-link").click();
    cy.url().should("include", CART_URL);

    // Verify product in cart
    cy.getBySel("cart-item").should("have.length", 1);
    cy.getBySel("product-name").should("contain", "Wireless Headphones");

    // Proceed to checkout
    cy.getBySel("checkout-button").click();

    // Fill shipping information
    cy.getBySel("email-input").type(TEST_USER.email);
    cy.getBySel("name-input").type(TEST_USER.name);
    cy.getBySel("address-input").type(TEST_USER.address);
    cy.getBySel("city-input").type(TEST_USER.city);
    cy.getBySel("zip-input").type(TEST_USER.zip);

    // Fill payment information
    cy.getBySel("card-number-input").type(TEST_CARD.number);
    cy.getBySel("card-expiry-input").type(TEST_CARD.expiry);
    cy.getBySel("card-cvc-input").type(TEST_CARD.cvc);

    // Submit order
    cy.getBySel("place-order-button").click();

    // Wait for payment processing
    cy.wait("@processPayment");

    // Verify success
    cy.url().should("include", ORDER_SUCCESS_URL);
    cy.getBySel("order-confirmation").should("contain", "Order confirmed");
    cy.getBySel("order-id").should("be.visible");
  });

  it("handles payment decline gracefully", () => {
    // Override mock to simulate decline
    cy.intercept("POST", "/api/payments", {
      statusCode: 400,
      body: { success: false, error: "Card declined" },
    }).as("processPayment");

    cy.visit(CHECKOUT_URL);

    // Fill form (abbreviated)
    cy.getBySel("email-input").type(TEST_USER.email);
    cy.getBySel("card-number-input").type("4000000000000002"); // Decline test card

    cy.getBySel("place-order-button").click();
    cy.wait("@processPayment");

    // Verify error handling
    cy.getBySel("error-message").should("contain", "Payment failed");
    cy.getBySel("retry-button").should("be.visible");
    cy.url().should("include", CHECKOUT_URL); // Still on checkout
  });
});
```

**Why good:** Tests complete user journey from product to order confirmation, covers happy path and error scenarios, uses named constants for all test data, uses data-cy selectors, mocks payment API for determinism

---

## Pattern 2: Test Structure and Organization

### Grouped Tests with Context

```typescript
// cypress/e2e/auth/login-flow.cy.ts
const LOGIN_URL = "/login";
const DASHBOARD_URL = "/dashboard";

const VALID_CREDENTIALS = {
  email: "user@example.com",
  password: "SecurePassword123!",
};

const INVALID_EMAIL = "invalid-email";
const WRONG_PASSWORD = "wrongpassword";

describe("Login Flow", () => {
  beforeEach(() => {
    cy.visit(LOGIN_URL);
  });

  context("with valid credentials", () => {
    it("redirects to dashboard after successful login", () => {
      cy.getBySel("email-input").type(VALID_CREDENTIALS.email);
      cy.getBySel("password-input").type(VALID_CREDENTIALS.password);
      cy.getBySel("submit-button").click();

      cy.url().should("include", DASHBOARD_URL);
      cy.getBySel("user-greeting").should("contain", "Welcome");
    });

    it("persists session across page refreshes", () => {
      cy.getBySel("email-input").type(VALID_CREDENTIALS.email);
      cy.getBySel("password-input").type(VALID_CREDENTIALS.password);
      cy.getBySel("submit-button").click();

      cy.url().should("include", DASHBOARD_URL);
      cy.reload();
      cy.url().should("include", DASHBOARD_URL); // Still logged in
    });
  });

  context("with invalid credentials", () => {
    it("shows error for invalid email format", () => {
      cy.getBySel("email-input").type(INVALID_EMAIL);
      cy.getBySel("password-input").type(VALID_CREDENTIALS.password);
      cy.getBySel("submit-button").click();

      cy.getBySel("email-error").should("contain", "Invalid email");
    });

    it("shows error for wrong password", () => {
      cy.getBySel("email-input").type(VALID_CREDENTIALS.email);
      cy.getBySel("password-input").type(WRONG_PASSWORD);
      cy.getBySel("submit-button").click();

      cy.getBySel("error-alert").should("contain", "Invalid credentials");
    });
  });

  context("form validation", () => {
    it("shows required field errors when empty", () => {
      cy.getBySel("submit-button").click();

      cy.getBySel("email-error").should("contain", "Email is required");
      cy.getBySel("password-error").should("contain", "Password is required");
    });

    it("disables submit button while loading", () => {
      cy.intercept("POST", "/api/auth/login", {
        delay: 1000,
        statusCode: 200,
        body: { token: "abc123" },
      }).as("login");

      cy.getBySel("email-input").type(VALID_CREDENTIALS.email);
      cy.getBySel("password-input").type(VALID_CREDENTIALS.password);
      cy.getBySel("submit-button").click();

      cy.getBySel("submit-button").should("be.disabled");
      cy.getBySel("loading-spinner").should("be.visible");
    });
  });
});
```

**Why good:** Uses describe for main feature, context for scenarios, named constants for all test data, beforeEach ensures fresh state, tests are independent

---

## Pattern 3: Selector Strategy Examples

### Data-Cy Selectors

```typescript
// HTML in your application
// <button data-cy="submit-button" class="btn btn-primary">Submit</button>
// <input data-cy="email-input" type="email" />
// <div data-cy="user-card" data-cy-user-id="123">...</div>

describe("Selector Examples", () => {
  it("uses data-cy selectors correctly", () => {
    // Exact match
    cy.get("[data-cy=submit-button]").click();

    // With custom command
    cy.getBySel("email-input").type("user@example.com");

    // Partial match for multiple elements
    cy.getBySelLike("user-card").should("have.length.at.least", 1);

    // Combining with other attributes
    cy.get("[data-cy=user-card][data-cy-user-id='123']").should("exist");
  });

  it("uses cy.contains appropriately", () => {
    // Good: Text is critical to the test
    cy.contains("Welcome to Dashboard").should("be.visible");

    // Good: Button text matters
    cy.contains("button", "Sign In").click();

    // Good: Error message validation
    cy.contains(".error", "Invalid email").should("be.visible");
  });

  it("scopes selectors to regions", () => {
    // Scope to navigation
    cy.getBySel("main-navigation").within(() => {
      cy.getBySel("home-link").click();
    });

    // Scope to modal
    cy.getBySel("confirmation-modal").within(() => {
      cy.getBySel("confirm-button").click();
    });
  });
});
```

---

## Pattern 4: Assertions and Chaining

### Common Assertion Patterns

```typescript
describe("Assertion Examples", () => {
  beforeEach(() => {
    cy.visit("/products");
  });

  it("uses chained assertions", () => {
    cy.getBySel("product-card")
      .first()
      .should("be.visible")
      .and("contain", "Product Name")
      .and("have.class", "in-stock");
  });

  it("asserts element count", () => {
    cy.getBySel("product-card").should("have.length", 10);
    cy.getBySel("product-card").should("have.length.at.least", 5);
    cy.getBySel("product-card").should("have.length.lessThan", 20);
  });

  it("asserts element state", () => {
    cy.getBySel("submit-button").should("be.enabled");
    cy.getBySel("delete-button").should("be.disabled");
    cy.getBySel("modal").should("not.exist");
    cy.getBySel("dropdown").should("not.be.visible");
  });

  it("asserts input values", () => {
    cy.getBySel("email-input").should("have.value", "");
    cy.getBySel("email-input").type("test@example.com");
    cy.getBySel("email-input").should("have.value", "test@example.com");
  });

  it("asserts URL and location", () => {
    cy.url().should("include", "/products");
    cy.location("pathname").should("eq", "/products");
    cy.location("search").should("contain", "category=electronics");
  });

  it("uses negative assertions", () => {
    cy.getBySel("error-message").should("not.exist");
    cy.getBySel("loading-spinner").should("not.be.visible");
    cy.getBySel("submit-button").should("not.be.disabled");
  });
});
```

---

## Pattern 5: Using Aliases

### Storing Values with Aliases

```typescript
describe("Alias Examples", () => {
  it("stores element for later use", () => {
    cy.getBySel("user-name").as("userName");

    // Do other things...
    cy.getBySel("other-element").click();

    // Use stored reference
    cy.get("@userName").should("contain", "John Doe");
  });

  it("stores request data with aliases", () => {
    cy.intercept("GET", "/api/user").as("getUser");

    cy.visit("/profile");
    cy.wait("@getUser").then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      expect(interception.response?.body.name).to.eq("John Doe");
    });
  });

  it("uses aliased fixtures", function () {
    cy.fixture("users").as("users");

    cy.visit("/login");

    // Access via this context (requires function() not arrow function)
    cy.getBySel("email-input").type(this.users.validUser.email);
    cy.getBySel("password-input").type(this.users.validUser.password);
  });

  it("chains multiple aliases", () => {
    cy.intercept("GET", "/api/products").as("getProducts");
    cy.intercept("GET", "/api/categories").as("getCategories");

    cy.visit("/shop");

    // Wait for multiple requests
    cy.wait(["@getProducts", "@getCategories"]);

    cy.getBySel("product-list").should("be.visible");
    cy.getBySel("category-filter").should("be.visible");
  });
});
```

**Why good:** Aliases solve async value storage, enable waiting for specific requests, work with fixtures for test data

---

## Pattern 6: Session Management

### Using cy.session() for Login Caching

```typescript
const TEST_USER = {
  email: "user@example.com",
  password: "SecurePassword123!",
};

// Reusable login command with session caching
Cypress.Commands.add("loginViaSession", (email: string, password: string) => {
  cy.session(
    [email, password],
    () => {
      cy.visit("/login");
      cy.getBySel("email-input").type(email);
      cy.getBySel("password-input").type(password);
      cy.getBySel("submit-button").click();
      cy.url().should("include", "/dashboard");
    },
    {
      validate: () => {
        // Validate session is still valid
        cy.getCookie("session").should("exist");
      },
    }
  );
});

describe("Dashboard Tests", () => {
  beforeEach(() => {
    // Login is cached, not repeated every test
    cy.loginViaSession(TEST_USER.email, TEST_USER.password);
    cy.visit("/dashboard");
  });

  it("shows user dashboard", () => {
    cy.getBySel("dashboard-heading").should("be.visible");
  });

  it("displays user stats", () => {
    cy.getBySel("user-stats").should("exist");
  });
});
```

**Why good:** cy.session() caches login state, dramatically speeds up test suites, validate function ensures session is still valid

---

_Extended examples: [intercept.md](intercept.md) | [custom-commands.md](custom-commands.md) | [fixtures-data.md](fixtures-data.md) | [component-testing.md](component-testing.md) | [accessibility.md](accessibility.md) | [ci-cd.md](ci-cd.md)_
