# Vue Test Utils - Async Testing Examples

> flushPromises, nextTick, and async setup patterns. Reference from [SKILL.md](../SKILL.md).

---

## Using flushPromises

### Basic API Call Testing

```typescript
// Good Example - Testing components with API calls
import { mount, flushPromises } from "@vue/test-utils";
import { UserList } from "./user-list.vue";
import { vi } from "vitest";

const DATA_TEST_LOADING = '[data-test="loading"]';
const DATA_TEST_USER = '[data-test="user"]';
const DATA_TEST_ERROR = '[data-test="error"]';
const DATA_TEST_EMPTY = '[data-test="empty"]';

const MOCK_USERS = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

// Mock the API module
vi.mock("@/api/users", () => ({
  getUsers: vi.fn(),
}));

import { getUsers } from "@/api/users";

beforeEach(() => {
  vi.clearAllMocks();
});

test("displays loading state initially", () => {
  vi.mocked(getUsers).mockResolvedValue(MOCK_USERS);

  const wrapper = mount(UserList);

  // Loading shows before API resolves
  expect(wrapper.find(DATA_TEST_LOADING).exists()).toBe(true);
  expect(wrapper.find(DATA_TEST_USER).exists()).toBe(false);
});

test("displays users after API resolves", async () => {
  vi.mocked(getUsers).mockResolvedValue(MOCK_USERS);

  const wrapper = mount(UserList);

  // Wait for API call to resolve
  await flushPromises();

  // Loading hidden, users displayed
  expect(wrapper.find(DATA_TEST_LOADING).exists()).toBe(false);
  expect(wrapper.findAll(DATA_TEST_USER)).toHaveLength(MOCK_USERS.length);
});

test("displays error on API failure", async () => {
  const ERROR_MESSAGE = "Failed to load users";
  vi.mocked(getUsers).mockRejectedValue(new Error(ERROR_MESSAGE));

  const wrapper = mount(UserList);

  await flushPromises();

  expect(wrapper.get(DATA_TEST_ERROR).text()).toContain(ERROR_MESSAGE);
});

test("displays empty state when no users", async () => {
  vi.mocked(getUsers).mockResolvedValue([]);

  const wrapper = mount(UserList);

  await flushPromises();

  expect(wrapper.find(DATA_TEST_EMPTY).exists()).toBe(true);
});
```

**Why good:** Mocks at module level, uses flushPromises() after mounting, tests all states (loading, success, error, empty)

---

### Testing Multiple Sequential API Calls

```typescript
// Good Example - Multiple async operations
import { mount, flushPromises } from "@vue/test-utils";
import { ProductDetails } from "./product-details.vue";
import { vi } from "vitest";

const DATA_TEST_PRODUCT = '[data-test="product"]';
const DATA_TEST_REVIEWS = '[data-test="reviews"]';
const DATA_TEST_RELATED = '[data-test="related"]';

vi.mock("@/api/products", () => ({
  getProduct: vi.fn(),
  getReviews: vi.fn(),
  getRelatedProducts: vi.fn(),
}));

import { getProduct, getReviews, getRelatedProducts } from "@/api/products";

const MOCK_PRODUCT = { id: 1, name: "Widget", price: 99 };
const MOCK_REVIEWS = [{ id: 1, rating: 5, text: "Great!" }];
const MOCK_RELATED = [{ id: 2, name: "Gadget" }];

test("loads product with reviews and related items", async () => {
  vi.mocked(getProduct).mockResolvedValue(MOCK_PRODUCT);
  vi.mocked(getReviews).mockResolvedValue(MOCK_REVIEWS);
  vi.mocked(getRelatedProducts).mockResolvedValue(MOCK_RELATED);

  const wrapper = mount(ProductDetails, {
    props: { productId: 1 },
  });

  // Single flushPromises resolves all parallel requests
  await flushPromises();

  expect(wrapper.get(DATA_TEST_PRODUCT).text()).toContain("Widget");
  expect(wrapper.findAll(DATA_TEST_REVIEWS)).toHaveLength(1);
  expect(wrapper.findAll(DATA_TEST_RELATED)).toHaveLength(1);
});

test("handles partial failure gracefully", async () => {
  vi.mocked(getProduct).mockResolvedValue(MOCK_PRODUCT);
  vi.mocked(getReviews).mockRejectedValue(new Error("Reviews unavailable"));
  vi.mocked(getRelatedProducts).mockResolvedValue(MOCK_RELATED);

  const wrapper = mount(ProductDetails, {
    props: { productId: 1 },
  });

  await flushPromises();

  // Product still displays despite reviews failure
  expect(wrapper.get(DATA_TEST_PRODUCT).text()).toContain("Widget");
  expect(wrapper.text()).toContain("Reviews unavailable");
});
```

