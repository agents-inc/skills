# Vue Test Utils - Composable Examples

> Testing composables through a component, in isolation, and with injected dependencies. See [core.md](core.md) for mounting and [mocking.md](mocking.md) for the `global` options.

> `useFakeTimers`, `useRealTimers` and `advanceTimersBy` below stand for your test runner's fake-timer controls, and module substitution for its module-mocking API.

---

## Through a component — the default

```typescript
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { useCounter } from "./use-counter";

const CounterHarness = defineComponent({
  setup: () => useCounter(),
  template: `
    <div>
      <span data-test="count">{{ count }}</span>
      <button data-test="increment" @click="increment">+</button>
      <button data-test="decrement" @click="decrement">-</button>
    </div>
  `,
});

describe("useCounter", () => {
  test("starts at zero", () => {
    expect(mount(CounterHarness).get('[data-test="count"]').text()).toBe("0");
  });

  test("increments and decrements", async () => {
    const wrapper = mount(CounterHarness);

    await wrapper.get('[data-test="increment"]').trigger("click");
    await wrapper.get('[data-test="increment"]').trigger("click");
    await wrapper.get('[data-test="decrement"]').trigger("click");

    expect(wrapper.get('[data-test="count"]').text()).toBe("1");
  });
});
```

**Why good:** the harness renders the composable's return value, so the test covers reactivity as well as logic — a `count` that updates but never re-renders fails here and passes any test that reads the ref directly.

---

## In isolation — the withSetup helper

```typescript
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { useLocalStorage } from "./use-local-storage";

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T;

  const wrapper = mount(
    defineComponent({
      setup() {
        result = composable();
        return () => null; // renders nothing; we only want the setup scope
      },
    }),
  );

  return { result, unmount: () => wrapper.unmount() };
}

describe("useLocalStorage", () => {
  beforeEach(() => localStorage.clear());

  test("falls back to the initial value", () => {
    const { result } = withSetup(() => useLocalStorage("draft", "initial"));

    expect(result.value).toBe("initial");
  });

  test("writes through on assignment", () => {
    const { result } = withSetup(() => useLocalStorage("draft", "initial"));

    result.value = "updated";

    expect(localStorage.getItem("draft")).toBe(JSON.stringify("updated"));
  });

  test("reads an existing value", () => {
    localStorage.setItem("draft", JSON.stringify("updated"));

    const { result } = withSetup(() => useLocalStorage("draft", "initial"));

    expect(result.value).toBe("updated");
  });
});
```

**Why good:** the composable runs inside a real component instance, so `onMounted`, `onUnmounted` and `inject` behave as they do in production, while the test still reaches the return value directly. Returning `unmount` is what makes cleanup testable.

---

## Async composables

```typescript
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent } from "vue";
import { useFetch } from "./use-fetch";

// `fetch` is substituted on the global object by the test setup
const FetchHarness = defineComponent({
  props: { url: { type: String, required: true } },
  setup: (props) => useFetch(() => props.url),
  template: `
    <div>
      <span v-if="isLoading" data-test="loading">Loading...</span>
      <span v-if="error" data-test="error">{{ error.message }}</span>
      <span v-if="data" data-test="data">{{ data.name }}</span>
    </div>
  `,
});

describe("useFetch", () => {
  test("loading, then data", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "Test" }),
    });

    const wrapper = mount(FetchHarness, { props: { url: "/api/data" } });
    expect(wrapper.find('[data-test="loading"]').exists()).toBe(true);

    await flushPromises();

    expect(wrapper.find('[data-test="loading"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="data"]').text()).toBe("Test");
  });

  test("surfaces a rejection", async () => {
    fetch.mockRejectedValue(new Error("Network error"));

    const wrapper = mount(FetchHarness, { props: { url: "/api/data" } });
    await flushPromises();

    expect(wrapper.get('[data-test="error"]').text()).toContain(
      "Network error",
    );
  });

  test("refetches when its reactive source changes", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "Test" }),
    });

    const wrapper = mount(FetchHarness, { props: { url: "/api/first" } });
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith("/api/first");

    await wrapper.setProps({ url: "/api/second" });
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith("/api/second");
  });
});
```

**Why good:** the composable takes a getter rather than a value, and the last test is what proves it — passing the url through a prop and changing it covers the watcher that a fixed string would never exercise.

---

## Composables that inject

```typescript
import { mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { useTheme, THEME_KEY } from "./use-theme";

const ThemeHarness = defineComponent({
  setup: () => useTheme(),
  template: `
    <div>
      <span data-test="theme">{{ theme }}</span>
      <button data-test="toggle" @click="toggleTheme">Toggle</button>
    </div>
  `,
});

describe("useTheme", () => {
  test("throws when nothing provided the key", () => {
    expect(() => mount(ThemeHarness)).toThrow("Theme provider not found");
  });

  test("reads what an ancestor provided", () => {
    const wrapper = mount(ThemeHarness, {
      global: {
        provide: {
          [THEME_KEY]: { theme: ref("light"), toggleTheme: () => {} },
        },
      },
    });

    expect(wrapper.get('[data-test="theme"]').text()).toBe("light");
  });

  test("stays reactive through the injected value", async () => {
    const theme = ref("light");
    const toggleTheme = () => {
      theme.value = theme.value === "light" ? "dark" : "light";
    };

    const wrapper = mount(ThemeHarness, {
      global: { provide: { [THEME_KEY]: { theme, toggleTheme } } },
    });

    await wrapper.get('[data-test="toggle"]').trigger("click");

    expect(wrapper.get('[data-test="theme"]').text()).toBe("dark");
  });
});
```

**Why good:** `global.provide` replaces the ancestor without needing one, and the first test covers the guard clause — the error a developer hits when they use the composable in the wrong place, which is the composable's most-used code path in practice.

---

## Calling a composable with no component at all

```typescript
import { nextTick, ref } from "vue";
import { useDebounce } from "./use-debounce";

const DEBOUNCE_DELAY_MS = 300;

describe("useDebounce", () => {
  beforeEach(() => useFakeTimers());
  afterEach(() => useRealTimers());

  test("passes the initial value through immediately", () => {
    const debounced = useDebounce(ref("initial"), DEBOUNCE_DELAY_MS);

    expect(debounced.value).toBe("initial");
  });

  test("delays an update", async () => {
    const source = ref("initial");
    const debounced = useDebounce(source, DEBOUNCE_DELAY_MS);

    source.value = "updated";
    await nextTick();
    expect(debounced.value).toBe("initial");

    advanceTimersBy(DEBOUNCE_DELAY_MS);
    await nextTick();
    expect(debounced.value).toBe("updated");
  });

  test("restarts the window on a new value", async () => {
    const source = ref("initial");
    const debounced = useDebounce(source, DEBOUNCE_DELAY_MS);

    source.value = "first";
    advanceTimersBy(DEBOUNCE_DELAY_MS / 2);
    source.value = "second";
    advanceTimersBy(DEBOUNCE_DELAY_MS / 2);
    await nextTick();

    expect(debounced.value).toBe("initial"); // neither window completed

    advanceTimersBy(DEBOUNCE_DELAY_MS / 2);
    await nextTick();

    expect(debounced.value).toBe("second");
  });
});
```

**Why this is the exception:** no component is mounted, so this works only for a composable that registers no lifecycle hooks and injects nothing. Add either and the call throws, or silently never cleans up — at which point move it to `withSetup` above.

---

_Next: [mocking.md](mocking.md) for the `global` options._
