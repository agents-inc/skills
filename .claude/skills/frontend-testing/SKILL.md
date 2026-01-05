# Frontend Testing Patterns - Photoroom Webapp

> **Quick Guide:** Unit tests use Karma + Mocha + Chai (NOT Jest/Vitest). Use Chai assertion syntax (`to.equal`, `to.deep.equal`, `to.have.been.called`). Sinon for mocking with mandatory sandbox cleanup. Mock store factories for dependency injection. E2E tests use Playwright with custom fixtures and Page Object Model. Import from `fixtures` not `@playwright/test`.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase test files matching source, named exports, import ordering, `import type`, named constants)

**(You MUST use Chai assertion syntax - NOT Jest/Vitest syntax (`.toBe()` vs `.to.equal()`))**

**(You MUST use Sinon sandbox with cleanup in `afterEach` - NEVER use `sinon.stub()` directly)**

**(You MUST call `queryClient.clear()` in `beforeEach` for tests using React Query)**

**(You MUST import `test` and `expect` from `fixtures` in E2E tests - NOT from `@playwright/test`)**

**(You MUST use Page Object Model (POM) pattern for E2E test interactions)**

</critical_requirements>

---

**Auto-detection:** Karma, Mocha, Chai, Sinon, unit test, test file, `.test.ts`, sandbox, mock store, Playwright, E2E, end-to-end, `.e2e.ts`, fixtures, POM, page object

**When to use:**

- Writing unit tests for stores, utilities, or hooks
- Setting up test mocks with Sinon sandbox
- Creating mock store factories for dependency injection
- Writing Playwright E2E tests with custom auth fixtures
- Using Page Object Model for E2E interactions

**Key patterns covered:**

- Karma + Mocha + Chai test framework (NOT Jest/Vitest)
- Chai assertion syntax (`to.equal`, `to.deep.equal`, `to.have.been.called`)
- Sinon sandbox pattern with mandatory cleanup
- Mock store factories with partial dependencies
- Test setup (WASM initialization, queryClient.clear)
- Playwright E2E configuration and custom fixtures
- Page Object Model (POM) pattern
- Auth state fixtures (proContext, proPage)

**When NOT to use:**

- Integration testing (use E2E instead)
- Component rendering tests (use Storybook for visual testing)
- API endpoint testing (use apps/image-editing-api patterns)

---

<philosophy>

## Philosophy

Testing in the Photoroom webapp follows a clear separation: **unit tests** for stores, utilities, and isolated logic; **E2E tests** for user flows and integration. The codebase uses Karma + Mocha + Chai for unit tests (NOT Jest/Vitest) and Playwright for E2E tests.

**Unit Testing Principles:**

1. **Chai assertions** - Use `.to.equal()`, `.to.deep.equal()`, `.to.have.been.called`
2. **Sinon sandboxes** - Always use sandbox for mocking with cleanup in `afterEach`
3. **Mock store factories** - Create test stores with partial dependency injection
4. **Isolated tests** - Clear queryClient and sandbox between tests

**E2E Testing Principles:**

1. **Custom fixtures** - Import from `fixtures`, not `@playwright/test`
2. **Page Object Model** - Encapsulate page interactions in POM classes
3. **Auth state fixtures** - Use `proContext`/`proPage` for authenticated tests
4. **Parallel execution** - Tests run in parallel with worker isolation

**When to use unit tests:**

- MobX store actions and computed properties
- Utility functions and helpers
- Hooks with complex logic
- State machine transitions

**When to use E2E tests:**

- User authentication flows
- Critical user journeys (create, edit, export)
- Cross-page navigation
- API integration verification

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Chai Assertion Syntax

The webapp uses Chai assertions with Mocha. Use Chai syntax exclusively for unit tests.

#### Chai vs Jest/Vitest Syntax Reference

