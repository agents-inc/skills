# Headless UI Quick Reference

> Component APIs, keyboard shortcuts, and data attributes for all Headless UI v2 components. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples. **Current: v2.2.9 (React only)**

---

## Component Inventory

| Component   | Import                                                                             | Purpose               | Keyboard                             |
| ----------- | ---------------------------------------------------------------------------------- | --------------------- | ------------------------------------ |
| Dialog      | `Dialog, DialogPanel, DialogBackdrop, DialogTitle, Description, CloseButton`       | Modal overlay         | Esc close, Tab trap                  |
| Menu        | `Menu, MenuButton, MenuItems, MenuItem, MenuSection, MenuHeading, MenuSeparator`   | Dropdown actions      | Arrows, Enter, Esc, type-ahead       |
| Listbox     | `Listbox, ListboxButton, ListboxOptions, ListboxOption, ListboxSelectedOption`     | Custom select         | Arrows, Enter/Space, Esc, type-ahead |
| Combobox    | `Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption`         | Searchable select     | Arrows, Enter, Esc, Tab selects      |
| Popover     | `Popover, PopoverButton, PopoverPanel, PopoverGroup, PopoverBackdrop, CloseButton` | Floating panel        | Enter/Space, Esc, Tab exits          |
| TabGroup    | `TabGroup, TabList, Tab, TabPanels, TabPanel`                                      | Tabbed content        | Arrows, Home/End                     |
| Disclosure  | `Disclosure, DisclosureButton, DisclosurePanel, CloseButton`                       | Show/hide toggle      | Enter/Space                          |
| Switch      | `Switch`                                                                           | Toggle on/off         | Space toggle                         |
| RadioGroup  | `RadioGroup, Radio`                                                                | Option selection      | Arrows cycle                         |
| Checkbox    | `Checkbox`                                                                         | Check/uncheck         | Space toggle                         |
| Transition  | `Transition, TransitionChild`                                                      | Animate mount/unmount | -                                    |
| Form Fields | `Field, Fieldset, Legend, Label, Description, Input, Select, Textarea`             | Accessible forms      | -                                    |

---

## Component Structure

### Dialog

```
Dialog (open, onClose, role, transition)
  DialogBackdrop (transition)
  [positioning wrapper - your div]
    DialogPanel (transition)
      DialogTitle -> sets aria-labelledby
      Description -> sets aria-describedby
      CloseButton -> closes dialog
```

**Required props:** `open` (boolean), `onClose` (callback)

**Key props:**

- `role`: `"dialog"` (default) or `"alertdialog"`
- `transition`: enables data-closed/data-enter/data-leave
- `autoFocus`: focus dialog on mount

### Menu (Dropdown)

```
Menu
  MenuButton (disabled, autoFocus)
  MenuItems (anchor, transition, portal, modal, static, unmount)
    MenuSection
      MenuHeading
      MenuItem (disabled) -> auto-closes on click
    MenuSeparator
```

**Key props:**

- `anchor`: positioning string or object (e.g., `"bottom start"`)
- `transition`: enables CSS transitions
- `portal`: render in portal (auto-enabled with anchor)
- `modal`: focus trapping and scroll locking

### Listbox (Custom Select)

```
Listbox (value, onChange, defaultValue, multiple, by, name, horizontal, disabled, invalid)
  ListboxButton
  ListboxOptions (anchor, transition, portal, modal, static, unmount)
    ListboxOption (value, disabled)
  ListboxSelectedOption (placeholder, options)
```

**Key props:**

- `multiple`: array value mode
- `by`: object comparison field (defaults to `id`)
- `name`: hidden input for forms
- `horizontal`: left/right arrow navigation

### Combobox (Autocomplete)

```
Combobox (value, onChange, defaultValue, multiple, by, name, immediate, virtual, onClose, disabled)
  ComboboxInput (displayValue, onChange, autoFocus)
  ComboboxButton
  ComboboxOptions (anchor, transition, portal, static, unmount)
    ComboboxOption (value, disabled)
```

