# Analytics Mocking (ampliMock)

> Pattern for mocking Amplitude analytics in tests - captures events for verification. Reference from [SKILL.md](../SKILL.md).

**Related examples:**
- [core.md](core.md) - Dependency injection, Sinon sandbox, mock store factories
- [firebase-auth.md](firebase-auth.md) - TestFirebaseAuth implementation and usage
- [async-testing.md](async-testing.md) - MobX when() and NotificationsStore mocking
- [complete-example.md](complete-example.md) - Full AuthStore test reference

---

## ampliMock Implementation

```typescript
// src/tests/mocks/ampliMock.ts
// Good Example
import type { Ampli } from "@photoroom/shared";

type EventCall = {
  name: string;
  properties?: Record<string, unknown>;
};

export const createAmpliMock = (): Ampli & {
  getCalls: () => EventCall[];
  reset: () => void;
} => {
  const calls: EventCall[] = [];

  return {
    // Common event methods
    track: (name: string, properties?: Record<string, unknown>) => {
      calls.push({ name, properties });
    },

    identify: (userId: string, properties?: Record<string, unknown>) => {
      calls.push({ name: "identify", properties: { userId, ...properties } });
    },

    // Add other Ampli methods as needed...

    // Test helpers
    getCalls: () => [...calls],
    reset: () => {
      calls.length = 0;
    },
  } as Ampli & { getCalls: () => EventCall[]; reset: () => void };
};

// Default singleton for simple cases
export const ampliMock = createAmpliMock();
```

---

## Usage in Tests

```typescript
// Good Example
describe("UserStore", () => {
  const sandbox = sinon.createSandbox();
  let ampli: ReturnType<typeof createAmpliMock>;

  beforeEach(() => {
    ampli = createAmpliMock();
  });

  afterEach(() => {
    sandbox.restore();
    ampli.reset();
  });

  it("should track sign up event", async () => {
    const userStore = makeTestUserStore({ ampli });

    await userStore.signUp({ email: "test@example.com" });

    const calls = ampli.getCalls();
    expect(calls).to.have.length(1);
    expect(calls[0].name).to.equal("user_signed_up");
    expect(calls[0].properties).to.deep.equal({
      email: "test@example.com",
      method: "email",
    });
  });

  it("should track multiple events in order", async () => {
    const userStore = makeTestUserStore({ ampli });

    await userStore.completeOnboarding();

    const calls = ampli.getCalls();
    expect(calls.map((c) => c.name)).to.deep.equal([
      "onboarding_started",
      "onboarding_step_completed",
      "onboarding_finished",
    ]);
  });
});
```

**Why good:** ampliMock captures event calls for verification, getCalls() returns copy preventing mutation, reset() in afterEach ensures clean state, verifies event order and properties

---

## Bad Examples

```typescript
// Bad Example - Not verifying analytics
it("should sign up user", async () => {
  const userStore = makeTestUserStore({ ampli: ampliMock });
  await userStore.signUp({ email: "test@example.com" });
  expect(userStore.isSignedUp).to.be.true;
  // Missing: analytics verification!
});

// Bad Example - Not resetting between tests
it("test 1", async () => {
  await store.action1();
  expect(ampliMock.getCalls()).to.have.length(1);
});

it("test 2", async () => {
  await store.action2();
  // BUG: getCalls() returns 2 because test 1's call is still there!
  expect(ampliMock.getCalls()).to.have.length(1); // Fails!
});
```

**Why bad:** Skipping analytics verification misses tracking bugs that break product metrics, not resetting mock between tests causes false positives/negatives
