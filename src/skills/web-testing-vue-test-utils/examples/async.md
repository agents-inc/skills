# Vue Test Utils - Async Examples

> `flushPromises`, `nextTick`, timers and async `setup()`. See [core.md](core.md) for mounting and querying.

> These examples assume the module a component fetches through has been substituted using your test runner's module-mocking API, and refer to the substituted export by its own name (`getUsers`, `fetchData`). `useFakeTimers`, `useRealTimers` and `advanceTimersBy` likewise stand for your runner's fake-timer controls. Arranging that substitution, installing fake timers and advancing them are the runner's concerns; `flushPromises` and the awaits are this skill's.

---

## flushPromises after a request

```typescript
import { mount, flushPromises } from "@vue/test-utils";
import UserList from "./user-list.vue";
import { getUsers } from "./api/users";

const USERS = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

test("shows the loading state before the request settles", () => {
  getUsers.mockResolvedValue(USERS);

  const wrapper = mount(UserList);

  // No flush yet, so the promise is still pending
  expect(wrapper.find('[data-test="loading"]').exists()).toBe(true);
  expect(wrapper.find('[data-test="user"]').exists()).toBe(false);
});

test("shows users once it settles", async () => {
  getUsers.mockResolvedValue(USERS);

  const wrapper = mount(UserList);
  await flushPromises();

  expect(wrapper.find('[data-test="loading"]').exists()).toBe(false);
  expect(wrapper.findAll('[data-test="user"]')).toHaveLength(2);
});

test("shows the error branch on rejection", async () => {
  getUsers.mockRejectedValue(new Error("Failed to load users"));

  const wrapper = mount(UserList);
  await flushPromises();

  expect(wrapper.get('[data-test="error"]').text()).toContain(
    "Failed to load users",
  );
});

test("shows the empty branch for no results", async () => {
  getUsers.mockResolvedValue([]);

  const wrapper = mount(UserList);
  await flushPromises();

  expect(wrapper.find('[data-test="empty"]').exists()).toBe(true);
});
```

**Why good:** all four branches a fetching component has — pending, resolved, rejected, empty — are covered, and the pending one is asserted _before_ the flush, which is the only point at which it exists.

---

## One flush drains parallel requests

```typescript
import { mount, flushPromises } from "@vue/test-utils";
import ProductDetails from "./product-details.vue";
import { getProduct, getReviews, getRelated } from "./api/products";

test("loads product, reviews and related items together", async () => {
  getProduct.mockResolvedValue({ id: 1, name: "Widget", price: 99 });
  getReviews.mockResolvedValue([{ id: 1, rating: 5 }]);
  getRelated.mockResolvedValue([{ id: 2, name: "Gadget" }]);

  const wrapper = mount(ProductDetails, { props: { productId: 1 } });
  await flushPromises(); // drains the whole microtask queue, not one promise

  expect(wrapper.get('[data-test="product"]').text()).toContain("Widget");
  expect(wrapper.findAll('[data-test="review"]')).toHaveLength(1);
  expect(wrapper.findAll('[data-test="related"]')).toHaveLength(1);
});

test("a failing sub-request does not take the page down", async () => {
  getProduct.mockResolvedValue({ id: 1, name: "Widget", price: 99 });
  getReviews.mockRejectedValue(new Error("Reviews unavailable"));
  getRelated.mockResolvedValue([{ id: 2, name: "Gadget" }]);

  const wrapper = mount(ProductDetails, { props: { productId: 1 } });
  await flushPromises();

  expect(wrapper.get('[data-test="product"]').text()).toContain("Widget");
  expect(wrapper.text()).toContain("Reviews unavailable");
});
```

**Why good:** the partial-failure test is the one worth having. A component that renders when everything succeeds is easy; one that keeps the page usable when a secondary request fails is the design decision under test.

---

## Awaiting DOM updates

```typescript
import { mount } from "@vue/test-utils";
import SearchForm from "./search-form.vue";

test("clearing resets the input", async () => {
  const wrapper = mount(SearchForm);

  await wrapper.get('[data-test="search"]').setValue("component testing");
  expect(wrapper.get('[data-test="search"]').element.value).toBe(
    "component testing",
  );

  await wrapper.get('[data-test="clear"]').trigger("click");
  expect(wrapper.get('[data-test="search"]').element.value).toBe("");
});
```

---

## nextTick, and when it is already handled

```typescript
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import Counter from "./counter.vue";

test("a change made outside the wrapper API needs nextTick", async () => {
  const wrapper = mount(Counter);

  wrapper.vm.increment(); // not a wrapper method, so nothing was awaited for us
  await nextTick();

  expect(wrapper.get('[data-test="double"]').text()).toBe("2");
});

test("trigger already includes it", async () => {
  const wrapper = mount(Counter);

  await wrapper.get('[data-test="increment"]').trigger("click");
  // No nextTick needed - the promise trigger() returned already covered it
  expect(wrapper.get('[data-test="count"]').text()).toBe("1");
});
```

