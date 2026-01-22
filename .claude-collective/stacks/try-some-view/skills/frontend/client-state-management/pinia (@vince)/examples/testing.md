# Pinia - Testing Examples

> Extended examples for testing Pinia stores. See [core.md](core.md) for core patterns.

**Prerequisites**: Understand Pattern 2 (Options Store), Pattern 3 (Setup Store) from core examples first.

---

## Unit Testing Stores

> **Note:** This pattern builds on [Pattern 2: Options Store Definition](core.md#pattern-2-options-store-definition).

### Good Example - Unit Testing Store

```typescript
// stores/__tests__/counter-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
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

**Why good:** Uses `setActivePinia` with fresh Pinia per test, tests both state and getters, named constants for test values

---

## Component Testing with Pinia

### Good Example - Component Testing with Pinia

```typescript
// components/__tests__/counter.test.ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
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

**Why good:** Uses `createTestingPinia` for component tests, shows initialState, stubActions, and custom mocking patterns
