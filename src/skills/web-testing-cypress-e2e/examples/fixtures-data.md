# Cypress — Fixtures and Test Data

> Fixture files, factories and shared constants. See [core.md](core.md) for the foundations and
> [intercept.md](intercept.md) for stubbing in depth.

A **fixture** is a static JSON file under `cypress/fixtures`, best for data several specs share. A
**factory** is a function that builds data in the spec, best for a scenario that needs a particular
shape or a unique value.

---

## Pattern 1: Loading a fixture

```json
// cypress/fixtures/users.json
{
  "validUser": {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  },
  "adminUser": {
    "email": "admin@example.com",
    "password": "AdminPassword123!"
  },
  "invalidUser": { "email": "invalid-email", "password": "short" }
}
```

```typescript
// Aliased onto the test context — needs function(), because an arrow does not bind `this`.
describe("Login", function () {
  beforeEach(function () {
    cy.fixture("users").as("users");
  });

  it("signs in a valid user", function () {
    cy.visit("/login");
    cy.getBySel("email-input").type(this.users.validUser.email);
    cy.getBySel("password-input").type(this.users.validUser.password);
    cy.getBySel("submit-button").click();

    cy.url().should("include", "/dashboard");
  });
});

// Or without the test context, which keeps arrow functions available.
it("signs in a valid user", () => {
  cy.fixture("users").then((users) => {
    cy.visit("/login");
    cy.getBySel("email-input").type(users.validUser.email);
  });
});
```

---

## Pattern 2: Serving a fixture from an intercept

```typescript
describe("Product list states", () => {
  it("renders the products", () => {
    cy.intercept("GET", "/api/products", {
      fixture: "products/products-list.json",
    }).as("get");

    cy.visit("/products");
    cy.wait("@get");
    cy.getBySel("product-card").should("have.length", 2);
  });

  it("shows the empty state", () => {
    cy.intercept("GET", "/api/products", {
      fixture: "products/products-empty.json",
    }).as("get");

    cy.visit("/products");
    cy.wait("@get");
    cy.getBySel("empty-state").should("contain", "No products found");
  });

  it("shows the error state", () => {
    // A fixture supplies the body; the status is still set explicitly.
    cy.intercept("GET", "/api/products", {
      statusCode: 500,
      fixture: "errors/500.json",
    }).as("get");

    cy.visit("/products");
    cy.wait("@get");
    cy.getBySel("error-message").should("be.visible");
  });
});
```

**Why good:** one file per state keeps each spec to two lines of setup, and the states are named in
the filesystem where the next person can find them.

**Suggested layout:**

```
cypress/fixtures/
├── auth/       valid-login.json, expired-token.json
├── users/      admin-user.json, users-list.json
├── products/   products-list.json, products-empty.json
└── errors/     404.json, 500.json, validation-error.json
```

---

## Pattern 3: Factories for scenario-specific data

```typescript
// cypress/support/factories/user-factory.ts
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
  createdAt: string;
}

let counter = 0;

export function createUser(overrides: Partial<User> = {}): User {
  counter += 1;
  return {
    id: `user-${counter}`,
    name: `Test User ${counter}`,
    email: `user${counter}@example.com`,
    role: "user",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createUsers(
  count: number,
  overrides: Partial<User> = {},
): User[] {
  return Array.from({ length: count }, () => createUser(overrides));
}
```

```typescript
import { createUser, createUsers } from "../support/factories/user-factory";

it("shows the admin badge", () => {
  // The override states exactly what this test is about; everything else is filled in.
  cy.intercept("GET", "/api/users/me", {
    body: createUser({ role: "admin", name: "Admin Jane" }),
  }).as("getCurrentUser");

  cy.visit("/profile");
  cy.wait("@getCurrentUser");
  cy.getBySel("admin-badge").should("be.visible");
});

it("paginates once there are enough rows", () => {
  cy.intercept("GET", "/api/users", { body: createUsers(50) }).as("getUsers");

  cy.visit("/users");
  cy.wait("@getUsers");
  cy.getBySel("pagination").should("be.visible");
});
```

**Why good:** the counter makes every generated record unique, so a test can run twice against a
real backend without a collision, and an override reads as the one fact the test depends on.

**Why a fixture is worse here:** a 50-record JSON file has to be maintained by hand and re-read by
anyone auditing the test.

---

## Pattern 4: Shared constants

```typescript
// cypress/support/constants/test-data.ts
export const TEST_USERS = {
  valid: { email: "user@example.com", password: "SecurePassword123!" },
  admin: { email: "admin@example.com", password: "AdminPassword123!" },
} as const;

export const URLS = {
  login: "/login",
  dashboard: "/dashboard",
  products: "/products",
} as const;

export const API = {
  users: "/api/users",
  products: "/api/products",
  auth: "/api/auth",
} as const;
```

**Why good:** `as const` makes each value a literal type, so a typo in a spec is a compile error
rather than a selector that silently matches nothing.

---

## Pattern 5: Reshaping a fixture at runtime

```typescript
it("shows a discount badge", () => {
  cy.fixture("products").then((products) => {
    const discounted = products.map((product: { price: number }) => ({
      ...product,
      price: product.price * 0.8,
      hasDiscount: true,
    }));

    cy.intercept("GET", "/api/products", { body: discounted }).as(
      "getProducts",
    );

    cy.visit("/products");
    cy.wait("@getProducts");
    cy.getBySel("discount-badge").should("be.visible");
  });
});
```

**Why good:** one fixture serves several scenarios, so a field added to the product shape is added
once. Note the intercept has to be registered inside the `.then()`, because everything outside it is
queued to run before the fixture resolves.
