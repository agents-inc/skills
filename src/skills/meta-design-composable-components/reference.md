# Composable Components — Reference

> Lookup tables for once the approach is settled: translating configuration props into parts, naming parts and state, the merge rules of each substitution shape, wiring roles, and the alignment checklist. The decisions and red flags are in [SKILL.md](SKILL.md); full implementations are in [examples/](examples/core.md).

---

## Configuration Prop to Composable Equivalent

| Configuration prop              | Composable equivalent                                   |
| ------------------------------- | ------------------------------------------------------- |
| `title="..."`                   | `<Root.Title>` part                                     |
| `description="..."`             | `<Root.Description>` part                               |
| `showCloseButton`               | Render a `<Root.Close>` part, or don't                  |
| `closeButtonLabel="..."`        | The consumer's `aria-label` on their own `<Root.Close>` |
| `hideBackdrop`                  | Render a `<Root.Backdrop>` part, or don't               |
| `icon={<Icon />}`               | Children of the part that should contain it             |
| `renderFooter={(close) => ...}` | Children, with `<Root.Close>` reading context           |
| `renderItem={(item) => ...}`    | `<Root.Item>` with arbitrary children                   |
| `items={[...]}`                 | `<Root.Item>` children registering with the `Root`      |
| `groupBy="category"`            | `<Root.Group>` + `<Root.GroupLabel>` markup             |
| `emptyMessage="..."`            | The consumer's conditional JSX inside the popup         |
| `size` / `padding` / `bgColor`  | The consumer's `className` on the part                  |
| `as="a"` / `component={Link}`   | `asChild`, or the `render` prop                         |
| `isOpen` + `onClose`            | `open` + `defaultOpen` + `onOpenChange(open, details)`  |
| `disabled` / `modal` / `loop`   | Stay props — they change behaviour, not markup          |

---

## State Triple Naming

| State     | Controlled | Uncontrolled      | Change callback                       |
| --------- | ---------- | ----------------- | ------------------------------------- |
| Open      | `open`     | `defaultOpen`     | `onOpenChange(open, details)`         |
| Checked   | `checked`  | `defaultChecked`  | `onCheckedChange(checked, details)`   |
| Pressed   | `pressed`  | `defaultPressed`  | `onPressedChange(pressed, details)`   |
| Value     | `value`    | `defaultValue`    | `onValueChange(value, details)`       |
| Selection | `selected` | `defaultSelected` | `onSelectedChange(selected, details)` |
| Expansion | `expanded` | `defaultExpanded` | `onExpandedChange(expanded, details)` |

The mode is decided by `value !== undefined`, never by a `controlled` flag. `defaultX` is read once at mount. The callback fires in both modes.

---

## Change Details Object

| Field                  | Type         | Purpose                                                 |
| ---------------------- | ------------ | ------------------------------------------------------- |
| `reason`               | string union | Why the change happened — branch side effects on it     |
| `event`                | `Event`      | The originating DOM event, when there was one           |
| `cancel()`             | method       | Refuse the change without taking control of the state   |
| `isCanceled`           | boolean      | Whether `cancel()` was called                           |
| `allowPropagation()`   | method       | Re-allow a DOM event the component would otherwise stop |
| `isPropagationAllowed` | boolean      | Whether propagation was re-allowed                      |

The first four are the minimum; the propagation pair earns its place once a component stops propagation of the events it handles (Escape inside nested layers, say).

---

## Element Substitution

### The two shapes

| Concern              | `asChild`                                                     | `render`                                                                                                    |
| -------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Consumer-facing prop | `asChild?: boolean`                                           | `render?: ReactElement \| ((props, state) => ReactElement)`                                                 |
| What renders         | The part's single child, with the part's props merged onto it | The given element with the part's props merged onto it, or whatever the callback returns                    |
| Merge                | `mergeSlotProps(partProps, child.props)`                      | Element form: `mergeSlotProps(partProps, element.props)`; callback form: none — the consumer places `props` |
| Several children     | Throws — a slot needs exactly one element child               | Callback form — the consumer chooses which element gets `props`                                             |
| Component state      | Not exposed — style from `data-*` attributes                  | Callback form receives it as the second argument                                                            |

