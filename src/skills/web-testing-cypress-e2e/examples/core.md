# Cypress E2E Testing — Core Examples

> Full code for the core patterns. Referenced from [SKILL.md](../SKILL.md).

**Extended examples:**

- [intercept.md](intercept.md) — network stubbing in depth
- [custom-commands.md](custom-commands.md) — commands, types, tasks, `cy.origin()`
- [fixtures-data.md](fixtures-data.md) — fixtures, factories, shared constants
- [component-testing.md](component-testing.md) — `cy.mount()`
- [accessibility.md](accessibility.md) — auditing a page inside a run
- [ci.md](ci.md) — CI configuration decisions

---

## Pattern 1: Complete user flow

```typescript
// cypress/e2e/checkout/checkout-flow.cy.ts
const TEST_USER = {
  email: "customer@example.com",
  name: "John Doe",
  address: "123 Main St",
  city: "San Francisco",
  zip: "94102",
};
// Sandbox card numbers the payment provider always accepts / always declines.
const CARD_ACCEPTED = "4242424242424242";
const CARD_DECLINED = "4000000000000002";

function fillCheckout(cardNumber: string) {
  cy.getBySel("email-input").type(TEST_USER.email);
  cy.getBySel("name-input").type(TEST_USER.name);
  cy.getBySel("address-input").type(TEST_USER.address);
  cy.getBySel("city-input").type(TEST_USER.city);
  cy.getBySel("zip-input").type(TEST_USER.zip);
  cy.getBySel("card-number-input").type(cardNumber);
}

describe("Checkout Flow", () => {
  beforeEach(() => {
    // Default: payment succeeds. Individual tests override.
    cy.intercept("POST", "/api/payments", {
      statusCode: 200,
      body: { success: true, orderId: "order-123" },
    }).as("processPayment");
  });

  it("completes a purchase with an accepted card", () => {
    cy.visit("/products/wireless-headphones");

    cy.getBySel("add-to-cart-button").click();
    cy.getBySel("cart-notification").should("contain", "Added to cart");

    cy.getBySel("cart-link").click();
    cy.getBySel("cart-item").should("have.length", 1);
    cy.getBySel("checkout-button").click();

    fillCheckout(CARD_ACCEPTED);
    cy.getBySel("place-order-button").click();
    cy.wait("@processPayment");

    cy.url().should("include", "/order/success");
    cy.getBySel("order-confirmation").should("contain", "Order confirmed");
  });

  it("keeps the user on checkout when the card is declined", () => {
    cy.intercept("POST", "/api/payments", {
      statusCode: 400,
      body: { success: false, error: "Card declined" },
    }).as("processPayment");

    cy.visit("/checkout");
    fillCheckout(CARD_DECLINED);
    cy.getBySel("place-order-button").click();
    cy.wait("@processPayment");

    cy.getBySel("error-message").should("contain", "Payment failed");
    cy.url().should("include", "/checkout");
  });
});
```

**Why good:** the journey is covered end to end in both outcomes, the payment call is stubbed so the
result is deterministic, and the repeated form filling is a function — a new field is a one-line
change.

---

## Pattern 2: Grouping with `context`

```typescript
// cypress/e2e/auth/login-flow.cy.ts
const VALID = { email: "user@example.com", password: "SecurePassword123!" };

describe("Login Flow", () => {
  beforeEach(() => {
    cy.visit("/login");
  });

  context("with valid credentials", () => {
    it("redirects to the dashboard", () => {
      cy.getBySel("email-input").type(VALID.email);
      cy.getBySel("password-input").type(VALID.password);
      cy.getBySel("submit-button").click();

      cy.url().should("include", "/dashboard");
      cy.getBySel("user-greeting").should("contain", "Welcome");
    });

    it("survives a reload", () => {
      cy.getBySel("email-input").type(VALID.email);
      cy.getBySel("password-input").type(VALID.password);
      cy.getBySel("submit-button").click();

      cy.url().should("include", "/dashboard");
      cy.reload();
      cy.url().should("include", "/dashboard");
    });
  });

  context("with invalid credentials", () => {
    it("reports a wrong password", () => {
      cy.getBySel("email-input").type(VALID.email);
      cy.getBySel("password-input").type("wrongpassword");
      cy.getBySel("submit-button").click();

      cy.getBySel("error-alert").should("contain", "Invalid credentials");
    });
  });

  context("form validation", () => {
    it("reports required fields", () => {
      cy.getBySel("submit-button").click();

      cy.getBySel("email-error").should("contain", "Email is required");
      cy.getBySel("password-error").should("contain", "Password is required");
    });

    it("disables submit while the request is in flight", () => {
      cy.intercept("POST", "/api/auth/login", {
        delay: 1000,
        statusCode: 200,
        body: { token: "abc123" },
      }).as("login");

      cy.getBySel("email-input").type(VALID.email);
      cy.getBySel("password-input").type(VALID.password);
      cy.getBySel("submit-button").click();

      cy.getBySel("submit-button").should("be.disabled");
      cy.getBySel("loading-spinner").should("be.visible");
    });
  });
});
```

**Why good:** `context` names the precondition, so a failure reads as "invalid credentials → wrong
password" without opening the file. The `delay` option is what makes the in-flight state observable
at all.

---

## Pattern 3: Selectors