```typescript
// ✅ Good Example - Chai syntax (used in webapp)
import { expect } from "chai";

describe("MyStore", () => {
  it("should have correct values", () => {
    // Equality
    expect(value).to.equal("expected");
    expect(value).to.not.equal("wrong");

    // Deep equality (objects/arrays)
    expect(obj).to.deep.equal({ key: "value" });

    // Boolean checks
    expect(authStore.isLoading).to.be.true;
    expect(authStore.isLoggedIn).to.be.false;

    // Null/undefined
    expect(authStore.firebaseUser).to.be.null;
    expect(value).to.be.undefined;

    // Type checks
    expect(result).to.be.an("array");
    expect(result).to.be.a("string");

    // Length
    expect(items).to.have.length(3);

    // Property existence
    expect(obj).to.have.property("id");
    expect(obj).to.have.property("name", "John");

    // Function calls (with sinon-chai)
    expect(mockFn).to.have.been.called;
    expect(mockFn).to.have.been.calledOnce;
    expect(mockFn).to.have.been.calledWith("arg1", "arg2");
    expect(mockFn).to.have.been.calledTwice;

    // Throwing errors
    expect(() => throwingFn()).to.throw(Error);
    expect(() => throwingFn()).to.throw("error message");
  });
});
```

**Why good:** Matches the webapp test framework (Karma + Mocha + Chai), consistent with existing tests, sinon-chai enables natural mocking assertions

```typescript
// ❌ Bad Example - Jest/Vitest syntax (NOT used in webapp)
import { expect } from "vitest";

describe("MyStore", () => {
  it("should have correct values", () => {
    expect(value).toBe("expected"); // WRONG - Jest syntax
    expect(obj).toEqual({ key: "value" }); // WRONG - Jest syntax
    expect(authStore.isLoading).toBeTruthy(); // WRONG - Jest syntax
    expect(mockFn).toHaveBeenCalled(); // WRONG - Jest syntax
    expect(mockFn).toHaveBeenCalledWith("arg"); // WRONG - Jest syntax
  });
});
```

**Why bad:** Jest/Vitest assertions will fail with Karma + Chai, tests error with "expect(...).toBe is not a function"

---

### Pattern 2: Sinon Sandbox with Cleanup

Use Sinon sandbox for all mocking. Create sandbox in test setup, restore in `afterEach`.

#### Sandbox Pattern

```typescript
// ✅ Good Example - Sinon sandbox with cleanup
import sinon from "sinon";
import { expect } from "chai";

describe("AuthStore", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should call fetchAppStartup on login", async () => {
    const fetchAppStartup = sandbox.stub().resolves({ courierToken: "token" });
    const authStore = makeTestAuthStore({ fetchAppStartup });

    await authStore.logIn();

    expect(fetchAppStartup).to.have.been.calledOnce;
  });

  it("should handle errors", async () => {
    const fetchAppStartup = sandbox.stub().rejects(new Error("Network error"));
    const logError = sandbox.stub(logger, "error");
    const authStore = makeTestAuthStore({ fetchAppStartup });

    await authStore.logIn();

    expect(logError).to.have.been.calledWith("Failed to fetch app startup");
  });
});
```

**Why good:** Sandbox groups related stubs/mocks together, `sandbox.restore()` cleans up all stubs at once, prevents test pollution between tests, enables stubbing module methods like `logger.error`

```typescript
// ❌ Bad Example - Direct sinon.stub without cleanup
describe("AuthStore", () => {
  it("should call fetchAppStartup on login", async () => {
    sinon.stub(api, "fetch"); // BAD: No cleanup - pollutes other tests
    // test code...
  });

  // Next test runs with api.fetch still stubbed!
  it("should actually call the API", async () => {
    // This test may fail because api.fetch is still stubbed
  });
});
```

**Why bad:** Direct `sinon.stub()` without sandbox leaks stubs to other tests, causes flaky test failures, makes debugging difficult because test order matters

---

### Pattern 3: Mock Store Factories

Create test store factories that accept partial dependencies for flexible testing.

#### Factory Pattern

