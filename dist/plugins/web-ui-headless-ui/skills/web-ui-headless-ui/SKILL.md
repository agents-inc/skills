---
name: web-ui-headless-ui
description: Unstyled accessible UI components by Tailwind Labs
---

# Headless UI Patterns

> **Quick Guide:** Headless UI ships behaviour with no appearance: ARIA, keyboard navigation and
> focus management are automatic, and every visual decision is yours through `className`. v2 uses
> flat compound components (`Menu` + `MenuButton` + `MenuItems` + `MenuItem`), publishes state as
> `data-*` attributes rather than render props, positions floating panels through the `anchor` prop,
> and animates through the `transition` prop with `data-closed` / `data-enter` / `data-leave`.
> **v2 is React only** — the Vue package remains at v1.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — data-attribute styling, anchor positioning, transitions, the `as` prop, `useClose`
- [examples/dialog.md](examples/dialog.md) — modal overlays, form dialogs, coordinated slide-over panels
- [examples/menu.md](examples/menu.md) — dropdown action menus, sections, headings, separators
- [examples/listbox-combobox.md](examples/listbox-combobox.md) — custom select, multi-select, autocomplete, virtual scrolling
- [examples/tabs.md](examples/tabs.md) — horizontal and vertical tabs, controlled state, badges
- [examples/popover-disclosure.md](examples/popover-disclosure.md) — floating panels, accordions, standalone transitions
- [examples/switch-radio.md](examples/switch-radio.md) — toggle, option cards, checkbox
- [examples/forms.md](examples/forms.md) — Field, Input, Label, Fieldset, cascading disabled state
- [reference.md](reference.md) — component inventory, data-attribute and anchor tables, keyboard shortcuts, v1 → v2 migration

---

<critical_requirements>

## Before writing Headless UI code

**Assemble each component from its v2 parts** — `Menu` + `MenuButton` + `MenuItems` + `MenuItem`.
The parts carry the ARIA wiring and the keyboard handling; a div with a click handler carries
neither.

**Style state from the `data-*` attributes** — `data-open`, `data-focus`, `data-selected`,
`data-hover`, `data-active`. They are plain DOM attributes, so the styling stays in CSS, costs no
re-render, and works in a server component.

**Position floating panels with the `anchor` prop** on `MenuItems`, `ListboxOptions`,
`ComboboxOptions` and `PopoverPanel`. It flips and shifts against the viewport, and it exposes
`--anchor-gap`, `--button-width` and `--input-width` for the fine-tuning that hand-rolled
positioning would need code for.

**Animate with the `transition` prop plus `data-closed` / `data-enter` / `data-leave`.** One class
list covers enter and leave, and the element stays mounted until the transition finishes.

</critical_requirements>

---

**Auto-detection:** Headless UI, headlessui, @headlessui/react, DialogPanel, DialogBackdrop,
MenuButton, MenuItems, MenuSection, ListboxButton, ListboxOptions, ComboboxInput, ComboboxOptions,
PopoverPanel, PopoverGroup, TabGroup, TabList, TabPanels, DisclosureButton, DisclosurePanel, Switch,
RadioGroup, Fieldset, Legend, CloseButton, useClose, data-closed, data-enter, data-leave,
anchor positioning, --anchor-gap, --button-width

**Applies to:**

- Accessible overlays — dialogs, popovers, dropdown menus — where you own every pixel
- Custom select, multi-select and autocomplete controls with keyboard navigation and type-ahead
- Tabs, accordions, switches, radio groups and checkboxes built from scratch
- Form fields that need `id`, `aria-labelledby` and `aria-describedby` wired without doing it by hand

**Handled elsewhere:**

- Appearance — every part takes a `className` and the library ships no CSS, so which CSS approach
  produces those class names is not this skill's concern
- Pre-styled components — this library has no visual opinions at all, and a project that wants them
  out of the box wants a styled component kit instead
- Design tokens and colour scales — the attributes below are the contract; what the values are is
  settled by whatever owns your visual language
