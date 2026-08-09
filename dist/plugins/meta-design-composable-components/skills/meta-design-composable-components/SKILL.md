---
name: meta-design-composable-components
description: Composable component APIs — parts, state, polymorphism
---

# Composable Components

> **Quick Guide:** Design component APIs the way headless primitive libraries do: a component owns behavior, state and accessibility -- the consumer owns markup and styling. Split configuration props into compound parts sharing scoped context, support controlled and uncontrolled use from the same API, let consumers substitute the rendered element (`asChild` or `render`), expose every state as a `data-*` attribute, and compose -- never replace -- the props, refs and handlers you receive. This is an alignment skill: run any existing component through the checklist at the end and fix what fails.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST express variation as parts and children, NOT as configuration props -- a new visual requirement must be satisfiable by rearranging JSX, never by adding a boolean or a `renderX` prop)**

**(You MUST ship the full state triple for every piece of component state -- `value` + `defaultValue` + `onValueChange` -- and NEVER copy a controlled prop into internal state)**

**(You MUST compose props, event handlers and refs that arrive from the consumer, NEVER replace them -- the consumer's handler runs first and must be able to suppress your internal behavior)**

**(You MUST expose state as `data-*` attributes on every part and keep behavior parts visually unopinionated -- no default classNames, no inline colors, no baked-in transitions)**

**(You MUST read the component's current API and all of its call sites before changing it -- alignment is a refactor of a contract, and every consumer is part of that contract)**

</critical_requirements>

---

**Auto-detection:** compound components, component API design, asChild, Slot, render prop, useRender, mergeProps, controlled uncontrolled, defaultValue, onValueChange, data-state, data attributes, headless component, primitive component, forwardRef, prop forwarding, composeRefs, composeEventHandlers, context scoping, roving tabindex, typeahead, focus trap, polymorphic component, children as composition, boolean prop explosion

**When to use:**

- Designing the public API of a new reusable component
- Aligning an existing component that has accumulated configuration props, booleans or `renderX` props
- Deciding whether a new requirement becomes a prop, a part, or a slot
- Adding controlled/uncontrolled duality to a component that only supports one mode
- Making a component polymorphic so consumers can swap the rendered element
- Moving styling decisions out of a component and into the consumer's stylesheet
- Wiring accessibility structurally (ids, roles, focus, keyboard) instead of per-consumer
- Reviewing a component library PR for API shape and forwarding discipline

**When NOT to use:**

- One-off application components rendered in exactly one place with no reuse pressure
- Layout containers that genuinely take no state and no variation
- Deciding _which_ primitive library to adopt -- this skill is about API shape, not tool selection
- Visual design decisions: spacing scales, color systems, variant naming

**Key patterns covered:**

- Compound components over configuration props
- Controlled/uncontrolled duality and the change-details object
- Polymorphism: `asChild` + Slot, and the `render` prop + `useRender`
- State as `data-*` attributes; zero visual opinions in behavior parts
- Prop forwarding discipline: rest-spread, ref forwarding, handler composition
- Context scoping and clear out-of-Root errors
- Structural accessibility: id wiring, focus management, roving tabindex, typeahead
- Children as composition, not `items={[...]}` configuration

---

## Detailed Resources

- [examples/core.md](examples/core.md) - Compound parts, children-as-composition, context scoping, the collection/registry problem
- [examples/state-contract.md](examples/state-contract.md) - Controlled/uncontrolled hook, change details with reason and cancelation, state as data attributes
- [examples/polymorphism.md](examples/polymorphism.md) - `asChild`/Slot, `render`/`useRender`, `composeRefs`, `composeEventHandlers`, merge rules
- [examples/accessibility-structure.md](examples/accessibility-structure.md) - Id wiring, focus trap and restore, roving tabindex, typeahead
- [reference.md](reference.md) - Prop-to-part translation, part and state naming, attribute vocabulary, ARIA and keyboard contracts

---

<philosophy>

## Philosophy

A composable component draws one line and never crosses it:

> **The component owns behavior, state and accessibility. The consumer owns markup, element type and styling.**

Every defect this skill addresses is the same defect: the component reached across that line, and the API grew a prop to compensate. `showCloseButton` exists because the component decided to render a close button. `padding="lg"` exists because the component decided on spacing. `renderItem` exists because the component decided on item markup. Each one is a small piece of the consumer's job that the component took, then had to hand back through a narrow hole.

Composability is the opposite move: give the job back entirely. A `Dialog.Close` part is not a smaller `showCloseButton` -- it is the consumer rendering their own button, anywhere in the tree, with the close behavior attached to it.

**The two current expressions of one principle.** Element substitution is the clearest case of the line being respected, and two shapes for it are current:

| Expression        | Shape                                              | Merging                                           |
| ----------------- | -------------------------------------------------- | ------------------------------------------------- |
| `asChild` + Slot  | `<Trigger asChild><a href="/x">Docs</a></Trigger>` | Clones the single child, merges props onto it     |
| `render` prop     | `<Trigger render={<a href="/x">Docs</a>} />`       | Clones the given element, merges props onto it    |
| `render` callback | `render={(props, state) => <a {...props} />}`      | Hands you the props and the state; you place them |

They are the same idea with different ergonomics. `asChild` reads as "this part IS this child"; `render` reads as "render this part AS this element", and its callback form additionally exposes the component's state so a consumer can branch on it. Neither is a fallback for the other -- a component ships one of them, consistently, on every part.

**When to apply this skill:**

- The component has more than about three boolean props
- A design change would require a new prop rather than different JSX
- The component renders markup the consumer did not ask for
- State lives only inside the component, or only outside it, but not both
- The component's own tests are the only place its keyboard behavior is described

**When NOT to apply:**

- The component has one call site and no reuse pressure -- configuration props are cheaper than parts
- The variation is genuinely closed (a `type="button" | "submit"` passthrough is not a boolean explosion)
- Splitting into parts would produce parts that can never be rearranged -- if `Root > Header > Title` is the only legal tree, `title` may honestly be a prop

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Compound Components Over Configuration Props

A monolith accepts the whole component as data. A compound component accepts it as JSX: a `Root` that owns state and publishes it through context, and parts that subscribe. The consumer decides which parts exist, in what order, wrapped in what.

```tsx
// Monolith: every new layout need becomes a new prop
<Dialog title="Delete" description="Permanent." showCloseButton size="lg" renderFooter={renderActions} />

// Compound: layout is JSX, the component still owns behavior
<Dialog.Root>
  <Dialog.Trigger>Delete</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup>
      <Dialog.Title>Delete</Dialog.Title>
      <Dialog.Close>Cancel</Dialog.Close>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

**Why good:** A footer above the title, two close buttons, a form wrapping the popup -- all are rearrangements, not API changes. The `Root` still owns open state, dismissal, focus and `aria-*` wiring, so nothing accessible was traded away for the flexibility.

**Why the monolith is bad:** `title` forces the component to choose the heading level and its position. `showCloseButton` forces it to choose the button's markup, label and placement. `renderFooter` is `children` with a worse signature and no access to the parts' context. Each prop is a permanent commitment resolvable only by adding another prop.

> **Full before/after, including the context and part implementations:** See [examples/core.md](examples/core.md).

---

### Pattern 2: Controlled/Uncontrolled Duality

Every piece of state a component owns ships as a triple: `value` (controlled), `defaultValue` (uncontrolled initial), and `onValueChange` (always called, in both modes). The component is uncontrolled by default so the common case needs no state at all.

```tsx
const [open, setOpen] = useControllableState({
  value: props.open,
  defaultValue: props.defaultOpen ?? false,
  onChange: props.onOpenChange,
});
```

**Why good:** One resolved value, one setter, one source of truth. `onOpenChange` fires in both modes, so analytics and side effects attach the same way regardless of who owns the state. A consumer converts from uncontrolled to controlled by adding two props, not by rewriting call sites.

**Why the alternatives are bad:** `open` with no `onOpenChange` produces a component that can never close itself -- the consumer must reimplement outside-press and Escape. `useState(props.open)` copies the prop once and then drifts silently. Mode-switching mid-life (`value` going from `undefined` to defined) changes which state wins between renders and desynchronizes the DOM; decide the mode at mount and warn if it changes.

**The change-details argument.** A bare `(value) => void` tells the consumer _what_ changed but not _why_, and gives them no way to refuse. Passing a details object solves both:

```tsx
onOpenChange={(open, details) => {
  if (details.reason === "outside-press" && hasUnsavedEdits) details.cancel();
}}
```

**Why good:** `reason` lets side effects be conditional (close-by-Escape and close-by-submit are different events). `cancel()` lets the consumer veto the state change without hoisting the state, which is the only alternative in a bare-callback API.

> **Full `useControllableState` implementation and details object:** See [examples/state-contract.md](examples/state-contract.md).

---

### Pattern 3: Polymorphism -- `asChild` and `render`

A component that hardcodes its element type forces wrappers. A trigger that must be a link, a menu item that must be a router link, a heading whose level depends on nesting -- all need element substitution, and both current shapes work by cloning an element the consumer supplies and merging the component's props onto it.

```tsx
// asChild form: the part becomes its child
import { Slot } from "radix-ui";

const Comp = asChild ? Slot.Root : "button";
return <Comp {...rest} ref={forwardedRef} />;

// render form: the part renders as the given element
import { useRender } from "@base-ui/react/use-render";
import { mergeProps } from "@base-ui/react/merge-props";

return useRender({
  defaultTagName: "button",
  render,
  props: mergeProps<"button">(internalProps, rest),
});
```

**Why good:** The consumer's element keeps its own semantics (`<a href>` stays a link, is focusable, and works with the router) while gaining the component's behavior, `aria-*` wiring and state attributes. No wrapper element is introduced, so layout and CSS selectors are unaffected.

**The merging contract -- the part every implementation gets wrong.** Substitution is only safe if all three are merged rather than overwritten:

| What            | Rule                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------- |
| **Handlers**    | The consumer's handler runs first; the component's internal handler runs after and is skippable |
| **Refs**        | Both refs receive the node -- the component needs it for measurement and focus restore          |
| **Class/style** | Concatenated and shallow-merged, with the consumer's values winning on conflict                 |

The escape hatch differs by library and this is the single most confusable fact in this area: with Slot-based composition the consumer calls `event.preventDefault()` and the primitive's composed handler checks `defaultPrevented` before running; with Base UI's merged props the consumer calls `event.preventBaseUIHandler()`, which skips Base UI's internal handler _without_ calling `preventDefault()` or `stopPropagation()`.

**Why hand-rolled substitution is bad:** `React.cloneElement(child, props)` overwrites the child's `onClick`, drops the child's `ref`, and replaces `className` instead of concatenating. The result renders fine, passes type-check, and silently breaks the consumer's handler.

> **Both APIs in full, plus dependency-free `composeRefs`/`composeEventHandlers`:** See [examples/polymorphism.md](examples/polymorphism.md).

---

### Pattern 4: State as `data-*` Attributes, Zero Visual Opinions

Every state the component computes is published on the DOM as a data attribute. Styling then happens in the consumer's stylesheet against `[data-state="open"]` or `[data-disabled]` -- no state needs to travel back out through props.

```tsx
<button
  data-state={open ? "open" : "closed"}
  data-side={side}
  {...(disabled ? { "data-disabled": "" } : null)}
/>
```

**Why good:** Enumerated states become attribute _values_ (`data-state="open" | "closed"`), boolean states become attribute _presence_. The consumer styles hover, open and disabled without the component knowing a single class name, and without re-rendering on every visual state change.

```tsx
// Bad: a boolean state written as a value
<button data-disabled={disabled} /> // renders data-disabled="false"
```

**Why bad:** `[data-disabled]` matches an element whose attribute is the string `"false"`, so every disabled style applies to enabled elements. Attribute presence is the boolean; omit the attribute entirely when the state is off.

**Zero visual opinions.** A behavior part renders no default `className`, no colors, no spacing, no transitions. The only styles it may set inline are the ones that are functionally load-bearing -- computed position coordinates, `transform` for a thumb, measured sizes -- and even those belong in CSS custom properties where possible, so the consumer can override them.

> **Full attribute vocabulary, state-driven `className`/`style` functions, and exit-animation attributes:** See [examples/state-contract.md](examples/state-contract.md).

---

### Pattern 5: Prop Forwarding Discipline

A part is a DOM element with behavior attached. Anything the consumer puts on it -- `id`, `aria-label`, `data-testid`, `className`, `onKeyDown`, `tabIndex` -- must reach the DOM node. Destructure only what you consume; spread the rest.

```tsx
<button
  type="button" // default: overridable
  {...rest} // consumer's props
  ref={composeRefs(forwardedRef, localRef)} // non-negotiable
  aria-expanded={open}
  data-state={open ? "open" : "closed"}
  onClick={composeEventHandlers(rest.onClick, handleClick)}
/>
```

**Why good:** Ordering encodes intent. Defaults sit before the spread so the consumer can override them. Non-negotiables -- the composed ref, the `aria-*` wiring, the composed handlers -- sit after the spread so a stray prop cannot silently break accessibility. Nothing the consumer passes is swallowed.

```tsx
// Bad: an allowlist API pretending to be a DOM element
function Trigger({ children, onClick }: TriggerProps) {
  return <button onClick={onClick}>{children}</button>;
}
```

**Why bad:** `id`, `className`, `aria-label`, `data-testid` and every other prop vanish with no error. Consumers add a wrapper `<div>` to attach what they need, which breaks the CSS selectors and the flex/grid layout the trigger was sitting in. The ref never arrives, so focus restore and positioning measurement fail.

> **Ref forwarding across React versions and the full composition helpers:** See [examples/polymorphism.md](examples/polymorphism.md).

---

### Pattern 6: Context Scoping and Clear Out-of-Root Errors

Parts communicate with their `Root` through a context created per-primitive and provided per-`Root` instance -- never a module-level store. Reading that context is always guarded, and the guard names the part.

```tsx
const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(part: string): DialogContextValue {
  const context = useContext(DialogContext);
  if (context === null) {
    throw new Error(`<Dialog.${part}> must be rendered inside <Dialog.Root>.`);
  }
  return context;
}
```

**Why good:** The `null` default makes misuse impossible to miss, and the message names both the offending part and the fix. Two dialogs on the same page have two providers, so nesting resolves by React's normal context shadowing rather than by an id-matching scheme.

**Why a default value object is bad:** `createContext(defaultValue)` makes an orphaned `Dialog.Close` render a button that does nothing -- no error, no warning, and a bug that only shows up in manual testing. Silent no-ops are worse than crashes in a component library.

**Memoize the value.** The context value is rebuilt every render unless memoized, and every part re-renders with it. Memoize on the state it actually contains, and keep setters stable with `useCallback` or `useRef` so they are not part of the dependency list.

> **Full provider, per-part consumers, and the descendant-registry pattern:** See [examples/core.md](examples/core.md).

---

### Pattern 7: Structural Accessibility

Accessibility that depends on the consumer passing the right `aria-*` props is accessibility that will be wrong. A composable component wires it structurally: it generates ids, connects them across parts through context, and owns the keyboard and focus behavior its role requires.

```tsx
// Title generates its id and registers it with the Root; Popup consumes it,
// and renders no aria-labelledby at all when no Title is present.
const generatedId = useId();
const id = props.id ?? generatedId;

useEffect(() => {
  registerTitleId(id);
  return () => registerTitleId(undefined);
}, [id, registerTitleId]);
```

**Why good:** The relationship survives every rearrangement of the parts, because it flows through context rather than through the DOM tree the consumer wrote. Registration also means the attribute is _absent_ when the part is absent, instead of pointing at an id that never rendered.

**What "structural" covers, per role:**

| Concern            | Owned by the component                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Labeling**       | Generated ids, `aria-labelledby`/`aria-describedby` wired via context                        |
| **Focus**          | Move focus in on open, restore to the trigger on close, trap while modal                     |
| **Arrow keys**     | Roving tabindex -- exactly one item is tabbable, arrows move the active one                  |
| **Typeahead**      | Buffered printable characters, matched against item text, reset on idle                      |
| **Escape hatches** | `onOpenAutoFocus`/`onCloseAutoFocus`-style hooks so consumers redirect focus without forking |

**Why bad without it:** A dialog that does not restore focus leaves the keyboard user at the top of the document. A listbox that makes every option tabbable turns one Tab press into forty. Neither is visible in a screenshot, and neither is the consumer's job to discover.

> **Id registration, focus trap and restore, roving tabindex and typeahead implementations:** See [examples/accessibility-structure.md](examples/accessibility-structure.md).

---

### Pattern 8: Children as Composition, Not `items={[...]}`

An `items` array makes the component responsible for rendering every item, which means it is responsible for icons, badges, descriptions, grouping, empty states, keys and i18n -- forever, one prop at a time. Children hand all of it back.

```tsx
// Config: the component owns item markup, so every design need is a new prop
<Select items={options} renderItem={renderOption} groupBy="category" showIcons />

// Composition: the consumer owns markup, the component still owns behavior
<Select.Popup>
  <Select.Group>
    <Select.GroupLabel>Frameworks</Select.GroupLabel>
    <Select.Item value="react">React <Badge>new</Badge></Select.Item>
  </Select.Group>
</Select.Popup>
```

**Why good:** Anything renderable is an item's content. Grouping is markup rather than a `groupBy` string. The component keeps ownership of selection, keyboard navigation and `aria-activedescendant`, because each `Item` registers itself with the `Root`.

**The cost, stated honestly:** with an `items` array the component knows the order for free; with children it must build a registry. Register each item's DOM node on mount and sort the registry by `compareDocumentPosition`, never by mount order -- mount order and DOM order diverge under conditional rendering, portals and Suspense, and index-based registration silently misroutes arrow keys after any reorder.

> **Item registry, DOM-order sorting, and the value/label problem:** See [examples/core.md](examples/core.md).

</patterns>

---

<integration>

## Scope Boundaries

This skill is about the **shape of a component's API**. It is deliberately not about:

| Out of scope                                     | Belongs to                            |
| ------------------------------------------------ | ------------------------------------- |
| Using the primitive libraries themselves         | `web-ui-radix-ui`, `web-ui-base-ui`   |
| WCAG conformance, screen reader testing at large | `web-accessibility-web-accessibility` |
| Variant styling and class composition            | `web-styling-cva`                     |
| Design tokens, theming, color systems            | their own styling skills              |

Accessibility appears here only where it is _structural_ -- id wiring, focus ownership, keyboard behavior -- because those decisions are API decisions: they determine what parts exist and what context they share. Contrast ratios, alt text and audit workflows are not.

Styling appears here only as a _contract_ -- what a component must expose (`data-*`, `className` passthrough, CSS custom properties) so that styling is possible at all. Which styling tool consumes that contract is not this skill's concern.

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Boolean prop explosion** (`showCloseButton`, `hideOverlay`, `withIcon`, `noPadding`) -- N booleans is 2^N states the component must render correctly and someone must test; the next design will need the one combination that was never considered. Each boolean is a part that was not extracted.
- **`isOpen` with no `onOpenChange`** -- the component can be opened but can never close itself; every consumer reimplements Escape and outside-press, inconsistently, and dismissal accessibility is lost.
- **Copying a controlled prop into state** (`useState(props.value)`) -- reads correctly on first render and drifts forever after; the DOM shows stale state while the consumer's store shows the truth.
- **Style props as API** (`padding`, `bgColor`, `width`, `margin`) -- makes the behavior component a design system with a worse type signature; a second product theme requires forking it.
- **`renderX` prop multiplication** (`renderHeader`, `renderFooter`, `renderItem`, `renderEmpty`) -- these are `children` with less power: no context access, no rearrangement, and a new one for every region.
- **Unforwarded refs** -- positioning, measurement, focus restore, scroll-into-view and every consumer integration break at once, with no error; the component just quietly stops behaving.
- **Replaced instead of composed handlers** -- `onClick={props.onClick}` on a trigger deletes the open behavior; `onClick={handleOpen}` deletes the consumer's. Either way the failure is silent.
- **Visual opinions in behavior parts** -- a default `className`, a hardcoded `transition`, an inline color: the consumer must now out-specify the component's own CSS to style it.

**Medium Priority Issues:**

- Parts that only work in one arrangement -- if `Trigger` must be the first child of `Root`, the split gained nothing over props.
- Context created with a default value object instead of `null` -- turns misuse into a silent no-op.
- Unmemoized context values -- every part re-renders on every `Root` render.
- Index-based item registration -- correct until the first conditional item, then arrow keys land on the wrong row.
- A component that generates ids but never lets a consumer supply one -- breaks external `aria-controls` and label wiring.
- Mixing polymorphism shapes (`asChild` on some parts, `render` on others) -- consumers cannot predict either.

**Common Mistakes:**

- Spreading `{...rest}` _after_ the `aria-*` and composed handlers, letting a stray consumer prop overwrite the wiring -- defaults go before the spread, non-negotiables after.
- Adding a part that renders its own wrapper `<div>` "for convenience" -- it lands in the middle of the consumer's flex layout and cannot be removed.
- Exporting parts as separate top-level components (`DialogTrigger`, `DialogClose`) with no namespace, so nothing communicates that they belong to a `Root`.
- Treating `children` as `ReactNode` when the component needs to inspect it -- inspection via `React.Children.map` breaks under fragments, portals and any wrapper; use a context registry instead.
- Firing `onValueChange` only in uncontrolled mode -- the consumer's logging and side effects vanish the moment they take control.

**Gotchas & Edge Cases:**

- **Slot merges a single child only.** Multiple children need an explicit `Slottable` marker so the merge targets the right element; without it, cloning throws or targets the wrong node.
- **`asChild` with a component that does not spread props is silently non-functional.** No error is raised -- the trigger simply never opens anything. The same is true of the element form of `render`.
- **React 19 callback refs may return a cleanup function.** A `composeRefs` helper that ignores return values leaks the old node; collect the cleanups and return a composed cleanup.
- **`useId` values are not selector-safe or XML-safe.** They were `:r0:` before React 19.1 and are `«r0»` from 19.1 on; colons break unescaped CSS selectors, and guillemets are invalid in SVG `id` attributes and throw in some `querySelector` implementations. Generated ids are fine in `aria-*` and `for`/`id` on HTML elements -- never build a selector string or an SVG id from one.
- **Changing `defaultValue` after mount does nothing** -- it is read once, by design. Consumers expecting it to reset the component need an explicit `key` change or a reset method.
- **`data-side`/`data-align` are written after measurement,** so they can flip between first paint and layout effect. Drive entry animations off explicit starting/ending-style attributes rather than mount.
- **Escape hatches differ by shape:** `event.preventDefault()` suppresses a Slot-composed internal handler; `event.preventBaseUIHandler()` suppresses a Base UI internal handler without preventing the default action. `preventBaseUIHandler` exists only on React synthetic events -- where the library listens natively, it has no effect.
- **Portaled content is out of DOM order.** Focus management, not `aria-owns`, is what keeps the experience coherent; a portal without a focus contract is worse than no portal.

</red_flags>

---

<decision_framework>

## Decision Framework

### Prop, Part, or Slot?

```
Does the new requirement change what is RENDERED?
|-- NO (it changes behavior or state) -> It is a prop. Ship it as a prop.
+-- YES -> Can the consumer already express it by rearranging existing parts?
    |-- YES -> Add nothing. Document the arrangement.
    +-- NO -> Does it need the component's state or behavior attached?
        |-- YES -> Add a PART (a new subcomponent reading the shared context).
        +-- NO -> It is the consumer's markup. Accept it as children.
```

A boolean prop is the correct answer only when it changes behavior (`modal`, `disabled`, `loop`) -- never when it toggles the existence of markup.

### Controlled, Uncontrolled, or Both?

```
Does anything outside the component need to read or set this state?
|-- NEVER -> Keep it internal. Do not expose it at all.
+-- SOMETIMES -> Ship the triple: value + defaultValue + onValueChange.
                 Uncontrolled by default, controlled when `value` is provided.
+-- ALWAYS (the component cannot compute it) -> Required `value` + `onValueChange`,
    no defaultValue. Document that it is controlled-only.
```

Never ship `value` alone, and never ship `defaultValue` alone -- the first cannot change, the second cannot be observed.

### Which Polymorphism Shape?

```
Does the component library you are extending already define one?
|-- YES -> Use that one, on every part, without exception.
+-- NO -> Do consumers need the component's STATE to decide what to render?
    |-- YES -> Callback form: render={(props, state) => ...}
    +-- NO -> Element form: asChild + Slot, or render={<El />}. Pick one and
              apply it uniformly -- the value is predictability, not the shape.
```

### The Alignment Checklist

Run any existing component through these six axes. Each failed line is a concrete refactor, in this order -- API shape first, because the later axes depend on which parts exist.

**1. API shape**

- [ ] No boolean prop toggles the existence of markup
- [ ] No `renderX` prop exists that `children` on a part could not express
- [ ] Every region a consumer might want to change is a part or a child, not a prop
- [ ] Parts can be rearranged, omitted, duplicated and wrapped without breaking behavior
- [ ] Parts are namespaced (`Dialog.Trigger`) so their `Root` is obvious

**2. State contract**

- [ ] Every exposed state ships as `value` + `defaultValue` + `onValueChange`
- [ ] The component is usable with zero state props (uncontrolled by default)
- [ ] No controlled prop is copied into `useState`
- [ ] The change callback fires in both modes
- [ ] The change callback carries a reason, and a cancelation path exists for vetoable changes

**3. Polymorphism**

- [ ] Every part that renders a DOM element supports element substitution
- [ ] One shape (`asChild` or `render`) is used consistently across all parts
- [ ] Substitution merges rather than overwrites props, refs, `className` and `style`
- [ ] The documented escape hatch for suppressing internal handlers is correct for the shape used

**4. Styling contract**

- [ ] Every state is readable from the DOM as a `data-*` attribute
- [ ] Boolean states are attribute presence, never `="false"`
- [ ] No part ships a default `className`, color, spacing or transition
- [ ] Inline styles are limited to functionally required values, exposed as CSS custom properties where possible
- [ ] `className` and `style` from the consumer always reach the DOM node

**5. Accessibility structure**

- [ ] Ids are generated and wired across parts through context, not through props
- [ ] `aria-labelledby`/`aria-describedby` are absent when the labeling part is absent
- [ ] Focus moves in on open and is restored to the trigger on close
- [ ] Composite widgets use roving tabindex -- exactly one tabbable item
- [ ] Consumers can override focus behavior through hooks rather than by forking

**6. Forwarding**

- [ ] Every part spreads its remaining props onto its DOM node
- [ ] Every part forwards its ref to that node
- [ ] Consumer handlers run first and can suppress the internal handler
- [ ] Defaults are placed before the spread, non-negotiables after
- [ ] Nothing the consumer passes is silently dropped

</decision_framework>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST express variation as parts and children, NOT as configuration props -- a new visual requirement must be satisfiable by rearranging JSX, never by adding a boolean or a `renderX` prop)**

**(You MUST ship the full state triple for every piece of component state -- `value` + `defaultValue` + `onValueChange` -- and NEVER copy a controlled prop into internal state)**

**(You MUST compose props, event handlers and refs that arrive from the consumer, NEVER replace them -- the consumer's handler runs first and must be able to suppress your internal behavior)**

**(You MUST expose state as `data-*` attributes on every part and keep behavior parts visually unopinionated -- no default classNames, no inline colors, no baked-in transitions)**

**(You MUST read the component's current API and all of its call sites before changing it -- alignment is a refactor of a contract, and every consumer is part of that contract)**

**Failure to follow these rules will produce a component that has to be forked or wrapped the first time a design changes -- the exact failure composable APIs exist to prevent.**

</critical_reminders>
