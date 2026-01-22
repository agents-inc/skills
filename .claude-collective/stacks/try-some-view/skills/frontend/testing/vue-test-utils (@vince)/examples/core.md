# Vue Test Utils - Core Examples

> Mounting, wrapper API, and queries. Reference from [SKILL.md](../SKILL.md).

---

## Mounting Components

### Basic Mount

```typescript
// Good Example - Basic component mounting
import { mount } from "@vue/test-utils";
import { Greeting } from "./greeting.vue";

const DEFAULT_NAME = "World";
const CUSTOM_NAME = "Vue";

test("renders default greeting", () => {
  const wrapper = mount(Greeting);

  expect(wrapper.text()).toContain(`Hello, ${DEFAULT_NAME}!`);
});

test("renders greeting with custom name prop", () => {
  const wrapper = mount(Greeting, {
    props: {
      name: CUSTOM_NAME,
    },
  });

  expect(wrapper.text()).toContain(`Hello, ${CUSTOM_NAME}!`);
});
```

**Why good:** Uses mount() for realistic testing, passes props via options object, uses named constants for test data

---

### Mount with Slots

```typescript
// Good Example - Testing slots
import { mount } from "@vue/test-utils";
import { Card } from "./card.vue";

const HEADER_TEXT = "Card Title";
const BODY_TEXT = "Card content goes here";
const FOOTER_TEXT = "Card footer";

test("renders slot content", () => {
  const wrapper = mount(Card, {
    slots: {
      header: `<h2>${HEADER_TEXT}</h2>`,
      default: `<p>${BODY_TEXT}</p>`,
      footer: FOOTER_TEXT,
    },
  });

  expect(wrapper.text()).toContain(HEADER_TEXT);
  expect(wrapper.text()).toContain(BODY_TEXT);
  expect(wrapper.text()).toContain(FOOTER_TEXT);
});

test("renders scoped slot with data", () => {
  const wrapper = mount(DataList, {
    props: {
      items: [{ id: 1, name: "Item 1" }],
    },
    slots: {
      item: `<template #item="{ item }">
        <span data-test="item-name">{{ item.name }}</span>
      </template>`,
    },
  });

  expect(wrapper.get('[data-test="item-name"]').text()).toBe("Item 1");
});
```

**Why good:** Tests both simple and scoped slots, uses meaningful slot content, verifies slot rendering through assertions

---

### Shallow Mount (Use Sparingly)

```typescript
// Example - When shallowMount is appropriate
import { mount, shallowMount } from "@vue/test-utils";
import { Dashboard } from "./dashboard.vue";

// Use shallowMount when:
// 1. Testing component in isolation from heavy children
// 2. Child components make unwanted side effects (API calls)
// 3. Performance issues with many nested components

test("dashboard renders widgets (shallow)", () => {
  // All child components are replaced with stubs
  const wrapper = shallowMount(Dashboard);

  // Can still check that child components would render
  expect(wrapper.findComponent({ name: "StatsWidget" }).exists()).toBe(true);
  expect(wrapper.findComponent({ name: "ChartWidget" }).exists()).toBe(true);
});

// Selective stubbing is often better
test("dashboard renders with selective stubs", () => {
  const wrapper = mount(Dashboard, {
    global: {
      stubs: {
        // Only stub the problematic component
        HeavyChartWidget: { template: "<div>Chart Stub</div>" },
      },
    },
  });

  // StatsWidget renders normally
  expect(wrapper.findComponent({ name: "StatsWidget" }).text()).toContain(
    "Stats",
  );
});
```

**Why this approach:** Selective stubbing is preferred over shallowMount because it maintains more realistic behavior while solving specific problems.

---

## Querying Elements

### Using get() for Required Elements

```typescript
// Good Example - get() for elements that must exist
import { mount } from "@vue/test-utils";
import { LoginForm } from "./login-form.vue";

const DATA_TEST_EMAIL = '[data-test="email"]';
const DATA_TEST_PASSWORD = '[data-test="password"]';
const DATA_TEST_SUBMIT = '[data-test="submit"]';
const DATA_TEST_FORM = '[data-test="form"]';

test("renders login form elements", () => {
  const wrapper = mount(LoginForm);

  // get() throws if element not found - test fails immediately
  const emailInput = wrapper.get(DATA_TEST_EMAIL);
  const passwordInput = wrapper.get(DATA_TEST_PASSWORD);
  const submitButton = wrapper.get(DATA_TEST_SUBMIT);

  expect(emailInput.attributes("type")).toBe("email");
  expect(passwordInput.attributes("type")).toBe("password");
  expect(submitButton.text()).toBe("Sign In");
});
```

