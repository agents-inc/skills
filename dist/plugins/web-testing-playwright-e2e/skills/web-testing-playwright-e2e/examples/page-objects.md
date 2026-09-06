# Playwright E2E Testing — Page Object Hierarchy

> Inheritance and composition across page objects. See [core.md](core.md) for the basic shape this
> builds on ([Pattern 2](core.md#pattern-2-page-object-model)).

---

## A base page for what every page shares

```typescript
// tests/e2e/pages/base-page.ts
import { expect, type Locator, type Page } from "@playwright/test";

export abstract class BasePage {
  readonly header: Locator;
  readonly footer: Locator;
  readonly navMenu: Locator;

  constructor(readonly page: Page) {
    this.header = page.getByRole("banner");
    this.footer = page.getByRole("contentinfo");
    this.navMenu = page.getByRole("navigation");
  }

  async navigateTo(linkName: string | RegExp) {
    await this.navMenu.getByRole("link", { name: linkName }).click();
  }

  async expectToBeOnPage(urlPattern: string | RegExp) {
    await expect(this.page).toHaveURL(urlPattern);
  }
}
```

```typescript
// tests/e2e/pages/dashboard-page.ts
import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base-page";

const DASHBOARD_URL = "/dashboard";

export class DashboardPage extends BasePage {
  readonly welcomeHeading: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly statsCards: Locator;

  constructor(page: Page) {
    super(page);
    this.welcomeHeading = page.getByRole("heading", { name: /welcome/i });
    this.userMenu = page.getByRole("button", { name: /user menu/i });
    this.logoutButton = page.getByRole("menuitem", { name: /logout/i });
    this.statsCards = page.getByTestId("stats-card");
  }

  async goto() {
    await this.page.goto(DASHBOARD_URL);
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
  }

  // Returns a locator rather than text: the caller can assert on it and get retries.
  statsCardValue(cardTitle: string): Locator {
    return this.statsCards
      .filter({ hasText: cardTitle })
      .getByTestId("card-value");
  }
}
```

**Why good:** landmark locators are written once for every page in the suite, and each subclass adds
only what is its own. Returning a `Locator` rather than an awaited string keeps the caller's
assertion retrying.
