# Base UI Reference

> Lookup tables, checklists, migration notes and version history. See [SKILL.md](SKILL.md) for the decision trees, concepts and red flags, and [examples/](examples/) for full implementations and anti-patterns with code. **Current: v1.7.0** — package `@base-ui/react`.

---

## Package and Imports

| Item               | Value                                                             |
| ------------------ | ----------------------------------------------------------------- |
| Package            | `@base-ui/react`                                                  |
| Deprecated package | `@base-ui-components/react` — stopped at `1.0.0-rc.0`, do not use |
| Component import   | `import { Popover } from "@base-ui/react/popover"`                |
| Utility import     | `import { useRender } from "@base-ui/react/use-render"`           |
| Subpath convention | lowercase, kebab-case component name                              |

---

## Utilities

| Utility             | Subpath                             | Purpose                                                            |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `useRender`         | `@base-ui/react/use-render`         | Give your own components the same `render` prop API                |
| `mergeProps`        | `@base-ui/react/merge-props`        | Merge prop sets with handler chaining and className/style joining  |
| `DirectionProvider` | `@base-ui/react/direction-provider` | Declare RTL/LTR so positioning and keyboard order follow           |
| `CSPProvider`       | `@base-ui/react/csp-provider`       | Supply a nonce for injected styles under a Content Security Policy |

`Field.Root` labels and validates any control of this library placed inside it — `Input`, `Select`, `Combobox`, `NumberField`, `Radio`, `Switch` — not only `Field.Control`.

---

## Component Coverage (v1.7.0)

Accordion, Alert Dialog, Autocomplete, Avatar, Button, Checkbox, Checkbox Group, Collapsible, Combobox, Context Menu, Dialog, Drawer, Field, Fieldset, Form, Input, Menu, Menubar, Meter, Navigation Menu, Number Field, OTP Field, Popover, Preview Card, Progress, Radio, Scroll Area, Select, Separator, Slider, Switch, Tabs, Toast, Toggle, Toggle Group, Toolbar, Tooltip.

---

## Data Attributes

| Attribute                 | Where                  | Meaning                                                   |
| ------------------------- | ---------------------- | --------------------------------------------------------- |
| `data-open`               | Popup, Arrow, Backdrop | The popup is open                                         |
| `data-closed`             | Popup, Arrow, Backdrop | The popup is closed                                       |
| `data-popup-open`         | Trigger                | The trigger's popup is open                               |
| `data-pressed`            | Trigger                | The trigger is being pressed                              |
| `data-starting-style`     | Popup                  | Present for the entering frame of a transition            |
| `data-ending-style`       | Popup                  | Present during the exit transition                        |
| `data-instant`            | Popup                  | Animation was deliberately skipped                        |
| `data-side`               | Popup, Arrow           | `top`/`bottom`/`left`/`right`/`inline-start`/`inline-end` |
| `data-align`              | Popup, Arrow           | `start`/`center`/`end`                                    |
| `data-uncentered`         | Arrow                  | Collision handling left the arrow off the anchor's centre |
| `data-nested`             | Dialog Popup           | Nested inside another dialog                              |
| `data-nested-dialog-open` | Dialog Popup           | This dialog has a nested dialog open                      |
| `data-selected`           | Item                   | The item is the current selection                         |
| `data-highlighted`        | Item                   | The item is focused via keyboard/pointer navigation       |
| `data-disabled`           | most parts             | The part ignores interaction                              |
| `data-readonly`           | Trigger, Control       | The value cannot be edited                                |
| `data-required`           | Trigger, Control       | A value is required                                       |
| `data-placeholder`        | Select Trigger         | No value chosen yet                                       |
| `data-valid`              | Field.Root             | The field passes validation                               |
| `data-invalid`            | Field.Root             | The field fails validation                                |
| `data-dirty`              | Field.Root             | The value has changed from its initial value              |
| `data-touched`            | Field.Root             | The field has been interacted with                        |
| `data-filled`             | Field.Root             | The field has a value                                     |
| `data-focused`            | Field.Root             | The field's control has focus                             |

Each component's API page is authoritative for the parts it exposes — the table above is the recurring set, not an exhaustive list.

---

## Positioner Props