- Non-React usage — v2 is React-only

---

<philosophy>

Headless UI supplies behaviour and supplies no appearance. Three things follow.

**Each pattern is several elements, not one.** A dropdown is `Menu` (state and context),
`MenuButton`, `MenuItems` (the floating panel) and `MenuItem`. Each part is separately styleable,
and the parts coordinate through context rather than through props you thread.

**State is published to the DOM.** Components write their state onto their own elements as `data-*`
attributes. Reading state from an attribute selector is cheaper and more correct than a render prop
that re-renders the subtree to swap a class.

**Positioning and transitions are built in.** Floating panels use Floating UI internally through the
`anchor` prop, and the `transition` prop drives CSS transitions off `data-closed`, so neither needs
a second library.

</philosophy>

---

<decision_framework>

## Which component

A native element that already does the job — `<select>`, `<input type="checkbox">`, `<details>` —
needs none of this. Reach for a component below when you must style what native will not let you
style, or extend what it does not do.

```
Modal that blocks the page          → Dialog (Escape, outside click, focus trapped)
Dropdown of actions                 → Menu (arrow keys, type-ahead, closes on select)
Custom select, single or multiple   → Listbox
Searchable select                   → Combobox (virtual={{ options }} past ~1000 items)
Floating non-modal content          → Popover (closes on outside click and tab-away)
Tabbed content                      → TabGroup
Show/hide toggle                    → Disclosure
Boolean toggle                      → Switch
One of a small visible set          → RadioGroup
Checked / unchecked / indeterminate → Checkbox
A field needing ARIA wiring         → Field + Label + Description + Input/Select/Textarea
```

## Which transition

```
Fade or scale                       → transition prop + data-closed classes
Different enter and leave motion    → stack data-closed:data-enter: and data-closed:data-leave:
Backdrop and panel together         → Transition + TransitionChild
An external animation library       → static prop, and render conditionally yourself
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Dialog

Always controlled: you own `open` and pass `onClose`. Focus is trapped in the panel, and the dialog
portals itself.

```tsx
<Dialog
  open={isOpen}
  onClose={() => setIsOpen(false)}
  className="relative z-50"
>
  <DialogBackdrop
    transition
    className="fixed inset-0 bg-black/30 duration-300 data-[closed]:opacity-0"
  />
  <div className="fixed inset-0 flex items-center justify-center p-4">
    <DialogPanel
      transition
      className="max-w-lg rounded-xl bg-white p-12 duration-300 data-[closed]:opacity-0"
    >
      <DialogTitle>Title</DialogTitle>
      <Description>Description text</Description>
    </DialogPanel>
  </div>
</Dialog>
```

`DialogTitle` sets `aria-labelledby` and `Description` sets `aria-describedby`.

Full code: [examples/dialog.md](examples/dialog.md)

---

### Pattern 2: Menu

A dropdown of actions: arrow keys, type-ahead search, and close-on-select.

```tsx
<Menu>
  <MenuButton>Options</MenuButton>
  <MenuItems
    anchor="bottom start"
    transition
    className="w-52 [--anchor-gap:8px] data-[closed]:opacity-0"
  >
    <MenuItem>
      <button className="block w-full px-3 py-1.5 text-left data-[focus]:bg-gray-100">
        Edit
      </button>
    </MenuItem>
  </MenuItems>
</Menu>
```

`data-focus` covers keyboard and pointer focus together. `MenuSection`, `MenuHeading` and
`MenuSeparator` group items with the matching ARIA semantics.

Full code: [examples/menu.md](examples/menu.md)

---

### Pattern 3: Listbox

A `<select>` replacement you style completely.

```tsx
<Listbox value={selected} onChange={setSelected}>
  <ListboxButton>{selected.name}</ListboxButton>
  <ListboxOptions
    anchor="bottom"
    className="w-[var(--button-width)] [--anchor-gap:4px]"
  >
    <ListboxOption
      value={item}
      className="data-[focus]:bg-blue-100 data-[selected]:font-semibold"
    >
      {item.name}
    </ListboxOption>
  </ListboxOptions>
