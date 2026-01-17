# Cypress Fixtures and Test Data Management

> Fixtures, test data patterns, and data factories. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand cy.fixture() and cy.intercept() basics.

---

## Pattern 1: Basic Fixture Usage

### Loading Fixtures

```typescript
// cypress/fixtures/users.json
{
  "validUser": {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  },
  "adminUser": {
    "email": "admin@example.com",
    "password": "AdminPassword123!",
    "role": "admin"
  },
  "invalidUser": {
    "email": "invalid-email",
    "password": "short"
  }
}

// In test file - using this context
describe("Login with Fixtures", function () {
  beforeEach(function () {
    cy.fixture("users").as("users");
  });

  it("logs in with valid credentials", function () {
    cy.visit("/login");
    cy.getBySel("email-input").type(this.users.validUser.email);
    cy.getBySel("password-input").type(this.users.validUser.password);
    cy.getBySel("submit-button").click();

    cy.url().should("include", "/dashboard");
  });

  it("shows error for invalid email", function () {
    cy.visit("/login");
    cy.getBySel("email-input").type(this.users.invalidUser.email);
    cy.getBySel("password-input").type(this.users.invalidUser.password);
    cy.getBySel("submit-button").click();

    cy.getBySel("error-message").should("contain", "Invalid email");
  });
});
```

**Note:** Must use `function()` not arrow functions to access `this` context.

### Using cy.fixture().then()

```typescript
// Alternative without this context (works with arrow functions)
describe("Login with Fixtures", () => {
  it("logs in with valid credentials", () => {
    cy.fixture("users").then((users) => {
      cy.visit("/login");
      cy.getBySel("email-input").type(users.validUser.email);
      cy.getBySel("password-input").type(users.validUser.password);
      cy.getBySel("submit-button").click();

      cy.url().should("include", "/dashboard");
    });
  });
});
```

---

## Pattern 2: Fixtures with cy.intercept()

### Mocking API Responses with Fixtures

```typescript
// cypress/fixtures/products.json
[
  {
    "id": "prod-1",
    "name": "Wireless Headphones",
    "price": 99.99,
    "inStock": true
  },
  {
    "id": "prod-2",
    "name": "Bluetooth Speaker",
    "price": 149.99,
    "inStock": false
  }
]

// In test file
describe("Product List", () => {
  it("displays products from fixture", () => {
    cy.intercept("GET", "/api/products", { fixture: "products.json" }).as("getProducts");

    cy.visit("/products");
    cy.wait("@getProducts");

    cy.getBySel("product-card").should("have.length", 2);
    cy.getBySel("product-card").first().should("contain", "Wireless Headphones");
    cy.getBySel("product-card").first().should("contain", "$99.99");
  });
});
```

### Multiple Fixture Files for Scenarios

```typescript
// cypress/fixtures/products-empty.json
[]

// cypress/fixtures/products-many.json
// Array with 50+ products

describe("Product List States", () => {
  it("shows empty state", () => {
    cy.intercept("GET", "/api/products", { fixture: "products-empty.json" }).as("getProducts");

    cy.visit("/products");
    cy.wait("@getProducts");

    cy.getBySel("empty-state").should("be.visible");
    cy.getBySel("empty-state").should("contain", "No products found");
  });

  it("shows pagination for many products", () => {
    cy.intercept("GET", "/api/products", { fixture: "products-many.json" }).as("getProducts");

    cy.visit("/products");
    cy.wait("@getProducts");

    cy.getBySel("pagination").should("be.visible");
    cy.getBySel("next-page-button").should("be.enabled");
  });
});
```

---

## Pattern 3: Organized Fixture Structure

### Directory Structure

```
cypress/
└── fixtures/
    ├── auth/
    │   ├── valid-login.json
    │   ├── invalid-login.json
    │   └── expired-token.json
    ├── users/
    │   ├── admin-user.json
    │   ├── regular-user.json
    │   └── users-list.json
    ├── products/
    │   ├── single-product.json
    │   ├── products-list.json
    │   └── products-empty.json
    └── errors/
        ├── 404.json
        ├── 500.json
        └── validation-error.json
```

### Loading Nested Fixtures