```typescript
// ✅ Good Example - Mock store factory with partial dependencies
import { AuthStore, type AuthStoreDependencies } from "stores/AuthStore";
import { NotificationsStore } from "@photoroom/ui/src/components/status/Notification/NotificationsStore";
import type { Ampli } from "@photoroom/shared";

// Test implementation of Firebase auth
class TestFirebaseAuth {
  #authStateCallback?: (user: FirebaseUser | null) => void;
  currentUser: FirebaseUser | null = null;

  onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    this.#authStateCallback = callback;
    // Immediately call with null (logged out state)
    setTimeout(() => callback(this.currentUser), 0);
    return () => {};
  }

  // Test helper to simulate login
  simulateLogin(user: FirebaseUser) {
    this.currentUser = user;
    this.#authStateCallback?.(user);
  }

  async signOut() {
    this.currentUser = null;
    this.#authStateCallback?.(null);
  }
}

// Mock ampli for analytics
const ampliMock = {
  identify: () => {},
  track: () => {},
  logEvent: () => {},
} as unknown as Ampli;

// Factory function with partial dependencies
const makeTestAuthStore = (
  partialDependencies: Partial<AuthStoreDependencies> = {}
): AuthStore => {
  return new AuthStore({
    firebaseAuth: partialDependencies.firebaseAuth ?? new TestFirebaseAuth(),
    fetchAppStartup:
      partialDependencies.fetchAppStartup ??
      (async () => ({ courierToken: "test-courier-token" })),
    fetchMagicCode:
      partialDependencies.fetchMagicCode ??
      (async () => ({ token: "test-magic-code", expiresAt: "2025-01-01" })),
    ampli: partialDependencies.ampli ?? ampliMock,
    notificationsStore: new NotificationsStore({
      logEvent: () => {},
      logNotificationEvent: () => {},
    }),
  });
};

// Usage in tests
describe("AuthStore", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("state is in sync with Firebase SDK", async () => {
    const firebaseAuth = new TestFirebaseAuth();
    const authStore = makeTestAuthStore({ firebaseAuth });

    expect(authStore.isLoading).to.be.true;
    expect(authStore.isLoggedIn).to.be.false;
    expect(authStore.firebaseUser).to.be.null;

    // Wait for loading to complete
    await when(() => !authStore.isLoading);

    expect(authStore.isLoading).to.be.false;
    expect(authStore.isLoggedIn).to.be.false;
  });

  it("updates state when user logs in", async () => {
    const firebaseAuth = new TestFirebaseAuth();
    const authStore = makeTestAuthStore({ firebaseAuth });

    await when(() => !authStore.isLoading);

    // Simulate Firebase login
    firebaseAuth.simulateLogin({
      uid: "test-uid",
      email: "test@example.com",
      isAnonymous: false,
    } as FirebaseUser);

    expect(authStore.isLoggedIn).to.be.true;
    expect(authStore.firebaseUid).to.equal("test-uid");
  });
});
```

**Why good:** Factory accepts partial dependencies so tests only provide what they need, default implementations for all dependencies prevent test setup boilerplate, TestFirebaseAuth provides control over auth state for testing, `when()` from MobX waits for observable conditions

```typescript
// ❌ Bad Example - Hardcoded dependencies
describe("AuthStore", () => {
  it("should work", () => {
    // BAD: Must provide ALL dependencies every time
    const authStore = new AuthStore({
      firebaseAuth: new TestFirebaseAuth(),
      fetchAppStartup: async () => ({ courierToken: "token" }),
      fetchMagicCode: async () => ({ token: "code", expiresAt: "2025-01-01" }),
      ampli: mockAmpli,
      notificationsStore: new NotificationsStore({ ... }),
    });
  });
});
```

**Why bad:** Every test must provide all dependencies even if irrelevant, changes to AuthStore constructor break all tests, no reuse of common test setup

---

### Pattern 4: Test Setup with WASM and QueryClient

Tests requiring the engine need WASM initialization. Tests using React Query need `queryClient.clear()`.

