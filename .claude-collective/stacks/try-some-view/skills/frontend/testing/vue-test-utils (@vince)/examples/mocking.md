# Vue Test Utils - Mocking Examples

> Pinia stores, Vue Router, plugins, and component stubs. Reference from [SKILL.md](../SKILL.md).

---

## Mocking Pinia Stores

### Basic createTestingPinia Usage

```typescript
// Good Example - Mocking Pinia stores
import { mount, flushPromises } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { UserDashboard } from "./user-dashboard.vue";
import { useUserStore } from "@/stores/user";

const DATA_TEST_NAME = '[data-test="user-name"]';
const DATA_TEST_EMAIL = '[data-test="user-email"]';
const DATA_TEST_LOGOUT = '[data-test="logout"]';

const MOCK_USER = {
  id: 1,
  name: "John Doe",
  email: "john@example.com",
};

describe("UserDashboard", () => {
  test("displays user information from store", () => {
    const wrapper = mount(UserDashboard, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              user: { currentUser: MOCK_USER, isLoading: false },
            },
          }),
        ],
      },
    });

    expect(wrapper.get(DATA_TEST_NAME).text()).toBe(MOCK_USER.name);
    expect(wrapper.get(DATA_TEST_EMAIL).text()).toBe(MOCK_USER.email);
  });

  test("calls logout action", async () => {
    const wrapper = mount(UserDashboard, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              user: { currentUser: MOCK_USER, isLoading: false },
            },
          }),
        ],
      },
    });

    // Get store instance
    const userStore = useUserStore();

    await wrapper.get(DATA_TEST_LOGOUT).trigger("click");

    // Actions are stubbed by default - verify call
    expect(userStore.logout).toHaveBeenCalled();
  });
});
```

**Why good:** Uses createTestingPinia for clean store mocking, initializes state via initialState option, verifies stubbed actions

---

### Running Real Actions

```typescript
// Good Example - Testing with real store actions
import { mount, flushPromises } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { vi } from "vitest";
import { TodoApp } from "./todo-app.vue";
import { useTodoStore } from "@/stores/todo";

const DATA_TEST_INPUT = '[data-test="new-todo"]';
const DATA_TEST_ADD = '[data-test="add-todo"]';
const DATA_TEST_TODO = '[data-test="todo-item"]';

describe("TodoApp with real actions", () => {
  test("adds todo through real action", async () => {
    const wrapper = mount(TodoApp, {
      global: {
        plugins: [
          createTestingPinia({
            // Don't stub actions - run real implementation
            stubActions: false,
            initialState: {
              todo: { items: [] },
            },
          }),
        ],
      },
    });

    await wrapper.get(DATA_TEST_INPUT).setValue("New todo item");
    await wrapper.get(DATA_TEST_ADD).trigger("click");

    // Action ran for real - store updated
    const todoStore = useTodoStore();
    expect(todoStore.items).toHaveLength(1);
    expect(todoStore.items[0].text).toBe("New todo item");
  });
});
```

**Why good:** Uses stubActions: false for integration testing, verifies store state after action

---

### Mocking Getters

```typescript
// Good Example - Overriding computed getters
import { mount } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { CartSummary } from "./cart-summary.vue";
import { useCartStore } from "@/stores/cart";

const DATA_TEST_TOTAL = '[data-test="total"]';
const DATA_TEST_COUNT = '[data-test="item-count"]';

describe("CartSummary", () => {
  test("displays computed total from getter", () => {
    const wrapper = mount(CartSummary, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              cart: {
                items: [
                  { id: 1, price: 10, quantity: 2 },
                  { id: 2, price: 15, quantity: 1 },
                ],
              },
            },
          }),
        ],
      },
    });

    // Getter 'total' computes from items
    expect(wrapper.get(DATA_TEST_TOTAL).text()).toContain("35");
  });

  test("overrides getter for specific test case", () => {
    const wrapper = mount(CartSummary, {
      global: {
        plugins: [createTestingPinia()],
      },
    });

    // Override getter directly
    const cartStore = useCartStore();
    cartStore.total = 99.99;
    cartStore.itemCount = 5;

    // Force reactivity update
    expect(wrapper.get(DATA_TEST_TOTAL).text()).toContain("99.99");
    expect(wrapper.get(DATA_TEST_COUNT).text()).toContain("5");
  });
});
```

**Why good:** Shows both computed getters from state and direct getter overrides

---

## Mocking Vue Router

### Stubbing Router Components