```typescript
describe("Nested Fixtures", () => {
  it("loads nested fixture files", () => {
    cy.intercept("GET", "/api/users", { fixture: "users/users-list.json" }).as("getUsers");
    cy.intercept("GET", "/api/products", { fixture: "products/products-list.json" }).as(
      "getProducts"
    );

    cy.visit("/dashboard");
    cy.wait(["@getUsers", "@getProducts"]);
  });

  it("uses error fixtures", () => {
    cy.intercept("GET", "/api/users", {
      statusCode: 500,
      fixture: "errors/500.json",
    }).as("getUsers");

    cy.visit("/users");
    cy.wait("@getUsers");

    cy.getBySel("error-message").should("be.visible");
  });
});
```

---

## Pattern 4: Dynamic Test Data with Factories

### Factory Pattern (Alternative to Static Fixtures)

```typescript
// cypress/support/factories/user-factory.ts
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
  createdAt: string;
}

let userCounter = 0;

export function createUser(overrides: Partial<User> = {}): User {
  userCounter++;
  return {
    id: `user-${userCounter}`,
    name: `Test User ${userCounter}`,
    email: `user${userCounter}@example.com`,
    role: "user",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createAdminUser(overrides: Partial<User> = {}): User {
  return createUser({ role: "admin", ...overrides });
}

export function createUsers(count: number, overrides: Partial<User> = {}): User[] {
  return Array.from({ length: count }, () => createUser(overrides));
}

// In test file
import { createUser, createUsers, createAdminUser } from "../support/factories/user-factory";

describe("User Management", () => {
  it("displays user list", () => {
    const users = createUsers(5);

    cy.intercept("GET", "/api/users", { body: users }).as("getUsers");

    cy.visit("/users");
    cy.wait("@getUsers");

    cy.getBySel("user-row").should("have.length", 5);
  });

  it("shows admin badge for admin users", () => {
    const adminUser = createAdminUser({ name: "Admin Jane" });

    cy.intercept("GET", "/api/users/me", { body: adminUser }).as("getCurrentUser");

    cy.visit("/profile");
    cy.wait("@getCurrentUser");

    cy.getBySel("admin-badge").should("be.visible");
    cy.getBySel("user-name").should("contain", "Admin Jane");
  });
});
```

### Product Factory

```typescript
// cypress/support/factories/product-factory.ts
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
  quantity: number;
}

let productCounter = 0;

const PRODUCT_CATEGORIES = ["Electronics", "Clothing", "Home", "Sports"];
const PRODUCT_NAMES = ["Widget", "Gadget", "Device", "Tool", "Item"];

export function createProduct(overrides: Partial<Product> = {}): Product {
  productCounter++;
  return {
    id: `prod-${productCounter}`,
    name: `${PRODUCT_NAMES[productCounter % PRODUCT_NAMES.length]} ${productCounter}`,
    price: Math.round(Math.random() * 10000) / 100, // 0.01 - 100.00
    category: PRODUCT_CATEGORIES[productCounter % PRODUCT_CATEGORIES.length],
    inStock: true,
    quantity: Math.floor(Math.random() * 100) + 1,
    ...overrides,
  };
}

export function createOutOfStockProduct(overrides: Partial<Product> = {}): Product {
  return createProduct({ inStock: false, quantity: 0, ...overrides });
}

export function createProducts(count: number, overrides: Partial<Product> = {}): Product[] {
  return Array.from({ length: count }, () => createProduct(overrides));
}

// Usage
describe("Product Inventory", () => {
  it("shows out of stock indicator", () => {
    const outOfStockProduct = createOutOfStockProduct({ name: "Sold Out Item" });

    cy.intercept("GET", "/api/products/*", { body: outOfStockProduct }).as("getProduct");

    cy.visit("/products/prod-1");
    cy.wait("@getProduct");

    cy.getBySel("out-of-stock-badge").should("be.visible");
    cy.getBySel("add-to-cart-button").should("be.disabled");
  });
});
```

---

## Pattern 5: Combining Fixtures and Factories

### Hybrid Approach

```typescript
// cypress/fixtures/base-user.json
{
  "email": "base@example.com",
  "password": "SecurePassword123!",
  "preferences": {
    "theme": "dark",
    "notifications": true,
    "language": "en"
  }
}

// cypress/support/factories/user-factory.ts
import baseUser from "../../fixtures/base-user.json";

export function createUserWithPreferences(overrides: Partial<typeof baseUser> = {}) {
  return {
    ...baseUser,
    ...overrides,
    preferences: {
      ...baseUser.preferences,
      ...overrides.preferences,
    },
  };
}

// In test file
describe("User Preferences", () => {
  it("uses dark theme when preference is set", () => {
    const darkThemeUser = createUserWithPreferences({
      preferences: { theme: "dark" },
    });

    cy.intercept("GET", "/api/user/preferences", { body: darkThemeUser.preferences }).as(
      "getPreferences"
    );

    cy.visit("/settings");
    cy.wait("@getPreferences");

    cy.get("body").should("have.class", "dark-theme");
  });
});
```

