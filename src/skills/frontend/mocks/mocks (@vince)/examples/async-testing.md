# Async Testing Patterns

> MobX when() for async state assertions and NotificationsStore mocking for user feedback verification. Reference from [SKILL.md](../SKILL.md).

**Related examples:**
- [core.md](core.md) - Dependency injection, Sinon sandbox, mock store factories
- [firebase-auth.md](firebase-auth.md) - TestFirebaseAuth implementation and usage
- [analytics-mocking.md](analytics-mocking.md) - ampliMock for analytics testing
- [complete-example.md](complete-example.md) - Full AuthStore test reference

---

## MobX when() for Async Assertions

### Correct Async Testing

```typescript
// Good Example
import { when } from "mobx";

describe("TeamsStore", () => {
  it("should load teams", async () => {
    const fetchTeams = sandbox.stub().resolves([
      { id: "team-1", name: "Team One" },
      { id: "team-2", name: "Team Two" },
    ]);
    const teamsStore = makeTestTeamsStore({ fetchTeams });

    // Start loading
    teamsStore.loadTeams();
    expect(teamsStore.isLoading).to.be.true;

    // Wait for loading to complete using when()
    await when(() => !teamsStore.isLoading);

    expect(teamsStore.teams).to.have.length(2);
    expect(teamsStore.teams[0]?.name).to.equal("Team One");
  });

  it("should handle error state", async () => {
    const fetchTeams = sandbox.stub().rejects(new Error("Network error"));
    const teamsStore = makeTestTeamsStore({ fetchTeams });

    teamsStore.loadTeams();

    // Wait for error state
    await when(() => teamsStore.error !== null);

    expect(teamsStore.error).to.equal("Network error");
    expect(teamsStore.isLoading).to.be.false;
  });

  it("should wait with timeout", async () => {
    const teamsStore = makeTestTeamsStore({
      fetchTeams: () => new Promise((resolve) => setTimeout(resolve, 5000)),
    });

    teamsStore.loadTeams();

    // when() with timeout option
    try {
      await when(() => !teamsStore.isLoading, { timeout: 100 });
      expect.fail("Should have timed out");
    } catch (error) {
      expect(error.message).to.include("WHEN_TIMEOUT");
    }
  });
});
```

**Why good:** when() waits for exact observable condition, no arbitrary delays or flaky timing, timeout option catches stuck states, works naturally with MobX reactivity

### Bad Examples

```typescript
// Bad Example - Using setTimeout
it("should load teams", async () => {
  teamsStore.loadTeams();

  // BAD: Arbitrary delay - flaky!
  await new Promise((r) => setTimeout(r, 100));

  expect(teamsStore.teams).to.have.length(2); // May fail if load takes > 100ms
});

// Bad Example - Polling with setInterval
it("should load teams", async () => {
  teamsStore.loadTeams();

  // BAD: Polling - wasteful and still flaky
  await new Promise((resolve) => {
    const interval = setInterval(() => {
      if (!teamsStore.isLoading) {
        clearInterval(interval);
        resolve();
      }
    }, 10);
  });
});

// Bad Example - Missing async/await
it("should load teams", () => {
  teamsStore.loadTeams();
  when(() => !teamsStore.isLoading); // Missing await - test passes immediately!
  expect(teamsStore.teams).to.have.length(0); // Wrong assertion passes
});
```

**Why bad:** setTimeout-based waits are flaky and slow (must wait worst-case time), polling is wasteful and still subject to timing issues, missing await causes test to pass before async operation completes

---

## NotificationsStore Mocking

### Implementation

```typescript
// Good Example
import { NotificationsStore } from "@photoroom/ui/src/components/status/Notification/NotificationsStore";

describe("ExportStore", () => {
  it("should show success notification", async () => {
    const notificationsStore = new NotificationsStore({
      defaultDuration: 3000,
      maxNotifications: 5,
    });
    const exportStore = makeTestExportStore({ notificationsStore });

    await exportStore.exportImage();

    expect(notificationsStore.notifications).to.have.length(1);
    expect(notificationsStore.notifications[0]?.type).to.equal("success");
    expect(notificationsStore.notifications[0]?.label).to.include("export");
  });

  it("should show error notification on failure", async () => {
    const notificationsStore = new NotificationsStore({
      defaultDuration: 3000,
      maxNotifications: 5,
    });
    const exportStore = makeTestExportStore({
      notificationsStore,
      exportApi: sandbox.stub().rejects(new Error("Export failed")),
    });

    await exportStore.exportImage();

    expect(notificationsStore.notifications).to.have.length(1);
    expect(notificationsStore.notifications[0]?.type).to.equal("danger");
  });
});
```

**Why good:** Fresh NotificationsStore per test prevents notification leakage, can verify notification type, label, and count, tests user feedback not just internal state

### Bad Examples

```typescript
// Bad Example - Using shared notification store
const sharedNotifications = new NotificationsStore({ ... });

it("test 1", async () => {
  await store1.action();
  expect(sharedNotifications.notifications).to.have.length(1);
});

it("test 2", async () => {
  await store2.action();
  // BUG: Has 2 notifications (1 from test 1 + 1 from test 2)!
  expect(sharedNotifications.notifications).to.have.length(1); // Fails
});

// Bad Example - Not verifying notifications
it("should handle error", async () => {
  await store.failingAction();
  expect(store.error).to.exist;
  // Missing: Did user get feedback about the error?
});
```

**Why bad:** Shared notification store accumulates notifications across tests, not verifying notifications means users might see silent failures in production
