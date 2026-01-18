# Vue Test Utils Reference

> Decision frameworks, anti-patterns, and API reference. Reference from [SKILL.md](SKILL.md).

---

## Decision Framework

### Mount Strategy Decision Tree

```
Testing a Vue component?
├─ Does it have many heavy child components causing slow tests?
│   └─ YES → Consider shallowMount() or selective stubs
│       └─ mount(Component, { shallow: true })
│
├─ Do you need to test parent-child integration?
│   └─ YES → Use mount()
│       └─ mount(Component) // Children render normally
│
├─ Does a child component make unwanted API calls?
│   └─ YES → Stub that specific component
│       └─ mount(Component, { global: { stubs: { ApiChild: true } } })
│
└─ Default case?
    └─ Use mount() for realistic testing
```

### Query Method Decision Tree

```
Looking for an element?
├─ Must the element exist?
│   └─ YES → Use get()
│       └─ wrapper.get('[data-test="submit"]')
│       └─ Throws error if not found (test fails immediately)
│
├─ Might the element not exist?
│   └─ YES → Use find()
│       └─ wrapper.find('[data-test="error"]')
│       └─ Returns empty wrapper (check with .exists())
│
└─ Looking for multiple elements?
    └─ Use findAll()
        └─ wrapper.findAll('[data-test="list-item"]')
        └─ Returns array of wrappers
```

### Async Handling Decision Tree

```
What type of async operation?
├─ DOM update after reactive state change?
│   └─ await the DOM-updating method
│       └─ await wrapper.trigger('click')
│       └─ await wrapper.setValue('text')
│
├─ External Promise (API call, fetch)?
│   └─ Use flushPromises()
│       └─ await flushPromises()
│
├─ setTimeout/setInterval?
│   └─ Use Vitest fake timers
│       └─ vi.useFakeTimers()
│       └─ vi.advanceTimersByTime(1000)
│
└─ Component with async setup()?
    └─ Wrap in Suspense
        └─ mount(Suspense, { slots: { default: AsyncComponent } })
```

### Selector Strategy Decision Tree

```
What selector to use?
├─ Is there a data-test attribute?
│   └─ YES → Use it (preferred)
│       └─ wrapper.get('[data-test="button"]')
│
├─ Testing a child Vue component?
│   └─ YES → Use findComponent()
│       └─ wrapper.findComponent(ChildComponent)
│
├─ Need to query by element type?
│   └─ Use element selector
│       └─ wrapper.get('button')
│       └─ Less preferred - add data-test if possible
│
└─ CSS class/ID available?
    └─ Avoid - these change with styling
        └─ Add data-test attribute instead
```

---

## Wrapper API Reference

### Query Methods

| Method | Returns | Throws on No Match | Use Case |
|--------|---------|-------------------|----------|
| `get(selector)` | DOMWrapper | Yes | Element must exist |
| `find(selector)` | DOMWrapper | No (empty wrapper) | Element may not exist |
| `findAll(selector)` | DOMWrapper[] | No (empty array) | Multiple elements |
| `getComponent(comp)` | VueWrapper | Yes | Child component must exist |
| `findComponent(comp)` | VueWrapper | No (empty wrapper) | Child component may not exist |
| `findAllComponents(comp)` | VueWrapper[] | No (empty array) | Multiple child components |

**Note:** `getComponent` vs `findComponent` follows the same pattern as `get` vs `find`:
- Use `getComponent` when the component **must** exist (clearer error messages)
- Use `findComponent` when the component **may not** exist (check with `.exists()`)

### DOM Interaction Methods

| Method | Description | Returns | Must Await |
|--------|-------------|---------|------------|
| `trigger(event)` | Triggers DOM event | Promise | **Yes** |
| `setValue(value)` | Sets input/select value | Promise | **Yes** |
| `setChecked(checked?)` | Sets checkbox/radio state | Promise | **Yes** |
| `setSelected()` | Selects option element | Promise | **Yes** |

### Wrapper Properties

| Property | Description | Example |
|----------|-------------|---------|
| `vm` | Component instance | `wrapper.vm.someMethod()` |
| `element` | Root DOM element | `wrapper.element.tagName` |
| `props()` | Get all props | `wrapper.props()` |
| `props(key)` | Get specific prop | `wrapper.props('title')` |
| `emitted()` | Get all emitted events | `wrapper.emitted()` |
| `emitted(event)` | Get specific event emissions | `wrapper.emitted('submit')` |

### Assertion Helpers

| Method | Description | Example |
|--------|-------------|---------|
| `exists()` | Element exists in DOM | `wrapper.find('.error').exists()` |
| `isVisible()` | Element is visible | `wrapper.get('.modal').isVisible()` |
| `text()` | Get text content | `wrapper.get('h1').text()` |
| `html(options?)` | Get HTML content | `wrapper.html()` or `wrapper.html({ raw: true })` |
| `classes()` | Get CSS classes | `wrapper.classes()` |
| `classes(name)` | Check for class | `wrapper.classes('active')` |
| `attributes()` | Get all attributes | `wrapper.attributes()` |
| `attributes(key)` | Get specific attribute | `wrapper.attributes('disabled')` |