#### Test Setup

```typescript
// src/tests/setup.ts
import { WASM } from "photoroom_engine_web";
import { queryClient } from "lib/query-client";

// Paths to WASM modules
const webgpuWasmPath = "./photoroom_engine_web/photoroom_engine_web_bg.wasm";
const webglWasmPath = "./photoroom_engine_web/photoroom_engine_webgl_bg.wasm";

// Initialize WASM once before all tests
before(async () => {
  await WASM.initialize({
    gpuBackend: "webgl",
    webgpuWasmModuleOrPath: webgpuWasmPath,
    webglWasmModuleOrPath: webglWasmPath,
  });
});

// Clear React Query cache before each test
beforeEach(async () => {
  queryClient.clear();
});
```

**Why good:** WASM initialization is expensive so done once in `before`, queryClient.clear() prevents test pollution from cached data, each test starts with fresh query state

#### Individual Test Setup

```typescript
// ✅ Good Example - Test file with proper setup
import { expect } from "chai";
import sinon from "sinon";
import { when } from "mobx";
import { queryClient } from "lib/query-client";

describe("TeamsStore", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    queryClient.clear(); // Clear any cached team data
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should fetch teams on initialization", async () => {
    const fetchTeams = sandbox.stub().resolves([
      { id: "1", name: "Team 1" },
      { id: "2", name: "Team 2" },
    ]);

    const teamsStore = makeTestTeamsStore({ fetchTeams });
    teamsStore.startTeamsQuery();

    await when(() => !teamsStore.teamsAreLoading);

    expect(teamsStore.allTeams).to.have.length(2);
    expect(fetchTeams).to.have.been.calledOnce;
  });
});
```

**Why good:** Sandbox created fresh each test, queryClient cleared to prevent stale data, `when()` awaits MobX observable conditions, explicit assertions on both data and mock calls

---

### Pattern 5: Test File Organization

Tests live in two locations: co-located with source files or in `src/tests/` for integration tests.

#### File Organization

```
src/
├── stores/
│   ├── AuthStore.ts
│   ├── AuthStore.test.ts         # Co-located unit test
│   ├── AppVersionStore.ts
│   └── AppVersionStore.test.ts   # Co-located unit test
├── utils/
│   ├── url.ts
│   └── url.test.ts               # Co-located utility test
├── lib/
│   └── editor/
│       ├── helpers/
│       │   ├── color.ts
│       │   └── color.test.ts     # Co-located helper test
│       └── models/
│           ├── Concept.ts
│           └── Concept.test.ts   # Co-located model test
└── tests/
    ├── setup.ts                  # Global test setup
    ├── AuthStore.test.ts         # Integration test
    └── TeamsStore.test.ts        # Integration test

e2e/
├── fixtures/
│   ├── index.ts                  # Fixture exports
│   └── auth.ts                   # Auth fixtures
├── pom/
│   ├── index.ts                  # POM exports
│   ├── webapp.ts                 # Main webapp POM
│   ├── CreatePage.ts             # Create page POM
│   ├── Editor.ts                 # Editor POM
│   └── BrandKitPage.ts           # Brand kit POM
├── auth.e2e.ts                   # Auth E2E tests
├── editor.e2e.ts                 # Editor E2E tests
└── batch.e2e.ts                  # Batch E2E tests
```

**Why good:** Co-located tests are easy to find next to source, `src/tests/` for complex integration tests, E2E tests in dedicated `e2e/` directory, POM classes organized in `e2e/pom/`

---

### Pattern 6: Playwright E2E Configuration

E2E tests use Playwright with specific configuration for the webapp.