**Why this distinction matters:** an explicit `nextTick` after a wrapper method is harmless but signals to the next reader that something subtle is happening when nothing is. Reserve it for state changed outside the wrapper API — which is itself usually a sign the test should be driving the DOM instead.

---

## Timers plus promises

```typescript
import { mount, flushPromises } from "@vue/test-utils";
import AutocompleteSearch from "./autocomplete-search.vue";
import { searchSuggestions } from "./api/search";

const DEBOUNCE_DELAY_MS = 300;

describe("AutocompleteSearch", () => {
  beforeEach(() => useFakeTimers()); // your runner's fake-timer controls
  afterEach(() => useRealTimers());

  test("waits for the debounce before searching", async () => {
    searchSuggestions.mockResolvedValue([{ id: 1, text: "alpha" }]);

    const wrapper = mount(AutocompleteSearch);
    await wrapper.get('[data-test="search-input"]').setValue("al");

    expect(searchSuggestions).not.toHaveBeenCalled();

    advanceTimersBy(DEBOUNCE_DELAY_MS); // fires the debounce callback
    expect(searchSuggestions).toHaveBeenCalledWith("al");

    await flushPromises(); // settles the request the callback started
    expect(wrapper.findAll('[data-test="suggestion"]')).toHaveLength(1);
  });

  test("a second keystroke cancels the first search", async () => {
    searchSuggestions.mockResolvedValue([]);

    const wrapper = mount(AutocompleteSearch);

    await wrapper.get('[data-test="search-input"]').setValue("a");
    advanceTimersBy(DEBOUNCE_DELAY_MS / 2);

    await wrapper.get('[data-test="search-input"]').setValue("alpha");
    advanceTimersBy(DEBOUNCE_DELAY_MS / 2);

    expect(searchSuggestions).not.toHaveBeenCalled(); // neither window completed

    advanceTimersBy(DEBOUNCE_DELAY_MS / 2);

    expect(searchSuggestions).toHaveBeenCalledTimes(1);
    expect(searchSuggestions).toHaveBeenCalledWith("alpha");
  });
});
```

**Why good:** the two queues are advanced separately and in order — timers first to fire the callback, `flushPromises` second to settle what it started. Collapsing them into one `await` is why debounce tests are so often flaky.

---

## Async setup() needs Suspense

```typescript
import { mount, flushPromises } from "@vue/test-utils";
import { Suspense, defineComponent, h, type Component } from "vue";
import AsyncDashboard from "./async-dashboard.vue";

function mountSuspended(
  component: Component,
  props: Record<string, unknown> = {},
) {
  return mount(
    defineComponent({
      render: () =>
        h(Suspense, null, {
          default: () => h(component, props),
          fallback: () =>
            h("div", { "data-test": "fallback" }, "Loading dashboard..."),
        }),
    }),
  );
}

test("renders the fallback first", () => {
  const wrapper = mountSuspended(AsyncDashboard);

  expect(wrapper.get('[data-test="fallback"]').text()).toBe(
    "Loading dashboard...",
  );
});

test("renders the component once setup resolves", async () => {
  const wrapper = mountSuspended(AsyncDashboard);
  await flushPromises();

  expect(wrapper.find('[data-test="fallback"]').exists()).toBe(false);
  expect(wrapper.get('[data-test="stats"]').exists()).toBe(true);
});
```

**Why good:** a component with a top-level `await` in `setup()` mounted on its own never resolves — Vue needs a `Suspense` boundary to hold the pending state. The helper makes that boundary a detail rather than a per-test ritual.

---

## Retry after failure

```typescript
import { mount, flushPromises } from "@vue/test-utils";
import DataLoader from "./data-loader.vue";
import { fetchData } from "./api/data";

test("allows retrying after an error", async () => {
  fetchData
    .mockRejectedValueOnce(new Error("Network error"))
    .mockResolvedValueOnce({ items: ["item1"] });

  const wrapper = mount(DataLoader);
  await flushPromises();

  expect(wrapper.get('[data-test="error"]').text()).toContain("Network error");

  await wrapper.get('[data-test="retry"]').trigger("click");
  await flushPromises();

  expect(wrapper.find('[data-test="error"]').exists()).toBe(false);
  expect(wrapper.get('[data-test="data"]').text()).toContain("item1");
});
```

**Why good:** the `…Once` variants let one test cover the whole recovery path, including the part most often broken — clearing the previous error before the retry renders.

---

_Next: [composables.md](composables.md), or [mocking.md](mocking.md) for the `global` options._
