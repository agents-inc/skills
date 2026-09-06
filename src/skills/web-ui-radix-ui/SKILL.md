---
name: web-ui-radix-ui
description: Unstyled accessible UI primitives
---

# Radix UI Primitives

> **Quick Guide:** Radix ships unstyled primitives that carry the behaviour and accessibility of a
> component and none of its appearance. Every primitive is a compound component — `Root`, `Trigger`,
> `Portal`, `Content` — sharing context; `asChild` merges a primitive's behaviour onto your own
> element; `data-state` attributes drive CSS animation. Current major is v1.4.x: React 19 and RSC
> compatible, `forwardRef` no longer required, and `radix-ui` is the unified package that replaces
> the individual `@radix-ui/react-*` ones.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — Dialog, `asChild`, `Slot` and `Slottable`
- [examples/overlays.md](examples/overlays.md) — AlertDialog, controlled Dialog with async work
- [examples/menus.md](examples/menus.md) — DropdownMenu, submenus, checkable and radio items
- [examples/forms.md](examples/forms.md) — Select, CSP `nonce`, indeterminate Progress
- [examples/navigation.md](examples/navigation.md) — Accordion and Tabs
- [examples/animation.md](examples/animation.md) — `data-state` keyframes and height animation
- [examples/preview.md](examples/preview.md) — `unstable_` primitives: OTP field, password toggle, Form
- [reference.md](reference.md) — anti-patterns with code, checklists, CSS variable table, v1.4.x changes

---

## Which path applies

- **A stable primitive** — the eight-year-old API surface, semver-stable. Follow
  [examples/core.md](examples/core.md), then the file for the primitive family you need.
- **A preview primitive** — `unstable_OneTimePasswordField`, `unstable_PasswordToggleField`,
  `unstable_Form`. The prefix is the API contract: these change between minors, so follow
  [examples/preview.md](examples/preview.md) and expect to revisit on upgrade.
- **Animating enter and exit** — the approach forks on complexity. CSS `@keyframes` keyed to
  `data-state` covers fades, slides and height; orchestrated sequences need `forceMount`. Both are in
  [examples/animation.md](examples/animation.md).

---

<critical_requirements>

## Before writing Radix UI code

**Install the unified `radix-ui` package** rather than individual `@radix-ui/react-*` ones. One
version of the shared internals means no duplicate context providers and no stacking-order conflicts
between primitives.

**Give overlays their full anatomy — `Root`, `Trigger`, `Portal`, `Overlay`, `Content`, `Close`.**
Each part registers itself with the Root's context; a missing part removes the behaviour it carried
rather than just its markup.

**Wrap overlay content in `Portal`.** Content rendered in place inherits every ancestor's
`overflow: hidden` and stacking context, so a dialog inside a scrolling panel is clipped by it.

**Give every Dialog and AlertDialog a `Title`.** It is what a screen reader announces on open, and
Radix logs a console error when it is missing (a warning for a missing `Description`).

**Forward the ref and spread every prop on a component used with `asChild`.** The ref is how Radix
positions floating content and returns focus on close; the spread is how the ARIA attributes and
event handlers reach the DOM element. React 19 passes `ref` as an ordinary prop; below that it needs
a `forwardRef` wrapper.

</critical_requirements>

---

**Auto-detection:** radix-ui, @radix-ui, Dialog.Root, AlertDialog, DropdownMenu, Popover, Tooltip,
Accordion, Tabs, Select.Viewport, asChild, Slot, Slottable, ItemIndicator, data-state, forceMount,
onOpenAutoFocus, onInteractOutside, --radix-accordion-content-height, unstable_OneTimePasswordField,
unstable_PasswordToggleField, unstable_Form

**Applies to:**

- Overlay behaviour — focus trapping, dismissal, collision-aware positioning, stacking order
- Compound component APIs whose parts coordinate through shared context
- Keyboard interaction and ARIA wiring for menus, selects, tabs and accordions
- Polymorphism — rendering a primitive's behaviour on a different element via `asChild`
- Building your own components with `asChild` support, using `Slot`

**Handled elsewhere:**

- Visual design — primitives render unstyled and take a `className`; what produces that class is not
  this skill's concern
- Form state, schema validation and submission — a Radix `Select` or `Checkbox` reports its value and
  nothing more
- Icon artwork — the examples use Unicode glyphs marked `aria-hidden`; supplying real icons is a
  separate choice
- Animation orchestration in JavaScript — Radix exposes `forceMount` and `data-state` as the hooks a
  presence-detecting animation runtime attaches to

---

<philosophy>

Radix separates the two halves of a component that are usually welded together. It owns the half
that is hard and invisible — ARIA roles, focus order, dismissal semantics, collision detection — and
leaves the half that is your product's identity entirely alone.

That split has a consequence worth internalising: **a primitive is a set of parts, not a component
with props.** `Dialog` is not a thing you configure; it is `Root`, `Trigger`, `Portal`, `Overlay`,
`Content`, `Title`, `Description` and `Close`, communicating through context you never see. You
compose the parts you need, in the arrangement your design calls for, and the coordination comes
free. Reaching for a prop where a part exists is the usual sign of fighting the model.

</philosophy>

---

<decision_framework>

## Choosing a primitive

