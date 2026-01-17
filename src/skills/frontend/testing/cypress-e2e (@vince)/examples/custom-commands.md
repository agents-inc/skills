# Cypress Custom Commands with TypeScript

> Custom commands and TypeScript type declarations. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand basic Cypress commands and TypeScript fundamentals.

---

## Pattern 1: Selector Commands

### Basic Selector Commands

```typescript
// cypress/support/commands.ts
export function registerCommands() {
  /**
   * Get element by data-cy attribute (exact match)
   */
  Cypress.Commands.add("getBySel", (selector: string, ...args) => {
    return cy.get(`[data-cy=${selector}]`, ...args);
  });

  /**
   * Get element by partial data-cy attribute match
   */
  Cypress.Commands.add("getBySelLike", (selector: string, ...args) => {
    return cy.get(`[data-cy*=${selector}]`, ...args);
  });

  /**
   * Get element by data-testid attribute (alternative convention)
   */
  Cypress.Commands.add("getByTestId", (testId: string, ...args) => {
    return cy.get(`[data-testid=${testId}]`, ...args);
  });
}

// cypress/support/e2e.ts
import { registerCommands } from "./commands";
registerCommands();
```

### Type Declarations

```typescript
// cypress/support/index.d.ts
/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable<Subject = any> {
    /**
     * Get element by data-cy attribute
     * @example cy.getBySel('submit-button')
     */
    getBySel(
      selector: string,
      options?: Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable & Cypress.Shadow>
    ): Chainable<JQuery<HTMLElement>>;

    /**
     * Get element by partial data-cy attribute match
     * @example cy.getBySelLike('error') // matches data-cy="error-message"
     */
    getBySelLike(
      selector: string,
      options?: Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable & Cypress.Shadow>
    ): Chainable<JQuery<HTMLElement>>;

    /**
     * Get element by data-testid attribute
     * @example cy.getByTestId('user-avatar')
     */
    getByTestId(
      testId: string,
      options?: Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable & Cypress.Shadow>
    ): Chainable<JQuery<HTMLElement>>;
  }
}
```

---

## Pattern 2: Authentication Commands

### Login Command with Session Caching

```typescript
// cypress/support/commands.ts
const LOGIN_URL = "/login";

export function registerAuthCommands() {
  /**
   * Log in a user via UI with session caching
   */
  Cypress.Commands.add("login", (email: string, password: string) => {
    cy.session(
      [email, password],
      () => {
        cy.visit(LOGIN_URL);
        cy.getBySel("email-input").type(email);
        cy.getBySel("password-input").type(password);
        cy.getBySel("submit-button").click();
        cy.url().should("include", "/dashboard");
      },
      {
        validate: () => {
          cy.getCookie("session").should("exist");
        },
      }
    );
  });

  /**
   * Log in programmatically via API (faster)
   */
  Cypress.Commands.add("loginViaApi", (email: string, password: string) => {
    cy.session(
      [email, password],
      () => {
        cy.request({
          method: "POST",
          url: "/api/auth/login",
          body: { email, password },
        }).then((response) => {
          window.localStorage.setItem("authToken", response.body.token);
        });
      },
      {
        validate: () => {
          cy.window().its("localStorage.authToken").should("exist");
        },
      }
    );
  });

  /**
   * Log out the current user
   */
  Cypress.Commands.add("logout", () => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit("/login");
  });
}
```

### Type Declarations for Auth

```typescript
// cypress/support/index.d.ts
declare namespace Cypress {
  interface Chainable<Subject = any> {
    /**
     * Log in a user via UI with session caching
     * @param email - User email address
     * @param password - User password
     * @example cy.login('user@example.com', 'password123')
     */
    login(email: string, password: string): Chainable<void>;

    /**
     * Log in a user via API (faster, skips UI)
     * @param email - User email address
     * @param password - User password
     * @example cy.loginViaApi('user@example.com', 'password123')
     */
    loginViaApi(email: string, password: string): Chainable<void>;

    /**
     * Log out the current user
     * @example cy.logout()
     */
    logout(): Chainable<void>;
  }
}
```

---

## Pattern 3: Form Commands

### Form Filling Commands

