# Playwright E2E Testing - Page Objects

> Advanced page object patterns with inheritance and composition. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand [Pattern 2: Page Object Model](core.md#pattern-2-page-object-model) from core examples first.

---

## Pattern: Complete Page Object Hierarchy

### Base Page with Common Functionality

```typescript
// tests/e2e/pages/base-page.ts
import type { Page, Locator } from "@playwright/test";

export abstract class BasePage {
  readonly page: Page;
  readonly header: Locator;
  readonly footer: Locator;
  readonly navMenu: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.getByRole("banner");
    this.footer = page.getByRole("contentinfo");
    this.navMenu = page.getByRole("navigation");
  }

  async navigateTo(linkName: string | RegExp) {
    await this.navMenu.getByRole("link", { name: linkName }).click();
  }

  async expectToBeOnPage(urlPattern: string | RegExp) {
    const { expect } = await import("@playwright/test");
    await expect(this.page).toHaveURL(urlPattern);
  }
}
```

### Extended Page Objects

```typescript
// tests/e2e/pages/dashboard-page.ts
import type { Page, Locator } from "@playwright/test";
import { BasePage } from "./base-page";

const DASHBOARD_URL = "/dashboard";

export class DashboardPage extends BasePage {
  readonly welcomeHeading: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly statsCards: Locator;
  readonly recentActivityList: Locator;

  constructor(page: Page) {
    super(page);
    this.welcomeHeading = page.getByRole("heading", { name: /welcome/i });
    this.userMenu = page.getByRole("button", { name: /user menu/i });
    this.logoutButton = page.getByRole("menuitem", { name: /logout/i });
    this.statsCards = page.getByTestId("stats-card");
    this.recentActivityList = page.getByRole("list", {
      name: /recent activity/i,
    });
  }

  async goto() {
    await this.page.goto(DASHBOARD_URL);
  }

  async logout() {
    await this.userMenu.click();
    await this.logoutButton.click();
  }

  async getStatsCardValue(cardTitle: string) {
    const card = this.statsCards.filter({ hasText: cardTitle });
    return card.getByTestId("card-value").textContent();
  }
}
```

**Why good:** Base page provides common functionality inheritance, page objects encapsulate all locators and actions, methods expose domain-specific operations

---

_See [core.md](core.md) for foundational patterns: User Flows, Basic Page Objects, Network Mocking, and Configuration._
