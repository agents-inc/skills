# Composable Components Quick Reference

> Lookup tables for translating configuration props into parts, naming parts and state, and wiring roles. See [SKILL.md](SKILL.md) for the patterns, the red flags and the alignment checklist, and [examples/](examples/) for full implementations.

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
| `as="a"` / `component={Link}`   | `asChild` + Slot, or the `render` prop                  |
| `isOpen` + `onClose`            | `open` + `defaultOpen` + `onOpenChange(open, details)`  |
| `disabled` / `modal` / `loop`   | Stay props -- they change behavior, not markup          |

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

Rules: the mode is decided by `value !== undefined`, never by a `controlled` flag. `defaultX` is read once at mount. The callback fires in both modes.

---

## Change Details Object

| Field                  | Type         | Purpose                                                 |
| ---------------------- | ------------ | ------------------------------------------------------- |
| `reason`               | string union | Why the change happened -- branch side effects on it    |
| `event`                | `Event`      | The originating DOM event, when there was one           |
| `cancel()`             | method       | Refuse the change without taking control of the state   |
| `isCanceled`           | boolean      | Whether `cancel()` was called                           |
| `allowPropagation()`   | method       | Re-allow a DOM event the component would otherwise stop |
| `isPropagationAllowed` | boolean      | Whether propagation was re-allowed                      |

---

## Polymorphism API Surface

| Concern                   | Slot-based                                        | `render`-based                                            |
| ------------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| Consumer-facing prop      | `asChild?: boolean`                               | `render?: ReactElement \| (props, state) => ReactElement` |
| Import                    | `import { Slot } from "radix-ui"`                 | `import { useRender } from "@base-ui/react/use-render"`   |
| Element to render         | `asChild ? Slot.Root : "button"`                  | `useRender({ defaultTagName: "button", render, props })`  |
| Prop merging helper       | hand-composed, or the primitive's own composition | `import { mergeProps } from "@base-ui/react/merge-props"` |
| Multiple children         | `Slot.Slottable`                                  | Place `props` yourself in the callback form               |
| Typed slot                | `Slot.createSlot<TElement, TProps>(name)`         | `useRender.ComponentProps<"button">`                      |
| Ref composition           | Composed onto the child by the slot               | `useRender`'s `ref` parameter accepts an array of refs    |
| Suppress internal handler | `event.preventDefault()` in the consumer handler  | `event.preventBaseUIHandler()` in the consumer handler    |
| State-driven class/style  | Attribute selectors in CSS                        | `className` / `style` also accept `(state) => ...`        |

`mergeProps` takes up to five prop objects; use `mergePropsN(propsArray)` beyond that. It does not merge refs -- only the rightmost survives.

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
| `Close`       | Any element that dismisses; readable anywhere inside the `Root`   |
| `Item`        | A registered, navigable entry                                     |
| `ItemText`    | Marks an item's label for typeahead and value display             |
| `Indicator`   | Renders only in a specific state (checked, selected)              |
| `Group`       | Groups items; carries `role="group"`                              |
| `GroupLabel`  | Labels a group via a registered id                                |
| `Value`       | Displays the current value, with a `placeholder` when empty       |

Export them namespaced (`Dialog.Trigger`) so a part's `Root` is unambiguous at every call site.

---

## State Attribute Vocabulary

| Attribute                                 | Kind     | Meaning                                             |
| ----------------------------------------- | -------- | --------------------------------------------------- |
| `data-state="open" \| "closed"`           | value    | Disclosure state (one-attribute vocabulary)         |
| `data-open` / `data-closed`               | presence | Disclosure state (presence vocabulary)              |
| `data-popup-open`                         | presence | On a trigger, when its popup is open                |
| `data-pressed`                            | presence | Pointer is currently down on the element            |
| `data-highlighted`                        | presence | Item is the active one for keyboard navigation      |
| `data-selected` / `data-checked`          | presence | Selection state                                     |
| `data-disabled`                           | presence | Non-interactive -- never write `="false"`           |
| `data-side="top" \| "right" \| ...`       | value    | Which side a popup was placed on, after measurement |
| `data-align="start" \| "center" \| "end"` | value    | Alignment along that side                           |
| `data-orientation`                        | value    | Composite widget axis                               |
| `data-starting-style`                     | presence | Present for the first frame, for entry animations   |
| `data-ending-style`                       | presence | Present while exiting, before unmount               |

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

Call `preventDefault()` only for keys actually handled -- unhandled keys must reach the consumer and the browser.