```typescript
// cypress/support/commands.ts
interface FormFieldConfig {
  selector: string;
  value: string;
  type?: "input" | "select" | "checkbox" | "radio";
}

export function registerFormCommands() {
  /**
   * Fill multiple form fields at once
   */
  Cypress.Commands.add("fillForm", (fields: FormFieldConfig[]) => {
    fields.forEach(({ selector, value, type = "input" }) => {
      const element = cy.getBySel(selector);

      switch (type) {
        case "select":
          element.select(value);
          break;
        case "checkbox":
          if (value === "true") {
            element.check();
          } else {
            element.uncheck();
          }
          break;
        case "radio":
          element.check(value);
          break;
        default:
          element.clear().type(value);
      }
    });
  });

  /**
   * Submit a form and wait for response
   */
  Cypress.Commands.add("submitForm", (submitSelector: string, alias?: string) => {
    cy.getBySel(submitSelector).click();
    if (alias) {
      cy.wait(`@${alias}`);
    }
  });

  /**
   * Clear all form fields
   */
  Cypress.Commands.add("clearForm", (fieldSelectors: string[]) => {
    fieldSelectors.forEach((selector) => {
      cy.getBySel(selector).clear();
    });
  });
}

// Usage example
describe("Form Commands", () => {
  it("fills and submits form", () => {
    cy.intercept("POST", "/api/users").as("createUser");

    cy.visit("/users/new");

    cy.fillForm([
      { selector: "name-input", value: "John Doe" },
      { selector: "email-input", value: "john@example.com" },
      { selector: "role-select", value: "admin", type: "select" },
      { selector: "active-checkbox", value: "true", type: "checkbox" },
    ]);

    cy.submitForm("submit-button", "createUser");

    cy.getBySel("success-message").should("be.visible");
  });
});
```

### Type Declarations for Form

```typescript
// cypress/support/index.d.ts
interface FormFieldConfig {
  selector: string;
  value: string;
  type?: "input" | "select" | "checkbox" | "radio";
}

declare namespace Cypress {
  interface Chainable<Subject = any> {
    /**
     * Fill multiple form fields at once
     * @param fields - Array of field configurations
     * @example cy.fillForm([{ selector: 'email-input', value: 'test@example.com' }])
     */
    fillForm(fields: FormFieldConfig[]): Chainable<void>;

    /**
     * Submit a form and optionally wait for response
     * @param submitSelector - data-cy selector for submit button
     * @param alias - Optional intercept alias to wait for
     * @example cy.submitForm('submit-button', 'createUser')
     */
    submitForm(submitSelector: string, alias?: string): Chainable<void>;

    /**
     * Clear all form fields
     * @param fieldSelectors - Array of data-cy selectors
     * @example cy.clearForm(['email-input', 'name-input'])
     */
    clearForm(fieldSelectors: string[]): Chainable<void>;
  }
}
```

---

## Pattern 4: Child and Dual Commands

### Child Command (Requires Previous Subject)

```typescript
// cypress/support/commands.ts
export function registerChildCommands() {
  /**
   * Scroll element into view and click
   */
  Cypress.Commands.add(
    "scrollAndClick",
    { prevSubject: "element" },
    (subject: JQuery<HTMLElement>) => {
      cy.wrap(subject).scrollIntoView().should("be.visible").click();
    }
  );

  /**
   * Type text and verify input value
   */
  Cypress.Commands.add(
    "typeAndVerify",
    { prevSubject: "element" },
    (subject: JQuery<HTMLElement>, text: string) => {
      cy.wrap(subject).clear().type(text).should("have.value", text);
    }
  );
}

// Usage
describe("Child Commands", () => {
  it("uses child commands", () => {
    cy.getBySel("hidden-button").scrollAndClick();
    cy.getBySel("email-input").typeAndVerify("test@example.com");
  });
});
```

### Dual Command (Works With or Without Subject)

```typescript
// cypress/support/commands.ts
export function registerDualCommands() {
  /**
   * Take screenshot with optional element scope
   */
  Cypress.Commands.add(
    "captureScreenshot",
    { prevSubject: "optional" },
    (subject: JQuery<HTMLElement> | undefined, name: string) => {
      if (subject) {
        cy.wrap(subject).screenshot(name);
      } else {
        cy.screenshot(name);
      }
    }
  );
}

// Usage
describe("Dual Commands", () => {
  it("captures full page screenshot", () => {
    cy.captureScreenshot("full-page");
  });

  it("captures element screenshot", () => {
    cy.getBySel("header").captureScreenshot("header-only");
  });
});
```

### Type Declarations for Child/Dual

```typescript
// cypress/support/index.d.ts
declare namespace Cypress {
  interface Chainable<Subject = any> {
    /**
     * Scroll element into view and click (child command)
     * @example cy.getBySel('hidden-button').scrollAndClick()
     */
    scrollAndClick(): Chainable<JQuery<HTMLElement>>;

    /**
     * Type text and verify input value (child command)
     * @param text - Text to type
     * @example cy.getBySel('email-input').typeAndVerify('test@example.com')
     */
    typeAndVerify(text: string): Chainable<JQuery<HTMLElement>>;

    /**
     * Take screenshot (dual command - works with or without subject)
     * @param name - Screenshot filename
     * @example cy.captureScreenshot('full-page')
     * @example cy.getBySel('header').captureScreenshot('header')
     */
    captureScreenshot(name: string): Chainable<void>;
  }
}
```

