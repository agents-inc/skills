# Vue Test Utils - Core Examples

> Mounting, slots, querying and interaction. See [async.md](async.md) for `flushPromises`, [composables.md](composables.md) for composables, and [mocking.md](mocking.md) for the `global` options.

> `test`, `describe` and `expect` come from whatever test runner executes these files.

---

## Mounting

```typescript
import { mount } from "@vue/test-utils";
import Greeting from "./greeting.vue";

test("renders the default greeting", () => {
  const wrapper = mount(Greeting);

  expect(wrapper.text()).toContain("Hello, World!");
});

test("renders a name passed as a prop", () => {
  const wrapper = mount(Greeting, { props: { name: "Vue" } });

  expect(wrapper.text()).toContain("Hello, Vue!");
});
```

---

## Slots

```typescript
import { mount } from "@vue/test-utils";
import Card from "./card.vue";
import DataList from "./data-list.vue";

test("renders named and default slots", () => {
  const wrapper = mount(Card, {
    slots: {
      header: "<h2>Card Title</h2>",
      default: "<p>Card content goes here</p>",
      footer: "Card footer", // a plain string is a valid slot
    },
  });

  expect(wrapper.text()).toContain("Card Title");
  expect(wrapper.text()).toContain("Card content goes here");
  expect(wrapper.text()).toContain("Card footer");
});

test("renders a scoped slot with the data it is given", () => {
  const wrapper = mount(DataList, {
    props: { items: [{ id: 1, name: "Item 1" }] },
    slots: {
      item: `<template #item="{ item }">
        <span data-test="item-name">{{ item.name }}</span>
      </template>`,
    },
  });

  expect(wrapper.get('[data-test="item-name"]').text()).toBe("Item 1");
});
```

**Why good:** the scoped-slot test asserts on the value the component passed _into_ the slot, which is the actual contract. Rendering a static slot proves only that the outlet exists.

---

## Selective stubbing beats shallow rendering

```typescript
import { mount, shallowMount } from "@vue/test-utils";
import Dashboard from "./dashboard.vue";
import QuickStats from "./quick-stats.vue";

test("dashboard renders its widgets (shallow)", () => {
  const wrapper = shallowMount(Dashboard); // every child replaced by a stub

  expect(wrapper.findComponent({ name: "StatsWidget" }).exists()).toBe(true);
});

test("dashboard renders its widgets (selective stub)", () => {
  const wrapper = mount(Dashboard, {
    global: {
      stubs: {
        HeavyChartWidget: { template: "<div>Chart Stub</div>" }, // the one real problem
      },
    },
  });

  // QuickStats renders for real, so this covers the integration too
  expect(wrapper.getComponent(QuickStats).text()).toContain("Stats");
});
```

**Why the second is usually right:** the reason to reach for shallow rendering is almost never depth — it is one child that is slow, draws to a canvas, or calls out to the network. Naming that child keeps every other integration under test.

---

## get, find and findAll

```typescript
import { mount } from "@vue/test-utils";
import LoginForm from "./login-form.vue";
import Alert from "./alert.vue";
import TodoList from "./todo-list.vue";

test("required elements: get()", () => {
  const wrapper = mount(LoginForm);

  // Throws with the selector and the rendered HTML if absent
  expect(wrapper.get('[data-test="email"]').attributes("type")).toBe("email");
  expect(wrapper.get('[data-test="submit"]').text()).toBe("Sign In");
});

test("conditional elements: find() plus exists()", () => {
  const withoutMessage = mount(Alert);
  expect(withoutMessage.find('[data-test="alert"]').exists()).toBe(false);

  const withMessage = mount(Alert, {
    props: { message: "Something happened" },
  });
  expect(withMessage.get('[data-test="alert"]').text()).toContain(
    "Something happened",
  );
});

test("collections: findAll()", () => {
  const todos = [
    { id: 1, text: "Learn Vue", done: false },
    { id: 2, text: "Write tests", done: true },
  ];
  const wrapper = mount(TodoList, { props: { todos } });

  expect(wrapper.findAll('[data-test="todo-item"]')).toHaveLength(2);
  expect(wrapper.findAll('[data-test="checkbox"]')[1].element.checked).toBe(
    true,
  );
});

test("the empty case renders a placeholder", () => {
  const wrapper = mount(TodoList, { props: { todos: [] } });

  expect(wrapper.findAll('[data-test="todo-item"]')).toHaveLength(0);
  expect(wrapper.text()).toContain("No todos yet");
});
```