</Listbox>
```

Objects are compared by their `id` field unless you pass `by`. `multiple` switches the value to an
array, `name` renders hidden inputs for native form submission, and `--button-width` matches the
panel to its trigger.

Full code: [examples/listbox-combobox.md](examples/listbox-combobox.md)

---

### Pattern 4: Combobox

A text input plus a filtered dropdown. You own the filtering.

```tsx
<Combobox value={selected} onChange={setSelected} onClose={() => setQuery("")}>
  <ComboboxInput
    displayValue={(item: Item | null) => item?.name ?? ""}
    onChange={(e) => setQuery(e.target.value)}
  />
  <ComboboxOptions anchor="bottom" className="w-[var(--input-width)]">
    <ComboboxOption value={item} className="data-[focus]:bg-blue-100">
      {item.name}
    </ComboboxOption>
  </ComboboxOptions>
</Combobox>
```

`onClose` is where the query resets — `onChange` fires on selection, which is a different moment.
`virtual={{ options }}` turns on built-in virtualisation, and `ComboboxOptions` then takes a render
function instead of children.

Full code: [examples/listbox-combobox.md](examples/listbox-combobox.md)

---

### Pattern 5: Popover

Floating non-modal content, closed by outside click, Escape or tabbing out.

```tsx
<Popover>
  <PopoverButton className="data-[open]:text-blue-600">Solutions</PopoverButton>
  <PopoverPanel
    anchor="bottom start"
    transition
    className="w-80 [--anchor-gap:8px] data-[closed]:opacity-0"
  >
    <CloseButton as="a" href="/analytics">
      Analytics
    </CloseButton>
  </PopoverPanel>
</Popover>
```

`CloseButton` closes the panel when it is activated, which is what navigation links inside a popover
need. `PopoverGroup` keeps sibling popovers from closing each other on tab, and `modal` traps focus.

Full code: [examples/popover-disclosure.md](examples/popover-disclosure.md)

---

### Pattern 6: Tabs

```tsx
<TabGroup>
  <TabList>
    <Tab className="px-3 py-2 data-[selected]:border-blue-500 data-[selected]:text-blue-600">
      Recent
    </Tab>
  </TabList>
  <TabPanels>
    <TabPanel>Content</TabPanel>
  </TabPanels>
</TabGroup>
```

Tab and TabPanel are matched by order. `vertical` switches navigation to Up/Down, `manual` requires
Enter or Space instead of activating on focus, and `selectedIndex` / `onChange` make it controlled.

Full code: [examples/tabs.md](examples/tabs.md)

---

### Pattern 7: Disclosure

```tsx
<Disclosure>
  <DisclosureButton className="group flex w-full justify-between px-4 py-2">
    Question text
    <span className="group-data-[open]:rotate-180" aria-hidden="true">
      &#9662;
    </span>
  </DisclosureButton>
  <DisclosurePanel transition className="duration-200 data-[closed]:opacity-0">
    Answer text
  </DisclosurePanel>
</Disclosure>
```

Each Disclosure owns its own state, so an accordion is a list of them and several can be open at
once. `defaultOpen` sets the initial state.

Full code: [examples/popover-disclosure.md](examples/popover-disclosure.md)

---

### Pattern 8: Switch, RadioGroup and Checkbox

```tsx
<Switch checked={enabled} onChange={setEnabled} name="notifications"
  className="group h-6 w-11 rounded-full bg-gray-200 data-[checked]:bg-blue-600">
  <span className="size-5 rounded-full bg-white group-data-[checked]:translate-x-5" />
</Switch>

<RadioGroup value={selected} onChange={setSelected}>
  <Radio value={option} className="data-[checked]:border-blue-500 data-[focus]:ring-2">
    <Label>{option.name}</Label>
  </Radio>
</RadioGroup>

<Checkbox checked={agreed} onChange={setAgreed} name="terms" indeterminate={isPartial}
  className="group size-5 rounded border data-[checked]:bg-blue-500" />
