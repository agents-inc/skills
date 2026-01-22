# Vue Test Utils - Testing Composables

> Testing Vue 3 composables in isolation and through components. Reference from [SKILL.md](../SKILL.md).

---

## Testing Composables via Components

The preferred way to test composables is through a component that uses them, which tests the composable in a realistic context.

### Basic Composable Test Through Component

```typescript
// Good Example - Testing composable through component
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { useCounter } from "./use-counter";

const DATA_TEST_COUNT = '[data-test="count"]';
const DATA_TEST_INCREMENT = '[data-test="increment"]';
const DATA_TEST_DECREMENT = '[data-test="decrement"]';

// Test component that uses the composable
const TestComponent = defineComponent({
  setup() {
    const { count, increment, decrement } = useCounter();
    return { count, increment, decrement };
  },
  template: `
    <div>
      <span data-test="count">{{ count }}</span>
      <button data-test="increment" @click="increment">+</button>
      <button data-test="decrement" @click="decrement">-</button>
    </div>
  `,
});

describe("useCounter", () => {
  test("starts at 0 by default", () => {
    const wrapper = mount(TestComponent);

    expect(wrapper.get(DATA_TEST_COUNT).text()).toBe("0");
  });

  test("increments count", async () => {
    const wrapper = mount(TestComponent);

    await wrapper.get(DATA_TEST_INCREMENT).trigger("click");

    expect(wrapper.get(DATA_TEST_COUNT).text()).toBe("1");
  });

  test("decrements count", async () => {
    const wrapper = mount(TestComponent);

    await wrapper.get(DATA_TEST_INCREMENT).trigger("click");
    await wrapper.get(DATA_TEST_INCREMENT).trigger("click");
    await wrapper.get(DATA_TEST_DECREMENT).trigger("click");

    expect(wrapper.get(DATA_TEST_COUNT).text()).toBe("1");
  });
});
```

**Why good:** Tests composable in realistic Vue context, verifies reactivity works correctly, tests through user interactions

---

## Testing Composables in Isolation

For complex composables or library code, test in isolation using a helper function.

### withSetup Helper Pattern

```typescript
// Good Example - Testing composable in isolation
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, type App } from "vue";

// Helper to test composables in isolation
function withSetup<T>(composable: () => T): {
  result: T;
  app: App;
  unmount: () => void;
} {
  let result!: T;

  const TestComponent = defineComponent({
    setup() {
      result = composable();
      return () => null;
    },
  });

  const wrapper = mount(TestComponent);

  return {
    result,
    app: wrapper.vm.$.appContext.app,
    unmount: () => wrapper.unmount(),
  };
}

// Testing useLocalStorage composable
import { useLocalStorage } from "./use-local-storage";

describe("useLocalStorage", () => {
  const STORAGE_KEY = "test-key";
  const INITIAL_VALUE = "initial";
  const NEW_VALUE = "updated";

  beforeEach(() => {
    localStorage.clear();
  });

  test("returns initial value when storage is empty", () => {
    const { result } = withSetup(() =>
      useLocalStorage(STORAGE_KEY, INITIAL_VALUE),
    );

    expect(result.value).toBe(INITIAL_VALUE);
  });

  test("persists value to localStorage", () => {
    const { result } = withSetup(() =>
      useLocalStorage(STORAGE_KEY, INITIAL_VALUE),
    );

    result.value = NEW_VALUE;

    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(NEW_VALUE));
  });

  test("reads existing value from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(NEW_VALUE));

    const { result } = withSetup(() =>
      useLocalStorage(STORAGE_KEY, INITIAL_VALUE),
    );

    expect(result.value).toBe(NEW_VALUE);
  });
});
```

**Why good:** Isolates composable from component, allows testing edge cases, cleans up with unmount

---

### Testing Async Composables

