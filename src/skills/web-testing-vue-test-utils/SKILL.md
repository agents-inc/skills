---
name: web-testing-vue-test-utils
description: Vue Test Utils — mount vs shallowMount, the wrapper API, awaiting DOM updates, flushPromises, testing composables, and the global mounting options. Load when writing or reviewing tests that mount Vue components.
---

# Vue Test Utils Patterns

> **Quick Guide:** `mount()` renders a component with its children; `shallowMount()` stubs them all and is the exception rather than the default. Query with `get()` when the element must exist and `find()` when it may not, using `data-test` attributes rather than classes. Every DOM-updating method returns a promise and is awaited; anything Vue's reactivity does not track — a request, a timer — needs `flushPromises()` as well. A component's environment arrives through the `global` mounting options.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — mounting, slots, `get`/`find`/`findAll`, `trigger`, `setValue`
- [examples/async.md](examples/async.md) — `flushPromises`, `nextTick`, debounced input, async `setup()` under Suspense
- [examples/composables.md](examples/composables.md) — through a component, in isolation, and with injected dependencies
- [examples/mocking.md](examples/mocking.md) — the four `global` seams: plugins, stubs, mocks, provide — and a custom mount that composes them
- [reference.md](reference.md) — wrapper API tables, mounting options, emitted-event patterns, debug checklist

---

## Which path applies

- **A component is the subject** — `mount` it and drive the wrapper;
  [examples/core.md](examples/core.md).
- **A composable is the subject** — mount a minimal component that calls it, so it runs inside a
  real setup scope; [examples/composables.md](examples/composables.md). Calling a composable outside
  a component works only for ones that register no lifecycle hooks and inject nothing.
- **The subject has an async `setup()`** — it must be mounted inside `Suspense`, or it never
  resolves; [examples/async.md](examples/async.md).

---

<critical_requirements>

## Before writing Vue Test Utils code

**Await every DOM-updating method — `trigger()`, `setValue()`, `setProps()`, `setData()`.** Each returns a promise that resolves after Vue has flushed, so an un-awaited call leaves the assertion looking at the pre-update DOM.

**Call `flushPromises()` after anything Vue's reactivity does not own** — a request, a timer callback, a promise chain started in `onMounted`. Awaiting the interaction flushes Vue's queue and nothing else.

**Reach for `mount()` first, and treat `shallowMount()` as the exception.** Stubbing every child changes how the component behaves, so a shallow test passes for a tree that does not render.

**Select with `data-test` attributes.** Classes and ids belong to styling and move under a restyle; a `data-test` attribute is a stated contract that a reader can see is load-bearing.

**Supply the component's environment through the `global` mounting options** — `plugins`, `stubs`, `mocks`, `provide`. That is the seam the library gives you, and it keeps the arrangement visible at the mount rather than hidden in module-level substitution.

</critical_requirements>

---

**Auto-detection:** @vue/test-utils, mount, shallowMount, VueWrapper, DOMWrapper, wrapper.get, wrapper.find, findAll, findComponent, findAllComponents, getComponent, trigger, setValue, setProps, setData, flushPromises, emitted, enableAutoUnmount, attachTo, renderStubDefaultSlot, config.global

**Applies to:**

- Mounting a Vue component and asserting on what it rendered
- Driving clicks, typing, selection and keyboard events through the wrapper
- Asserting on emitted events and their payloads
- Deciding between full mount, selective stubs and shallow rendering
- Testing a composable, in a component or in isolation
- Supplying plugins, stubs, global properties and injected values at mount time

**Handled elsewhere:**

- Test runner mechanics — the file's `describe`/`it`, the assertion API, module substitution, mock
  functions and fake timers all belong to whatever runs the file
- Store design and its own test helpers — a store's testing plugin is installed through
  `global.plugins`, and how to configure it is settled by whoever owns the store
- Route definition and navigation guards — a router installs as a plugin like any other
- Journeys spanning navigations and a real backend — browser-driven end-to-end coverage
- Whether the rendered result still looks right — pixel comparison against an approved image

---

<philosophy>

## Philosophy

**Vue's DOM updates are asynchronous, and the library's API is shaped around that one fact.** `trigger`, `setValue`, `setProps` and `setData` all return promises for the same reason: the effect of the change is not observable on the line after it. Most flaky Vue component tests are a missing `await` on one of those four.

**Two async queues, two tools.** Awaiting a wrapper method flushes Vue's own render queue. `flushPromises()` drains the microtask queue, which is where a resolved request or a settled promise chain is waiting. A component that fetches on mount needs the second even though nothing was triggered.

**Stubbing is a dial, not a switch.** `shallowMount` is the far end of it — every child replaced, slots inert, integration coverage gone. Stubbing the one heavy child by name keeps the rest of the tree real and usually solves the actual problem, which is a chart library or a network call rather than depth.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Mounting