---

## Mounting Options Reference

### Global Options

```typescript
mount(Component, {
  global: {
    // Register plugins
    plugins: [pinia, router],

    // Register global components
    components: {
      Button: MyButton,
    },

    // Register global directives
    directives: {
      tooltip: vTooltip,
    },

    // Stub components
    stubs: {
      ChildComponent: true, // Replace with stub
      OtherChild: false,    // Don't stub this one
      CustomStub: { template: '<div>stub</div>' },
    },

    // Provide/inject values
    provide: {
      theme: 'dark',
    },

    // Mock global properties ($t, $router, etc.)
    mocks: {
      $t: (key: string) => key,
      $router: { push: vi.fn() },
    },
  },
});
```

### Props and Slots

```typescript
mount(Component, {
  // Pass props
  props: {
    title: 'Hello',
    items: [1, 2, 3],
  },

  // Pass slots
  slots: {
    default: '<span>Default slot content</span>',
    header: HeaderComponent,
    footer: () => h('footer', 'Footer content'),
  },

  // Pass scoped slots
  slots: {
    item: `<template #item="{ data }">{{ data.name }}</template>`,
  },
});
```

### Attachments

```typescript
mount(Component, {
  // Attach to document (needed for focus, portal testing)
  attachTo: document.body,

  // IMPORTANT: Clean up after test
  // wrapper.unmount() removes from document
});
```

### Global Configuration

```typescript
import { config } from "@vue/test-utils";

// Set project-wide defaults (same structure as mounting `global` options)
config.global.stubs = {
  RouterLink: true,
  RouterView: true,
};

// Render default slot content even in shallow mounts
config.global.renderStubDefaultSlot = true;

// Auto-unmount wrappers after tests (Vitest example)
import { enableAutoUnmount } from "@vue/test-utils";

enableAutoUnmount(afterEach);
```

---

## Anti-Patterns to Avoid

### Not Awaiting DOM Updates

```typescript
// ANTI-PATTERN
test("updates counter", () => {
  const wrapper = mount(Counter);

  // DON'T: Missing await
  wrapper.get("button").trigger("click");

  // Assertion runs before DOM updates
  expect(wrapper.text()).toContain("1"); // FLAKY
});
```

**Why it's wrong:** Vue updates the DOM asynchronously. Without `await`, the assertion runs before the update completes.

**What to do instead:**

```typescript
test("updates counter", async () => {
  const wrapper = mount(Counter);

  // DO: Always await DOM-updating methods
  await wrapper.get("button").trigger("click");

  expect(wrapper.text()).toContain("1"); // Reliable
});
```

---

### Using shallowMount by Default

```typescript
// ANTI-PATTERN
test("renders todo list", () => {
  // DON'T: shallowMount by default
  const wrapper = shallowMount(TodoList, {
    props: { todos: mockTodos },
  });

  // Child components are stubbed - not testing integration
  expect(wrapper.findAllComponents(TodoItem)).toHaveLength(3);
});
```

**Why it's wrong:** `shallowMount` replaces all child components with stubs. The component behaves differently from production, and you lose integration coverage.

**What to do instead:**

```typescript
test("renders todo list", () => {
  // DO: Use mount() for realistic testing
  const wrapper = mount(TodoList, {
    props: { todos: mockTodos },
  });

  // Actually tests that TodoItem renders correctly
  expect(wrapper.findAllComponents(TodoItem)).toHaveLength(3);
});
```

---

### Using CSS Classes as Selectors

```typescript
// ANTI-PATTERN
test("shows error message", async () => {
  const wrapper = mount(LoginForm);

  await wrapper.get("form").trigger("submit");

  // DON'T: CSS classes change with styling
  expect(wrapper.get(".error-message").text()).toContain("Required");
  expect(wrapper.get("#submit-btn").exists()).toBe(true);
});
```

**Why it's wrong:** CSS classes and IDs are styling concerns. They change during refactoring without affecting behavior.

**What to do instead:**

```typescript
test("shows error message", async () => {
  const wrapper = mount(LoginForm);

  await wrapper.get('[data-test="form"]').trigger("submit");

  // DO: Use data-test attributes
  expect(wrapper.get('[data-test="error"]').text()).toContain("Required");
  expect(wrapper.get('[data-test="submit"]').exists()).toBe(true);
});
```

---

### Forgetting flushPromises for API Calls

```typescript
// ANTI-PATTERN
test("displays user data", async () => {
  vi.mocked(fetchUser).mockResolvedValue({ name: "John" });
  const wrapper = mount(UserProfile);

  // DON'T: Missing flushPromises - Promise hasn't resolved
  expect(wrapper.text()).toContain("John"); // FAILS
});
```

**Why it's wrong:** Vue's reactivity doesn't track external Promises. Without `flushPromises()`, the API call hasn't resolved when you assert.

**What to do instead:**

```typescript
test("displays user data", async () => {
  vi.mocked(fetchUser).mockResolvedValue({ name: "John" });
  const wrapper = mount(UserProfile);

  // DO: Wait for promises to resolve
  await flushPromises();

  expect(wrapper.text()).toContain("John"); // Passes
});
```

---

### Testing Implementation Details

```typescript
// ANTI-PATTERN
test("counter internal state", () => {
  const wrapper = mount(Counter);

  // DON'T: Accessing internal state directly
  expect(wrapper.vm.count).toBe(0);

  wrapper.vm.increment(); // Calling internal method

  expect(wrapper.vm.count).toBe(1);
});
```

**Why it's wrong:** Tests internal implementation, not behavior. Refactoring the component breaks tests even if behavior is correct.

**What to do instead:**

```typescript
test("counter increments on click", async () => {
  const wrapper = mount(Counter);

  // DO: Test through user interactions
  expect(wrapper.text()).toContain("0");

  await wrapper.get('[data-test="increment"]').trigger("click");

  expect(wrapper.text()).toContain("1");
});
```

---

### Manual Pinia Store Mocking

```typescript
// ANTI-PATTERN
test("uses store data", () => {
  // DON'T: Manual store mocking is verbose and error-prone
  const mockStore = {
    user: { name: "John" },
    isAuthenticated: true,
    login: vi.fn(),
  };

  vi.mock("@/stores/auth", () => ({
    useAuthStore: () => mockStore,
  }));

  // ...
});
```

**Why it's wrong:** Manual mocking is verbose, doesn't include Pinia's behavior, and requires resetting between tests.

**What to do instead:**

```typescript
import { createTestingPinia } from "@pinia/testing";

