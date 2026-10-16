---
name: meta-design-composable-components
description: Composable component APIs — parts, state, polymorphism. Load when designing a reusable component's API, or aligning one that has grown boolean, renderX or style props.
---

# Composable Component Patterns

> **Quick Guide:** The component owns behaviour, state and accessibility; the consumer owns markup, element type and styling. That line settles most API questions: variation becomes parts and children instead of booleans and `renderX` props, each exposed state ships as `value` + `defaultValue` + `onValueChange` with a details argument carrying the reason and a veto, every part can render as the consumer's element through one substitution shape, state is published as `data-*` attributes, and whatever the consumer passes — props, handlers, refs — is composed rather than replaced. Three React 19 facts change the code: `ref` is an ordinary prop, a callback ref may return a cleanup that a ref-composing helper has to collect, and `useId`'s format changed in both 19.1 and 19.2, with only 19.2's safe in both a CSS selector and an XML id.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — Patterns 1–3: compound parts, children with a descendant registry, context scoping
- [examples/state-contract.md](examples/state-contract.md) — Patterns 4–5: `useControllableState`, change details with reason and cancel, retrofitting the triple, state as `data-*` attributes
- [examples/polymorphism.md](examples/polymorphism.md) — Patterns 6–7: `asChild` and `render` built without a library, the merge they share, `composeEventHandlers`, `composeRefs`, prop ordering
- [examples/accessibility-structure.md](examples/accessibility-structure.md) — Pattern 8: id wiring, focus ownership, roving tabindex, typeahead, Escape
- [reference.md](reference.md) — prop-to-part translation, naming tables, substitution merge rules, attribute vocabulary, ARIA and keyboard contracts, the alignment checklist

---

## Which path applies