```typescript
// Good Example - Stubbing router-link and router-view
import { mount } from "@vue/test-utils";
import { NavBar } from "./nav-bar.vue";

const DATA_TEST_HOME = '[data-test="home-link"]';
const DATA_TEST_ABOUT = '[data-test="about-link"]';
const DATA_TEST_PROFILE = '[data-test="profile-link"]';

describe("NavBar", () => {
  test("renders navigation links", () => {
    const wrapper = mount(NavBar, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a :href="to" data-stub="router-link"><slot /></a>',
            props: ["to"],
          },
        },
      },
    });

    expect(wrapper.get(DATA_TEST_HOME).attributes("href")).toBe("/");
    expect(wrapper.get(DATA_TEST_ABOUT).attributes("href")).toBe("/about");
    expect(wrapper.get(DATA_TEST_PROFILE).attributes("href")).toBe("/profile");
  });

  test("simple stub for presence check", () => {
    const wrapper = mount(NavBar, {
      global: {
        stubs: {
          RouterLink: true, // Simple stub
        },
      },
    });

    // Can't check href, but can verify structure
    expect(wrapper.findAll("router-link-stub")).toHaveLength(3);
  });
});
```

**Why good:** Custom stub preserves `to` prop for testing, simple stub for quick structure checks

---

### Mocking useRoute and useRouter

```typescript
// Good Example - Mocking router hooks
import { mount, flushPromises } from "@vue/test-utils";
import { vi } from "vitest";
import { UserPage } from "./user-page.vue";

const DATA_TEST_USER_ID = '[data-test="user-id"]';
const DATA_TEST_BACK = '[data-test="back-button"]';

// Mock vue-router module
vi.mock("vue-router", () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(),
}));

import { useRoute, useRouter } from "vue-router";

const mockPush = vi.fn();
const mockBack = vi.fn();

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
    back: mockBack,
  } as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("UserPage", () => {
  test("displays user ID from route params", () => {
    vi.mocked(useRoute).mockReturnValue({
      params: { id: "123" },
      query: {},
    } as any);

    const wrapper = mount(UserPage);

    expect(wrapper.get(DATA_TEST_USER_ID).text()).toBe("123");
  });

  test("navigates back on button click", async () => {
    vi.mocked(useRoute).mockReturnValue({
      params: { id: "123" },
      query: {},
    } as any);

    const wrapper = mount(UserPage);

    await wrapper.get(DATA_TEST_BACK).trigger("click");

    expect(mockBack).toHaveBeenCalled();
  });

  test("reads query parameters", () => {
    vi.mocked(useRoute).mockReturnValue({
      params: { id: "123" },
      query: { tab: "settings" },
    } as any);

    const wrapper = mount(UserPage);

    expect(wrapper.text()).toContain("settings");
  });
});
```

**Why good:** Mocks vue-router at module level, provides realistic route/router interfaces

---

### Using Real Router for Integration

```typescript
// Good Example - Real router for integration tests
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import { App } from "./app.vue";
import { routes } from "./routes";

const DATA_TEST_NAV_HOME = '[data-test="nav-home"]';
const DATA_TEST_NAV_ABOUT = '[data-test="nav-about"]';
const DATA_TEST_CONTENT = '[data-test="page-content"]';

describe("App routing integration", () => {
  test("navigates between pages", async () => {
    const router = createRouter({
      history: createWebHistory(),
      routes,
    });

    // Start at home
    router.push("/");
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.get(DATA_TEST_CONTENT).text()).toContain("Home");

    // Navigate to about
    await wrapper.get(DATA_TEST_NAV_ABOUT).trigger("click");
    await flushPromises();

    expect(wrapper.get(DATA_TEST_CONTENT).text()).toContain("About");
  });
});
```

**Why good:** Uses real router for full navigation testing, awaits router.isReady() before mounting

---

## Stubbing Child Components

### Selective Stubbing

```typescript
// Good Example - Stubbing specific components
import { mount } from "@vue/test-utils";
import { Dashboard } from "./dashboard.vue";
import { HeavyChart } from "./heavy-chart.vue";
import { QuickStats } from "./quick-stats.vue";

const DATA_TEST_STATS = '[data-test="stats"]';

describe("Dashboard", () => {
  test("stubs heavy component, keeps lightweight one", () => {
    const wrapper = mount(Dashboard, {
      global: {
        stubs: {
          // Stub the slow chart component
          HeavyChart: { template: '<div data-test="chart-stub">Chart</div>' },
          // Don't stub QuickStats - test its integration
        },
      },
    });

    // Chart is stubbed
    expect(wrapper.find('[data-test="chart-stub"]').exists()).toBe(true);

    // QuickStats rendered normally
    expect(wrapper.findComponent(QuickStats).exists()).toBe(true);
  });

  test("stub with slot support", () => {
    const wrapper = mount(Dashboard, {
      global: {
        stubs: {
          Card: {
            template: '<div class="card-stub"><slot /></div>',
          },
        },
      },
    });

    // Slot content renders inside stub
    expect(wrapper.find(".card-stub").text()).toContain("Dashboard content");
  });
});
```

**Why good:** Selective stubbing balances speed and realism, custom stubs preserve slot functionality

---

### Stubbing with Props Validation