```typescript
import { mount, shallowMount } from "@vue/test-utils";

// Default: children render, slots work, events bubble
const wrapper = mount(TodoList, {
  props: { todos: [{ id: 1, text: "Test", done: false }] },
});

// Every child stubbed - reach for this only when depth itself is the problem
const shallow = shallowMount(TodoList, { props: { todos: [] } });

// Usually better than shallow: stub the one child that misbehaves
const selective = mount(Dashboard, {
  global: { stubs: { HeavyChartWidget: { template: "<div />" } } },
});
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Querying the Wrapper

`get*` throws with a useful message when the element is missing; `find*` returns an empty wrapper you then check with `.exists()`. The same split applies to `getComponent` / `findComponent`.

```typescript
const input = wrapper.get('[data-test="search-input"]'); // must exist
expect(wrapper.find('[data-test="error"]').exists()).toBe(false); // may not exist
expect(wrapper.findAll('[data-test="result"]')).toHaveLength(3);

expect(wrapper.getComponent(ChildComponent).props("message")).toBe("Hello");
```

Using `find()` where `get()` was meant is the quiet failure: the empty wrapper satisfies nothing, and the assertion after it reports a confusing type error rather than "element not found".

Full code: [examples/core.md](examples/core.md)

### Pattern 3: Interaction and Emitted Events

```typescript
await wrapper.get('[data-test="email"]').setValue("test@example.com");
await wrapper.get('[data-test="form"]').trigger("submit.prevent");

expect(wrapper.emitted("submit")).toBeTruthy();
expect(wrapper.emitted("submit")![0]).toEqual([{ email: "test@example.com" }]);
```

`emitted()` accumulates across the whole test, so index into it rather than asserting on the array as a whole after several interactions.

Full code: [examples/core.md](examples/core.md)

### Pattern 4: flushPromises for Untracked Async

```typescript
import { mount, flushPromises } from "@vue/test-utils";

const wrapper = mount(UserProfile, { props: { userId: 1 } });

expect(wrapper.find('[data-test="loading"]').exists()).toBe(true);

await flushPromises(); // the request settles, then Vue re-renders

expect(wrapper.get('[data-test="user-name"]').text()).toBe("John Doe");
```

`flushPromises()` drains microtasks only. A `setTimeout` needs the runner's fake timers advanced first, and then `flushPromises()` for whatever the callback started.

Full code: [examples/async.md](examples/async.md)

### Pattern 5: Testing Composables

Mount a component whose only job is to call the composable, so lifecycle hooks and `inject` work as they do in production.

```typescript
function withSetup<T>(composable: () => T) {
  let result!: T;
  const wrapper = mount(
    defineComponent({ setup: () => ((result = composable()), () => null) }),
  );
  return { result, unmount: () => wrapper.unmount() };
}

const { result, unmount } = withSetup(() =>
  useLocalStorage("draft", "initial"),
);
```

Where the composable is inseparable from its UI, render a small template around it and assert on the DOM instead — the reactivity is then covered rather than assumed.

Full code: [examples/composables.md](examples/composables.md)

### Pattern 6: The global Mounting Options

Four seams, each for a different kind of dependency, all set at the mount and all settable project-wide through `config.global`.

```typescript
mount(Component, {
  global: {
    plugins: [
      /* anything installed with app.use() - a store, a router, an i18n instance */
    ],
    stubs: { RouterLink: true, HeavyChart: { template: "<div />" } },
    mocks: { $t: (key: string) => key }, // global properties the template reads
    provide: { [THEME_KEY]: { theme: ref("light") } }, // what an ancestor would provide
  },
});
```

Wrap these in a custom mount once, so a test states only what makes it different.

Full code: [examples/mocking.md](examples/mocking.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A `trigger()`, `setValue()`, `setProps()` or `setData()` without `await` — the assertion reads the DOM before Vue has flushed, so the test passes or fails by timing
- No `flushPromises()` after a request resolves — the loading branch is still rendered when the assertion runs
- `setData()` on a component written with the Composition API — it only reaches an Options API `data()` function, so the call silently changes nothing
- A component with an async `setup()` mounted directly instead of inside `Suspense` — it never resolves and the wrapper stays on the fallback
- `isVisible()` without `attachTo: document.body` — the element is not in a rendered document, so visibility cannot be computed correctly
- `trigger("click")` on a disabled element — the browser drops it, and so does the library; that is correct behaviour rather than a bug to work around

**Surprising behaviour:**

- `shallowMount` stubs every child including ones from a component library, so a test can pass against a tree that renders nothing
- `find()` returns an empty wrapper rather than throwing, which turns a missing element into a confusing error one line later
- `emitted()` accumulates for the lifetime of the wrapper — asserting a length after several interactions counts all of them
- `setValue()` applies only to `<input>`, `<textarea>` and `<select>`; on anything else it is a no-op
- `trigger()` already awaits `nextTick`, so an extra `await nextTick()` after it is redundant
- Reaching into `wrapper.vm` to call a method or read state couples the test to the implementation; drive the component through the DOM instead
- A wrapper mounted with `attachTo` stays in the document until unmounted — register `enableAutoUnmount` once rather than remembering per test

</red_flags>