### Merge rules

These hold wherever a part's props are merged onto an element the consumer supplied — the `asChild` child, or the element given to `render`. In the callback form the consumer spreads `props` and composes their own handlers with them.

| Prop                           | Rule                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Event handlers                 | Both run — the consumer's first, then the part's                                                          |
| Suppressing the part's handler | The consumer calls `event.preventDefault()`; the part's handler, built with `composeEventHandlers`, skips |
| `className`                    | Joined — the part's first, then the consumer's                                                            |
| ID-reference ARIA props        | `aria-describedby` and `aria-labelledby` — ids from both sides joined, de-duplicated, the part's first    |
| `style`                        | Shallow-merged — the consumer's keys win                                                                  |
| `ref`                          | Composed — both receive the node                                                                          |
| Every other prop               | The consumer's value wins                                                                                 |

A headless library's own merge helper can differ on any row — handler order, which side wins, how refs travel, the escape hatch. Parts built over a library follow its helper and its rules; that library's own skill covers them.

---

## Part Naming Conventions

| Part          | Responsibility                                                    |
| ------------- | ----------------------------------------------------------------- |
| `Root`        | Owns state and context; renders no DOM element in most primitives |
| `Trigger`     | Opens or toggles; carries `aria-expanded` / `aria-haspopup`       |
| `Portal`      | Moves subsequent parts out of the DOM flow                        |
| `Backdrop`    | The dismissible surface behind a modal layer                      |
| `Positioner`  | Owns computed coordinates; publishes `data-side` / `data-align`   |
| `Popup`       | The panel itself; carries the role and the labelling attributes   |
| `Arrow`       | Positioned pointer, rotated from `data-side`                      |
| `Title`       | Registers the id consumed by `aria-labelledby`                    |
| `Description` | Registers the id consumed by `aria-describedby`                   |
| `Close`       | Any element that dismisses; works anywhere inside the `Root`      |
| `Item`        | A registered, navigable entry                                     |
| `ItemText`    | Marks an item's label for typeahead and value display             |
| `Indicator`   | Renders only in a specific state (checked, selected)              |
| `Group`       | Groups items; carries `role="group"`                              |
| `GroupLabel`  | Labels a group via a registered id                                |
| `Value`       | Displays the current value, with a `placeholder` when empty       |

Export them namespaced (`Dialog.Trigger`) so a part's `Root` is unambiguous at every call site.

---

## State Attribute Vocabulary

| Attribute                                 | Kind     | Meaning                                                     |
| ----------------------------------------- | -------- | ----------------------------------------------------------- |
| `data-state="open" \| "closed"`           | value    | Disclosure state (one-attribute vocabulary)                 |
| `data-open` / `data-closed`               | presence | Disclosure state (presence vocabulary)                      |
| `data-popup-open`                         | presence | On a trigger, while its popup is open                       |
| `data-pressed`                            | presence | A toggle that is on, or a trigger while it is being pressed |
| `data-highlighted`                        | presence | The item active for keyboard navigation                     |
| `data-selected` / `data-checked`          | presence | Selection state                                             |
| `data-disabled`                           | presence | Non-interactive — never written as `="false"`               |
| `data-side="top" \| "right" \| ...`       | value    | The side a popup landed on, after measurement               |
| `data-align="start" \| "center" \| "end"` | value    | Alignment along that side                                   |
| `data-orientation`                        | value    | Composite widget axis                                       |
| `data-starting-style`                     | presence | Present while the element begins animating in               |
| `data-ending-style`                       | presence | Present while the element animates out, before unmount      |

Enumerated states are attribute values; boolean states are attribute presence.

---

## ARIA Wiring by Widget