| Prop                   | Default                | Purpose                                                      |
| ---------------------- | ---------------------- | ------------------------------------------------------------ |
| `side`                 | `"bottom"`             | Edge of the anchor to attach to                              |
| `align`                | `"center"`             | Alignment along that edge                                    |
| `sideOffset`           | `0`                    | Gap between anchor and popup, in px                          |
| `alignOffset`          | `0`                    | Shift along the alignment axis, in px                        |
| `collisionBoundary`    | `"clipping-ancestors"` | Box the popup must stay inside                               |
| `collisionPadding`     | `5`                    | Minimum distance kept from that box                          |
| `arrowPadding`         | `5`                    | Minimum distance between arrow and popup edges               |
| `sticky`               | `false`                | Keep the popup visible as the anchor scrolls out of view     |
| `positionMethod`       | `"absolute"`           | `"fixed"` escapes transformed / contained ancestors          |
| `anchor`               | the trigger            | Position against an arbitrary element or virtual rect        |
| `alignItemWithTrigger` | `true` (Select only)   | Align the selected item's text over the trigger's value text |

---

## CSS Variables

| Variable             | Purpose                                          |
| -------------------- | ------------------------------------------------ |
| `--anchor-width`     | Width of the anchor, for trigger-matching popups |
| `--available-height` | Height the positioner found, for `max-height`    |
| `--popup-width`      | The popup's own measured width                   |
| `--popup-height`     | The popup's own measured height                  |

---

## eventDetails

| Member                 | Type                   | Purpose                                                        |
| ---------------------- | ---------------------- | -------------------------------------------------------------- |
| `reason`               | `string`               | Why the change was requested — values documented per component |
| `event`                | `Event`                | The native DOM event that caused it                            |
| `cancel()`             | `() => void`           | Prevent the internal state from updating                       |
| `allowPropagation()`   | `() => void`           | Let the DOM event propagate where Base UI would stop it        |
| `isCanceled`           | `boolean`              | Read-only: `cancel()` has already been called                  |
| `isPropagationAllowed` | `boolean`              | Read-only: propagation has already been permitted              |
| `trigger`              | `Element \| undefined` | The element that triggered the event, where applicable         |

Select's documented `reason` values: `trigger-press`, `outside-press`, `escape-key`, `window-resize`, `item-press`, `focus-out`, `list-navigation`, `cancel-open`, `none`.

---

## mergeProps Precedence

| Prop            | Behaviour                                    |
| --------------- | -------------------------------------------- |
| Event handlers  | Executed rightmost-first                     |
| `className`     | Concatenated rightmost-first                 |
| `style`         | Merged; rightmost keys win                   |
| `ref`           | **Not merged** — only the rightmost survives |
| Everything else | Rightmost wins, like `Object.assign`         |

Takes up to five argument sets; use `mergePropsN` with an array beyond that. `event.preventBaseUIHandler()` suppresses Base UI's own handler inside a merged synthetic handler. Because `ref` is not merged, every ref that needs the node goes to `useRender`'s `ref` parameter, which accepts a single ref or an array.

---

## Anti-Patterns

Each one is written out as a "Bad Example" beside the pattern it belongs to:

| Anti-pattern                                          | Where                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| Positioning props on `Popup`                          | [examples/core.md](examples/core.md) Pattern 1               |
| A ref object read during render as `container`        | [examples/core.md](examples/core.md) Pattern 1a              |
| An anchor wrapped inside `Menu.Item`                  | [examples/core.md](examples/core.md) Pattern 2               |
| Transforming the `Positioner`                         | [examples/core.md](examples/core.md) Pattern 3               |
| `asChild`, and a `render` target that swallows props  | [examples/composition.md](examples/composition.md) Pattern 4 |
| Forgetting to spread in the function form             | [examples/composition.md](examples/composition.md) Pattern 5 |
| Assuming left-to-right `mergeProps` precedence        | [examples/composition.md](examples/composition.md) Pattern 7 |
| Mirroring state into React to drive styles            | [examples/styling.md](examples/styling.md) Pattern 8         |
| A transition with no boundary attributes              | [examples/styling.md](examples/styling.md) Pattern 11        |
| Animating a child and expecting unmount to wait       | [examples/styling.md](examples/styling.md) Pattern 11        |
| Controlling for no reason, controlled with no handler | [examples/state.md](examples/state.md) Patterns 12–13        |
| Returning early instead of cancelling                 | [examples/state.md](examples/state.md) Pattern 14            |
| Hand-rolled label and error wiring                    | [examples/forms.md](examples/forms.md) Pattern 16            |
| `onChange` validation without a debounce              | [examples/forms.md](examples/forms.md) Pattern 18            |
| Server errors rendered away from their field          | [examples/forms.md](examples/forms.md) Pattern 19            |

---

## Checklists

### Popup Checklist