**Key props:**

- `virtual`: `{ options, disabled? }` for large list virtualization
- `immediate`: open on input focus
- `onClose`: fires when dropdown closes (reset query here)
- `displayValue`: format selected value for input display

### Popover

```
Popover
  PopoverButton (disabled, autoFocus)
  PopoverPanel (anchor, transition, focus, portal, modal, static, unmount)
    CloseButton (as) -> closes popover on click
  PopoverBackdrop (transition)
PopoverGroup -> manages sibling popover focus
```

**Key props:**

- `focus`: trap focus within panel
- `modal`: focus trap + scroll lock + inert external elements
- `PopoverGroup`: prevents close when tabbing between grouped popovers

### TabGroup

```
TabGroup (defaultIndex, selectedIndex, onChange, vertical, manual)
  TabList
    Tab (disabled, autoFocus)
  TabPanels
    TabPanel (static, unmount)
```

**Key props:**

- `vertical`: switch to Up/Down arrow navigation
- `manual`: require Enter/Space to activate (default is automatic on focus)
- `selectedIndex`/`onChange`: controlled mode
- `defaultIndex`: uncontrolled initial tab

### Disclosure

```
Disclosure (defaultOpen)
  DisclosureButton (autoFocus)
  DisclosurePanel (transition, static, unmount)
  CloseButton -> closes disclosure
```

### Switch

```
Field (disabled)
  Label (passive)
  Description
  Switch (checked, onChange, defaultChecked, name, value, form, disabled)
```

**Key props:**

- `name`/`value`: hidden input for form submission
- `passive` on Label: prevent toggle on label click

### RadioGroup

```
RadioGroup (value, onChange, defaultValue, by, name, form, disabled)
  Radio (value, disabled, autoFocus)
    Label
    Description
```

**Key props:**

- `by`: object comparison field (defaults to `id`)
- `name`: hidden input(s) for form submission

### Checkbox

```
Field (disabled)
  Label (passive)
  Description
  Checkbox (checked, onChange, defaultChecked, indeterminate, name, value, form, disabled)
```

**Key props:**

- `indeterminate`: third visual state
- `name`/`value`: hidden input for form submission

### Transition

```
Transition (show, appear, beforeEnter, afterEnter, beforeLeave, afterLeave, unmount)
  TransitionChild (appear, beforeEnter, afterEnter, beforeLeave, afterLeave)
```

**Key props:**

- `show`: controls visibility
- `appear`: animate on initial mount
- `unmount`: remove from DOM when hidden (default: true)

---

## Data Attributes Reference

### State Attributes (per component)

| Attribute            | Available on                                         | Meaning                                 |
| -------------------- | ---------------------------------------------------- | --------------------------------------- |
| `data-open`          | Dialog, Menu, Popover, Disclosure, Listbox, Combobox | Component is open                       |
| `data-closed`        | Components with `transition` prop                    | Component is closed (transition target) |
| `data-focus`         | MenuItem, ListboxOption, ComboboxOption, Tab, inputs | Has keyboard/mouse focus                |
| `data-selected`      | ListboxOption, ComboboxOption, Tab                   | Currently selected                      |
| `data-checked`       | Checkbox, Switch, Radio                              | Control is checked/on                   |
| `data-disabled`      | All interactive                                      | Component is disabled                   |
| `data-hover`         | All interactive                                      | Mouse hover (NOT on touch devices)      |
| `data-active`        | All interactive                                      | Mouse press (cleared on drag-off)       |
| `data-indeterminate` | Checkbox                                             | Indeterminate state                     |
| `data-changing`      | Switch, Checkbox                                     | True for 2 frames during state change   |
| `data-autofocus`     | Components with autoFocus                            | Has autoFocus prop set                  |
| `data-invalid`       | Listbox, Combobox                                    | Has invalid prop set                    |

