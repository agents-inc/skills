# Testing Examples - Core

> Essential Karma + Mocha + Chai patterns. Reference from [SKILL.md](../SKILL.md).

**Extended examples:**
- [mock-stores.md](mock-stores.md) - Mock store factories, test setup with WASM/QueryClient
- [playwright-config.md](playwright-config.md) - Playwright E2E configuration, auth fixtures
- [page-objects.md](page-objects.md) - E2E test structure, Page Object Model

---

## Pattern 1: Chai Assertion Syntax

### Chai vs Jest/Vitest Syntax Reference

```typescript
// Good Example - Chai syntax (used in webapp)
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
// Bad Example - Jest/Vitest syntax (NOT used in webapp)
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

## Pattern 2: Sinon Sandbox with Cleanup

### Sandbox Pattern

```typescript
// Good Example - Sinon sandbox with cleanup
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
// Bad Example - Direct sinon.stub without cleanup
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

_Extended examples: [mock-stores.md](mock-stores.md) | [playwright-config.md](playwright-config.md) | [page-objects.md](page-objects.md)_