---

## Pattern 6: Test Data Constants

### Centralized Test Constants

```typescript
// cypress/support/constants/test-data.ts

// User credentials
export const TEST_USERS = {
  valid: {
    email: "user@example.com",
    password: "SecurePassword123!",
  },
  admin: {
    email: "admin@example.com",
    password: "AdminPassword123!",
  },
  invalid: {
    email: "invalid-email",
    password: "short",
  },
} as const;

// URL constants
export const URLS = {
  login: "/login",
  dashboard: "/dashboard",
  products: "/products",
  checkout: "/checkout",
} as const;

// API endpoints
export const API_ENDPOINTS = {
  users: "/api/users",
  products: "/api/products",
  auth: "/api/auth",
  orders: "/api/orders",
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const;

// Timeouts
export const TIMEOUTS = {
  short: 2000,
  medium: 5000,
  long: 10000,
} as const;

// Usage in tests
import { TEST_USERS, URLS, API_ENDPOINTS, HTTP_STATUS } from "../support/constants/test-data";

describe("Login Flow", () => {
  it("authenticates valid user", () => {
    cy.intercept("POST", API_ENDPOINTS.auth, {
      statusCode: HTTP_STATUS.OK,
      body: { token: "abc123" },
    }).as("login");

    cy.visit(URLS.login);
    cy.getBySel("email-input").type(TEST_USERS.valid.email);
    cy.getBySel("password-input").type(TEST_USERS.valid.password);
    cy.getBySel("submit-button").click();

    cy.wait("@login");
    cy.url().should("include", URLS.dashboard);
  });
});
```

---

## Pattern 7: Fixture Modification at Runtime

### Modifying Fixtures Dynamically

```typescript
describe("Dynamic Fixture Modification", () => {
  it("modifies fixture data at runtime", () => {
    cy.fixture("products").then((products) => {
      // Modify fixture data
      const discountedProducts = products.map((product: { price: number }) => ({
        ...product,
        price: product.price * 0.8, // 20% discount
        hasDiscount: true,
      }));

      cy.intercept("GET", "/api/products", { body: discountedProducts }).as("getProducts");

      cy.visit("/products");
      cy.wait("@getProducts");

      cy.getBySel("discount-badge").should("be.visible");
    });
  });

  it("filters fixture data", () => {
    cy.fixture("products").then((products) => {
      // Only return in-stock products
      const inStockProducts = products.filter((p: { inStock: boolean }) => p.inStock);

      cy.intercept("GET", "/api/products?inStock=true", { body: inStockProducts }).as(
        "getInStockProducts"
      );

      cy.visit("/products?inStock=true");
      cy.wait("@getInStockProducts");

      cy.getBySel("out-of-stock-badge").should("not.exist");
    });
  });
});
```

---

## Pattern 8: Fixture Validation

### Type-Safe Fixtures with Zod

```typescript
// cypress/support/schemas/user-schema.ts
import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "user", "guest"]),
});

export type User = z.infer<typeof userSchema>;

// cypress/support/fixtures/load-validated-fixture.ts
import { userSchema } from "../schemas/user-schema";

export function loadValidatedUserFixture(fixturePath: string) {
  return cy.fixture(fixturePath).then((data) => {
    const result = userSchema.safeParse(data);
    if (!result.success) {
      throw new Error(`Invalid fixture at ${fixturePath}: ${result.error.message}`);
    }
    return result.data;
  });
}

// Usage
describe("Validated Fixtures", () => {
  it("uses type-safe fixture loading", () => {
    loadValidatedUserFixture("users/admin-user").then((user) => {
      // TypeScript knows user is User type
      cy.intercept("GET", "/api/user/me", { body: user }).as("getCurrentUser");

      cy.visit("/profile");
      cy.wait("@getCurrentUser");

      cy.getBySel("user-email").should("contain", user.email);
    });
  });
});
```

---

_See [core.md](core.md) for foundational patterns and [intercept.md](intercept.md) for API mocking details._