#### Playwright Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const TIMEOUT_3_MINUTES = 3 * 60 * 1000;
const TIMEOUT_60_SECONDS = 60 * 1000;
const SCREENSHOT_THRESHOLD = 0.25;
const SCREENSHOT_DIFF_RATIO = 0.05;
const WORKER_PERCENTAGE = "30%";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts$/,

  // Timeouts
  timeout: TIMEOUT_3_MINUTES,
  expect: {
    timeout: TIMEOUT_60_SECONDS,
    toHaveScreenshot: {
      threshold: SCREENSHOT_THRESHOLD,
      maxDiffPixelRatio: SCREENSHOT_DIFF_RATIO,
    },
  },

  // Parallelization
  workers: WORKER_PERCENTAGE,
  fullyParallel: true,

  // CI-specific settings
  maxFailures: process.env.CI ? 1 : 0,
  retries: process.env.CI ? 1 : 0,

  // Reporter
  reporter: process.env.CI ? "github" : "html",

  // Projects (browsers)
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Base URL
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
```

**Why good:** Named constants for magic numbers, CI-specific retry and failure behavior, screenshot thresholds for visual regression, parallel execution with worker limits, trace on failure for debugging

---

### Pattern 7: Custom Auth Fixtures

E2E tests use custom fixtures for authenticated states. Import from `fixtures`, not `@playwright/test`.

#### Auth Fixtures

```typescript
// e2e/fixtures/auth.ts
import { test as base, type Page, type BrowserContext } from "@playwright/test";

// Path to stored auth state files
const getAuthFilePath = (userType: "pro" | "free" | "anonymous") => {
  return `./e2e/.auth/${userType}.json`;
};

type AuthFixtures = {
  proContext: BrowserContext;
  proPage: Page;
  freeContext: BrowserContext;
  freePage: Page;
};

export const test = base.extend<AuthFixtures>({
  // Pro user context with stored auth state
  proContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getAuthFilePath("pro"),
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await use(context);
    await context.close();
  },

  // Pro user page
  proPage: async ({ proContext }, use) => {
    const page = await proContext.newPage();
    await use(page);
    await page.close();
  },

  // Free user context
  freeContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getAuthFilePath("free"),
    });
    await use(context);
    await context.close();
  },

  // Free user page
  freePage: async ({ freeContext }, use) => {
    const page = await freeContext.newPage();
    await use(page);
    await page.close();
  },
});

export { expect } from "@playwright/test";
```

**Why good:** Reusable auth contexts for different user types, clipboard permissions for export tests, proper cleanup with context.close(), exports both `test` and `expect` for use in test files

#### Fixtures Index

```typescript
// e2e/fixtures/index.ts
export { test, expect } from "./auth";
```

**Why good:** Single import point for all fixtures, clean API for test files

---

### Pattern 8: E2E Test Structure

E2E tests import from fixtures and use Page Object Model for interactions.

#### E2E Test File

```typescript
// ✅ Good Example - E2E test with fixtures and POM
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
// ❌ Bad Example - Importing from @playwright/test
import { test, expect } from "@playwright/test"; // WRONG - ESLint error

test("should work", async ({ page }) => {
  // This test lacks auth fixtures or custom configuration
});
```

**Why bad:** Direct import from `@playwright/test` bypasses custom fixtures, no auth state fixtures available, ESLint rule `no-restricted-imports` will error

---

### Pattern 9: Page Object Model (POM)

Encapsulate page interactions in POM classes for maintainability and reuse.

#### POM Structure

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

#### POM Helper Functions

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

#### Using POM in Tests

```typescript
// ✅ Good Example - Using POM in E2E test
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

</patterns>

---

<anti_patterns>

## Anti-Patterns

### ❌ Using Jest/Vitest Assertion Syntax

Jest/Vitest assertions will fail with Karma + Chai. Use Chai syntax exclusively.

```typescript
// ❌ Avoid - Jest/Vitest syntax
expect(value).toBe("expected");
expect(mockFn).toHaveBeenCalled();
expect(obj).toEqual({ key: "value" });

// ✅ Use instead - Chai syntax
expect(value).to.equal("expected");
expect(mockFn).to.have.been.called;
expect(obj).to.deep.equal({ key: "value" });
```

### ❌ Direct Sinon Stubs Without Sandbox

