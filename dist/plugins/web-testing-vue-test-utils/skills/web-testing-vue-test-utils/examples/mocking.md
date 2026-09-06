# Vue Test Utils - Supplying a Component's Environment

> The four `global` mounting options — `plugins`, `stubs`, `mocks`, `provide` — and a custom mount that composes them. See [core.md](core.md) for mounting and [composables.md](composables.md) for `provide` worked through a composable.

> `fn()` below stands for your test runner's mock-function factory.

---

## global.plugins — anything installed with app.use()

A mounted component gets its own application instance, so every plugin the real app installs must be installed on the test mount too. A store, a router, an i18n instance and a UI kit all arrive the same way.

```typescript
import { mount } from "@vue/test-utils";
import UserDashboard from "./user-dashboard.vue";
import { createAppStore } from "./store"; // your state library's test-mode factory

test("renders state supplied by the store plugin", () => {
  const wrapper = mount(UserDashboard, {
    global: {
      plugins: [createAppStore({ user: { name: "John Doe" } })],
    },
  });

  expect(wrapper.get('[data-test="user-name"]').text()).toBe("John Doe");
});
```

**Why this is the seam:** the plugin is an argument to the mount, so each test states the world it needs and no test leaks into the next. How a particular store or router builds its test-mode instance is settled by whoever owns it — from here it is a plugin like any other.

### A plugin that initialises asynchronously

Some plugins resolve something before they are usable — a navigation plugin settling on an initial location is the common case. Await that readiness **before** mounting, or the component's first render sees the unresolved state and every assertion after it is about a tree that was never meant to exist.

```typescript
import { mount, flushPromises } from "@vue/test-utils";
import App from "./app.vue";
import { createNavigation } from "./navigation"; // your navigation library's factory

const navigation = createNavigation({ routes });

navigation.goTo("/");
await navigation.ready(); // whatever your plugin's readiness promise is called

const wrapper = mount(App, { global: { plugins: [navigation] } });

expect(wrapper.get('[data-test="page-content"]').text()).toContain("Home");

await wrapper.get('[data-test="nav-about"]').trigger("click");
await flushPromises(); // the transition is the plugin's promise, not Vue's render queue

expect(wrapper.get('[data-test="page-content"]').text()).toContain("About");
```

**Why both waits are needed:** awaiting `trigger()` flushes Vue's render queue and nothing else. A plugin-driven transition resolves on the microtask queue, so without `flushPromises()` the assertion reads the outgoing view — the same two-queue split the skill's philosophy describes, arriving through a plugin rather than through a request.

---

## global.stubs — replacing children

```typescript
import { mount } from "@vue/test-utils";
import Dashboard from "./dashboard.vue";
import QuickStats from "./quick-stats.vue";

test("stub the expensive child, keep the rest real", () => {
  const wrapper = mount(Dashboard, {
    global: {
      stubs: {
        HeavyChart: { template: '<div data-test="chart-stub">Chart</div>' },
        // QuickStats deliberately absent - its integration is part of the subject
      },
    },
  });

  expect(wrapper.find('[data-test="chart-stub"]').exists()).toBe(true);
  expect(wrapper.getComponent(QuickStats).exists()).toBe(true);
});

test("a stub that still renders its slot", () => {
  const wrapper = mount(Dashboard, {
    global: {
      // `Card: true` would swallow the slot content; a template keeps it
      stubs: { Card: { template: '<div class="card-stub"><slot /></div>' } },
    },
  });

  expect(wrapper.find(".card-stub").text()).toContain("Dashboard content");
});
```

**Why the two forms differ:** `Stub: true` generates a `<stub-name-stub>` element that renders no slots at all, so any content the parent passed through disappears and assertions about it fail for a reason that has nothing to do with the component. Reach for `true` only when presence is the whole assertion; give the stub a template the moment slot content matters.

### Globally registered components

Components a plugin registers globally — a router's link and outlet components, a UI kit's primitives — are not imported by the component under test, so they need stubbing by name.

```typescript
import { mount } from "@vue/test-utils";
import NavBar from "./nav-bar.vue";

test("renders each navigation destination", () => {
  const wrapper = mount(NavBar, {
    global: {
      stubs: {
        // Preserve the prop carrying the destination, so it stays assertable
        RouterLink: { template: "<a :href='to'><slot /></a>", props: ["to"] },
      },
    },
  });

  expect(wrapper.get('[data-test="home-link"]').attributes("href")).toBe("/");
  expect(wrapper.get('[data-test="about-link"]').attributes("href")).toBe(
    "/about",
  );
});

test("presence check only", () => {
  const wrapper = mount(NavBar, {
    global: { stubs: { RouterLink: true } },
  });

  expect(wrapper.findAll("router-link-stub")).toHaveLength(3);
});
```

