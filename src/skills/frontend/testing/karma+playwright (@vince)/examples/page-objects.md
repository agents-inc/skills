# Testing Examples - Page Objects

> E2E test structure and Page Object Model patterns. See [playwright-config.md](playwright-config.md) for configuration setup.

**Prerequisites**: Understand Playwright configuration and auth fixtures from [playwright-config.md](playwright-config.md) first.

---

## Pattern 1: E2E Test Structure

### E2E Test File

```typescript
// Good Example - E2E test with fixtures and POM
import { expect, test } from "fixtures";
import { openApp } from "pom";

test.describe("Auth", () => {
  test('Redirect to "/create" when user is already logged in', async ({
    proPage,
  }) => {
    await openApp(proPage, { url: "/login" });
    await proPage.waitForURL("/create");
  });

  test("Show login page for anonymous users", async ({ page }) => {
    await openApp(page, { url: "/login" });
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
  });

  test("Call `/app-startup` endpoint when user changes", async ({ proPage }) => {
    const waitForAppStartupResponse = async () => {
      const res = await proPage.waitForResponse((res) =>
        res.url().includes("/v1/app-startup/")
      );
      return await res.json();
    };

    const appStartupPromise = waitForAppStartupResponse();
    await openApp(proPage, { url: "/create" });

    const response = await appStartupPromise;
    expect(response).to.have.property("courierToken");
  });
});
```

**Why good:** Imports from `fixtures` not `@playwright/test`, uses `proPage` fixture for authenticated user, `openApp` POM helper for navigation, proper async/await for network responses

```typescript
// Bad Example - Importing from @playwright/test
import { test, expect } from "@playwright/test"; // WRONG - ESLint error

test("should work", async ({ page }) => {
  // This test lacks auth fixtures or custom configuration
});
```

**Why bad:** Direct import from `@playwright/test` bypasses custom fixtures, no auth state fixtures available, ESLint rule `no-restricted-imports` will error

---

## Pattern 2: Page Object Model (POM)

### POM Structure

```typescript
// e2e/pom/webapp.ts
import type { Page } from "@playwright/test";

import { CreatePage } from "./CreatePage";
import { BrandKitPage } from "./BrandKitPage";
import { Editor } from "./Editor";

export class Webapp {
  readonly page: Page;
  readonly createPage: CreatePage;
  readonly brandKitPage: BrandKitPage;
  readonly editor: Editor;

  constructor(page: Page) {
    this.page = page;
    this.createPage = new CreatePage(page);
    this.brandKitPage = new BrandKitPage(page);
    this.editor = new Editor(page);
  }

  async goto(path: string) {
    await this.page.goto(path);
  }

  async waitForAppReady() {
    // Wait for app to fully load
    await this.page.waitForSelector('[data-testid="app-ready"]', {
      state: "attached",
    });
  }
}

// e2e/pom/CreatePage.ts
import type { Page, Locator } from "@playwright/test";

export class CreatePage {
  readonly page: Page;
  readonly uploadButton: Locator;
  readonly templateGrid: Locator;

  constructor(page: Page) {
    this.page = page;
    this.uploadButton = page.getByRole("button", { name: /Upload/i });
    this.templateGrid = page.getByTestId("template-grid");
  }

  async uploadImage(imagePath: string) {
    const fileChooserPromise = this.page.waitForEvent("filechooser");
    await this.uploadButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(imagePath);
  }

  async selectTemplate(templateName: string) {
    await this.templateGrid
      .getByRole("button", { name: templateName })
      .click();
  }
}

// e2e/pom/Editor.ts
import type { Page, Locator } from "@playwright/test";

export class Editor {
  readonly page: Page;
  readonly canvas: Locator;
  readonly toolbar: Locator;
  readonly exportButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.getByTestId("editor-canvas");
    this.toolbar = page.getByTestId("editor-toolbar");
    this.exportButton = page.getByRole("button", { name: /Export/i });
  }

  async waitForCanvasReady() {
    await this.canvas.waitFor({ state: "visible" });
  }

  async clickExport() {
    await this.exportButton.click();
  }

  async selectTool(toolName: string) {
    await this.toolbar.getByRole("button", { name: toolName }).click();
  }
}
```

**Why good:** Page interactions encapsulated in reusable classes, locators defined once and reused, async methods for actions, composed POM (Webapp contains CreatePage, Editor, etc.), clear separation of concerns

### POM Helper Functions

```typescript
// e2e/pom/index.ts
import type { Page } from "@playwright/test";
import { Webapp } from "./webapp";

export type OpenAppOptions = {
  url?: string;
  waitForReady?: boolean;
};

export const openApp = async (
  page: Page,
  options: OpenAppOptions = {}
): Promise<Webapp> => {
  const { url = "/create", waitForReady = true } = options;

  const webapp = new Webapp(page);
  await webapp.goto(url);

  if (waitForReady) {
    await webapp.waitForAppReady();
  }

  return webapp;
};

export { Webapp } from "./webapp";
export { CreatePage } from "./CreatePage";
export { Editor } from "./Editor";
export { BrandKitPage } from "./BrandKitPage";
```

**Why good:** `openApp` helper reduces test boilerplate, default options with sensible defaults, returns Webapp instance for chaining

### Using POM in Tests

```typescript
// Good Example - Using POM in E2E test
import { expect, test } from "fixtures";
import { openApp } from "pom";

test.describe("Editor", () => {
  test("should upload and edit an image", async ({ proPage }) => {
    const webapp = await openApp(proPage, { url: "/create" });

    await webapp.createPage.uploadImage("./e2e/fixtures/test-image.png");
    await webapp.editor.waitForCanvasReady();

    await webapp.editor.selectTool("Crop");
    await expect(webapp.editor.toolbar).toContainText("Crop");
  });

  test("should export edited image", async ({ proPage }) => {
    const webapp = await openApp(proPage, { url: "/u/edit/test-template-id" });

    await webapp.editor.waitForCanvasReady();
    await webapp.editor.clickExport();

    // Wait for export dialog
    await expect(proPage.getByRole("dialog")).toBeVisible();
  });
});
```

**Why good:** Clean test code using POM abstractions, reusable `openApp` helper, page interactions through POM methods, assertions use Playwright expect

---

_See [core.md](core.md) for unit testing patterns: Chai Assertion Syntax, Sinon Sandbox with Cleanup._
