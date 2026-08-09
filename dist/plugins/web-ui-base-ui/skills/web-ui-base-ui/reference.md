# Base UI Reference

> Lookup tables, decision trees, checklists and anti-patterns with code. See [SKILL.md](SKILL.md) for concepts and red flags, and [examples/](examples/) for full implementations. **Current: v1.7.0 (August 2026)** — package `@base-ui/react`.

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

## Decision Frameworks

### Which popup component?

```
Does it block the rest of the page until answered?
├─ YES → is it a destructive or irreversible confirmation?
│   ├─ YES → Alert Dialog
│   └─ NO  → Dialog (or Drawer for an edge-anchored panel)
└─ NO → what opens it?
    ├─ Hover or focus, short text        → Tooltip
    ├─ Hover or focus, rich content      → Preview Card
    ├─ Right-click                       → Context Menu
    ├─ Click, list of commands           → Menu (Menubar when in a bar)
    ├─ Click, arbitrary content          → Popover
    ├─ Click, pick one/many from a list  → Select
    └─ Typing, filter a list             → Combobox (Autocomplete for free text)
```

### Which composition mechanism?

```
Need to change the element a part renders?
├─ NO → className / style, done
└─ YES → does the output depend on the part's state?
    ├─ NO  → render={<YourElement />}
    └─ YES → render={(props, state) => …}

Building your own part that should accept `render`?
└─ useRender({ defaultTagName, render, props: mergeProps(...) })
```

### Which animation approach?

```
Is the motion a single interpolation between two states?
├─ YES → CSS transition + [data-starting-style] / [data-ending-style]   (preferred)
└─ NO → multi-step motion?
    ├─ YES → CSS @keyframes on [data-open] / [data-closed]
    └─ Driven by an external animation library?
        ├─ Popup unmounts    → keepMounted on Portal + presence wrapper
        ├─ Popup stays in DOM → render={(props, state) => …}, animate on state.open
        └─ Library animates outside the Web Animations API → actionsRef.unmount()
```

### Controlled or uncontrolled?

```
Does anything outside need to SET the value?
├─ YES → controlled: value/open + onValueChange/onOpenChange
└─ NO → does anything outside need to OBSERVE it?
    ├─ YES → uncontrolled + handler only
    └─ NO → do you need to FORBID some changes?
        ├─ YES → uncontrolled + eventDetails.cancel()
        └─ NO → defaultValue / defaultOpen
```

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

### Positioning Props on Popup

Positioning lives on `Positioner`. Props placed on `Popup` are not part of its API and fall through to the DOM.

```tsx
// WRONG — no Positioner, unknown attributes on the DOM node
<Popover.Portal>
  <Popover.Popup side="top" sideOffset={8}>Content</Popover.Popup>
</Popover.Portal>

// CORRECT
<Popover.Portal>
  <Popover.Positioner side="top" sideOffset={8}>
    <Popover.Popup>Content</Popover.Popup>
  </Popover.Positioner>
</Popover.Portal>
```

### Transforming the Positioner

The positioner carries the computed placement transform.

```css
/* WRONG — overwrites the placement transform */
.positioner {
  transform: translateY(-4px);
}

/* CORRECT — animate the popup, express the gap as sideOffset */
.popup {
  transition: transform 150ms;
}
.popup[data-starting-style] {
  transform: translateY(-4px);
}
```

### Reaching for asChild

There is no `asChild` and no `Slot` in this library.

```tsx
// WRONG — asChild is not a prop here
<Menu.Trigger asChild>
  <Button>Open</Button>
</Menu.Trigger>

// CORRECT
<Menu.Trigger render={<Button />}>Open</Menu.Trigger>
```

### A render Target That Swallows Props

```tsx
// WRONG — no ref, no prop spreading; the menu silently never opens
function Button({ children }: { children: React.ReactNode }) {
  return <button className="button">{children}</button>;
}

// CORRECT
function Button({ className, ref, ...props }: React.ComponentProps<"button">) {
  return <button ref={ref} className={className} {...props} />;
}
```

### Returning Early Instead of Canceling

```tsx
// WRONG — the return value is ignored; an uncontrolled component still updates
onOpenChange={(open) => {
  if (shouldStayClosed) return;
  setOpen(open);
}}

// CORRECT
onOpenChange={(open, eventDetails) => {
  if (shouldStayClosed) {
    eventDetails.cancel();
  }
}}
```

### Duplicating State for Styling

```tsx
// WRONG — data-popup-open already exists, and the copy drifts
const [open, setOpen] = useState(false);
<Popover.Trigger className={open ? "trigger trigger--open" : "trigger"} />

// CORRECT
<Popover.Trigger className="trigger" />
```

```css
.trigger[data-popup-open] {
  background: var(--color-accent);
}
```

### A Transition With No Boundary States

```css
/* WRONG — nothing to transition from on mount, and the base state leaks */
.popup {
  transition: opacity 150ms;
  opacity: 0;
}
.popup[data-open] {
  opacity: 1;
}

/* CORRECT */
.popup {
  transition: opacity 150ms;
}
.popup[data-starting-style],
.popup[data-ending-style] {
  opacity: 0;
}
```

### Animating a Child and Expecting Unmount to Wait

```tsx
// WRONG — Popup reports no running animations and unmounts immediately
<Popover.Popup>
  <AnimatedBox exit={{ opacity: 0 }}>Content</AnimatedBox>
</Popover.Popup>

// CORRECT — animate Popup itself, or drive unmount with actionsRef
<Popover.Popup render={<AnimatedBox exit={{ opacity: 0 }} />}>Content</Popover.Popup>
```

### Server Errors Rendered Away From Their Field

```tsx
// WRONG — no association, no focus target, no onClearErrors
{
  serverError && <div className="banner">{serverError}</div>;
}

// CORRECT — Form maps errors onto fields by name
<Form errors={{ url: serverError }} onClearErrors={setErrors}>
  <Field.Root name="url">
    <Field.Control type="url" />
    <Field.Error />
  </Field.Root>
</Form>;
```

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
