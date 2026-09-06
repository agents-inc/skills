# Cypress — `cy.intercept()` Patterns

> Network stubbing, verification and sequencing. See [core.md](core.md) for the foundations and
> [fixtures-data.md](fixtures-data.md) for serving a stub from a fixture file.

---

## Pattern 1: Stubbing a response

```typescript
const MOCK_USERS = [
  { id: "1", name: "John Doe", email: "john@example.com" },
  { id: "2", name: "Jane Smith", email: "jane@example.com" },
];

describe("User List", () => {
  beforeEach(() => {
    cy.intercept("GET", "/api/users", { statusCode: 200, body: MOCK_USERS }).as(
      "getUsers",
    );
  });

  it("renders the users the API returned", () => {
    cy.visit("/users");
    cy.wait("@getUsers");

    cy.getBySel("user-row").should("have.length", 2);
    cy.getBySel("user-row").first().should("contain", "John Doe");
  });
});
```

```typescript
it("sends the form values and reports success", () => {
  cy.intercept("POST", "/api/users", {
    statusCode: 201,
    body: { id: "new-123", name: "New User" },
  }).as("createUser");

  cy.visit("/users/new");
  cy.getBySel("name-input").type("New User");
  cy.getBySel("submit-button").click();

  // The alias carries the request too, so the payload is assertable.
  cy.wait("@createUser")
    .its("request.body")
    .should("deep.include", { name: "New User" });
  cy.getBySel("success-message").should("contain", "User created");
});
```

**Why good:** `beforeEach` establishes the default and each test overrides only what it is about.
Waiting on the alias rather than a duration means the test is as fast as the stub and never racy.

---

## Pattern 2: Error and failure states

```typescript
const HTTP = { NOT_FOUND: 404, UNAUTHORIZED: 401, SERVER_ERROR: 500 } as const;

describe("Error handling", () => {
  it("shows a not-found message", () => {
    cy.intercept("GET", "/api/users/*", {
      statusCode: HTTP.NOT_FOUND,
      body: { error: "User not found" },
    }).as("getUser");

    cy.visit("/users/nonexistent-id");
    cy.wait("@getUser");
    cy.getBySel("error-message").should("contain", "User not found");
  });

  it("redirects to login on 401", () => {
    cy.intercept("GET", "/api/users", { statusCode: HTTP.UNAUTHORIZED }).as(
      "getUsers",
    );

    cy.visit("/users");
    cy.wait("@getUsers");
    cy.url().should("include", "/login");
  });

  it("offers a retry on 500", () => {
    cy.intercept("GET", "/api/users", { statusCode: HTTP.SERVER_ERROR }).as(
      "getUsers",
    );

    cy.visit("/users");
    cy.wait("@getUsers");
    cy.getBySel("retry-button").should("be.visible");
  });

  it("handles the request failing outright", () => {
    // No response at all, as opposed to an error response.
    cy.intercept("GET", "/api/users", { forceNetworkError: true }).as(
      "getUsers",
    );

    cy.visit("/users");
    cy.getBySel("error-message").should("contain", "Network error");
  });
});
```

**Why good:** these are the paths a real backend cannot be asked to produce on demand, which is the
whole reason to stub. `forceNetworkError` covers the case that has no status code at all.

---

## Pattern 3: Verifying what was sent

```typescript
it("sends the values the form collected", () => {
  cy.intercept("POST", "/api/users").as("createUser"); // no stub — observe only

  cy.visit("/users/new");
  cy.getBySel("name-input").type("Test User");
  cy.getBySel("role-select").select("member");
  cy.getBySel("submit-button").click();

  cy.wait("@createUser").then(({ request }) => {
    expect(request.body).to.deep.equal({ name: "Test User", role: "member" });
    expect(request.headers).to.have.property("content-type");
  });
});

it("sends the search term and page size as query parameters", () => {
  cy.intercept("GET", "/api/users*").as("searchUsers");

  cy.visit("/users");
  cy.getBySel("search-input").type("john");
  cy.getBySel("search-button").click();

  cy.wait("@searchUsers").then(({ request }) => {
    const url = new URL(request.url);
    expect(url.searchParams.get("q")).to.eq("john");
    expect(url.searchParams.get("limit")).to.eq("20");
  });
});
```

**Why good:** an intercept with no response body observes without changing behaviour, so the test
covers the contract the UI sends while the real API still answers.

---

## Pattern 4: Modifying a real response