Stubs without sandbox leak between tests, causing flaky failures.

```typescript
// ❌ Avoid - Direct stub without cleanup
it("test 1", () => {
  sinon.stub(api, "fetch"); // Leaks to test 2
});

it("test 2", () => {
  api.fetch(); // Still stubbed from test 1!
});

// ✅ Use instead - Sandbox pattern
let sandbox: sinon.SinonSandbox;

beforeEach(() => {
  sandbox = sinon.createSandbox();
});

afterEach(() => {
  sandbox.restore();
});

it("test 1", () => {
  sandbox.stub(api, "fetch"); // Cleaned up after test
});
```

### ❌ Importing Directly from @playwright/test

Bypasses custom auth fixtures and configuration.

```typescript
// ❌ Avoid - Direct Playwright import
import { test, expect } from "@playwright/test";

// ✅ Use instead - Custom fixtures
import { test, expect } from "fixtures";
```

### ❌ Missing queryClient.clear() for React Query Tests

Cached data from previous tests causes false positives.

```typescript
// ❌ Avoid - No cache clearing
describe("TeamsStore", () => {
  it("should fetch teams", async () => {
    // May pass due to cached data from previous test
  });
});

// ✅ Use instead - Clear cache each test
beforeEach(() => {
  queryClient.clear();
});
```

### ❌ Hardcoded Dependencies Instead of Factories

Requires full dependency setup for every test.

```typescript
// ❌ Avoid - Full dependency specification
const store = new AuthStore({
  firebaseAuth: new TestFirebaseAuth(),
  fetchAppStartup: async () => ({ courierToken: "token" }),
  fetchMagicCode: async () => ({ token: "code", expiresAt: "date" }),
  ampli: mockAmpli,
  notificationsStore: mockNotifications,
});

// ✅ Use instead - Factory with defaults
const store = makeTestAuthStore({ fetchAppStartup: customStub });
```

### ❌ Raw Selectors Instead of POM

Duplicated selectors across tests, harder to maintain.

```typescript
// ❌ Avoid - Raw selectors in test
await page.click('[data-testid="upload-button"]');
await page.click('[data-testid="template-grid"] button:first-child');

// ✅ Use instead - POM methods
await webapp.createPage.uploadButton.click();
await webapp.createPage.selectTemplate("Portrait");
```

### ❌ Forgetting to Await MobX when()

Causes race conditions or requires arbitrary setTimeout.

```typescript
// ❌ Avoid - Not awaiting when()
when(() => !store.isLoading);
expect(store.data).to.exist; // May fail - loading not complete

// ✅ Use instead - Await the condition
await when(() => !store.isLoading);
expect(store.data).to.exist;
```

</anti_patterns>

---

<decision_framework>

## Decision Framework

### Unit Test vs E2E Test

```
What am I testing?

Is it a user flow across multiple pages?
|-- YES --> E2E test with Playwright
|-- NO --> Is it testing API integration in the browser?
    |-- YES --> E2E test
    |-- NO --> Is it a store action or computed property?
        |-- YES --> Unit test
        |-- NO --> Is it a utility function?
            |-- YES --> Unit test
            |-- NO --> Is it a hook with complex logic?
                |-- YES --> Unit test with mock dependencies
                |-- NO --> Consider if test is needed
```

### Assertion Syntax Decision

```
Which assertion syntax should I use?

Am I in a unit test file (.test.ts)?
|-- YES --> Chai syntax: expect(x).to.equal(y)
|-- NO --> Am I in an E2E test file (.e2e.ts)?
    |-- YES --> Playwright expect: await expect(locator).toBeVisible()
    |-- NO --> Check file type and use appropriate syntax
```

### Mock Strategy Decision

```
How should I mock this dependency?

Is it a store dependency?
|-- YES --> Use mock store factory with partial dependencies
|-- NO --> Is it a module function?
    |-- YES --> Use sandbox.stub(module, "functionName")
    |-- NO --> Is it an external service?
        |-- YES --> Create test implementation class (like TestFirebaseAuth)
        |-- NO --> Use sandbox.stub() with appropriate return value
```