```

`name` renders the hidden input that makes the control part of native form submission. A parent-scoped
variant (`group-data-[checked]:`) is how a child element reacts to the control's state.

Full code: [examples/switch-radio.md](examples/switch-radio.md)

---

### Pattern 9: Form fields

`Field` generates the ids and wires the ARIA relationships between label, description and control.

```tsx
<Fieldset>
  <Legend>Shipping Details</Legend>
  <Field>
    <Label>Full name</Label>
    <Description>Helper text</Description>
    <Input name="name" className="data-[focus]:outline-2" />
  </Field>
  <Field disabled>
    <Label className="data-[disabled]:opacity-50">Promo code</Label>
    <Input className="data-[disabled]:bg-gray-100" />
  </Field>
</Fieldset>
```

No `htmlFor` and no manual `id`. `disabled` on the `Field` cascades to every child, and each one
gets `data-disabled` to style from.

Full code: [examples/forms.md](examples/forms.md)

---

### Pattern 10: Anchor positioning

```tsx
<MenuItems anchor="bottom start" className="[--anchor-gap:8px]">
<MenuItems anchor={{ to: "bottom start", gap: 8, offset: 4, padding: 12 }}>
<ListboxOptions className="w-[var(--button-width)]">
<ComboboxOptions className="w-[var(--input-width)]">
```

A position is a side (`top`, `bottom`, `left`, `right`) optionally followed by `start` or `end`.
The string form reads the `--anchor-*` custom properties off the panel, so a media query can change
the gap without changing the markup; the object form takes the same values as numbers.

Full table: [reference.md](reference.md)

---

### Pattern 11: Styling from data attributes

Every component publishes its state as attributes, and the same eight cover most of the library:
`data-open`, `data-closed`, `data-focus`, `data-selected`, `data-checked`, `data-disabled`,
`data-hover`, `data-active`.

```tsx
<MenuItem><button className="data-[focus]:bg-blue-100 data-[disabled]:opacity-50">Edit</button></MenuItem>
<DialogPanel transition className="duration-200 data-[closed]:opacity-0 data-[closed]:scale-95">
```

**The attribute names are the contract; the selector syntax is your styling layer's.** Plain CSS
writes `[data-focus] { … }`; a utility-class framework writes the same thing through its
attribute-variant syntax, which is what the examples in this skill use.

Full table, including which component publishes which attribute:
[reference.md](reference.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A `Dialog` without both `open` and `onClose` — it never opens, or never closes
- A dialog with no `DialogTitle` — nothing announces what the dialog is
- Filtering Combobox options inside the render without deriving them from the query state — the list
  goes stale against what was typed
- `transition` with no `duration-*` — the state flips with no animation, and the element can unmount
  before anything is visible
- Hand-rolled positioning on a floating panel instead of `anchor` — it does not flip or shift, so it
  clips at the viewport edge

**Surprising behaviour:**

- Render props for class toggling still work but re-render the subtree and cannot be used in a server
  component; the `data-*` attributes are the v2 answer
- The v1 `Transition` class props — `enter`, `enterFrom`, `enterTo`, `leave`, `leaveFrom`, `leaveTo` —
  are superseded by `data-closed` / `data-enter` / `data-leave`
- `data-hover` is deliberately not applied on touch devices, so hover styling never sticks
- `data-active` clears when the pointer drags off the element, unlike CSS `:active`
- `data-changing` on Switch and Checkbox is true for two frames only
- Dialog portals into `#headlessui-portal-root` on its own — there is no Portal component to add
- Listbox and Combobox compare objects by `id`; anything else needs `by`
- `Tab` renders a Fragment by default, so `as="button"` is what gives it an element to style
- `Menu` is for actions — a navigation panel is a `Popover`, and plain links are plain links
- Wiring `id`, `htmlFor`, `aria-labelledby` or `aria-describedby` by hand fights `Field`, which has
  already set them

</red_flags>