**Why good:** Uses get() because these elements must exist for the component to function. Fails fast with clear error if element missing.

---

### Using find() for Conditional Elements

```typescript
// Good Example - find() for elements that may not exist
import { mount } from "@vue/test-utils";
import { Alert } from "./alert.vue";

const DATA_TEST_ALERT = '[data-test="alert"]';
const DATA_TEST_DISMISS = '[data-test="dismiss"]';

test("alert is hidden by default", () => {
  const wrapper = mount(Alert);

  // find() returns empty wrapper if not found
  const alert = wrapper.find(DATA_TEST_ALERT);

  expect(alert.exists()).toBe(false);
});

test("alert is visible when message provided", () => {
  const wrapper = mount(Alert, {
    props: { message: "Something happened" },
  });

  const alert = wrapper.find(DATA_TEST_ALERT);

  expect(alert.exists()).toBe(true);
  expect(alert.text()).toContain("Something happened");
});

test("dismissible alert has close button", () => {
  const wrapper = mount(Alert, {
    props: {
      message: "Info",
      dismissible: true,
    },
  });

  // Conditional element based on prop
  expect(wrapper.find(DATA_TEST_DISMISS).exists()).toBe(true);
});
```

**Why good:** Uses find() for conditional elements, checks .exists() before accessing content, tests both present and absent states

---

### Using findAll() for Multiple Elements

```typescript
// Good Example - findAll() for lists
import { mount } from "@vue/test-utils";
import { TodoList } from "./todo-list.vue";

const DATA_TEST_ITEM = '[data-test="todo-item"]';
const DATA_TEST_CHECKBOX = '[data-test="checkbox"]';

const MOCK_TODOS = [
  { id: 1, text: "Learn Vue", done: false },
  { id: 2, text: "Write tests", done: true },
  { id: 3, text: "Build app", done: false },
];

test("renders all todo items", () => {
  const wrapper = mount(TodoList, {
    props: { todos: MOCK_TODOS },
  });

  const items = wrapper.findAll(DATA_TEST_ITEM);

  expect(items).toHaveLength(MOCK_TODOS.length);
});

test("renders completed todos with checked state", () => {
  const wrapper = mount(TodoList, {
    props: { todos: MOCK_TODOS },
  });

  const checkboxes = wrapper.findAll(DATA_TEST_CHECKBOX);

  // Second item is completed
  expect(checkboxes[1].element.checked).toBe(true);
});

test("empty list shows placeholder", () => {
  const wrapper = mount(TodoList, {
    props: { todos: [] },
  });

  expect(wrapper.findAll(DATA_TEST_ITEM)).toHaveLength(0);
  expect(wrapper.text()).toContain("No todos yet");
});
```

**Why good:** Uses findAll() for list items, tests both populated and empty states, accesses specific items by index when needed

---

## User Interactions

### Form Input with setValue()

```typescript
// Good Example - Form interactions
import { mount } from "@vue/test-utils";
import { RegistrationForm } from "./registration-form.vue";

const DATA_TEST_USERNAME = '[data-test="username"]';
const DATA_TEST_EMAIL = '[data-test="email"]';
const DATA_TEST_PASSWORD = '[data-test="password"]';
const DATA_TEST_TERMS = '[data-test="terms"]';
const DATA_TEST_COUNTRY = '[data-test="country"]';
const DATA_TEST_FORM = '[data-test="form"]';

const VALID_USERNAME = "johndoe";
const VALID_EMAIL = "john@example.com";
const VALID_PASSWORD = "SecurePass123!";

test("fills out registration form", async () => {
  const wrapper = mount(RegistrationForm);

  // Text inputs - MUST await
  await wrapper.get(DATA_TEST_USERNAME).setValue(VALID_USERNAME);
  await wrapper.get(DATA_TEST_EMAIL).setValue(VALID_EMAIL);
  await wrapper.get(DATA_TEST_PASSWORD).setValue(VALID_PASSWORD);

  // Checkbox - use setChecked() or trigger('change')
  await wrapper.get(DATA_TEST_TERMS).setValue(true);

  // Select dropdown
  await wrapper.get(DATA_TEST_COUNTRY).setValue("US");

  // Verify values
  expect(wrapper.get(DATA_TEST_USERNAME).element.value).toBe(VALID_USERNAME);
  expect(wrapper.get(DATA_TEST_EMAIL).element.value).toBe(VALID_EMAIL);
  expect(wrapper.get(DATA_TEST_TERMS).element.checked).toBe(true);
});

test("submits form with data", async () => {
  const wrapper = mount(RegistrationForm);

  await wrapper.get(DATA_TEST_USERNAME).setValue(VALID_USERNAME);
  await wrapper.get(DATA_TEST_EMAIL).setValue(VALID_EMAIL);
  await wrapper.get(DATA_TEST_PASSWORD).setValue(VALID_PASSWORD);
  await wrapper.get(DATA_TEST_TERMS).setValue(true);

  await wrapper.get(DATA_TEST_FORM).trigger("submit.prevent");

  expect(wrapper.emitted("submit")).toBeTruthy();
  expect(wrapper.emitted("submit")![0][0]).toMatchObject({
    username: VALID_USERNAME,
    email: VALID_EMAIL,
  });
});
```

