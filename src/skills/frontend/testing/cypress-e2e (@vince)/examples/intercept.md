# Cypress cy.intercept() Patterns

> API mocking and network interception patterns. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [Pattern 3: Network Mocking](../SKILL.md#pattern-3-network-mocking-with-cyintercept) from SKILL.md first.

---

## Pattern 1: Basic Request Mocking

### Stubbing GET Requests

```typescript
const API_USERS_ENDPOINT = "/api/users";
const MOCK_USERS = [
  { id: "1", name: "John Doe", email: "john@example.com" },
  { id: "2", name: "Jane Smith", email: "jane@example.com" },
];

describe("User List", () => {
  beforeEach(() => {
    cy.intercept("GET", API_USERS_ENDPOINT, {
      statusCode: 200,
      body: MOCK_USERS,
    }).as("getUsers");
  });

  it("displays users from API", () => {
    cy.visit("/users");
    cy.wait("@getUsers");

    cy.getBySel("user-row").should("have.length", 2);
    cy.getBySel("user-row").first().should("contain", "John Doe");
  });
});
```

### Stubbing POST Requests

```typescript
const API_CREATE_USER = "/api/users";
const CREATED_USER = {
  id: "new-123",
  name: "New User",
  email: "new@example.com",
};

it("creates a new user", () => {
  cy.intercept("POST", API_CREATE_USER, {
    statusCode: 201,
    body: CREATED_USER,
  }).as("createUser");

  cy.visit("/users/new");
  cy.getBySel("name-input").type("New User");
  cy.getBySel("email-input").type("new@example.com");
  cy.getBySel("submit-button").click();

  cy.wait("@createUser").its("request.body").should("deep.include", {
    name: "New User",
    email: "new@example.com",
  });

  cy.getBySel("success-message").should("contain", "User created");
});
```

---

## Pattern 2: Error State Testing

### HTTP Error Responses

```typescript
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

describe("Error Handling", () => {
  it("shows not found message on 404", () => {
    cy.intercept("GET", "/api/users/*", {
      statusCode: HTTP_NOT_FOUND,
      body: { error: "User not found" },
    }).as("getUser");

    cy.visit("/users/nonexistent-id");
    cy.wait("@getUser");

    cy.getBySel("error-message").should("contain", "User not found");
    cy.getBySel("back-button").should("be.visible");
  });

  it("shows server error message on 500", () => {
    cy.intercept("GET", "/api/users", {
      statusCode: HTTP_SERVER_ERROR,
      body: { error: "Internal server error" },
    }).as("getUsers");

    cy.visit("/users");
    cy.wait("@getUsers");

    cy.getBySel("error-message").should("contain", "Something went wrong");
    cy.getBySel("retry-button").should("be.visible");
  });

  it("redirects to login on 401", () => {
    cy.intercept("GET", "/api/users", {
      statusCode: HTTP_UNAUTHORIZED,
      body: { error: "Unauthorized" },
    }).as("getUsers");

    cy.visit("/users");
    cy.wait("@getUsers");

    cy.url().should("include", "/login");
  });

  it("shows forbidden message on 403", () => {
    cy.intercept("GET", "/api/admin/settings", {
      statusCode: HTTP_FORBIDDEN,
      body: { error: "Forbidden" },
    }).as("getSettings");

    cy.visit("/admin/settings");
    cy.wait("@getSettings");

    cy.getBySel("error-message").should("contain", "Access denied");
  });
});
```

### Network Failures

```typescript
it("handles network failure gracefully", () => {
  cy.intercept("GET", "/api/users", { forceNetworkError: true }).as("getUsers");

  cy.visit("/users");

  cy.getBySel("error-message").should("contain", "Network error");
  cy.getBySel("retry-button").should("be.visible");
});

it("handles timeout gracefully", () => {
  cy.intercept("GET", "/api/users", {
    delay: 30000, // 30 second delay to simulate timeout
    body: [],
  }).as("getUsers");

  cy.visit("/users");

  // App should show loading state
  cy.getBySel("loading-spinner").should("be.visible");
});
```

---

## Pattern 3: Request Verification

### Verifying Request Body

```typescript
const NEW_USER_DATA = {
  name: "Test User",
  email: "test@example.com",
  role: "member",
};

it("sends correct data when creating user", () => {
  cy.intercept("POST", "/api/users", {
    statusCode: 201,
    body: { id: "123", ...NEW_USER_DATA },
  }).as("createUser");

  cy.visit("/users/new");
  cy.getBySel("name-input").type(NEW_USER_DATA.name);
  cy.getBySel("email-input").type(NEW_USER_DATA.email);
  cy.getBySel("role-select").select(NEW_USER_DATA.role);
  cy.getBySel("submit-button").click();

  cy.wait("@createUser").then((interception) => {
    expect(interception.request.body).to.deep.equal(NEW_USER_DATA);
    expect(interception.request.headers).to.have.property("content-type");
  });
});
```

### Verifying Query Parameters

```typescript
const SEARCH_TERM = "john";
const PAGE_SIZE = 20;

it("sends correct query parameters", () => {
  cy.intercept("GET", "/api/users*").as("searchUsers");

  cy.visit("/users");
  cy.getBySel("search-input").type(SEARCH_TERM);
  cy.getBySel("search-button").click();

  cy.wait("@searchUsers").then((interception) => {
    const url = new URL(interception.request.url);
    expect(url.searchParams.get("q")).to.eq(SEARCH_TERM);
    expect(url.searchParams.get("limit")).to.eq(String(PAGE_SIZE));
  });
});
```

---

## Pattern 4: Response Modification

### Intercepting and Modifying Responses

```typescript
const DISCOUNT_PERCENTAGE = 0.2;

it("applies discount to product prices", () => {
  cy.intercept("GET", "/api/products", (req) => {
    req.continue((res) => {
      // Modify each product's price
      res.body = res.body.map((product: { price: number }) => ({
        ...product,
        originalPrice: product.price,
        price: product.price * (1 - DISCOUNT_PERCENTAGE),
        hasDiscount: true,
      }));
    });
  }).as("getProducts");

  cy.visit("/products");
  cy.wait("@getProducts");

  cy.getBySel("discount-badge").should("be.visible");
  cy.getBySel("original-price").should("be.visible");
});
```

### Conditional Response Based on Request

```typescript
it("returns different users based on role filter", () => {
  cy.intercept("GET", "/api/users*", (req) => {
    const url = new URL(req.url);
    const role = url.searchParams.get("role");

    if (role === "admin") {
      req.reply({
        statusCode: 200,
        body: [{ id: "1", name: "Admin User", role: "admin" }],
      });
    } else {
      req.reply({
        statusCode: 200,
        body: [
          { id: "2", name: "Regular User 1", role: "user" },
          { id: "3", name: "Regular User 2", role: "user" },
        ],
      });
    }
  }).as("getUsers");

  // Test admin filter
  cy.visit("/users?role=admin");
  cy.wait("@getUsers");
  cy.getBySel("user-row").should("have.length", 1);

  // Test regular users
  cy.visit("/users?role=user");
  cy.wait("@getUsers");
  cy.getBySel("user-row").should("have.length", 2);
});
```

---

## Pattern 5: Using Fixtures with Intercept

### Loading Fixture Files

```typescript
// cypress/fixtures/products.json
// [
//   { "id": "1", "name": "Product A", "price": 99.99 },
//   { "id": "2", "name": "Product B", "price": 149.99 }
// ]

describe("Product List with Fixtures", () => {
  it("displays products from fixture", () => {
    cy.intercept("GET", "/api/products", { fixture: "products.json" }).as("getProducts");

    cy.visit("/products");
    cy.wait("@getProducts");

    cy.getBySel("product-card").should("have.length", 2);
    cy.getBySel("product-card").first().should("contain", "Product A");
  });

  it("uses different fixtures for scenarios", () => {
    // Empty state
    cy.intercept("GET", "/api/products", { fixture: "empty-products.json" }).as("getProducts");
    cy.visit("/products");
    cy.wait("@getProducts");
    cy.getBySel("empty-state").should("be.visible");

    // Error state
    cy.intercept("GET", "/api/products", { statusCode: 500, fixture: "error.json" }).as(
      "getProductsError"
    );
    cy.visit("/products");
    cy.wait("@getProductsError");
    cy.getBySel("error-message").should("be.visible");
  });
});
```

### Dynamic Fixture Selection

```typescript
it("uses different fixtures based on test scenario", () => {
  const scenario = "many-products"; // Could be parameterized

  cy.intercept("GET", "/api/products", { fixture: `${scenario}.json` }).as("getProducts");

  cy.visit("/products");
  cy.wait("@getProducts");
});
```

---

## Pattern 6: Delays and Throttling

### Simulating Slow Network

```typescript
const DELAY_MS = 2000;
const THROTTLE_KBPS = 1000; // Simulate 3G

it("shows loading state during slow request", () => {
  cy.intercept("GET", "/api/products", {
    delay: DELAY_MS,
    body: [{ id: "1", name: "Product" }],
  }).as("getProducts");

  cy.visit("/products");

  // Loading should appear
  cy.getBySel("loading-spinner").should("be.visible");

  cy.wait("@getProducts");

  // Loading should disappear
  cy.getBySel("loading-spinner").should("not.exist");
  cy.getBySel("product-card").should("be.visible");
});

it("simulates slow download", () => {
  cy.intercept("GET", "/api/large-file", {
    throttleKbps: THROTTLE_KBPS,
    fixture: "large-response.json",
  }).as("getLargeFile");

  cy.visit("/downloads");
  cy.getBySel("download-button").click();

  // Progress indicator should be visible during slow download
  cy.getBySel("download-progress").should("be.visible");
});
```

---

## Pattern 7: Multiple Sequential Requests

### Handling Pagination

```typescript
const PAGE_SIZE = 10;

it("loads more items on scroll", () => {
  // First page
  cy.intercept("GET", "/api/products?page=1*", {
    body: { products: Array(PAGE_SIZE).fill({ id: "1", name: "Product" }), hasMore: true },
  }).as("getPage1");

  // Second page
  cy.intercept("GET", "/api/products?page=2*", {
    body: { products: Array(PAGE_SIZE).fill({ id: "2", name: "Product" }), hasMore: false },
  }).as("getPage2");

  cy.visit("/products");
  cy.wait("@getPage1");
  cy.getBySel("product-card").should("have.length", PAGE_SIZE);

  // Scroll to bottom to trigger infinite scroll
  cy.getBySel("product-list").scrollTo("bottom");
  cy.wait("@getPage2");
  cy.getBySel("product-card").should("have.length", PAGE_SIZE * 2);
});
```

### Chained Requests

```typescript
it("handles dependent API calls", () => {
  // First request returns user
  cy.intercept("GET", "/api/user/me", {
    body: { id: "user-123", teamId: "team-456" },
  }).as("getUser");

  // Second request uses data from first
  cy.intercept("GET", "/api/teams/team-456", {
    body: { id: "team-456", name: "Engineering Team" },
  }).as("getTeam");

  cy.visit("/profile");

  cy.wait("@getUser");
  cy.wait("@getTeam");

  cy.getBySel("team-name").should("contain", "Engineering Team");
});
```

---

## Pattern 8: Request Counting and One-Time Mocks

### Asserting Request Count

```typescript
it("only fetches data once", () => {
  let requestCount = 0;

  cy.intercept("GET", "/api/users", (req) => {
    requestCount++;
    req.reply({ body: [] });
  }).as("getUsers");

  cy.visit("/users");
  cy.wait("@getUsers");

  // Navigate away and back
  cy.getBySel("home-link").click();
  cy.getBySel("users-link").click();

  // Should use cached data, not refetch
  cy.then(() => {
    expect(requestCount).to.eq(1);
  });
});
```

### One-Time Error Then Success

```typescript
it("retries after error and succeeds", () => {
  // First request fails
  cy.intercept("GET", "/api/users", { times: 1, forceNetworkError: true }).as("getUsersError");

  // Subsequent requests succeed
  cy.intercept("GET", "/api/users", { body: [{ id: "1", name: "User" }] }).as("getUsersSuccess");

  cy.visit("/users");

  cy.getBySel("error-message").should("be.visible");
  cy.getBySel("retry-button").click();

  cy.wait("@getUsersSuccess");
  cy.getBySel("user-row").should("have.length", 1);
});
```

---

_See [core.md](core.md) for foundational patterns: User Flows, Test Structure, and Selectors._
