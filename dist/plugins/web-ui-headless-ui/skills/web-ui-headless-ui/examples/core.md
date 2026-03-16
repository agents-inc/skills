# Headless UI - Core Patterns

> Essential patterns that apply across all Headless UI components. See [SKILL.md](../SKILL.md) for component selection guidance and [reference.md](../reference.md) for API reference.

**Topic-specific examples:**

- [Dialog & Modal](dialog.md) - Modal overlays, form dialogs, slide-over panels
- [Menu & Dropdowns](menu.md) - Dropdown action menus, sections, icons
- [Listbox & Combobox](listbox-combobox.md) - Custom select, autocomplete, virtual scrolling
- [Tabs](tabs.md) - Horizontal/vertical tabs, controlled state
- [Popover & Disclosure](popover-disclosure.md) - Floating panels, accordion
- [Switch, RadioGroup & Checkbox](switch-radio.md) - Toggle, option selection
- [Form Components](forms.md) - Field, Input, Label, Fieldset

---

## Pattern 1: Data-Attribute Styling

All Headless UI components expose `data-*` attributes for CSS-based state styling. This is the fundamental styling mechanism and applies to every component.

```tsx
// Direct state styling on the component element
<MenuItem>
  <button className="data-[focus]:bg-blue-100 data-[disabled]:opacity-50">
    Edit
  </button>
</MenuItem>

// Parent-to-child state propagation using Tailwind's `group` utility
<Switch className="group h-6 w-11 rounded-full bg-gray-200 data-[checked]:bg-blue-600">
  <span className="size-5 rounded-full bg-white group-data-[checked]:translate-x-5" />
</Switch>

// Transition state styling
<DialogPanel
  transition
  className="duration-200 ease-out data-[closed]:opacity-0 data-[closed]:scale-95"
>
```

**Why good:** Pure CSS styling (no JS re-renders), RSC-compatible, works with any styling solution via `className`, `group-data-[*]` propagates state to children

### Available Data Attributes

| Attribute       | Available On                                         | Meaning                           |
| --------------- | ---------------------------------------------------- | --------------------------------- |
| `data-open`     | Dialog, Menu, Popover, Disclosure, Listbox, Combobox | Component is open                 |
| `data-closed`   | Components with `transition` prop                    | Closed state (for transitions)    |
| `data-focus`    | MenuItem, ListboxOption, ComboboxOption, Tab, inputs | Has keyboard/mouse focus          |
| `data-selected` | ListboxOption, ComboboxOption, Tab                   | Currently selected                |
| `data-checked`  | Checkbox, Switch, Radio                              | Control is checked/on             |
| `data-disabled` | All interactive components                           | Component is disabled             |
| `data-hover`    | All interactive components                           | Mouse hover (NOT on touch)        |
| `data-active`   | All interactive components                           | Mouse press (cleared on drag-off) |

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

**Why good:** Viewport-aware (auto-flips), no manual positioning code, CSS variables for fine-tuning, responsive via media queries

### Position Values

`"top"`, `"top start"`, `"top end"`, `"bottom"`, `"bottom start"`, `"bottom end"`, `"left"`, `"left start"`, `"left end"`, `"right"`, `"right start"`, `"right end"`

### CSS Variables

| Variable           | Purpose                             |
| ------------------ | ----------------------------------- |
| `--anchor-gap`     | Space between trigger and panel     |
| `--anchor-offset`  | Horizontal offset from anchor point |
| `--anchor-padding` | Minimum distance from viewport edge |
| `--button-width`   | Width of trigger button             |
| `--input-width`    | Width of input element              |

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

**Why good:** `data-[closed]` defines both enter-from and leave-to states, `data-[enter]`/`data-[leave]` allow directional transitions, `Transition`+`TransitionChild` coordinate multiple elements

### Key Rules

- Always pair `transition` prop with a `duration-*` class (otherwise no visible animation)
- `data-[closed]` is the target state: elements start at `data-[closed]` state and transition to normal, then back to `data-[closed]` when closing
- Stack `data-[closed]:data-[enter]:` and `data-[closed]:data-[leave]:` for different enter/leave animations
- `data-[transition]` applies during any transition (useful for shared styles like `pointer-events-none`)

---

## Pattern 4: The `as` Prop and Element Customization

Every Headless UI component accepts `as` to change the rendered element.

```tsx
// Render as a different element
<Tab as="div" className="...">Custom tab</Tab>
<MenuItem as="a" href="/settings">Settings</MenuItem>
<CloseButton as="a" href="/analytics">Analytics</CloseButton>

// Render as Fragment (component manages children directly)
<Tab as={Fragment}>{/* children */}</Tab>
```

**Why good:** Semantic HTML without wrapper elements, enables links in Menus, Fragments avoid extra DOM nodes

---

## Pattern 5: The `useClose` Hook

Imperative close for nested components deep within Dialog, Popover, or Disclosure.

```tsx
import { useClose } from "@headlessui/react";

function NestedContent() {
  const close = useClose();

  return (
    <button
      onClick={() => {
        // Do something first...
        close(); // Then close the nearest closeable ancestor
      }}
    >
      Done
    </button>
  );
}
```

**Why good:** Avoids prop drilling `onClose` callbacks through deeply nested component trees, works with Dialog, Popover, and Disclosure