**Why good:** Awaits all setValue() calls, uses proper selectors, verifies both DOM state and emitted events

---

### Click Events with trigger()

```typescript
// Good Example - Button and click interactions
import { mount } from "@vue/test-utils";
import { Counter } from "./counter.vue";

const DATA_TEST_COUNT = '[data-test="count"]';
const DATA_TEST_INCREMENT = '[data-test="increment"]';
const DATA_TEST_DECREMENT = '[data-test="decrement"]';
const DATA_TEST_RESET = '[data-test="reset"]';

const INITIAL_COUNT = 0;

test("increments counter on click", async () => {
  const wrapper = mount(Counter);

  expect(wrapper.get(DATA_TEST_COUNT).text()).toBe(String(INITIAL_COUNT));

  // MUST await trigger()
  await wrapper.get(DATA_TEST_INCREMENT).trigger("click");

  expect(wrapper.get(DATA_TEST_COUNT).text()).toBe("1");
});

test("decrements counter on click", async () => {
  const wrapper = mount(Counter, {
    props: { initialCount: 5 },
  });

  await wrapper.get(DATA_TEST_DECREMENT).trigger("click");

  expect(wrapper.get(DATA_TEST_COUNT).text()).toBe("4");
});

test("resets counter to initial value", async () => {
  const wrapper = mount(Counter, {
    props: { initialCount: 10 },
  });

  await wrapper.get(DATA_TEST_INCREMENT).trigger("click");
  await wrapper.get(DATA_TEST_INCREMENT).trigger("click");
  await wrapper.get(DATA_TEST_RESET).trigger("click");

  expect(wrapper.get(DATA_TEST_COUNT).text()).toBe("10");
});
```

**Why good:** Awaits all trigger() calls, tests multiple interaction scenarios, uses props to control initial state

---

### Keyboard and Mouse Events

```typescript
// Good Example - Keyboard shortcuts and mouse events
import { mount } from "@vue/test-utils";
import { SearchInput } from "./search-input.vue";

const DATA_TEST_INPUT = '[data-test="search-input"]';
const DATA_TEST_SUGGESTION = '[data-test="suggestion"]';

test("submits search on Enter key", async () => {
  const wrapper = mount(SearchInput);

  const input = wrapper.get(DATA_TEST_INPUT);
  await input.setValue("vue testing");
  await input.trigger("keydown.enter");

  expect(wrapper.emitted("search")).toBeTruthy();
  expect(wrapper.emitted("search")![0][0]).toBe("vue testing");
});

test("closes dropdown on Escape key", async () => {
  const wrapper = mount(SearchInput);

  await wrapper.get(DATA_TEST_INPUT).setValue("test");
  // Assuming dropdown opens on input

  await wrapper.get(DATA_TEST_INPUT).trigger("keydown.escape");

  expect(wrapper.find(DATA_TEST_SUGGESTION).exists()).toBe(false);
});

test("selects suggestion on click", async () => {
  const wrapper = mount(SearchInput, {
    props: {
      suggestions: ["vue", "vue test utils", "vitest"],
    },
  });

  await wrapper.get(DATA_TEST_INPUT).setValue("v");
  await wrapper.findAll(DATA_TEST_SUGGESTION)[1].trigger("click");

  expect(wrapper.get(DATA_TEST_INPUT).element.value).toBe("vue test utils");
});
```

**Why good:** Tests keyboard shortcuts with proper modifiers, tests both keyboard and mouse interactions, verifies state changes after events

---

_For more patterns, see:_

- [async.md](async.md) - Async testing patterns
- [composables.md](composables.md) - Testing composables
- [mocking.md](mocking.md) - Pinia stores, Vue Router, stubs
