# Pinia - Testing Examples

> Extended examples for testing Pinia stores. See [core.md](core.md) for core patterns.

**Prerequisites**: Understand Pattern 2 (Options Store), Pattern 3 (Setup Store) from core examples first.

---

## Unit Testing Stores

> **Note:** This pattern builds on [Pattern 2: Options Store Definition](core.md#pattern-2-options-store-definition).

### Good Example - Unit Testing Store

```typescript
// stores/__tests__/counter-store.test.ts
// Use your test runner's describe/it/expect
import { setActivePinia, createPinia } from "pinia";
import { useCounterStore } from "../counter-store";

const INITIAL_COUNT = 0;
const TEST_INCREMENT_VALUE = 5;

describe("Counter Store", () => {
  beforeEach(() => {
    // Create fresh Pinia for each test
    setActivePinia(createPinia());
  });

  it("initializes with default values", () => {
    const store = useCounterStore();

    expect(store.count).toBe(INITIAL_COUNT);
    expect(store.doubleCount).toBe(INITIAL_COUNT * 2);
  });

  it("increments count", () => {
    const store = useCounterStore();

    store.increment();

    expect(store.count).toBe(1);
    expect(store.doubleCount).toBe(2);
  });

  it("sets count to specific value", () => {
    const store = useCounterStore();

    store.setCount(TEST_INCREMENT_VALUE);

    expect(store.count).toBe(TEST_INCREMENT_VALUE);
  });

  it("resets state", () => {
    const store = useCounterStore();
    store.setCount(TEST_INCREMENT_VALUE);

    store.$reset();

    expect(store.count).toBe(INITIAL_COUNT);
  });
});
```

**Why good:** `setActivePinia` is what lets `useCounterStore()` resolve with no component mounted, and a fresh Pinia in `beforeEach` means no case inherits the state another left behind. Getters are asserted alongside state, since a getter reading a stale `state` is the failure this catches.

---

## Component Testing with Pinia

### Good Example - Component Testing with Pinia

```typescript
// components/__tests__/counter.test.ts
// Use your test runner's describe/it/expect/vi
// Use your component mounting utility (e.g. mount from Vue Test Utils)
import { createTestingPinia } from "@pinia/testing";
import Counter from "../Counter.vue";
import { useCounterStore } from "@/stores/counter-store";

const INITIAL_COUNT = 10;

describe("Counter Component", () => {
  it("displays current count", () => {
    const wrapper = mount(Counter, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              counter: { count: INITIAL_COUNT },
            },
          }),
        ],
      },
    });

    expect(wrapper.text()).toContain(INITIAL_COUNT.toString());
  });

  it("calls increment action when button clicked", async () => {
    const wrapper = mount(Counter, {
      global: {
        plugins: [
          createTestingPinia({
            stubActions: false, // Execute real actions
          }),
        ],
      },
    });

    const store = useCounterStore();

    await wrapper.find("button").trigger("click");

    expect(store.increment).toHaveBeenCalledTimes(1);
  });

  it("mocks action implementation", async () => {
    const wrapper = mount(Counter, {
      global: {
        plugins: [createTestingPinia()],
      },
    });

    const store = useCounterStore();
    // Actions are stubbed by default - provide custom implementation
    store.increment = vi.fn().mockImplementation(() => {
      store.count = 999;
    });

    await wrapper.find("button").trigger("click");

    expect(store.count).toBe(999);
  });
});
```

**Why good:** `createTestingPinia` activates itself, so no `setActivePinia` is needed and `useCounterStore()` inside the test returns the same store the component got. `initialState` is keyed by store id and merged over the declared state, so a test names only the fields the case is about.

### What createTestingPinia changes

**Actions are replaced by spies and do not run.** This is the default and the source of most surprises: the button is clicked, the spy records it, and the state never moves. Three ways forward, depending on what the test is about:

- Asserting the component asked for something — keep the default and assert on the spy.
- Asserting what the component shows afterwards — `stubActions: false` runs the real action. The spies are still in place, so a call count is still assertable; running and spying are not exclusive.
- Needing a specific outcome — assign an implementation, as the third test above does.

**Name the spy factory where the runner is not detected.** `@pinia/testing` wraps actions using the test runner's own spy function, which it discovers from the environment. Where that discovery does not happen, pass it explicitly — the symptom otherwise is an action that will not accept a call assertion:

```typescript
createTestingPinia({ createSpy: vi.fn });
```

**Getters ignore `initialState`.** It seeds state only, and a getter derives from that state — so a getter is steered by setting the state it reads. Forcing a value directly works on an Options store's getter but not on a Setup store's, where the getter is a read-only `computed`.