```typescript
// Good Example - Testing async composables
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { vi } from "vitest";
import { useFetch } from "./use-fetch";

const DATA_TEST_DATA = '[data-test="data"]';
const DATA_TEST_LOADING = '[data-test="loading"]';
const DATA_TEST_ERROR = '[data-test="error"]';

const MOCK_URL = "/api/data";
const MOCK_DATA = { name: "Test" };

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const TestComponent = defineComponent({
  props: {
    url: { type: String, required: true },
  },
  setup(props) {
    const { data, isLoading, error } = useFetch(() => props.url);
    return { data, isLoading, error };
  },
  template: `
    <div>
      <span v-if="isLoading" data-test="loading">Loading...</span>
      <span v-if="error" data-test="error">{{ error.message }}</span>
      <span v-if="data" data-test="data">{{ data.name }}</span>
    </div>
  `,
});

describe("useFetch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("shows loading state initially", () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    const wrapper = mount(TestComponent, {
      props: { url: MOCK_URL },
    });

    expect(wrapper.find(DATA_TEST_LOADING).exists()).toBe(true);
  });

  test("displays data after fetch resolves", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    const wrapper = mount(TestComponent, {
      props: { url: MOCK_URL },
    });

    await flushPromises();

    expect(wrapper.find(DATA_TEST_LOADING).exists()).toBe(false);
    expect(wrapper.get(DATA_TEST_DATA).text()).toBe("Test");
  });

  test("displays error on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const wrapper = mount(TestComponent, {
      props: { url: MOCK_URL },
    });

    await flushPromises();

    expect(wrapper.get(DATA_TEST_ERROR).text()).toContain("Network error");
  });

  test("refetches when URL changes", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    const wrapper = mount(TestComponent, {
      props: { url: "/api/first" },
    });

    await flushPromises();
    expect(mockFetch).toHaveBeenCalledWith("/api/first");

    await wrapper.setProps({ url: "/api/second" });
    await flushPromises();

    expect(mockFetch).toHaveBeenCalledWith("/api/second");
  });
});
```

**Why good:** Tests all states (loading, success, error), tests reactivity to prop changes, uses flushPromises for async

---

## Testing Composables with Dependencies

### Composables that Use Provide/Inject

```typescript
// Good Example - Testing composables with inject
import { mount } from "@vue/test-utils";
import { defineComponent, provide, inject, ref } from "vue";
import { useTheme, THEME_KEY } from "./use-theme";

const DATA_TEST_THEME = '[data-test="theme"]';
const DATA_TEST_TOGGLE = '[data-test="toggle"]';

// Composable that uses inject
// use-theme.ts:
// export const THEME_KEY = Symbol('theme')
// export function useTheme() {
//   const theme = inject(THEME_KEY)
//   if (!theme) throw new Error('Theme provider not found')
//   return theme
// }

const TestComponent = defineComponent({
  setup() {
    const { theme, toggleTheme } = useTheme();
    return { theme, toggleTheme };
  },
  template: `
    <div>
      <span data-test="theme">{{ theme }}</span>
      <button data-test="toggle" @click="toggleTheme">Toggle</button>
    </div>
  `,
});

describe("useTheme", () => {
  test("throws without provider", () => {
    expect(() => mount(TestComponent)).toThrow("Theme provider not found");
  });

  test("works with provider", () => {
    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          [THEME_KEY]: {
            theme: ref("light"),
            toggleTheme: vi.fn(),
          },
        },
      },
    });

    expect(wrapper.get(DATA_TEST_THEME).text()).toBe("light");
  });

  test("toggles theme", async () => {
    const theme = ref("light");
    const toggleTheme = () => {
      theme.value = theme.value === "light" ? "dark" : "light";
    };

    const wrapper = mount(TestComponent, {
      global: {
        provide: {
          [THEME_KEY]: { theme, toggleTheme },
        },
      },
    });

    await wrapper.get(DATA_TEST_TOGGLE).trigger("click");

    expect(wrapper.get(DATA_TEST_THEME).text()).toBe("dark");
  });
});
```

**Why good:** Tests error case without provider, uses global.provide to inject dependencies

---

### Composables with Pinia Stores