- [ ] `Portal > Positioner > Popup` in that order
- [ ] All positioning props on `Positioner`, all visual styling on `Popup`
- [ ] `sideOffset` at least the arrow's height when an `Arrow` is present
- [ ] `max-height: var(--available-height)` with `overflow-y: auto` on scrollable popups
- [ ] `[data-side]` rules cover the logical values (`inline-start`, `inline-end`), not just `left`/`right`
- [ ] `[data-uncentered]` on `Arrow` handled
- [ ] `keepMounted` left off unless an animation library owns unmount

### render Prop Checklist

- [ ] Element-form target forwards `ref`
- [ ] Element-form target spreads every remaining prop onto its DOM node
- [ ] Function-form callback spreads `{...props}` itself
- [ ] Your own parts use `useRender` + `mergeProps` rather than cloning by hand

### State Checklist

- [ ] Uncontrolled unless something outside must set the value
- [ ] Controlled components always supply the matching change handler
- [ ] `defaultValue` treated as read-once; later changes require control
- [ ] Vetoes use `eventDetails.cancel()`, never an early `return`
- [ ] `reason` compared against values the component actually documents

### Field Checklist

- [ ] `name` on `Field.Root`, not on the inner control
- [ ] `Field.Error` present so validation messages have somewhere to land
- [ ] `validationMode="onChange"` paired with `validationDebounceTime`
- [ ] Field state styled from `Field.Root`'s data attributes, not React state
- [ ] `Fieldset.Legend` selected by class, not by `legend` tag

---

## Migrating From Radix Primitives

Several of the same authors, so the mental model transfers; the API does not. The differences are structural.

| Concern         | Radix                                           | Base UI                                                                                                       |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Package         | `radix-ui` or `@radix-ui/react-*`               | `@base-ui/react`, one subpath per component                                                                   |
| Polymorphism    | `asChild` boolean + `Slot`                      | `render` prop, element or `(props, state)` function                                                           |
| Custom parts    | `Slot` / `Slottable`                            | `useRender` + `mergeProps`                                                                                    |
| Positioning     | props on `Content`                              | separate `Positioner` part wrapping `Popup`                                                                   |
| Open state attr | `data-state="open" \| "closed"`                 | separate `data-open` / `data-closed`                                                                          |
| Trigger state   | `data-state` on trigger                         | `data-popup-open`, `data-pressed`                                                                             |
| Exit animation  | CSS `@keyframes` only — `transition` is ignored | CSS `transition` is recommended, via `data-starting-style` / `data-ending-style`; `@keyframes` also supported |
| Keeping mounted | `forceMount` per part                           | `keepMounted` on `Portal`, plus `actionsRef.unmount()`                                                        |
| Change handlers | `(value)`                                       | `(value, eventDetails)` with `reason` and `cancel()`                                                          |
| Forms           | unstable/preview                                | `Field`, `Fieldset`, `Form` shipped stable                                                                    |

**Mechanical rewrites when porting a component:**

1. `<X.Content side="top" sideOffset={8}>` becomes `<X.Positioner side="top" sideOffset={8}><X.Popup>`.
2. `asChild` plus a child element becomes `render={<child />}`; the child's ref-forwarding and prop-spreading requirement is unchanged, so custom trigger components port as-is.
3. `[data-state="open"]` selectors split into `[data-open]` and `[data-closed]`.
4. Enter/exit `@keyframes` collapse into one `transition` rule plus `[data-starting-style]` / `[data-ending-style]` blocks, and gain mid-flight cancelation.
5. `forceMount` on Portal/Overlay/Content collapses to `keepMounted` on `Portal` alone.

Both can be installed side by side — separate packages, separate contexts, no shared globals — so migration goes component by component. What they cannot share is one styled wrapper: a dialog styled for `data-state` does not react to `data-open`, so port the CSS alongside each component rather than writing selectors that satisfy both.

---

## Version Notes

| Version | Change                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------- |
| v1.0.0  | Stable release, 35 components, new `@base-ui/react` package name                                      |
| v1.1.0  | `loopFocus`, new state attributes, placeholder props, `CSPProvider`                                   |
| v1.2.0  | Drawer (preview), `useFilteredItems` for Autocomplete and Combobox                                    |
| v1.3.0  | Drawer stable; new parts for Select, Combobox and Slider                                              |
| v1.4.0  | OTP Field (preview); toasts updatable by id                                                           |
| v1.5.0  | Popup performance work; Persian digit support in Number Field                                         |
| v1.6.0  | OTP Field stable; keyboard navigation updates; mobile drawer improvements                             |
| v1.7.0  | Performance and accessibility work, WebKit overscroll feedback in Scroll Area, bundle size reductions |