```typescript
// Good Example - Verifying props passed to stubbed components
import { mount } from "@vue/test-utils";
import { ProductPage } from "./product-page.vue";
import { AddToCart } from "./add-to-cart.vue";

describe("ProductPage", () => {
  test("passes correct props to AddToCart", () => {
    const wrapper = mount(ProductPage, {
      props: {
        product: { id: 1, name: "Widget", price: 99 },
      },
    });

    // Find the real or stubbed component
    const addToCart = wrapper.findComponent(AddToCart);

    // Verify props
    expect(addToCart.props("productId")).toBe(1);
    expect(addToCart.props("price")).toBe(99);
  });
});
```

**Why good:** Tests prop passing without needing full child component implementation

---

## Mocking Global Properties

### Mocking $t (i18n)

```typescript
// Good Example - Mocking translation function
import { mount } from "@vue/test-utils";
import { WelcomeMessage } from "./welcome-message.vue";

const DATA_TEST_GREETING = '[data-test="greeting"]';
const DATA_TEST_DESCRIPTION = '[data-test="description"]';

describe("WelcomeMessage", () => {
  test("displays translated text", () => {
    // Simple mock that returns the key
    const $t = (key: string) => key;

    const wrapper = mount(WelcomeMessage, {
      global: {
        mocks: { $t },
      },
    });

    expect(wrapper.get(DATA_TEST_GREETING).text()).toBe("welcome.title");
  });

  test("with translation lookup", () => {
    const translations: Record<string, string> = {
      "welcome.title": "Welcome!",
      "welcome.description": "Get started with our app.",
    };

    const $t = (key: string) => translations[key] ?? key;

    const wrapper = mount(WelcomeMessage, {
      global: {
        mocks: { $t },
      },
    });

    expect(wrapper.get(DATA_TEST_GREETING).text()).toBe("Welcome!");
    expect(wrapper.get(DATA_TEST_DESCRIPTION).text()).toBe(
      "Get started with our app.",
    );
  });
});
```

**Why good:** Simple mock for structure testing, translation lookup for content verification

---

### Mocking Other Globals

```typescript
// Good Example - Mocking $toast, $modal, custom globals
import { mount } from "@vue/test-utils";
import { vi } from "vitest";
import { FormWithNotifications } from "./form-with-notifications.vue";

const DATA_TEST_SUBMIT = '[data-test="submit"]';

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};

const mockModal = {
  confirm: vi.fn(),
};

describe("FormWithNotifications", () => {
  test("shows success toast on submit", async () => {
    const wrapper = mount(FormWithNotifications, {
      global: {
        mocks: {
          $toast: mockToast,
        },
      },
    });

    await wrapper.get(DATA_TEST_SUBMIT).trigger("click");

    expect(mockToast.success).toHaveBeenCalledWith("Form submitted!");
  });

  test("shows confirmation modal before dangerous action", async () => {
    mockModal.confirm.mockResolvedValue(true);

    const wrapper = mount(FormWithNotifications, {
      global: {
        mocks: {
          $modal: mockModal,
        },
      },
    });

    await wrapper.get('[data-test="delete"]').trigger("click");

    expect(mockModal.confirm).toHaveBeenCalledWith(
      "Are you sure you want to delete?",
    );
  });
});
```

**Why good:** Mocks common global plugins ($toast, $modal), verifies interactions with globals

---

## Custom Mount Function

### Reusable Test Setup

```typescript
// Good Example - Custom mount with all providers
// test-utils.ts
import { mount, type MountingOptions, type VueWrapper } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { vi } from "vitest";
import type { Component } from "vue";

interface CustomMountOptions extends MountingOptions<unknown> {
  initialPiniaState?: Record<string, unknown>;
  mockRoute?: Partial<{
    params: Record<string, string>;
    query: Record<string, string>;
  }>;
  stubRouter?: boolean;
}

export function customMount<T extends Component>(
  component: T,
  options: CustomMountOptions = {},
): VueWrapper {
  const {
    initialPiniaState,
    mockRoute = { params: {}, query: {} },
    stubRouter = true,
    ...mountOptions
  } = options;

  return mount(component, {
    global: {
      plugins: [
        createTestingPinia({
          initialState: initialPiniaState,
          createSpy: vi.fn,
        }),
      ],
      stubs: stubRouter
        ? {
            RouterLink: { template: "<a><slot /></a>" },
            RouterView: true,
          }
        : {},
      mocks: {
        $t: (key: string) => key,
        $route: mockRoute,
        $router: {
          push: vi.fn(),
          replace: vi.fn(),
          back: vi.fn(),
        },
      },
      ...mountOptions.global,
    },
    ...mountOptions,
  });
}

// Usage in tests:
// import { customMount } from './test-utils'
//
// const wrapper = customMount(MyComponent, {
//   initialPiniaState: { user: { name: 'John' } },
//   mockRoute: { params: { id: '123' } },
// })
```

**Why good:** Centralizes test configuration, reduces boilerplate, provides consistent test environment

---

_For more patterns, see:_

- [core.md](core.md) - Mounting and querying
- [async.md](async.md) - Async testing patterns
- [composables.md](composables.md) - Testing composables