- **Designing a new component** — settle the parts (Patterns 1–3), then the state contract (4–5); substitution and forwarding (6–7) apply to every part you defined. Start at [examples/core.md](examples/core.md).
- **Aligning an existing component** — read its call sites, run it through the [alignment checklist](reference.md#alignment-checklist), and fix API shape first, because the later axes depend on which parts exist. Migrate additively, as [retrofitting the triple](examples/state-contract.md#retrofitting-an-existing-component) shows.
- **Building on a headless library that already ships parts** — use its substitution shape and its merge helper on every part you add, so yours behave like its own; the library's API is its own skill's subject, and [examples/polymorphism.md](examples/polymorphism.md) shows what any merge has to guarantee.

---

<critical_requirements>

## Before designing a component API

**Express variation as parts and children, never as configuration props.** A boolean or `renderX` prop is the component deciding the consumer's markup, so each design need becomes another prop and N booleans become 2^N layouts to render and test; a part lets the consumer's JSX make that decision once.

**Ship every exposed piece of state as `value` + `defaultValue` + `onValueChange`, resolved in one hook.** A controlled prop copied into `useState` is read once and then drifts from the consumer's store; resolving to the prop whenever it is defined leaves no second copy to drift.

**Compose what the consumer passes — props, handlers, refs — instead of replacing it.** Defaults go before the rest-spread and wiring after it, the consumer's handler runs first, and refs are merged; anything replaced disappears with no error and no type failure.

**Publish every state as a `data-*` attribute, and ship behaviour parts with no visual styling.** Attribute selectors let consumers style each state without the component knowing a class name or re-rendering; a default class, colour or transition is something every consumer has to out-specify.

**Read every call site before changing a component's API.** A removed prop whose name is also an HTML attribute — `title`, `hidden`, `color` — still type-checks once a part extends its element's props, and lands on the DOM node instead of failing the build.

</critical_requirements>

---

**Auto-detection:** compound components, namespaced parts, `asChild`, `render` prop, `useControllableState`, `defaultValue`, `onValueChange`, `onOpenChange`, change details, `data-state`, `data-disabled`, `composeRefs`, `composeEventHandlers`, out-of-Root error, descendant registry, roving tabindex, typeahead, focus trap, polymorphic component, boolean prop explosion, `renderX` props, `items` prop, headless component

**Applies to:**

- Deciding whether a new requirement becomes a prop, a part or children
- Designing the public API of a reusable component
- Aligning a component that has accumulated booleans, `renderX` props, style props or an `items` array
- Adding controlled/uncontrolled support, with a change callback that says why and can be refused
- Letting a part render as the consumer's element, and composing their props, handlers and refs onto it
- Publishing state for styling, and wiring ids, focus and keyboard behaviour across parts
- Reviewing a component change for API shape and forwarding discipline

**Handled elsewhere:**

- A headless library's own API — its parts, props, merge helper, escape hatch and version facts — is covered by that library's own skill. This skill settles the shape of what you build, on top of a library or without one.
- Which headless library to adopt.
- Accessibility conformance — WCAG audits, contrast, alt text, screen-reader testing. Accessibility appears here only where it decides which parts exist and what they share.
- Authoring styles — variant composition, tokens, theming. Styling appears here only as the contract a component exposes: `data-*` attributes, `className` and `style` passthrough, CSS custom properties.
- Visual design — spacing scales, colour systems, variant naming.

---

<philosophy>

## Philosophy

A composable component draws one line and keeps to it:

> **The component owns behaviour, state and accessibility. The consumer owns markup, element type and styling.**

Every defect this skill addresses is the component reaching across that line, and the API growing a prop to hand the job back through a narrow hole. `showCloseButton` exists because the component decided to render a close button, `padding="lg"` because it decided on spacing, `renderItem` because it decided on item markup. Composability hands the job back whole: `Dialog.Close` is not a smaller `showCloseButton` — it is the consumer's own button, anywhere in the tree, with close behaviour attached.

</philosophy>

---

<decision_framework>

## Decision Framework

### Prop, part or children?

```
Does the requirement change what is RENDERED?
|-- NO (it changes behaviour or state) -> A prop.
+-- YES -> Can the consumer already express it by rearranging existing parts?
    |-- YES -> Add nothing. Document the arrangement.
    +-- NO -> Does it need the component's state or behaviour attached?
        |-- YES -> A PART: a new subcomponent reading the shared context.
        +-- NO -> The consumer's markup. Accept it as children.
```

A boolean prop is right only when it changes behaviour (`modal`, `disabled`, `loop`), never when it toggles markup.

### Controlled, uncontrolled or both?

```
Does anything outside the component need to read or set this state?
|-- NEVER -> Keep it internal; expose nothing.
|-- SOMETIMES -> The triple: value + defaultValue + onValueChange.
|                Uncontrolled by default, controlled when `value` is defined.
+-- ALWAYS (the component cannot compute it) -> Required value + onValueChange,
                no defaultValue, documented as controlled-only.
```

`value` alone cannot change and `defaultValue` alone cannot be observed, so neither ships without `onValueChange`.

### Which substitution shape?

```
Does the library you are extending already define one?
|-- YES -> That one, on every part.
+-- NO -> Do consumers need the component's STATE to choose what to render?
    |-- YES -> render={(props, state) => ...}
    +-- NO -> asChild, or render={<El />}. Pick one: the value is that every part works alike.
```

### When configuration props are the right answer

- One call site and no reuse pressure — props are cheaper than parts.
- The variation is closed: a `type="button" | "submit"` passthrough is not a boolean explosion.
- The parts could never be rearranged — if `Root > Header > Title` is the only legal tree, `title` may honestly be a prop.
- A layout container that genuinely takes no state and no variation — it takes children and nothing else, so there are no parts to split and no state to expose.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Compound Parts Over Configuration Props

A `Root` owns state and publishes it through context; parts subscribe, and the consumer decides which parts exist, in what order, wrapped in what.

```tsx
// Monolith: each layout need is a new prop
<Dialog title="Delete" showCloseButton size="lg" renderFooter={renderActions} />

// Parts: layout is JSX; Root still owns open state, dismissal, focus and aria-* wiring
<Dialog.Root>
  <Dialog.Trigger>Delete</Dialog.Trigger>
  <Dialog.Popup>
    <Dialog.Title>Delete</Dialog.Title>
    <Dialog.Close>Cancel</Dialog.Close>
  </Dialog.Popup>
</Dialog.Root>
```

Full code: [examples/core.md](examples/core.md#pattern-1-compound-parts-over-configuration-props)

### Pattern 2: Children as Composition

An `items` array makes the component own every item's markup — icons, badges, grouping, empty states — one prop at a time. Children hand that back while each `Item` registers with the `Root`, which keeps selection, keyboard navigation and `aria-activedescendant`. The cost is a registry ordered by DOM position, since mount order stops matching DOM order the first time an item renders late.

```tsx
<Select.Popup>
  <Select.Group>
    <Select.GroupLabel>Frameworks</Select.GroupLabel>
    <Select.Item value="react">
      <Select.ItemText>React</Select.ItemText> <Badge>new</Badge>
    </Select.Item>
  </Select.Group>
</Select.Popup>
```

Full code: [examples/core.md](examples/core.md#pattern-2-children-as-composition)

### Pattern 3: Context Scoping

One context per primitive, provided per `Root`, created with a `null` default and read through a guard that names the part — so an orphaned part throws instead of rendering a button that does nothing.

```tsx
const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(part: string): DialogContextValue {
  const context = useContext(DialogContext);
  if (context === null)
    throw new Error(`<Dialog.${part}> must be rendered inside <Dialog.Root>.`);
  return context;
}
```

Memoize the provided value — by hand, or with the React Compiler running over the component's source — or every part re-renders on every `Root` render.

Full code: [examples/core.md](examples/core.md#pattern-3-context-scoping)

### Pattern 4: Controlled and Uncontrolled State

One hook resolves the triple to a single value and setter, and calls `onValueChange` in both modes, so consumer side effects attach the same way whoever owns the state. The callback's second argument says why the change happened and lets the consumer refuse it without taking control.

```tsx
const [isOpen, setIsOpen] = useControllableState({
  value: open,
  defaultValue: defaultOpen,
  onChange: onOpenChange,
  componentName: "<Dialog.Root>",
});

<Dialog.Root
  onOpenChange={(open, details) => {
    if (details.reason === "outside-press" && hasUnsavedEdits) details.cancel();
  }}
/>;
```

Full code: [examples/state-contract.md](examples/state-contract.md#pattern-4-controlled-and-uncontrolled-state)

### Pattern 5: State as Data Attributes

Enumerated states are attribute values, boolean states are attribute presence, and the consumer's stylesheet does the rest. Behaviour parts set no class, colour, spacing or transition; the only inline styles they may set are functionally load-bearing — computed coordinates, measured sizes — exposed as CSS custom properties where possible, so the consumer's stylesheet decides how they apply and can override them.

```tsx
<button
  data-state={open ? "open" : "closed"}
  data-side={side}
  data-disabled={disabled ? "" : undefined}
/>
```

Full code: [examples/state-contract.md](examples/state-contract.md#pattern-5-state-as-data-attributes)

### Pattern 6: Element Substitution

A part that hardcodes its element forces wrappers — a `<button>` around an `<a>` is invalid nesting and lands in the consumer's layout. Substitution clones the consumer's element and merges the part's props, handlers, ref and state attributes onto it, so the element keeps its own semantics.

```tsx
// asChild: the part becomes its single child
<Tooltip.Trigger asChild><a href="/docs">Docs</a></Tooltip.Trigger>

// render, element form: the part renders as the given element
<Tooltip.Trigger render={<a href="/docs" />}>Docs</Tooltip.Trigger>

// render, callback form: the consumer places the props and reads the state
<Tooltip.Trigger
  render={(props, state) => <a href="/docs" {...props}>{state.open ? "Hide" : "Docs"}</a>}
/>
```

The merge is the contract: the consumer's handler runs first and can suppress the internal one, both refs receive the node, `className` concatenates and `style` merges with the consumer winning.

Full code: [examples/polymorphism.md](examples/polymorphism.md#pattern-6-element-substitution)

### Pattern 7: Prop Forwarding

A part is a DOM element with behaviour attached: destructure what it consumes, spread the rest, and let position in the JSX encode policy.

```tsx
<button
  type="button" // default: before the spread, so the consumer can override it
  {...rest}
  ref={composeRefs(ref, localRef)} // wiring: after the spread, so nothing clobbers it
  aria-expanded={open}
  data-state={open ? "open" : "closed"}
  onClick={composeEventHandlers(rest.onClick, toggle)}
/>
```

Full code: [examples/polymorphism.md](examples/polymorphism.md#pattern-7-prop-forwarding)

### Pattern 8: Structural Accessibility

Accessibility that depends on the consumer passing the right `aria-*` props will be wrong. The component generates ids and wires them across parts through context, and owns the focus and keyboard behaviour its role requires: focus in on open and back on close, a Tab trap while modal, roving tabindex, typeahead and Escape — with `onOpenAutoFocus`/`onCloseAutoFocus`-style hooks so consumers redirect focus without forking.

```tsx
// A labelling part registers its id while mounted, so aria-labelledby is absent
// when no Title renders instead of pointing at nothing.
const id = props.id ?? generatedId;
useEffect(() => {
  registerTitleId(id);
  return () => registerTitleId(undefined);
}, [id, registerTitleId]);
```

Full code: [examples/accessibility-structure.md](examples/accessibility-structure.md#pattern-8-structural-accessibility)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime, silently:**

- `open` with no `onOpenChange` — the component can open but never close itself, so every consumer reimplements Escape and outside press — ship the triple.
- `useState(props.value)` — right on the first render, stale after the first external change — resolve to the prop whenever it is defined.
- `onValueChange` called only in uncontrolled mode — the consumer's side effects vanish the moment they take control — call it in both.
- A controlled prop that is `undefined` on the first render (`value={data?.selected}`) — the component starts uncontrolled and switches, so the value freezes or jumps back — decide the mode at mount and warn when it changes.
- `onClick={props.onClick}` or `onClick={handleOpen}` on a part — one deletes the component's behaviour, the other the consumer's — `composeEventHandlers(props.onClick, handleOpen)`.
- `{...rest}` spread after the `aria-*` wiring and composed handlers — a stray consumer prop overwrites them — defaults before the spread, wiring after.
- A part that picks its props from an allowlist (`{ children, onClick }`) — `id`, `aria-label`, `data-testid`, `className` and the ref vanish, and consumers add a wrapper that breaks their layout — spread the rest.
- A ref accepted and never attached — positioning, measurement and focus restore stop working with no error — attach it, composed with any internal ref.
- `React.cloneElement(child, props)` as hand-rolled substitution — the child's `onClick`, `className` and `style` are replaced, and a passed `ref` replaces the child's — merge with `composeEventHandlers` and `composeRefs`.
- A substitution target that does not spread its props and receive `ref` — the part renders and never opens anything — require both of any component used with `asChild` or `render`.
- `data-disabled={disabled}` — React writes `data-*` and `aria-*` booleans as the strings `"true"` and `"false"`, so `[data-disabled]` matches enabled elements — `data-disabled={disabled ? "" : undefined}`.
- `createContext(defaultValue)` for part context — an orphaned part renders and does nothing — default to `null` and throw from the guard.
- Items registered by mount index — arrow keys land on the wrong row after the first late-rendered item — sort the registry by `compareDocumentPosition`.
- A `composeRefs` that ignores what callback refs return — the composed ref returns nothing, so React calls it with `null` and an inner ref's cleanup never runs — collect the cleanups, and return a composed one only when some ref supplied one, because React 18 logs an error for any callback ref that returns a function.

**Grows the API with every design change:**

- Booleans that toggle markup (`showCloseButton`, `hideOverlay`, `withIcon`) — 2^N layouts, and the next design needs the combination nobody built — extract the part.
- `renderX` props (`renderHeader`, `renderFooter`, `renderItem`) — `children` with no context access and no rearrangement — accept children on a part.
- Style props as API (`padding`, `bgColor`, `width`) — the behaviour component becomes a design system with a worse signature — accept the consumer's `className`.
- Default classes, colours or transitions in behaviour parts — consumers must out-specify the component's CSS to style it — ship none.
- Parts that only work in one arrangement — if `Trigger` must be `Root`'s first child, the split bought nothing over props.
- A part that renders its own wrapper `<div>` for convenience — it lands inside the consumer's flex or grid layout and cannot be removed — one element per part.
- Parts exported as unrelated top-level components (`DialogTrigger`) — nothing at the call site says they need a `Root` — export a namespace.
- Two substitution shapes in one library (`asChild` here, `render` there) — consumers can predict neither — one shape on every part.
- Generated ids with no consumer override — external `aria-controls` and label wiring become impossible — `props.id ?? generatedId`.

**Surprising behaviour:**

- An `asChild` slot merges onto exactly one element child and throws on more — a part that renders decoration around its content cannot slot it; offer the `render` callback form there.
- Suppressing a part's internal handler depends on the merge. An `asChild` slot leaves it to the part's composed handler, which skips when the consumer calls `event.preventDefault()`; a merge helper that wraps events may expose its own skip method instead, which leaves the default action alone and exists only on React's synthetic events, not on value callbacks. Document the one your parts honour.
- Changing `defaultValue` after mount does nothing — it is read once; resetting needs a `key` change or a reset method.
- `data-side` and `data-align` are written after measurement and can differ between first paint and the positioning layout effect — drive entry animations off a starting-style attribute, not off mount.
- `useId` output is internal and has changed shape: 19.0's `:r0:` needs escaping in a CSS selector, 19.1's `«r0»` is not a valid XML name, and 19.2's `_r_` prefix is valid in both. Keep a ref to the element, or `CSS.escape` the id, rather than splicing it into a selector.
- `React.Children.map` to inspect children breaks under fragments, wrappers and conditional children — a context registry does not.
- Portaled content is out of DOM order — the focus contract, not `aria-owns`, is what keeps it coherent.
- A focus trap in a non-modal popover strands the user, who expects Tab to move on to the page — gate the trap on `modal`.

</red_flags>