**Why good:** Tests parallel API calls, single flushPromises() handles all, tests partial failure scenarios

---

## Awaiting DOM Updates

### trigger() and setValue() Return Promises

```typescript
// Good Example - Chained async interactions
import { mount } from "@vue/test-utils";
import { SearchForm } from "./search-form.vue";

const DATA_TEST_INPUT = '[data-test="search"]';
const DATA_TEST_CLEAR = '[data-test="clear"]';
const DATA_TEST_SUBMIT = '[data-test="submit"]';
const DATA_TEST_RESULTS = '[data-test="results"]';

const SEARCH_TERM = "vue testing";

test("search flow with multiple interactions", async () => {
  const wrapper = mount(SearchForm);

  // Each method returns a Promise - await each
  await wrapper.get(DATA_TEST_INPUT).setValue(SEARCH_TERM);
  await wrapper.get(DATA_TEST_SUBMIT).trigger("click");

  // Verify search was performed
  expect(wrapper.emitted("search")![0][0]).toBe(SEARCH_TERM);
});

test("clear resets input value", async () => {
  const wrapper = mount(SearchForm);

  await wrapper.get(DATA_TEST_INPUT).setValue(SEARCH_TERM);
  expect(wrapper.get(DATA_TEST_INPUT).element.value).toBe(SEARCH_TERM);

  await wrapper.get(DATA_TEST_CLEAR).trigger("click");
  expect(wrapper.get(DATA_TEST_INPUT).element.value).toBe("");
});
```

**Why good:** Each await ensures DOM is updated before next interaction, tests verify intermediate states

---

### Using nextTick for Reactive Updates

```typescript
// Good Example - When to use nextTick vs flushPromises
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import { Counter } from "./counter.vue";

const DATA_TEST_COUNT = '[data-test="count"]';
const DATA_TEST_DOUBLE = '[data-test="double"]';

test("computed value updates reactively", async () => {
  const wrapper = mount(Counter);

  // Direct state manipulation (via exposed method)
  await wrapper.vm.increment();

  // nextTick ensures Vue processes the reactive update
  await nextTick();

  // Computed 'double' should update
  expect(wrapper.get(DATA_TEST_DOUBLE).text()).toBe("2");
});

// Note: Usually trigger() handles nextTick internally
test("trigger handles nextTick automatically", async () => {
  const wrapper = mount(Counter);

  // trigger() returns Promise that includes nextTick
  await wrapper.get('[data-test="increment"]').trigger("click");

  // No need for explicit nextTick
  expect(wrapper.get(DATA_TEST_COUNT).text()).toBe("1");
});
```

**Why good:** Shows when nextTick is needed (manual state changes) vs when it's automatic (trigger/setValue)

---

## Combining flushPromises with DOM Updates

### Search with Debounce