**Why the prop-preserving stub is usually right:** `RouterLink: true` proves three links exist and nothing about where they point, which is the only interesting thing a navigation bar does. Declaring `props: ["to"]` on the stub keeps the destination in the DOM and turns the test into an assertion about behaviour.

The alternative is to install the real plugin through `global.plugins` and let it register its own components — heavier, but the right call when navigation itself is the subject.

---

## global.mocks — global properties the template reads

```typescript
import { mount } from "@vue/test-utils";
import WelcomeMessage from "./welcome-message.vue";

test("renders the key when the lookup is a pass-through", () => {
  const wrapper = mount(WelcomeMessage, {
    global: { mocks: { $t: (key: string) => key } },
  });

  expect(wrapper.get('[data-test="greeting"]').text()).toBe("welcome.title");
});

test("renders resolved copy when the lookup has entries", () => {
  const messages: Record<string, string> = {
    "welcome.title": "Welcome!",
    "welcome.description": "Get started with our app.",
  };

  const wrapper = mount(WelcomeMessage, {
    global: { mocks: { $t: (key: string) => messages[key] ?? key } },
  });

  expect(wrapper.get('[data-test="greeting"]').text()).toBe("Welcome!");
  expect(wrapper.get('[data-test="description"]').text()).toBe(
    "Get started with our app.",
  );
});
```

**Why both forms earn their place:** the pass-through proves the component asks for the right keys, which is what breaks when someone renames one. The resolving form proves the copy reaches the right slot in the layout. Testing only the second hides a wrong key behind a lookup that happens to contain it.

```typescript
// Global service objects arrive the same way
const toast = { success: fn(), error: fn() };

test("confirms a successful submit", async () => {
  const wrapper = mount(FormWithNotifications, {
    global: { mocks: { $toast: toast } },
  });

  await wrapper.get('[data-test="submit"]').trigger("click");

  expect(toast.success).toHaveBeenCalledWith("Form submitted!");
});
```

---

## global.provide — standing in for an ancestor

`provide` supplies an injection key without mounting whatever normally provides it. The worked example is in [composables.md](composables.md#composables-that-inject), since a composable is the usual consumer.

---

## Asserting on props passed to a child

```typescript
import { mount } from "@vue/test-utils";
import ProductPage from "./product-page.vue";
import AddToCart from "./add-to-cart.vue";

test("passes the product's identity and price down", () => {
  const wrapper = mount(ProductPage, {
    props: { product: { id: 1, name: "Widget", price: 99 } },
  });

  const addToCart = wrapper.getComponent(AddToCart);

  expect(addToCart.props("productId")).toBe(1);
  expect(addToCart.props("price")).toBe(99);
});
```

**Why good:** `props()` reads through whether the child is real or stubbed, so this assertion survives a later decision to stub it — and it tests the parent's job, which is choosing what to pass.

---

## A custom mount that composes them

```typescript
// test-utils.ts
import { mount, type MountingOptions, type VueWrapper } from "@vue/test-utils";
import type { Component } from "vue";
import { createAppStore } from "./store";

interface CustomMountOptions extends MountingOptions<unknown> {
  initialState?: Record<string, unknown>;
  stubNavigation?: boolean;
}

export function customMount<T extends Component>(
  component: T,
  options: CustomMountOptions = {},
): VueWrapper {
  const { initialState, stubNavigation = true, ...mountOptions } = options;

  return mount(component, {
    ...mountOptions,
    global: {
      plugins: [createAppStore(initialState)],
      stubs: stubNavigation
        ? { RouterLink: { template: "<a><slot /></a>" }, RouterView: true }
        : {},
      mocks: { $t: (key: string) => key },
      // Spread last, so a test can override any of the four above
      ...mountOptions.global,
    },
  });
}
```

```typescript
// In a test
const wrapper = customMount(MyComponent, {
  initialState: { user: { name: "John" } },
  stubNavigation: false, // this one exercises navigation for real
});
```

**Why good:** the defaults cover what every test needs and each option names the one thing a test wants different. Spreading `mountOptions.global` last is what makes the override work — spread first, and the defaults silently win over anything a test passed.

### Project-wide defaults

Anything every test needs without exception belongs on `config.global` in the setup file rather than in a helper, and wrappers can be unmounted automatically rather than per test.

```typescript
import { config, enableAutoUnmount } from "@vue/test-utils";

config.global.stubs = { RouterLink: true, RouterView: true };
config.global.renderStubDefaultSlot = true; // stubs still render default slot content

enableAutoUnmount(afterEach);
```

`config.global` is module-level state shared by every file in the process, so treat it as a floor — things that are true everywhere — and keep anything a test might want to vary in the custom mount.

---

_Back to [core.md](core.md), or [async.md](async.md) for requests and timers._