```
Blocking the page?
├─ Destructive confirmation → AlertDialog (no click-outside dismiss, by design)
├─ Form or content         → Dialog
└─ Page-level, not blocking → Dialog with modal={false}, or Popover

Floating beside a trigger?
├─ Opened by click, holds interactive content → Popover
├─ Opened by hover or focus, text only        → Tooltip
└─ A list of actions                          → DropdownMenu

Choosing from options?
├─ One value, in a form   → Select
├─ Several values         → Popover containing Checkbox items
└─ An action, not a value → DropdownMenu

Showing and hiding regions?
├─ One at a time, in place → Accordion (type="single" collapsible)
├─ Several at once         → Accordion (type="multiple")
└─ One panel replacing another → Tabs
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Compound component anatomy

Every overlay is the same six parts. Root holds the state, Portal escapes the layout, Title and
Description carry the accessible name.

```tsx
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className={overlayClass} />
    <Dialog.Content className={contentClass}>
      <Dialog.Title>Account settings</Dialog.Title>
      <Dialog.Description>Manage preferences and security.</Dialog.Description>
      <Dialog.Close aria-label="Close">×</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Controlled and uncontrolled state

`defaultOpen` lets Radix own the state. `open` with `onOpenChange` takes it back — needed to close
after an async save, to open from somewhere other than the trigger, or to mirror the URL.
`onOpenChange` is the only channel for user intent, so a controlled primitive that omits it can
never be dismissed.

```tsx
const [open, setOpen] = useState(false);

<Dialog.Root open={open} onOpenChange={setOpen}>
  {/* … */}
</Dialog.Root>;
```

Full code: [examples/overlays.md](examples/overlays.md)

### Pattern 3: `asChild` for polymorphism

`asChild` tells a part to render its child instead of its own element, merging props and behaviour
onto it. This is how a `Tooltip.Trigger` becomes an anchor, or a `Dialog.Trigger` becomes your own
button, without a wrapper element.

```tsx
<Tooltip.Trigger asChild>
  <a href="/docs">Documentation</a>
</Tooltip.Trigger>
```

A custom component in that position takes `ref` and spreads the rest, or the merge silently drops
the handlers and ARIA attributes Radix passed down.

Full code: [examples/core.md](examples/core.md)

### Pattern 4: Building your own `asChild` components with `Slot`

`Slot` is the merging machinery `asChild` uses, exposed for your own components. Swap the rendered
element for `Slot` when `asChild` is set. `Slottable` marks where the child's content belongs when
the component also renders fixed decoration around it.

```tsx
function Button({ asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp {...props} />;
}
```

Full code: [examples/core.md](examples/core.md)

### Pattern 5: Portal and its container

Portal moves content to `document.body`, out of every ancestor's clipping and stacking context.
Pass `container` to send it somewhere else — a shadow root, an iframe body, or a
micro-frontend's own mount point.

```tsx
<Popover.Portal container={containerRef.current}>
  <Popover.Content>
    <Popover.Arrow />
  </Popover.Content>
</Popover.Portal>
```

Full code: [examples/core.md](examples/core.md)

### Pattern 6: Animation through `data-state`

Radix sets `data-state="open"` and `"closed"` on the animatable parts and suspends unmount until the
exit animation reports it has finished. It listens for `animationend`, so `@keyframes` delays the
unmount and `transition` does not.

```css
.dialog-overlay[data-state="open"] {
  animation: fadeIn 150ms ease-out;
}
.dialog-overlay[data-state="closed"] {
  animation: fadeOut 150ms ease-in;
}
```

For sequences a JavaScript runtime drives, `forceMount` on Portal, Overlay and Content hands
unmounting back to you.

Full code: [examples/animation.md](examples/animation.md)

### Pattern 7: Focus management

Modal content traps focus and returns it to the trigger on close, with no configuration. Override
where the initial focus lands with `onOpenAutoFocus` — a destructive confirmation should open on
Cancel rather than on Delete.

```tsx
<AlertDialog.Content
  onOpenAutoFocus={(event) => {
    event.preventDefault();
    cancelRef.current?.focus();
  }}
>
```

Full code: [examples/overlays.md](examples/overlays.md)

### Pattern 8: Accessible names for overlays

`Title` is the accessible name and is required. Where the design has no visible heading, keep the
element and hide it visually — removing it removes the announcement, not just the text.

```tsx
<VisuallyHidden asChild>
  <Dialog.Title>Filter results</Dialog.Title>
</VisuallyHidden>
```

Set `aria-describedby={undefined}` on `Content` when there is deliberately no `Description`, which
silences the warning without inventing text.

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A custom `asChild` child that does not take a ref — Radix cannot measure or focus it, so floating
  content mispositions and focus never returns; take `ref` as a prop (React 19) or wrap in
  `forwardRef`
- A custom `asChild` child that does not spread its remaining props — the merged event handlers and
  ARIA attributes are dropped, leaving a trigger that looks right and does nothing
- Overlay content outside `Portal` — clipped by any ancestor with `overflow: hidden`, and layered
  against the wrong stacking context
- A Dialog without `Title` — no accessible name, and a console error on every open
- `transition` used for an exit animation — unmount is not delayed, so the element disappears before
  anything animates; use `@keyframes`
- Mounting content with a JavaScript animation runtime but no `forceMount` — Radix unmounts it the
  moment state flips, cutting the exit animation off at frame one

**Surprising behaviour:**

- `data-state` flips to `"closed"` before the exit animation starts, not after it ends
- `--radix-accordion-content-height` and its siblings are set only while an animation is running,
  and read as empty outside one
- AlertDialog has no click-outside or Escape dismissal — `Cancel` or `Action` is the only way out,
  which is the point of choosing it
- `Slot` merges handlers rather than replacing them, and the child's own handler runs first
- Setting an explicit `z-index` on portalled content fights the ordering Radix maintains between
  layered primitives; isolate the container instead
- A `Progress` with `value={undefined}` is indeterminate rather than zero
- `Select` and `ScrollArea` take a `nonce` prop, needed wherever a Content Security Policy blocks
  unnonced inline styles

</red_flags>