```typescript
// Good Example - Debounced search with API
import { mount, flushPromises } from "@vue/test-utils";
import { vi } from "vitest";
import { AutocompleteSearch } from "./autocomplete-search.vue";

const DATA_TEST_INPUT = '[data-test="search-input"]';
const DATA_TEST_SUGGESTION = '[data-test="suggestion"]';
const DATA_TEST_LOADING = '[data-test="loading"]';

const DEBOUNCE_DELAY_MS = 300;

vi.mock("@/api/search", () => ({
  searchSuggestions: vi.fn(),
}));

import { searchSuggestions } from "@/api/search";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("shows suggestions after debounce", async () => {
  vi.mocked(searchSuggestions).mockResolvedValue([
    { id: 1, text: "vue" },
    { id: 2, text: "vue test utils" },
  ]);

  const wrapper = mount(AutocompleteSearch);

  // Type in input
  await wrapper.get(DATA_TEST_INPUT).setValue("vu");

  // No API call yet (debouncing)
  expect(searchSuggestions).not.toHaveBeenCalled();

  // Advance timers past debounce delay
  vi.advanceTimersByTime(DEBOUNCE_DELAY_MS);

  // Now API should be called
  expect(searchSuggestions).toHaveBeenCalledWith("vu");

  // Flush the API promise
  await flushPromises();

  // Suggestions should appear
  expect(wrapper.findAll(DATA_TEST_SUGGESTION)).toHaveLength(2);
});

test("cancels pending search on new input", async () => {
  vi.mocked(searchSuggestions).mockResolvedValue([]);

  const wrapper = mount(AutocompleteSearch);

  await wrapper.get(DATA_TEST_INPUT).setValue("v");
  vi.advanceTimersByTime(DEBOUNCE_DELAY_MS / 2);

  // Type more before debounce completes
  await wrapper.get(DATA_TEST_INPUT).setValue("vue");
  vi.advanceTimersByTime(DEBOUNCE_DELAY_MS / 2);

  // First search should not have fired
  expect(searchSuggestions).not.toHaveBeenCalled();

  // Complete debounce for second input
  vi.advanceTimersByTime(DEBOUNCE_DELAY_MS / 2);

  // Only "vue" search should fire
  expect(searchSuggestions).toHaveBeenCalledTimes(1);
  expect(searchSuggestions).toHaveBeenCalledWith("vue");
});
```

**Why good:** Combines fake timers for debounce with flushPromises for API, tests debounce cancellation

---

## Testing Async Setup

### Components with async setup()

```typescript
// Good Example - Testing async setup components
import { mount, flushPromises } from "@vue/test-utils";
import { Suspense, defineComponent, h } from "vue";
import { AsyncDashboard } from "./async-dashboard.vue";

const DATA_TEST_STATS = '[data-test="stats"]';
const FALLBACK_TEXT = "Loading dashboard...";

// Helper to mount async component with Suspense
function mountWithSuspense(component: any, options = {}) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component, options.props || {}),
          fallback: () => h("div", { "data-test": "fallback" }, FALLBACK_TEXT),
        });
      },
    }),
    options
  );
  return wrapper;
}

test("shows fallback while loading", () => {
  const wrapper = mountWithSuspense(AsyncDashboard);

  expect(wrapper.get('[data-test="fallback"]').text()).toBe(FALLBACK_TEXT);
});

test("shows dashboard after async setup resolves", async () => {
  const wrapper = mountWithSuspense(AsyncDashboard);

  await flushPromises();

  expect(wrapper.find('[data-test="fallback"]').exists()).toBe(false);
  expect(wrapper.get(DATA_TEST_STATS).exists()).toBe(true);
});
```

**Why good:** Uses Suspense wrapper as required by Vue 3, tests both fallback and resolved states

---

## Error Boundary Testing

### Testing Error States

```typescript
// Good Example - Testing async error handling
import { mount, flushPromises } from "@vue/test-utils";
import { vi } from "vitest";
import { DataLoader } from "./data-loader.vue";

const DATA_TEST_RETRY = '[data-test="retry"]';
const DATA_TEST_ERROR = '[data-test="error"]';
const DATA_TEST_DATA = '[data-test="data"]';

vi.mock("@/api/data", () => ({
  fetchData: vi.fn(),
}));

import { fetchData } from "@/api/data";

test("allows retry after error", async () => {
  // First call fails, second succeeds
  vi.mocked(fetchData)
    .mockRejectedValueOnce(new Error("Network error"))
    .mockResolvedValueOnce({ items: ["item1"] });

  const wrapper = mount(DataLoader);

  // Wait for first (failing) request
  await flushPromises();

  expect(wrapper.get(DATA_TEST_ERROR).text()).toContain("Network error");

  // Click retry
  await wrapper.get(DATA_TEST_RETRY).trigger("click");

  // Wait for second (successful) request
  await flushPromises();

  expect(wrapper.find(DATA_TEST_ERROR).exists()).toBe(false);
  expect(wrapper.get(DATA_TEST_DATA).text()).toContain("item1");
});
```

**Why good:** Tests error recovery flow, uses mockRejectedValueOnce/mockResolvedValueOnce for sequential behavior

---

_For more patterns, see:_
- [core.md](core.md) - Mounting and querying
- [composables.md](composables.md) - Testing composables
- [mocking.md](mocking.md) - Pinia stores, Vue Router, stubs