### Transition Attributes

| Attribute         | When Applied               | Purpose                                  |
| ----------------- | -------------------------- | ---------------------------------------- |
| `data-closed`     | Before enter, during leave | Define start/end state                   |
| `data-enter`      | During enter transition    | Enter-specific styles (duration, easing) |
| `data-leave`      | During leave transition    | Leave-specific styles (duration, easing) |
| `data-transition` | During any transition      | Shared transition styles                 |

### Tailwind Usage

```tsx
// Basic state styling
className =
  "data-[focus]:bg-blue-100 data-[selected]:font-bold data-[disabled]:opacity-50";

// Parent state styling via group
className = "group ...";
// On child:
className = "group-data-[checked]:translate-x-5 group-data-[open]:rotate-180";

// Transition styling
className =
  "transition duration-200 data-[closed]:opacity-0 data-[closed]:scale-95";

// Direction-specific transitions (enter from left, leave to right)
className =
  "transition duration-300 data-[closed]:opacity-0 data-[closed]:data-[enter]:-translate-x-4 data-[closed]:data-[leave]:translate-x-4";
```

---

## Anchor Positioning Reference

### Position Values

| Value            | Description           |
| ---------------- | --------------------- |
| `"top"`          | Above, centered       |
| `"top start"`    | Above, left-aligned   |
| `"top end"`      | Above, right-aligned  |
| `"bottom"`       | Below, centered       |
| `"bottom start"` | Below, left-aligned   |
| `"bottom end"`   | Below, right-aligned  |
| `"left"`         | Left, centered        |
| `"left start"`   | Left, top-aligned     |
| `"left end"`     | Left, bottom-aligned  |
| `"right"`        | Right, centered       |
| `"right start"`  | Right, top-aligned    |
| `"right end"`    | Right, bottom-aligned |

### CSS Variables

| Variable           | Purpose                             | Applies to                              |
| ------------------ | ----------------------------------- | --------------------------------------- |
| `--anchor-gap`     | Space between trigger and panel     | All anchor components                   |
| `--anchor-offset`  | Horizontal offset from anchor point | All anchor components                   |
| `--anchor-padding` | Minimum distance from viewport edge | All anchor components                   |
| `--button-width`   | Width of trigger button             | MenuItems, ListboxOptions, PopoverPanel |
| `--input-width`    | Width of input element              | ComboboxOptions                         |

### Usage Patterns

```tsx
// String syntax
<MenuItems anchor="bottom start" className="[--anchor-gap:8px]">

// Object syntax
<MenuItems anchor={{ to: "bottom start", gap: 8, offset: 4, padding: 12 }}>

// Responsive gap
<MenuItems anchor="bottom" className="[--anchor-gap:4px] sm:[--anchor-gap:8px]">

// Match trigger width
<ListboxOptions className="w-[var(--button-width)]">
<ComboboxOptions className="w-[var(--input-width)]">
```

---

## Keyboard Shortcuts

### Dialog

| Key         | Action                                              |
| ----------- | --------------------------------------------------- |
| `Escape`    | Close dialog                                        |
| `Tab`       | Cycle forward through focusable elements (trapped)  |
| `Shift+Tab` | Cycle backward through focusable elements (trapped) |

### Menu

| Key               | Action                                         |
| ----------------- | ---------------------------------------------- |
| `Enter` / `Space` | Open menu (when button focused) or select item |
| `Arrow Down`      | Open menu / next item                          |
| `Arrow Up`        | Previous item                                  |
| `Home` / `End`    | First / last item                              |
| `Escape`          | Close menu                                     |
| `A-Z`             | Jump to matching item (type-ahead)             |

### Listbox

| Key                          | Action                       |
| ---------------------------- | ---------------------------- |
| `Enter` / `Space`            | Open / select item           |
| `Arrow Down` / `Arrow Up`    | Navigate items               |
| `Arrow Left` / `Arrow Right` | Navigate (when `horizontal`) |
| `Home` / `End`               | First / last item            |
| `Escape`                     | Close                        |
| `A-Z`                        | Jump to matching item        |