---

## Pattern 5: Database and API Commands

### Task-Based Database Commands

```typescript
// cypress.config.ts
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      on("task", {
        "db:seed": async (data: { users: object[]; products: object[] }) => {
          // Seed database with test data
          // This runs in Node.js, so you can use any Node packages
          const response = await fetch(`${config.env.apiUrl}/test/seed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          return response.json();
        },

        "db:reset": async () => {
          // Reset database to clean state
          const response = await fetch(`${config.env.apiUrl}/test/reset`, {
            method: "POST",
          });
          return response.json();
        },

        "db:query": async (query: string) => {
          // Execute arbitrary query (for verification)
          const response = await fetch(`${config.env.apiUrl}/test/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          return response.json();
        },
      });
    },
  },
});

// cypress/support/commands.ts
export function registerDbCommands() {
  /**
   * Seed database with test data
   */
  Cypress.Commands.add("seedDatabase", (data: { users?: object[]; products?: object[] }) => {
    cy.task("db:seed", data);
  });

  /**
   * Reset database to clean state
   */
  Cypress.Commands.add("resetDatabase", () => {
    cy.task("db:reset");
  });
}

// Usage
describe("Database Commands", () => {
  beforeEach(() => {
    cy.resetDatabase();
    cy.seedDatabase({
      users: [{ id: "1", name: "Test User", email: "test@example.com" }],
    });
  });

  it("displays seeded users", () => {
    cy.visit("/users");
    cy.getBySel("user-row").should("have.length", 1);
  });
});
```

---

## Pattern 6: Complete Commands File

### Full Commands Setup

```typescript
// cypress/support/commands.ts

// ============================================
// Selector Commands
// ============================================

function registerSelectorCommands() {
  Cypress.Commands.add("getBySel", (selector, ...args) => {
    return cy.get(`[data-cy=${selector}]`, ...args);
  });

  Cypress.Commands.add("getBySelLike", (selector, ...args) => {
    return cy.get(`[data-cy*=${selector}]`, ...args);
  });
}

// ============================================
// Authentication Commands
// ============================================

const LOGIN_URL = "/login";

function registerAuthCommands() {
  Cypress.Commands.add("login", (email, password) => {
    cy.session(
      [email, password],
      () => {
        cy.visit(LOGIN_URL);
        cy.getBySel("email-input").type(email);
        cy.getBySel("password-input").type(password);
        cy.getBySel("submit-button").click();
        cy.url().should("include", "/dashboard");
      },
      {
        validate: () => {
          cy.getCookie("session").should("exist");
        },
      }
    );
  });

  Cypress.Commands.add("logout", () => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });
}

// ============================================
// Form Commands
// ============================================

function registerFormCommands() {
  Cypress.Commands.add("fillForm", (fields) => {
    fields.forEach(({ selector, value, type = "input" }) => {
      const element = cy.getBySel(selector);
      switch (type) {
        case "select":
          element.select(value);
          break;
        case "checkbox":
          value === "true" ? element.check() : element.uncheck();
          break;
        default:
          element.clear().type(value);
      }
    });
  });
}

// ============================================
// Export All Commands
// ============================================

export function registerCommands() {
  registerSelectorCommands();
  registerAuthCommands();
  registerFormCommands();
}
```

### Complete Type Declarations

```typescript
// cypress/support/index.d.ts
/// <reference types="cypress" />

interface FormFieldConfig {
  selector: string;
  value: string;
  type?: "input" | "select" | "checkbox" | "radio";
}

declare namespace Cypress {
  interface Chainable<Subject = any> {
    // Selector commands
    getBySel(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>
    ): Chainable<JQuery<HTMLElement>>;

    getBySelLike(
      selector: string,
      options?: Partial<Loggable & Timeoutable & Withinable & Shadow>
    ): Chainable<JQuery<HTMLElement>>;

    // Auth commands
    login(email: string, password: string): Chainable<void>;
    logout(): Chainable<void>;

    // Form commands
    fillForm(fields: FormFieldConfig[]): Chainable<void>;

    // Database commands
    seedDatabase(data: { users?: object[]; products?: object[] }): Chainable<void>;
    resetDatabase(): Chainable<void>;
  }
}
```

---

_See [core.md](core.md) for foundational patterns and basic test structure._
