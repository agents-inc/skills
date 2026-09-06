# Vue Test Utils Reference

> Wrapper API tables, mounting options and the debug checklist. Decisions and red flags live in [SKILL.md](SKILL.md); worked code lives in [examples/](examples/core.md).

---

## Wrapper Queries

| Method                    | Returns      | Missing element            | Use for                       |
| ------------------------- | ------------ | -------------------------- | ----------------------------- |
| `get(selector)`           | DOMWrapper   | Throws, with rendered HTML | Element must exist            |
| `find(selector)`          | DOMWrapper   | Empty wrapper              | Element may not exist         |
| `findAll(selector)`       | DOMWrapper[] | Empty array                | Several elements              |
| `getComponent(comp)`      | VueWrapper   | Throws                     | Child component must exist    |
| `findComponent(comp)`     | VueWrapper   | Empty wrapper              | Child component may not exist |
| `findAllComponents(comp)` | VueWrapper[] | Empty array                | Several child components      |

`findComponent` also accepts `{ name: "ChildComponent" }`, which matches the registered name rather than the definition — useful when the component is not importable from the test, and fragile if the name is ever changed.

## DOM Interaction

All three return a promise that resolves after Vue flushes. Awaiting is not optional.

| Method            | Applies to                                                                      |
| ----------------- | ------------------------------------------------------------------------------- |
| `trigger(event)`  | Any element; supports `keydown.enter`, `submit.prevent` and other Vue modifiers |
| `setValue(value)` | `<input>`, `<textarea>`, `<select>` — a boolean for checkbox and radio          |
| `setProps(props)` | The wrapper root, to re-render with new props                                   |
| `setData(data)`   | Options API `data()` only — a no-op on a Composition API component              |

## Wrapper Properties and Assertions

| Member           | Returns                                                       |
| ---------------- | ------------------------------------------------------------- |
| `text()`         | Text content, whitespace collapsed                            |
| `html(options?)` | Rendered HTML; `{ raw: true }` skips pretty-printing          |
| `exists()`       | Whether the wrapper holds an element                          |
| `isVisible()`    | Visibility — needs `attachTo: document.body` to be meaningful |
| `classes()`      | All classes, or a boolean for one                             |
| `attributes()`   | All attributes, or one by name                                |
| `props()`        | All props, or one by name                                     |
| `emitted()`      | All emissions, or one event's array                           |
| `element`        | The underlying DOM node                                       |
| `vm`             | The component instance — an escape hatch, not a query         |

---

## Mounting Options

```typescript
mount(Component, {
  props: { title: "Hello", items: [1, 2, 3] },

  slots: {
    default: "<span>Default slot content</span>",
    header: HeaderComponent,
    footer: () => h("footer", "Footer content"),
    item: `<template #item="{ data }">{{ data.name }}</template>`, // scoped
  },

  attachTo: document.body, // required for focus, visibility and portal assertions
  shallow: true, // equivalent to shallowMount(), settable per call

  global: {
    plugins: [
      /* anything the app installs with app.use() */
    ],
    components: { Button: MyButton }, // registered globally rather than imported
    directives: { tooltip: vTooltip },
    stubs: {
      ChildComponent: true, // <child-component-stub>, no slots rendered
      CustomStub: { template: "<div><slot /></div>" }, // slot content preserved
      OtherChild: false, // opt out of a stub set elsewhere
    },
    provide: { theme: "dark" }, // satisfies inject() without an ancestor
    mocks: { $t: (key: string) => key }, // global properties the template reads
  },
});
```

### Project-wide defaults

```typescript
import { config, enableAutoUnmount } from "@vue/test-utils";

config.global.stubs = { RouterLink: true, RouterView: true };
config.global.renderStubDefaultSlot = true; // stubs render their default slot

enableAutoUnmount(afterEach); // unmount every wrapper, no per-test cleanup
```

`config.global` takes the same shape as a mount's `global` block and applies to every file in the process.

---

## Emitted Events

`emitted()` returns a record of event name to an array of emissions, each emission being the array of arguments passed to `$emit`. It accumulates for the lifetime of the wrapper.

```typescript
await wrapper.get('[data-test="form"]').trigger("submit");

expect(wrapper.emitted("submit")).toBeTruthy(); // emitted at all
expect(wrapper.emitted("submit")![0][0]).toEqual({ name: "John" }); // first emission, first arg

// Order across several interactions
await wrapper.get('[data-test="next"]').trigger("click");
await wrapper.get('[data-test="next"]').trigger("click");

expect(wrapper.emitted("step-change")).toHaveLength(2);
expect(wrapper.emitted("step-change")![0]).toEqual([1]);
expect(wrapper.emitted("step-change")![1]).toEqual([2]);
```

The double index is the part that catches people out: `[0]` selects the emission, `[0][0]` its first argument.

---

## Debug Checklist

When an assertion fails and the reason is not obvious:

1. **Print the render.** `wrapper.html()` shows what actually rendered — usually the fastest answer to "why does `get()` not find it".
2. **Check the awaits.** Every `trigger`, `setValue`, `setProps` and `setData` on the path to the assertion.
3. **Check for an unflushed promise.** A component that fetches on mount needs `flushPromises()` even though nothing was triggered.
4. **Check the selector reached the DOM.** A `data-test` attribute on a component tag lands on that component's root element only if it does not declare `inheritAttrs: false`.
5. **Check what was stubbed.** Under `shallowMount`, or a `config.global.stubs` set elsewhere, the element you are looking for may be inside a stub.
6. **Print the emissions.** `wrapper.emitted()` with no argument lists every event the component fired, which settles name and payload questions at once.
7. **Print the props.** `wrapper.props()` confirms what the component actually received, as opposed to what the test meant to pass.
8. **Check the API style.** `setData()` silently does nothing on a component written with `<script setup>` or a Composition API `setup()`.