### Combobox

| Key                       | Action                        |
| ------------------------- | ----------------------------- |
| `Arrow Down` / `Arrow Up` | Open / navigate items         |
| `Enter`                   | Select focused item           |
| `Tab`                     | Select focused item and close |
| `Escape`                  | Close dropdown                |
| `Home` / `End`            | First / last item             |

### Tabs

| Key                          | Action                            |
| ---------------------------- | --------------------------------- |
| `Arrow Left` / `Arrow Right` | Previous / next tab (horizontal)  |
| `Arrow Up` / `Arrow Down`    | Previous / next tab (vertical)    |
| `Home` / `Page Up`           | First tab                         |
| `End` / `Page Down`          | Last tab                          |
| `Enter` / `Space`            | Activate tab (when `manual` mode) |

### Disclosure

| Key               | Action       |
| ----------------- | ------------ |
| `Enter` / `Space` | Toggle panel |

### Switch

| Key     | Action             |
| ------- | ------------------ |
| `Space` | Toggle switch      |
| `Enter` | Submit parent form |

### RadioGroup

| Key          | Action                |
| ------------ | --------------------- |
| `Arrow Keys` | Cycle through options |
| `Space`      | Select focused option |
| `Enter`      | Submit parent form    |

### Checkbox

| Key     | Action             |
| ------- | ------------------ |
| `Space` | Toggle checkbox    |
| `Enter` | Submit parent form |

### Popover

| Key               | Action                                             |
| ----------------- | -------------------------------------------------- |
| `Enter` / `Space` | Toggle panel (when button focused)                 |
| `Escape`          | Close panel                                        |
| `Tab`             | Cycle through panel contents; exiting closes panel |
| `Shift+Tab`       | Reverse cycle                                      |

---

## v2 Migration from v1

### Breaking Changes

| v1 Pattern                                                                                         | v2 Pattern                                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `<Transition enter="..." enterFrom="..." enterTo="..." leave="..." leaveFrom="..." leaveTo="...">` | `<div transition className="duration-200 data-[closed]:opacity-0">` |
| `<Menu.Button>`                                                                                    | `<MenuButton>` (flat imports)                                       |
| `<Menu.Items>`                                                                                     | `<MenuItems>` (flat imports)                                        |
| `<Listbox.Button>`                                                                                 | `<ListboxButton>` (flat imports)                                    |
| Manual Floating UI / Popper.js                                                                     | `anchor` prop on panels                                             |
| Render props for state styling                                                                     | `data-*` attributes                                                 |
| `<Dialog.Panel>`                                                                                   | `<DialogPanel>`                                                     |
| `<Dialog.Title>`                                                                                   | `<DialogTitle>`                                                     |

### New in v2

- **Anchor positioning**: `anchor` prop on MenuItems, ListboxOptions, ComboboxOptions, PopoverPanel
- **Data-attribute transitions**: `transition` prop + `data-[closed]`, `data-[enter]`, `data-[leave]`
- **Checkbox**: New component with indeterminate support
- **Form components**: Field, Input, Label, Description, Fieldset, Legend, Select, Textarea
- **Improved state attributes**: `data-hover` (no touch), `data-active` (no drag), `data-focus` (no imperative)
- **Virtual scrolling**: `virtual` prop on Combobox
- **CloseButton**: Declarative close for Dialog, Popover, Disclosure
- **useClose hook**: Imperative close in nested components
- **Multi-dialog support**: Multiple dialogs as siblings (v2.1)
- **Flat imports**: `import { MenuButton } from "@headlessui/react"` instead of `Menu.Button`

---

## Installation

```bash
npm install @headlessui/react
```

**Requirements:** React 18+ (works with React 19)

**Peer dependencies:** React, React DOM
