---
name: web-ui-base-ui
description: Unstyled accessible React component primitives
---

# Base UI Primitives

> **Quick Guide:** Base UI is an unstyled React component library built by the creators of Radix, Material UI and Floating UI. Components are split into named parts (`Root`, `Trigger`, `Portal`, `Positioner`, `Popup`, `Arrow`), polymorphism is done with the `render` prop (there is no `asChild`), state is exposed as data attributes and as an argument to `className`/`style` functions, and every change handler receives an `eventDetails` object whose `cancel()` method can veto the state change. **Current: v1.7.0 (August 2026)** — package is `@base-ui/react`, imported per component subpath.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST install and import `@base-ui/react` from per-component subpaths — `@base-ui/react/popover`, `@base-ui/react/field`. The older `@base-ui-components/react` package is frozen at a release candidate and MUST NOT be used.)**

**(You MUST use the `render` prop for polymorphism — Base UI has NO `asChild`. A component passed to `render` MUST forward its `ref` and spread every received prop onto its DOM node.)**

**(You MUST nest popups as `Portal > Positioner > Popup` and put every positioning prop — `side`, `align`, `sideOffset`, `collisionPadding` — on `Positioner`, never on `Popup`.)**

**(You MUST style state from Base UI's own data attributes — `data-open`/`data-closed`, `data-starting-style`/`data-ending-style`, `data-popup-open` — or from the state argument to `className`/`style`. Never mirror popup state into your own React state to drive styles.)**

**(You MUST call `eventDetails.cancel()` to veto a change. Returning early from a change handler does NOT stop an uncontrolled component from updating its internal state.)**

</critical_requirements>

---

**Auto-detection:** Base UI, base-ui, `@base-ui/react`, useRender, mergeProps, Positioner, Popup, Backdrop, Viewport, `data-popup-open`, `data-starting-style`, `data-ending-style`, `data-uncentered`, eventDetails, `Field.Root`, `Fieldset.Legend`, `Form errors`, alignItemWithTrigger, keepMounted, actionsRef, DirectionProvider, CSPProvider

**When to use:**

- Building an accessible design system where you own 100% of the visual layer
- Needing popup positioning with collision handling as a first-class, separately-styleable part
- Needing to veto or inspect the reason behind a state change (`eventDetails.reason`, `eventDetails.cancel()`)
- Wanting native-form-compatible field grouping and validation without a form runtime
- Building your own primitives that behave like the library's (`useRender`, `mergeProps`)

**When NOT to use:**

- You want components that arrive pre-styled — this library ships zero CSS by design
- The interaction is a plain `<button>` or `<a>` with no popup, no state and no ARIA wiring
- The project is not React — these primitives are React-only

**Package Installation:**

```bash
npm i @base-ui/react
```

Import each part namespace from its own subpath:

```tsx
import { Popover } from "@base-ui/react/popover";
import { Field } from "@base-ui/react/field";
import { useRender } from "@base-ui/react/use-render";
import { mergeProps } from "@base-ui/react/merge-props";
```

**Detailed Resources:**

- For anatomy, Portal/Positioner mechanics and a first component, see [examples/core.md](examples/core.md)
- For `render`, `useRender` and `mergeProps` composition, see [examples/composition.md](examples/composition.md)
- For state functions, data-attribute selectors and animation, see [examples/styling.md](examples/styling.md)
- For controlled state, `eventDetails` and imperative actions, see [examples/state.md](examples/state.md)
- For Field, Fieldset, Form and validation, see [examples/forms.md](examples/forms.md)
- For decision frameworks, data-attribute tables and anti-patterns, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

Base UI supplies behaviour, accessibility and positioning; it supplies no appearance at all. Three ideas follow from that.

**Parts are separate elements, not props.** A popup is not one component with twenty props — it is `Root` (state and context), `Portal` (where in the DOM), `Positioner` (where on screen), `Popup` (the box you style), `Arrow`, and optionally `Backdrop` and `Viewport`. Each part is independently styleable and independently replaceable. This is why positioning props live on `Positioner`: the element being positioned is a different element from the element you decorate, so transforms applied to your popup never fight the positioning math.

**State is published, not hidden.** Every part writes its state to data attributes and passes the same state object to `className` and `style` when you supply them as functions. Reading state from the DOM (in CSS) or from the callback argument (in JS) is always cheaper and always more correct than duplicating it into React state.

**Composition is a prop, not a wrapper.** Instead of a `Slot` element and an `asChild` boolean, every part takes `render`. It accepts either an element to clone or a function that receives `(props, state)` and returns an element. The same mechanism is exposed as `useRender` so components you write behave identically to components the library ships.

**Uncontrolled first, with an escape hatch.** Components manage their own state by default. Controlling them means supplying `value`/`open` plus a handler — but the handler also receives `eventDetails`, so you can inspect _why_ a change was requested and refuse it without ever taking ownership of the state.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Part Anatomy, Portal and Positioner

Every interactive component is a namespace of parts assembled by hand. Popups follow one shape.

```tsx
import { Popover } from "@base-ui/react/popover";

<Popover.Root>
  <Popover.Trigger />
  <Popover.Portal>
    <Popover.Backdrop />
    <Popover.Positioner sideOffset={8}>
      <Popover.Popup>
        <Popover.Arrow />
        <Popover.Viewport>
          <Popover.Title />
          <Popover.Description />
          <Popover.Close />
        </Popover.Viewport>
      </Popover.Popup>
    </Popover.Positioner>
  </Popover.Portal>
</Popover.Root>;
```

**Why this structure:** `Portal` escapes ancestor `overflow` and stacking contexts, `Positioner` owns the collision math and carries the transform, `Popup` is yours to style and animate without disturbing that transform, `Viewport` keeps content stable while the popup resizes.

`Portal` takes `container` (an `HTMLElement`, `ShadowRoot` or ref — default `document.body`) and `keepMounted` (default `false`; set it when an external animation library owns unmounting).

Menus, Select, Tooltip, Preview Card and Context Menu all repeat this skeleton with extra parts (`Menu.SubmenuRoot`, `Menu.CheckboxItem`, `Select.Value`, `Select.Icon`).

See [examples/core.md](examples/core.md) for a complete menu and a custom portal container.

---

### Pattern 2: Styling Unstyled Parts

`className` and `style` accept a plain value **or** a function of the part's state. Data attributes carry the same information into CSS.

```tsx
<Switch.Thumb className={(state) => (state.checked ? "thumb thumb--on" : "thumb")} />
<Switch.Thumb style={(state) => ({ color: state.checked ? "red" : "blue" })} />
```

The equivalent in CSS, with no JavaScript at all:

```css
.Popup[data-open] {
  opacity: 1;
}
.Popup[data-side="top"] {
  transform-origin: bottom center;
}
.Popup[data-align="start"] {
  margin-inline-start: 0;
}
.Arrow[data-uncentered] {
  display: none;
}
```

`data-side` is one of `top | bottom | left | right | inline-start | inline-end`; `data-align` is `start | center | end`. Side- and align-aware rules are how you make one popup class work in every collision outcome — the attribute reflects where the popup actually landed, not where you asked for it.

**Prefer CSS to the function form.** The function form re-runs on every state change; an attribute selector costs nothing. Reach for it only when the class name genuinely cannot be expressed as a selector, or when you must swap rendered content by state.

Utility-class CSS frameworks target these attributes through their attribute-variant syntax — consult your styling solution for the exact form. The attribute names above are the contract either way.

See [examples/styling.md](examples/styling.md) for state-function, CSS-variable and animation examples.

---

### Pattern 3: Render-Prop Composition

`render` replaces the element a part produces. Two forms.

```tsx
// Element form — change the tag, or hand over your own component
<Menu.Item render={<a href="/library" />}>Add to Library</Menu.Item>
<Menu.Trigger render={<MyButton size="md" />}>Open menu</Menu.Trigger>

// Function form — full control over props, and content that varies by state
<Switch.Thumb
  render={(props, state) => (
    <span {...props}>{state.checked ? <CheckedIcon /> : <UncheckedIcon />}</span>
  )}
/>
```

**Merge semantics for the element form:** Base UI clones your element and merges its own props in. Your component MUST forward `ref` and MUST spread every received prop onto the DOM node, or the event handlers and ARIA attributes that make the part work are silently dropped. `className` strings are concatenated, `style` objects are merged, event handlers are chained.

**Merge semantics for the function form:** you receive the merged props and are responsible for spreading them. Nothing is applied for you. Use it when you must reorder children, branch on state, or avoid a wrapper in a hot path.

Nest `render` props as deeply as the composition requires — a `Menu.Trigger` can render your `Tooltip.Trigger` which renders your `Button`.

To build your own parts with the same API, use `useRender` and `mergeProps`:

```tsx
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

interface TextProps extends useRender.ComponentProps<"p"> {}

export function Text({ render, ...otherProps }: TextProps) {
  return useRender({
    defaultTagName: "p",
    render,
    props: mergeProps<"p">({ className: "text" }, otherProps),
  });
}
```

`mergeProps` merges right-to-left: handlers run rightmost-first, `className` concatenates rightmost-first, `style` keys from the rightmost object win. It does **not** merge `ref` — pass every ref that needs the node to `useRender`'s `ref` parameter, which takes a single ref or an array. Inside a merged synthetic handler, `event.preventBaseUIHandler()` stops the library's own handler from running.

See [examples/composition.md](examples/composition.md) for ref merging, nesting and `useRender` typing.

---

### Pattern 4: Controlled vs Uncontrolled, and Canceling Changes

Components are uncontrolled by default. Control them only when something outside the component must drive or observe the value.

```tsx
const [open, setOpen] = useState(false);
<Dialog.Root open={open} onOpenChange={setOpen}>
  …
</Dialog.Root>;
```

Every change handler receives `eventDetails` as its second argument:

```ts
interface BaseUIChangeEventDetails {
  reason: string;
  event: Event;
  cancel: () => void;
  allowPropagation: () => void;
  isCanceled: boolean;
  isPropagationAllowed: boolean;
  trigger: Element | undefined;
}
```

`cancel()` is the veto. It works on an **uncontrolled** component too — the internal state is prevented from updating, so you get conditional behaviour without lifting state:

```tsx
<Tooltip.Root
  onOpenChange={(open, eventDetails) => {
    if (eventDetails.reason === "trigger-press") {
      eventDetails.cancel();
    }
  }}
/>
```

`reason` tells you _why_ — a trigger press, an outside press, an escape key, an item selection. Branch on it instead of inferring intent from the current value. `isCanceled` is a read-only flag reporting whether `cancel()` has already been called by another handler in the chain; it does not itself cancel anything.

Related: `onOpenChangeComplete` fires after animations settle, and `actionsRef` exposes imperative `close()` / `unmount()`.

See [examples/state.md](examples/state.md) for cancelation, reason branching and `actionsRef`.

---

### Pattern 5: Fields, Fieldsets and Forms

`Field` wires a label, a control, a description and an error message together and handles the ARIA relationships. `Form` collects external errors and maps them onto fields by `name`.

```tsx
<Form errors={errors} onClearErrors={setErrors}>
  <Fieldset.Root>
    <Fieldset.Legend>Contact</Fieldset.Legend>
    <Field.Root name="url" validationMode="onBlur">
      <Field.Label>Homepage</Field.Label>
      <Field.Control type="url" required />
      <Field.Error />
    </Field.Root>
  </Fieldset.Root>
</Form>
```

`Field.Root` publishes `data-valid`, `data-invalid`, `data-dirty`, `data-touched`, `data-filled`, `data-focused` and `data-disabled` — style the whole field group from the root rather than tracking validity in React. `validationMode` is `onSubmit` (default), `onBlur` or `onChange`; `validationDebounceTime` throttles async `validate` functions.

`name` on `Field.Root` includes the wrapped control in native `FormData` submission — Base UI's non-native controls (Select, Combobox, Radio) render hidden inputs to participate. The `errors` prop is an object keyed by those same `name` values, which is how a server response becomes an inline message.

**External form runtimes** integrate through the controlled surface, not through anything Base-UI-specific: give `Field.Root` a `name` and `invalid`, give the control `value` / `onValueChange` / `onBlur` / `ref`, and give `Field.Error` a `match` prop. No adapter package is required.

See [examples/forms.md](examples/forms.md) for validation modes, server errors and `Field.Validity`.

---

### Pattern 6: Popup Positioning Essentials

`Positioner` is the whole positioning API. Defaults: `side="bottom"`, `align="center"`, `sideOffset={0}`, `alignOffset={0}`, `collisionPadding={5}`, `arrowPadding={5}`, `sticky={false}`, `positionMethod="absolute"`, `collisionBoundary="clipping-ancestors"`.

```tsx
<Popover.Positioner
  side="top"
  align="start"
  sideOffset={8}
  collisionPadding={16}
  sticky
>
  <Popover.Popup>
    <Popover.Arrow />
  </Popover.Popup>
</Popover.Positioner>
```

- `sideOffset` is the gap between anchor and popup — set it to at least the arrow height or the arrow overlaps the trigger.
- `collisionBoundary` / `collisionPadding` define the box the popup must stay inside; raise the padding when a fixed header would otherwise clip it.
- `sticky` keeps the popup visible while the anchor scrolls away instead of letting it drift off.
- `positionMethod="fixed"` is the fix for an anchor inside a transformed or `contain`-ed ancestor.
- `anchor` positions against an arbitrary element or virtual rect rather than the trigger — how you build cursor-anchored and selection-anchored popups.
- Select adds `alignItemWithTrigger` (default `true`), which aligns the selected item's text over the trigger's text; it disables itself on touch input or when the viewport is too small.

Read the outcome, never assume it: `data-side` and `data-align` on `Popup` and `Arrow` report where the popup actually landed, and `data-uncentered` on `Arrow` means collision handling pushed the popup so far that the arrow no longer points at the anchor's centre. Popups expose CSS variables such as `--anchor-width`, `--available-height`, `--popup-width` and `--popup-height` for width-matching and max-height rules.

See [examples/core.md](examples/core.md) for collision-aware popup CSS and a virtual anchor.

</patterns>

---

<migration_notice>

## Coming from Radix Primitives

Base UI is written by several of the people who wrote Radix Primitives, so the mental model transfers — but the API does not. The differences are structural, not cosmetic.

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
2. `asChild` + child element becomes `render={<child />}`; the child's `forwardRef` + prop-spreading requirement is unchanged, so custom trigger components port as-is.
3. `[data-state="open"]` selectors split into `[data-open]` and `[data-closed]`.
4. Enter/exit `@keyframes` can collapse into one `transition` rule plus `[data-starting-style]` / `[data-ending-style]` blocks — and gain mid-flight cancelation for free.
5. `forceMount` on Portal/Overlay/Content collapses to `keepMounted` on `Portal` alone.

**Coexistence:** both libraries can be installed in the same app — separate packages, separate contexts, no shared globals. Migrate component-by-component. What they cannot share is a single styled wrapper: a `Dialog` styled for `data-state` will not react to `data-open`, so port the CSS alongside each component rather than trying to write selectors that satisfy both.

</migration_notice>

---

<decision_framework>

## Decision Framework

**Which composition mechanism?**

```
Do you need to change the element a Base UI part renders?
├─ NO → pass className / style directly, done
└─ YES → does the output depend on the part's state?
    ├─ NO  → render={<YourElement />}          (element form)
    └─ YES → render={(props, state) => …}      (function form)

Are you building your own part that should accept `render` too?
└─ YES → useRender({ defaultTagName, render, props: mergeProps(...) })
```

**Controlled or uncontrolled?**

```
Does anything outside the component need to set the value?
├─ YES → controlled: value/open + onValueChange/onOpenChange
└─ NO → does anything outside need to *observe* it?
    ├─ YES → uncontrolled + handler only (read, don't own)
    └─ NO → do you need to *forbid* some changes?
        ├─ YES → uncontrolled + eventDetails.cancel()
        └─ NO → fully uncontrolled (defaultValue / defaultOpen)
```

**Where does styling state come from?**

```
Can the rule be expressed as an attribute selector?
├─ YES → CSS: [data-open], [data-side="top"], [data-invalid]
└─ NO → does the *content* change with state, not just the styling?
    ├─ YES → render={(props, state) => …}
    └─ NO → className={(state) => …} / style={(state) => …}
```

See [reference.md](reference.md) for popup-part selection and animation-approach trees.

</decision_framework>

---

<integration>

## Integration Guide

**Base UI ships no styles.** Every part accepts `className` and `style`; state reaches your styling layer through data attributes and CSS variables. Any styling approach works because the contract is plain CSS.

**Its own utilities:**

| Utility             | Subpath                             | Purpose                                                            |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `useRender`         | `@base-ui/react/use-render`         | Give your own components the same `render` prop API                |
| `mergeProps`        | `@base-ui/react/merge-props`        | Merge prop sets with handler chaining and className/style joining  |
| `DirectionProvider` | `@base-ui/react/direction-provider` | Declare RTL/LTR so positioning and keyboard order follow           |
| `CSPProvider`       | `@base-ui/react/csp-provider`       | Supply a nonce for injected styles under a Content Security Policy |

**Its own parts compose with each other:** `Field.Root` labels and validates any Base UI control placed inside it — `Input`, `Select`, `Combobox`, `NumberField`, `Radio`, `Switch` — not just `Field.Control`. `Fieldset.Root` groups fields; `Form` collects their errors.

**Component coverage (v1.7.0):** v1.0.0 shipped 35 components; Drawer became stable in v1.3.0 and OTP Field in v1.6.0. Available: Accordion, Alert Dialog, Autocomplete, Avatar, Button, Checkbox, Checkbox Group, Collapsible, Combobox, Context Menu, Dialog, Drawer, Field, Fieldset, Form, Input, Menu, Menubar, Meter, Navigation Menu, Number Field, OTP Field, Popover, Preview Card, Progress, Radio, Scroll Area, Select, Separator, Slider, Switch, Tabs, Toast, Toggle, Toggle Group, Toolbar, Tooltip.

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Installing `@base-ui-components/react` — that package stopped at a release candidate; the maintained package is `@base-ui/react` and the APIs differ
- Reaching for `asChild` — it does not exist here; the part renders its default element and your child is ignored or duplicated
- A `render` target that does not spread props or forward `ref` — the popup silently never opens, positioning never attaches, and ARIA wiring is lost with no error
- Positioning props on `Popup` instead of `Positioner` — they are not part of `Popup`'s API, so they land on the DOM node as unknown attributes and React warns
- A `transform` on `Popup` while expecting `Positioner`'s placement to hold — put your own transforms on `Popup` only, never on `Positioner`
- Returning early from a change handler to block a change — an uncontrolled component still updates; only `eventDetails.cancel()` stops it
- Mirroring `open`/`value` into React state purely to drive CSS — the data attributes already carry it, and the copy will drift

**Medium Priority Issues:**

- Omitting `Portal` for a popup — ancestor `overflow: hidden` clips it and ancestor stacking contexts trap it
- `sideOffset={0}` with an `Arrow` — the arrow overlaps the trigger
- Hard-coded popup `max-height` instead of `--available-height` — the popup overflows small viewports
- Ignoring `data-uncentered` on `Arrow` — after collision handling the arrow points at nothing
- `keepMounted` left on with no animation library driving unmount — hidden popup markup stays in the DOM and in the accessibility tree
- Assuming `defaultValue` can be changed later — it is read once; later changes warn in development and do nothing

**Gotchas & Edge Cases:**

- `isCanceled` reports whether some handler already called `cancel()`; setting or reading it does not cancel anything — call `cancel()`
- `data-starting-style` / `data-ending-style` exist only during the transition; a rule written without them applies to the resting state too
- CSS transitions are recommended over `@keyframes` here specifically because a transition can be cancelled mid-flight when the user reopens a closing popup
- Animation completion is detected via `element.getAnimations()`, so a JS-driven animation on a _child_ of `Popup` will not delay unmount — animate `Popup` itself or drive unmount with `actionsRef`
- `Select.Positioner` defaults `alignItemWithTrigger` to `true`, which overrides ordinary `side`/`align` expectations; it silently switches off on touch or in a small viewport, so the popup positions differently across devices
- `Menu.Item` closes the menu on click by default — set `closeOnClick={false}` for items that toggle something
- `Menu.Item` renders a non-native button by default; set `nativeButton` when a real `<button>` matters for form or tooling behaviour
- `Fieldset.Legend` renders a `<div>`, not a `<legend>` — do not select it by tag name
- `mergeProps` runs handlers right-to-left, which is the opposite of most merge helpers; `event.preventBaseUIHandler()` is the way to suppress the library's own handler

See [reference.md](reference.md) for full anti-pattern examples with code.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST install and import `@base-ui/react` from per-component subpaths — `@base-ui/react/popover`, `@base-ui/react/field`. The older `@base-ui-components/react` package is frozen at a release candidate and MUST NOT be used.)**

**(You MUST use the `render` prop for polymorphism — Base UI has NO `asChild`. A component passed to `render` MUST forward its `ref` and spread every received prop onto its DOM node.)**

**(You MUST nest popups as `Portal > Positioner > Popup` and put every positioning prop — `side`, `align`, `sideOffset`, `collisionPadding` — on `Positioner`, never on `Popup`.)**

**(You MUST style state from Base UI's own data attributes — `data-open`/`data-closed`, `data-starting-style`/`data-ending-style`, `data-popup-open` — or from the state argument to `className`/`style`. Never mirror popup state into your own React state to drive styles.)**

**(You MUST call `eventDetails.cancel()` to veto a change. Returning early from a change handler does NOT stop an uncontrolled component from updating its internal state.)**

**Failure to follow these rules will silently break popup positioning, prop and ref merging, exit animations, and state changes you believed you had blocked.**

</critical_reminders>
