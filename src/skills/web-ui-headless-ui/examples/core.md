# Headless UI - Core Patterns

> Essential patterns that apply across all Headless UI components. See [SKILL.md](../SKILL.md) for component selection guidance and [reference.md](../reference.md) for API reference.

**Topic-specific examples:** [dialog.md](dialog.md), [menu.md](menu.md),
[listbox-combobox.md](listbox-combobox.md), [tabs.md](tabs.md),
[popover-disclosure.md](popover-disclosure.md), [switch-radio.md](switch-radio.md),
[forms.md](forms.md)

---

## Pattern 1: Data-Attribute Styling

Every component publishes its state as `data-*` attributes. This is the styling mechanism the whole
library shares. The attribute names are the contract; the selector syntax below is a utility-class
framework's attribute-variant form, and plain CSS writes `[data-focus] { … }` for the same thing.

```tsx
// State on the element itself
<MenuItem>
  <button className="data-[focus]:bg-blue-100 data-[disabled]:opacity-50">
    Edit
  </button>
</MenuItem>

// Parent state reaching a child: mark the parent, scope the child's variant to it
<Switch className="group h-6 w-11 rounded-full bg-gray-200 data-[checked]:bg-blue-600">
  <span className="size-5 rounded-full bg-white group-data-[checked]:translate-x-5" />
</Switch>

// Transition state
<DialogPanel
  transition
  className="duration-200 ease-out data-[closed]:opacity-0 data-[closed]:scale-95"
>
```

**Why good:** no JavaScript re-render, works in a server component, and the state reaches children
without prop drilling.

**Most used:** `data-open`, `data-closed`, `data-focus`, `data-selected`, `data-checked`,
`data-disabled`, `data-hover`, `data-active`. Per-component availability:
[reference.md](../reference.md#data-attributes-reference).

---

## Pattern 2: Anchor Positioning

Floating panels (MenuItems, ListboxOptions, ComboboxOptions, PopoverPanel) accept an `anchor` prop for viewport-aware positioning.

```tsx
// String syntax — most common
<MenuItems anchor="bottom start" className="[--anchor-gap:8px]">

// Object syntax — full control
<MenuItems anchor={{ to: "bottom start", gap: 8, offset: 4, padding: 12 }}>

// Match trigger width for dropdowns
<ListboxOptions className="w-[var(--button-width)]">
<ComboboxOptions className="w-[var(--input-width)]">

// Responsive gap
<MenuItems anchor="bottom" className="[--anchor-gap:4px] sm:[--anchor-gap:8px]">
```

**Why good:** flips and shifts against the viewport with no positioning code, and the CSS variables
make the gap responsive without touching the markup.

**Position values:** a side — `top`, `bottom`, `left`, `right` — optionally followed by `start` or
`end`. **CSS variables:** `--anchor-gap`, `--anchor-offset`, `--anchor-padding`, `--button-width`,
`--input-width`. Full table: [reference.md](../reference.md#anchor-positioning-reference).

---

## Pattern 3: Transitions with data-closed

The `transition` prop enables CSS transitions using data attributes. Apply to any component that supports open/close states.

```tsx
// Basic fade + scale (most common)
<DialogPanel
  transition
  className="duration-300 ease-out data-[closed]:opacity-0 data-[closed]:scale-95"
>

// Different enter/leave directions
<PopoverPanel
  transition
  className="duration-300 data-[closed]:opacity-0 data-[closed]:data-[enter]:-translate-y-4 data-[closed]:data-[leave]:translate-y-4"
>

// Coordinated multi-element transitions (backdrop + panel)
<Transition show={isOpen}>
  <TransitionChild>
    <div className="fixed inset-0 bg-black/30 transition duration-300 data-[closed]:opacity-0" />
  </TransitionChild>
  <TransitionChild>
    <div className="fixed right-0 w-80 bg-white transition duration-300 data-[closed]:translate-x-full" />
  </TransitionChild>
</Transition>
```

### Key rules

- `data-closed` is both the enter-from and the leave-to state — the element starts there, transitions
  to its resting styles, and returns there on close
- Pair `transition` with a duration, or the state flips with nothing visible
- Stack `data-[closed]:data-[enter]:` and `data-[closed]:data-[leave]:` for asymmetric motion
- `data-transition` applies throughout either direction, which is where shared rules like
  `pointer-events: none` go
- `Transition` + `TransitionChild` hold the unmount until every child has finished

---

## Pattern 4: The `as` Prop and Element Customization

Every Headless UI component accepts `as` to change the rendered element.

```tsx
// Render as a different element
<Tab as="button" className="...">Custom tab</Tab>
<MenuItem as="a" href="/settings">Settings</MenuItem>
<CloseButton as="a" href="/analytics">Analytics</CloseButton>

// Some components default to Fragment (e.g. Tab) — use `as` to render a real element
<Radio as="div" className="rounded-lg border p-4 data-[checked]:border-blue-500">
  <Label>{option.name}</Label>
</Radio>
```

**Why good:** semantic HTML with no wrapper element, links inside menus, and a real element to style
on `Tab`, which is a Fragment by default.

---

## Pattern 5: The `useClose` Hook

Imperative close for nested components deep within Dialog, Popover, or Disclosure.

```tsx
import { useClose } from "@headlessui/react";

function NestedContent() {
  const close = useClose();

  return (
    <button onClick={() => close()}>Done</button> // closes the nearest closeable ancestor
  );
}
```

**Why good:** no `onClose` threaded through the tree. Works inside Dialog, Popover and Disclosure.