### E2E Test Organization

```
Where should this E2E test live?

Is it testing a specific feature area?
|-- YES --> Create/use feature-specific file (auth.e2e.ts, editor.e2e.ts)
|-- NO --> Is it a cross-cutting flow?
    |-- YES --> Create flow-specific file (onboarding.e2e.ts)
    |-- NO --> Add to relevant existing file
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **MobX**: Use `when()` to await observable conditions in tests
- **React Query**: Clear `queryClient` in `beforeEach` to prevent stale data
- **Sinon**: Primary mocking library with sandbox pattern
- **Chai**: Assertion library with natural language syntax
- **Playwright**: E2E testing with custom fixtures

**Test Commands:**

```bash
# Unit tests
cd apps/webapp
pnpm run test           # Run all unit tests
pnpm run test:watch     # Watch mode

# E2E tests
pnpm run e2e            # Run E2E tests
pnpm run e2e:headed     # Run with browser visible
pnpm run e2e:debug      # Debug mode
pnpm run e2e:ui         # Playwright UI mode
```

**Running Specific Tests:**

```bash
# Unit test by file
pnpm run test -- --grep "AuthStore"

# E2E test by file
pnpm run e2e auth.e2e.ts

# E2E test by test name
pnpm run e2e -g "should redirect"
```

**Replaces / Conflicts with:**

- **Jest/Vitest**: NOT used for webapp unit tests - use Chai assertions
- **React Testing Library**: NOT used for component tests - use Storybook or E2E
- **Cypress**: NOT used - Playwright is the E2E framework

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using Jest/Vitest assertion syntax (`.toBe()`, `.toEqual()`, `.toHaveBeenCalled()`) - tests will fail
- Missing `sandbox.restore()` in `afterEach` - causes test pollution and flaky tests
- Importing `test`/`expect` from `@playwright/test` in E2E files - bypasses custom fixtures
- Missing `queryClient.clear()` for React Query tests - stale cached data causes false positives

**Medium Priority Issues:**

- Direct `sinon.stub()` without sandbox - harder to clean up, potential leaks
- Not using `when()` for MobX conditions - may need arbitrary setTimeout
- Hardcoded test data instead of factories - brittle tests
- Missing `await` for async assertions - tests pass incorrectly
- Not using POM for E2E tests - duplicated selectors, harder to maintain

**Common Mistakes:**

- `expect(value).toBe("x")` instead of `expect(value).to.equal("x")`
- `expect(fn).toHaveBeenCalled()` instead of `expect(fn).to.have.been.called`
- Forgetting to await `when()` for MobX observables
- Not closing browser contexts in E2E fixtures
- Using `page` fixture when `proPage` needed for auth

**Gotchas & Edge Cases:**

- Chai uses `.to.be.true` not `.to.be(true)` - the boolean without parentheses
- `to.have.been.called` not `to.be.called` for sinon-chai spy assertions
- `when()` returns a promise - must be awaited
- Playwright's `expect` is different from Chai's `expect` - check file type
- E2E auth state files must exist before running tests (`./e2e/.auth/pro.json`)
- WASM initialization is async - must complete before engine-related tests

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use Chai assertion syntax - NOT Jest/Vitest syntax (`.toBe()` vs `.to.equal()`))**

**(You MUST use Sinon sandbox with cleanup in `afterEach` - NEVER use `sinon.stub()` directly)**

**(You MUST call `queryClient.clear()` in `beforeEach` for tests using React Query)**

**(You MUST import `test` and `expect` from `fixtures` in E2E tests - NOT from `@playwright/test`)**

**(You MUST use Page Object Model (POM) pattern for E2E test interactions)**

**Failure to follow these rules will cause test failures, flaky tests from pollution, and missing auth fixtures in E2E tests.**

</critical_reminders>