```typescript
// Markup under test:
// <button data-cy="submit-button" class="btn btn-primary">Submit</button>
// <div data-cy="user-card" data-cy-user-id="123">…</div>

cy.get("[data-cy=submit-button]").click();
cy.getBySel("email-input").type("user@example.com"); // custom command
cy.getBySelLike("user-card").should("have.length.at.least", 1); // partial match
cy.get("[data-cy=user-card][data-cy-user-id='123']").should("exist");

// Text as the subject: a copy change should fail this deliberately.
cy.contains("button", "Sign In").click();

// Scope to a region so a duplicate elsewhere on the page cannot match.
cy.getBySel("main-navigation").within(() => {
  cy.getBySel("home-link").click();
});
```

---

## Pattern 4: Assertions

```typescript
// Chained: one query, several conditions, all retried together.
cy.getBySel("product-card")
  .first()
  .should("be.visible")
  .and("contain", "Product Name")
  .and("have.class", "in-stock");

// Counts, states and values
cy.getBySel("product-card").should("have.length", 10);
cy.getBySel("submit-button").should("be.enabled");
cy.getBySel("email-input").should("have.value", "test@example.com");

// not.exist (removed from the DOM) is a stronger claim than not.be.visible (still there).
cy.getBySel("modal").should("not.exist");
cy.getBySel("dropdown").should("not.be.visible");

// Location
cy.url().should("include", "/products");
cy.location("pathname").should("eq", "/products");
```

---

## Pattern 5: Aliases

```typescript
describe("Aliases", () => {
  it("stores an element for later", () => {
    cy.getBySel("user-name").as("userName");
    cy.getBySel("other-element").click();
    cy.get("@userName").should("contain", "John Doe");
  });

  it("inspects the request an alias captured", () => {
    cy.intercept("GET", "/api/user").as("getUser");

    cy.visit("/profile");
    cy.wait("@getUser").then((interception) => {
      expect(interception.response?.statusCode).to.eq(200);
      expect(interception.response?.body.name).to.eq("John Doe");
    });
  });

  // `this.users` needs a function(), not an arrow: arrows do not bind the test context.
  it("reads an aliased fixture", function () {
    cy.fixture("users").as("users");

    cy.visit("/login");
    cy.getBySel("email-input").type(this.users.validUser.email);
  });

  it("waits for several requests at once", () => {
    cy.intercept("GET", "/api/products").as("getProducts");
    cy.intercept("GET", "/api/categories").as("getCategories");

    cy.visit("/shop");
    cy.wait(["@getProducts", "@getCategories"]);
  });
});
```

**Why good:** an alias is the only way to carry a value across commands, because the queue means
nothing is available at the point it is written.

---

## Pattern 6: `cy.session()`

```typescript
const TEST_USER = { email: "user@example.com", password: "SecurePassword123!" };

Cypress.Commands.add("loginViaSession", (email: string, password: string) => {
  cy.session(
    [email, password], // the cache key
    () => {
      cy.visit("/login");
      cy.getBySel("email-input").type(email);
      cy.getBySel("password-input").type(password);
      cy.getBySel("submit-button").click();
      // Guarding assertion: the session is captured after this passes, not before.
      cy.url().should("include", "/dashboard");
    },
    {
      // Runs on every restore; a failure here re-runs the setup instead of using stale state.
      validate: () => cy.getCookie("session").should("exist"),
    },
  );
});

describe("Dashboard", () => {
  beforeEach(() => {
    cy.loginViaSession(TEST_USER.email, TEST_USER.password);
    cy.visit("/dashboard");
  });

  it("shows the dashboard", () => {
    cy.getBySel("dashboard-heading").should("be.visible");
  });
});
```

**Why good:** the login runs once and every later test restores cookies and storage instead of
replaying the form. The `validate` callback is what stops an expired session being restored silently.

---

## Pattern 7: Keys and focus

`cy.focused()` yields whatever currently holds focus, so an assertion about focus is about the
browser's own state rather than about a class the app happened to add. Special keys go inside braces
in `cy.type()`.

```typescript
it("returns focus to the trigger when the dialog closes", () => {
  cy.visit("/");
  cy.getBySel("open-modal-button").click();
  cy.getBySel("modal").should("be.visible");
  cy.focused().should("have.attr", "data-cy", "modal-close-button");

  cy.get("body").type("{esc}");

  cy.getBySel("modal").should("not.exist");
  cy.focused().should("have.attr", "data-cy", "open-modal-button");
});

it("moves through the menu with the arrow keys", () => {
  cy.visit("/");
  cy.getBySel("dropdown-trigger").click();

  cy.get("body").type("{downarrow}");
  cy.focused().should("have.attr", "data-cy", "dropdown-item-1");

  cy.get("body").type("{downarrow}");
  cy.focused().should("have.attr", "data-cy", "dropdown-item-2");

  cy.get("body").type("{uparrow}");
  cy.focused().should("have.attr", "data-cy", "dropdown-item-1");
});
```

**Tab is the exception.** `cy.type()` does not accept `{tab}`, because the synthetic event it
dispatches cannot move focus the way the browser does. Tab-order and focus-trap tests therefore need
a plugin that sends a real key event — a spec calling `.tab()` is using one, and that dependency
belongs in the spec's own imports rather than assumed.