test("uses store data", () => {
  // DO: Use createTestingPinia
  const wrapper = mount(Component, {
    global: {
      plugins: [
        createTestingPinia({
          initialState: {
            auth: { user: { name: "John" }, isAuthenticated: true },
          },
        }),
      ],
    },
  });

  // Store behaves correctly with stubbed actions
});
```

---

## Common Emitted Events Patterns

### Checking Emitted Events

```typescript
test("emits submit event with form data", async () => {
  const wrapper = mount(ContactForm);

  await wrapper.get('[data-test="name"]').setValue("John");
  await wrapper.get('[data-test="email"]').setValue("john@example.com");
  await wrapper.get("form").trigger("submit");

  // Check event was emitted
  expect(wrapper.emitted("submit")).toBeTruthy();

  // Check event payload (first emission, first argument)
  expect(wrapper.emitted("submit")![0][0]).toEqual({
    name: "John",
    email: "john@example.com",
  });
});

test("emits multiple events in sequence", async () => {
  const wrapper = mount(StepWizard);

  await wrapper.get('[data-test="next"]').trigger("click");
  await wrapper.get('[data-test="next"]').trigger("click");

  // Check number of emissions
  expect(wrapper.emitted("step-change")).toHaveLength(2);

  // Check specific emissions
  expect(wrapper.emitted("step-change")![0]).toEqual([1]);
  expect(wrapper.emitted("step-change")![1]).toEqual([2]);
});
```

---

## Debug Checklist

When a test fails unexpectedly:

1. **Add `console.log(wrapper.html())`** to see current DOM state
2. **Check async handling** - did you `await` all DOM-updating methods?
3. **Check `flushPromises()`** - did you call it after API calls?
4. **Check selector** - is the `data-test` attribute actually on the element?
5. **Check mounting strategy** - is `shallowMount` stubbing needed children?
6. **Check mock setup** - is the mock returning the expected value?
7. **Check emitted events** - use `console.log(wrapper.emitted())` to debug
8. **Check component props** - use `console.log(wrapper.props())` to verify

---

## Vitest Matcher Reference for Vue

| Matcher | Use Case | Example |
|---------|----------|---------|
| `toBeTruthy()` | Event was emitted | `expect(wrapper.emitted('click')).toBeTruthy()` |
| `toHaveLength(n)` | Count elements/emissions | `expect(items).toHaveLength(3)` |
| `toContain(text)` | Text includes substring | `expect(wrapper.text()).toContain('Hello')` |
| `toEqual(value)` | Deep equality check | `expect(wrapper.emitted('submit')![0][0]).toEqual({ name: 'John' })` |
| `toBe(value)` | Strict equality | `expect(wrapper.props('title')).toBe('Hello')` |
| `toMatchSnapshot()` | Snapshot testing | `expect(wrapper.html()).toMatchSnapshot()` |