```typescript
const DISCOUNT = 0.2;

it("shows a discount badge on every product", () => {
  cy.intercept("GET", "/api/products", (req) => {
    req.continue((res) => {
      res.body = res.body.map((product: { price: number }) => ({
        ...product,
        originalPrice: product.price,
        price: product.price * (1 - DISCOUNT),
        hasDiscount: true,
      }));
    });
  }).as("getProducts");

  cy.visit("/products");
  cy.wait("@getProducts");
  cy.getBySel("discount-badge").should("be.visible");
});

it("answers differently depending on the request", () => {
  cy.intercept("GET", "/api/users*", (req) => {
    const role = new URL(req.url).searchParams.get("role");
    req.reply({
      statusCode: 200,
      body: role === "admin" ? ADMIN_USERS : REGULAR_USERS,
    });
  }).as("getUsers");

  cy.visit("/users?role=admin");
  cy.wait("@getUsers");
  cy.getBySel("user-row").should("have.length", ADMIN_USERS.length);
});
```

**Why good:** `req.continue()` keeps everything the real API returns and rewrites only the field
under test, so the stub cannot drift out of shape. `req.reply()` inside the handler is what makes a
single route serve several scenarios.

---

## Pattern 5: Delay and throttling

```typescript
it("shows the loading state while the request is slow", () => {
  cy.intercept("GET", "/api/products", {
    delay: 2000,
    body: [{ id: "1", name: "Product" }],
  }).as("getProducts");

  cy.visit("/products");
  cy.getBySel("loading-spinner").should("be.visible");

  cy.wait("@getProducts");
  cy.getBySel("loading-spinner").should("not.exist");
});

it("shows download progress on a slow connection", () => {
  cy.intercept("GET", "/api/large-file", {
    throttleKbps: 1000,
    fixture: "large-response.json",
  }).as("getLargeFile");

  cy.visit("/downloads");
  cy.getBySel("download-button").click();
  cy.getBySel("download-progress").should("be.visible");
});
```

**Why good:** a loading state is otherwise unobservable — the stub answers too fast to see it. Note
the option is `delay`; `delayMs` was removed in Cypress 14.

---

## Pattern 6: Sequencing several requests

```typescript
const PAGE_SIZE = 10;

it("loads the next page on scroll", () => {
  cy.intercept("GET", "/api/products?page=1*", {
    body: {
      products: Array(PAGE_SIZE).fill({ id: "1", name: "Product" }),
      hasMore: true,
    },
  }).as("getPage1");

  cy.intercept("GET", "/api/products?page=2*", {
    body: {
      products: Array(PAGE_SIZE).fill({ id: "2", name: "Product" }),
      hasMore: false,
    },
  }).as("getPage2");

  cy.visit("/products");
  cy.wait("@getPage1");
  cy.getBySel("product-card").should("have.length", PAGE_SIZE);

  cy.getBySel("product-list").scrollTo("bottom");
  cy.wait("@getPage2");
  cy.getBySel("product-card").should("have.length", PAGE_SIZE * 2);
});
```

**Why good:** separate aliases per page make the assertion after each wait unambiguous about which
response it is describing.

---

## Pattern 7: One-time stubs and call counts

```typescript
it("recovers when a retry succeeds", () => {
  // times: 1 applies this stub to the first matching request only.
  cy.intercept("GET", "/api/users", { times: 1, forceNetworkError: true }).as(
    "firstAttempt",
  );
  cy.intercept("GET", "/api/users", { body: [{ id: "1", name: "User" }] }).as(
    "retry",
  );

  cy.visit("/users");
  cy.getBySel("error-message").should("be.visible");
  cy.getBySel("retry-button").click();

  cy.wait("@retry");
  cy.getBySel("user-row").should("have.length", 1);
});

it("fetches once and serves the rest from cache", () => {
  let requestCount = 0;

  cy.intercept("GET", "/api/users", (req) => {
    requestCount += 1;
    req.reply({ body: [] });
  }).as("getUsers");

  cy.visit("/users");
  cy.wait("@getUsers");

  cy.getBySel("home-link").click();
  cy.getBySel("users-link").click();

  // Inside cy.then, so the check runs after the queued commands rather than before them.
  cy.then(() => expect(requestCount).to.eq(1));
});
```

**Why good:** `times` expresses "fail once, then work" without a stateful handler, and the counter
assertion sits inside `cy.then()` because everything above it is queued rather than executed.