**Why good:** each variant is used for the job it exists for. The empty case is tested explicitly because an empty-list bug renders nothing and therefore breaks no assertion that only counts items.

---

## setValue and trigger

```typescript
import { mount } from "@vue/test-utils";
import RegistrationForm from "./registration-form.vue";

test("fills and submits the form", async () => {
  const wrapper = mount(RegistrationForm);

  await wrapper.get('[data-test="username"]').setValue("johndoe");
  await wrapper.get('[data-test="email"]').setValue("john@example.com");
  await wrapper.get('[data-test="terms"]').setValue(true); // checkbox: boolean
  await wrapper.get('[data-test="country"]').setValue("US"); // select: option value

  await wrapper.get('[data-test="form"]').trigger("submit.prevent");

  expect(wrapper.emitted("submit")).toBeTruthy();
  expect(wrapper.emitted("submit")![0][0]).toMatchObject({
    username: "johndoe",
    email: "john@example.com",
  });
});
```

**Why good:** `setValue` covers text inputs, checkboxes and selects with one method, dispatching the `input` or `change` event each element type actually needs. Every call is awaited, so the next line sees the updated DOM.

---

## Clicks and counted state

```typescript
import { mount } from "@vue/test-utils";
import Counter from "./counter.vue";

test("increments and decrements", async () => {
  const wrapper = mount(Counter, { props: { initialCount: 5 } });

  await wrapper.get('[data-test="increment"]').trigger("click");
  expect(wrapper.get('[data-test="count"]').text()).toBe("6");

  await wrapper.get('[data-test="decrement"]').trigger("click");
  expect(wrapper.get('[data-test="count"]').text()).toBe("5");
});

test("reset returns to the initial prop, not to zero", async () => {
  const wrapper = mount(Counter, { props: { initialCount: 10 } });

  await wrapper.get('[data-test="increment"]').trigger("click");
  await wrapper.get('[data-test="reset"]').trigger("click");

  expect(wrapper.get('[data-test="count"]').text()).toBe("10");
});
```

---

## Keyboard events

```typescript
import { mount } from "@vue/test-utils";
import SearchInput from "./search-input.vue";

test("submits on Enter", async () => {
  const wrapper = mount(SearchInput);

  const input = wrapper.get('[data-test="search-input"]');
  await input.setValue("component testing");
  await input.trigger("keydown.enter"); // Vue's key modifier syntax works here

  expect(wrapper.emitted("search")![0][0]).toBe("component testing");
});

test("closes the suggestion list on Escape", async () => {
  const wrapper = mount(SearchInput, {
    props: { suggestions: ["alpha", "alphabet"] },
  });

  await wrapper.get('[data-test="search-input"]').setValue("al");
  await wrapper.get('[data-test="search-input"]').trigger("keydown.escape");

  expect(wrapper.find('[data-test="suggestion"]').exists()).toBe(false);
});

test("clicking a suggestion fills the input", async () => {
  const wrapper = mount(SearchInput, {
    props: { suggestions: ["alpha", "alphabet"] },
  });

  await wrapper.get('[data-test="search-input"]').setValue("al");
  await wrapper.findAll('[data-test="suggestion"]')[1].trigger("click");

  expect(wrapper.get('[data-test="search-input"]').element.value).toBe(
    "alphabet",
  );
});
```

**Why good:** `trigger("keydown.enter")` uses the same modifier syntax the template does, so the test and the handler agree on which key by construction rather than by a hand-written `key` property.

---

_Next: [async.md](async.md) for requests and timers, [mocking.md](mocking.md) for the `global` options._