| Widget    | Trigger carries                                                              | Panel/list carries                                                   |
| --------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Dialog    | `aria-haspopup="dialog"`, `aria-expanded`                                    | `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby` |
| Popover   | `aria-expanded`, `aria-controls`                                             | `role="dialog"` when it contains focusables                          |
| Tooltip   | `aria-describedby` while open                                                | `role="tooltip"`                                                     |
| Menu      | `aria-haspopup="menu"`, `aria-expanded`                                      | `role="menu"`, items `role="menuitem"`                               |
| Listbox   | `aria-haspopup="listbox"`, `aria-expanded`                                   | `role="listbox"`, items `role="option"` + `aria-selected`            |
| Combobox  | `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant` | `role="listbox"`                                                     |
| Accordion | `aria-expanded`, `aria-controls`                                             | `role="region"`, `aria-labelledby` pointing at the trigger           |
| Tabs      | `role="tab"`, `aria-selected`, `aria-controls`                               | `role="tabpanel"`, `aria-labelledby`                                 |

---

## Keyboard Contract by Widget

| Widget           | Keys the component must own                                               |
| ---------------- | ------------------------------------------------------------------------- |
| Dialog (modal)   | `Escape` closes; `Tab`/`Shift+Tab` trapped                                |
| Popover          | `Escape` closes; focus returns to the trigger                             |
| Menu             | `ArrowUp`/`ArrowDown`, `Home`/`End`, typeahead, `Escape`, `Enter`/`Space` |
| Listbox          | Arrows, `Home`/`End`, typeahead, `Enter` selects, `Escape` closes         |
| Combobox         | Arrows move `aria-activedescendant`; input keeps focus                    |
| Tabs (automatic) | Arrows move and activate; `Home`/`End` jump                               |
| Tabs (manual)    | Arrows move focus only; `Enter`/`Space` activates                         |
| Accordion        | Arrows move between triggers; `Home`/`End` jump                           |
| Slider           | Arrows step; `PageUp`/`PageDown` step large; `Home`/`End` to bounds       |

Call `preventDefault()` only for keys actually handled — unhandled keys must reach the consumer and the browser.

---

## Alignment Checklist

Signs a component needs it: more than about three boolean props, a design change that needs a new prop rather than different JSX, markup the consumer did not ask for, state that lives only inside or only outside the component, keyboard behaviour described nowhere but its own tests.

Run the component through the six axes in order — API shape first, because the later axes depend on which parts exist. Each failed line is one refactor.

**1. API shape**

- [ ] No boolean prop toggles the existence of markup
- [ ] No `renderX` prop exists that children on a part could not express
- [ ] Every region a consumer might want to change is a part or a child, not a prop
- [ ] Parts can be rearranged, omitted, duplicated and wrapped without breaking behaviour
- [ ] Parts are namespaced (`Dialog.Trigger`) so their `Root` is obvious

**2. State contract**

- [ ] Every exposed state ships as `value` + `defaultValue` + `onValueChange`
- [ ] The component works with zero state props (uncontrolled by default)
- [ ] No controlled prop is copied into `useState`
- [ ] The change callback fires in both modes
- [ ] The change callback carries a reason, and vetoable changes can be cancelled

**3. Element substitution**

- [ ] Every part that renders a DOM element supports substitution
- [ ] One shape (`asChild` or `render`) is used on every part
- [ ] Substitution merges rather than overwrites handlers, refs, `className` and `style`
- [ ] The documented escape hatch for suppressing internal handlers matches the shape used

**4. Styling contract**

- [ ] Every state is readable from the DOM as a `data-*` attribute
- [ ] Boolean states are attribute presence, never `="false"`
- [ ] No part ships a default `className`, colour, spacing or transition
- [ ] Inline styles are limited to functionally required values, exposed as CSS custom properties where possible
- [ ] The consumer's `className` and `style` always reach the DOM node

**5. Accessibility structure**

- [ ] Ids are generated and wired across parts through context, not through props
- [ ] `aria-labelledby`/`aria-describedby` are absent when the labelling part is absent
- [ ] Focus moves in on open and returns on close
- [ ] Composite widgets use roving tabindex or `aria-activedescendant` — one, not both
- [ ] Consumers can redirect focus through hooks rather than by forking

**6. Forwarding**

- [ ] Every part spreads its remaining props onto its DOM node
- [ ] Every part attaches its ref to that node
- [ ] Consumer handlers run first and can suppress the internal handler
- [ ] Defaults sit before the spread, wiring after
- [ ] Nothing the consumer passes is silently dropped