```typescript
// Good Example - Testing composables that use Pinia
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent } from "vue";
import { createTestingPinia } from "@pinia/testing";
import { useUserProfile } from "./use-user-profile";
import { useAuthStore } from "@/stores/auth";

const DATA_TEST_NAME = '[data-test="name"]';
const DATA_TEST_STATUS = '[data-test="status"]';

// Composable that uses Pinia store
// use-user-profile.ts:
// export function useUserProfile() {
//   const authStore = useAuthStore()
//   const displayName = computed(() => authStore.user?.name ?? 'Guest')
//   return { displayName, isAuthenticated: computed(() => authStore.isAuthenticated) }
// }

const TestComponent = defineComponent({
  setup() {
    const { displayName, isAuthenticated } = useUserProfile();
    return { displayName, isAuthenticated };
  },
  template: `
    <div>
      <span data-test="name">{{ displayName }}</span>
      <span data-test="status">{{ isAuthenticated ? 'Logged in' : 'Guest' }}</span>
    </div>
  `,
});

describe("useUserProfile", () => {
  test("shows Guest when not authenticated", () => {
    const wrapper = mount(TestComponent, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              auth: { user: null, isAuthenticated: false },
            },
          }),
        ],
      },
    });

    expect(wrapper.get(DATA_TEST_NAME).text()).toBe("Guest");
    expect(wrapper.get(DATA_TEST_STATUS).text()).toBe("Guest");
  });

  test("shows user name when authenticated", () => {
    const wrapper = mount(TestComponent, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              auth: {
                user: { id: 1, name: "John Doe" },
                isAuthenticated: true,
              },
            },
          }),
        ],
      },
    });

    expect(wrapper.get(DATA_TEST_NAME).text()).toBe("John Doe");
    expect(wrapper.get(DATA_TEST_STATUS).text()).toBe("Logged in");
  });

  test("updates when store changes", async () => {
    const wrapper = mount(TestComponent, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              auth: { user: null, isAuthenticated: false },
            },
          }),
        ],
      },
    });

    expect(wrapper.get(DATA_TEST_NAME).text()).toBe("Guest");

    // Update store directly
    const authStore = useAuthStore();
    authStore.user = { id: 1, name: "Jane" };
    authStore.isAuthenticated = true;

    // Wait for reactivity
    await flushPromises();

    expect(wrapper.get(DATA_TEST_NAME).text()).toBe("Jane");
  });
});
```

**Why good:** Uses createTestingPinia for store mocking, tests reactivity when store changes, tests multiple auth states

---

## Testing Composable Return Values Directly

### For Library Composables

```typescript
// Good Example - Direct composable testing for libraries
import { nextTick, ref } from "vue";
import { useDebounce } from "./use-debounce";
import { vi } from "vitest";

const DEBOUNCE_DELAY_MS = 300;

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns initial value immediately", () => {
    const source = ref("initial");
    const debounced = useDebounce(source, DEBOUNCE_DELAY_MS);

    expect(debounced.value).toBe("initial");
  });

  test("debounces value updates", async () => {
    const source = ref("initial");
    const debounced = useDebounce(source, DEBOUNCE_DELAY_MS);

    source.value = "updated";
    await nextTick();

    // Not updated yet
    expect(debounced.value).toBe("initial");

    vi.advanceTimersByTime(DEBOUNCE_DELAY_MS);
    await nextTick();

    // Now updated
    expect(debounced.value).toBe("updated");
  });

  test("cancels pending update on new value", async () => {
    const source = ref("initial");
    const debounced = useDebounce(source, DEBOUNCE_DELAY_MS);

    source.value = "first";
    vi.advanceTimersByTime(DEBOUNCE_DELAY_MS / 2);

    source.value = "second";
    vi.advanceTimersByTime(DEBOUNCE_DELAY_MS / 2);
    await nextTick();

    // Still initial - neither debounce completed
    expect(debounced.value).toBe("initial");

    vi.advanceTimersByTime(DEBOUNCE_DELAY_MS / 2);
    await nextTick();

    // Only "second" applied
    expect(debounced.value).toBe("second");
  });
});
```

**Why good:** Tests composable directly for library use cases, uses fake timers for time-based behavior, tests edge cases

---

_For more patterns, see:_

- [core.md](core.md) - Mounting and querying
- [async.md](async.md) - Async testing patterns
- [mocking.md](mocking.md) - Pinia stores, Vue Router, stubs
