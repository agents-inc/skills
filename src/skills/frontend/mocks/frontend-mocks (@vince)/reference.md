# Mocking Reference (Photoroom Webapp)

> Decision frameworks, red flags, and anti-patterns for frontend mocking. Reference from [SKILL.md](SKILL.md).

---

## Decision Framework

### What to Mock

```
What am I testing?
|
+-- External service (Firebase, Analytics)?
|   |
|   +-- Use dedicated test double (TestFirebaseAuth, ampliMock)
|
+-- API call?
|   |
|   +-- Inject mock function via factory
|   |   sandbox.stub().resolves({ ... })
|
+-- Store dependency?
|   |
|   +-- Create via factory, provide partial overrides
|
+-- Side effect (notifications, logging)?
    |
    +-- Create fresh instance per test
    +-- Verify calls/state after action
```

### Async Assertion Strategy

```
Waiting for async behavior?
|
+-- Is it MobX observable state?
|   |
|   +-- YES --> Use when(() => condition)
|   |
|   +-- NO --> Is it a Promise?
|       |
|       +-- YES --> await the Promise directly
|       |
|       +-- NO --> Is it a callback?
|           |
|           +-- Use sinon.stub().callsFake()
```

### Stub vs Spy vs Mock

```
What behavior do I need?
|
+-- Replace implementation entirely?
|   |
|   +-- sandbox.stub().resolves({ ... })
|
+-- Track calls but keep original?
|   |
|   +-- sandbox.spy(object, "method")
|
+-- Verify specific call pattern?
    |
    +-- sandbox.stub() with expect().to.have.been.calledWith()
```

### Test Isolation

```
Creating test instance?
|
+-- Is it a store?
|   |
|   +-- Use factory function with partial dependencies
|   +-- Create fresh instance in each test
|
+-- Is it a mock?
|   |
|   +-- Create in beforeEach or inside test
|   +-- Reset/restore in afterEach
|
+-- Is it a stub?
    |
    +-- Create via sandbox.stub()
    +-- sandbox.restore() handles cleanup
```

---

## Anti-Patterns

### Missing Sandbox Cleanup

Stubs created without sandbox cleanup leak to other tests, causing flaky failures that are difficult to diagnose.

```typescript
// ❌ Anti-pattern
describe("MyStore", () => {
  it("test one", () => {
    sinon.stub(api, "fetch").resolves({ data: "test" });
    // No restore - stub persists!
  });

  it("test two", () => {
    // api.fetch still stubbed from test one!
    // Test may pass or fail depending on execution order
  });
});
```

**Correct approach:** Create sandbox at describe scope, call sandbox.restore() in afterEach.

---

### setTimeout-Based Async Assertions

Using arbitrary timeouts for async assertions creates flaky tests that pass locally but fail in CI, or vice versa.

```typescript
// ❌ Anti-pattern
it("should load data", async () => {
  store.loadData();
  await new Promise((r) => setTimeout(r, 100)); // Arbitrary delay
  expect(store.data).to.exist; // May fail if load takes > 100ms
});
```

**Correct approach:** Use MobX `when()` to wait for observable conditions.

---

### Shared Store Instances

Reusing store instances between tests causes state leakage and order-dependent test failures.

```typescript
// ❌ Anti-pattern
const sharedStore = makeTestStore(); // Created once

it("test 1", () => {
  sharedStore.setValue("a");
  expect(sharedStore.value).to.equal("a");
});

it("test 2", () => {
  // sharedStore still has "a" from test 1!
  expect(sharedStore.value).to.be.undefined; // Fails
});
```

**Correct approach:** Create fresh store instances within each test using factory functions.

---

### Direct Firebase SDK Mocking

Stubbing Firebase SDK internals is fragile, incomplete, and requires deep knowledge of Firebase implementation details.

```typescript
// ❌ Anti-pattern
sandbox.stub(firebase.auth(), "onAuthStateChanged").callsFake((cb) => {
  cb({ uid: "123" }); // Incomplete user object
  return () => {};
});
```

**Correct approach:** Use TestFirebaseAuth test double that implements the same interface.

---

### Jest Syntax in Karma/Mocha Tests

Using Jest assertion syntax (toBe, toEqual, jest.fn()) in a Karma/Mocha/Chai environment causes compilation errors.

```typescript
// ❌ Anti-pattern
expect(value).toBe(5); // Jest syntax
expect(array).toEqual([1, 2]); // Jest syntax
const mock = jest.fn(); // Jest mocking
```

**Correct approach:** Use Chai assertions (to.equal, to.deep.equal) and Sinon for mocking.

---

### Missing await with when()

Forgetting to await MobX `when()` causes tests to pass before async operations complete, leading to false positives.

```typescript
// ❌ Anti-pattern
it("should load", () => {
  store.loadData();
  when(() => store.isLoaded); // Missing await!
  expect(store.data).to.exist; // Runs immediately, likely fails
});
```

**Correct approach:** Always await when() calls.

---

## RED FLAGS

**High Priority Issues:**

- Missing sandbox.restore() in afterEach - stubs leak to other tests causing flaky failures
- Using setTimeout for async assertions - flaky tests that pass/fail randomly
- Missing await with when() - test passes before async operation completes
- Jest assertion syntax (toBe, toEqual) - wrong test framework, tests won't compile

**Medium Priority Issues:**

- Shared store instances between tests - state leakage causes order-dependent tests
- Not resetting ampliMock between tests - event counts accumulate incorrectly
- Not verifying notifications in error paths - silent failures in production
- Direct Firebase SDK stubbing - fragile, incomplete mocks

**Common Mistakes:**

- Forgetting to await async store methods before assertions
- Not providing all required dependencies to factory (check for undefined errors)
- Using regular methods instead of arrow functions in test stores
- Not cleaning up MobxQuery in store dispose (memory leaks in tests)

**Gotchas & Edge Cases:**

- TestFirebaseAuth fires onAuthStateChanged async - first callback is delayed via setTimeout(0)
- when() with timeout throws error, must wrap in try/catch
- Sinon stubs on class methods need the class instance, not prototype
- NotificationsStore maxNotifications affects test assertions
- ampliMock.getCalls() returns copy - safe to filter/map without mutation

---

## Quick Reference

### Common Test Imports

```typescript
import sinon from "sinon";
import { expect } from "chai";
import { when } from "mobx";
```

### Sandbox Setup Pattern

```typescript
describe("MyStore", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  // Tests...
});
```

### Factory Pattern

```typescript
const makeTestStore = (partial: Partial<Dependencies> = {}): Store => {
  return new Store({
    dependency1: partial.dependency1 ?? defaultValue1,
    dependency2: partial.dependency2 ?? defaultValue2,
  });
};
```

### Async Wait Pattern

```typescript
// Wait for loading to complete
await when(() => !store.isLoading);

// Wait for specific value
await when(() => store.value === expectedValue);

// Wait with timeout
await when(() => condition, { timeout: 1000 });
```

### Assertion Syntax (Chai)

```typescript
// Equality
expect(value).to.equal(5);
expect(array).to.deep.equal([1, 2, 3]);

// Boolean
expect(value).to.be.true;
expect(value).to.be.false;

// Existence
expect(value).to.exist;
expect(value).to.be.null;
expect(value).to.be.undefined;

// Arrays
expect(array).to.have.length(3);
expect(array).to.include("item");

// Sinon assertions
expect(stub).to.have.been.calledOnce;
expect(stub).to.have.been.calledWith("arg1", "arg2");
```
