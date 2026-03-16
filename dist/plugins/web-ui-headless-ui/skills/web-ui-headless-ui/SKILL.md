---
name: web-ui-headless-ui
description: Unstyled accessible UI components by Tailwind Labs
---

# Headless UI Patterns

> **Quick Guide:** Headless UI provides completely unstyled, fully accessible UI components designed for Tailwind CSS. Use compound component patterns (Menu/MenuButton/MenuItems/MenuItem), `data-*` attributes for styling states, built-in anchor positioning for floating elements, and the `transition` prop for CSS-powered animations. All components handle ARIA, keyboard navigation, and focus management automatically. **Current: v2.2.x (React only)** - Built-in anchor positioning via Floating UI, data-attribute transitions, form components, and virtual scrolling.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the v2 compound component anatomy - e.g. Menu/MenuButton/MenuItems/MenuItem - never render raw divs with click handlers)**

**(You MUST use `data-*` attributes for styling states (data-open, data-focus, data-selected, data-hover, data-active) - NOT render props for class toggling)**

**(You MUST use the `anchor` prop on floating panels (MenuItems, ListboxOptions, ComboboxOptions, PopoverPanel) instead of manual positioning)**

**(You MUST use the `transition` prop with data-closed/data-enter/data-leave classes for animations - NOT the legacy Transition component enter/leave props)**

</critical_requirements>

---

**Auto-detection:** Headless UI, headlessui, @headlessui/react, Dialog, DialogPanel, DialogTitle, Menu, MenuButton, MenuItems, MenuItem, Listbox, ListboxButton, ListboxOptions, ListboxOption, Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption, Popover, PopoverButton, PopoverPanel, TabGroup, TabList, Tab, TabPanel, Disclosure, DisclosureButton, DisclosurePanel, Switch, RadioGroup, Radio, Transition, Field, Label, Description, Input, Fieldset, Legend, Checkbox, CloseButton, data-closed, data-open, anchor positioning

**When to use:**

- Building accessible overlay components (dialogs, popovers, dropdowns, menus) with Tailwind CSS
- Creating fully custom select/combobox/listbox controls with keyboard navigation
- Implementing tabs, disclosure/accordion, switch, radio group, or checkbox with custom styling
- Needing automatic ARIA attributes, focus trapping, and keyboard handling without visual opinions

**When NOT to use:**

- Pre-styled component library desired (use shadcn/ui, Catalyst, or a design system built on Headless UI)
- Simple native HTML elements suffice (plain `<select>`, `<input type="checkbox">`, `<details>`)
- Non-React projects (v2 is React-only; Vue version remains at v1)
- Complex compound component API with `asChild` polymorphism needed (use Radix UI instead)

**Package Installation:**

```bash
npm install @headlessui/react
```

**Detailed Resources:**

- For practical code examples (Dialog, Menu, Combobox, Tabs, Popover, Forms), see [examples/headless-ui.md](examples/headless-ui.md)
- For quick component reference and keyboard shortcuts, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

Headless UI provides **behavior-only** components: accessibility, keyboard navigation, focus management, and state handling are built in, while **all visual styling is your responsibility**. This makes it the ideal companion for Tailwind CSS.

**Core Design Principles:**

- **Unstyled by default**: No CSS shipped. Style entirely with Tailwind utility classes via `className`.
- **Accessible out of the box**: ARIA roles, attributes, and keyboard interactions are automatic.
- **Compound components**: Each UI pattern is composed of multiple coordinated parts (e.g., `Menu` + `MenuButton` + `MenuItems` + `MenuItem`).
- **Data attributes for state**: Components expose `data-open`, `data-focus`, `data-selected`, `data-hover`, `data-active`, `data-disabled`, `data-checked` for CSS-based state styling.
- **Built-in anchor positioning**: Floating panels (menus, listboxes, comboboxes, popovers) use Floating UI internally for automatic viewport-aware positioning.
- **Transition support**: The `transition` prop enables CSS transitions using `data-closed`, `data-enter`, `data-leave` attributes.

**v2 Key Changes from v1:**

- Anchor positioning built in (no separate Floating UI setup needed)
- Data-attribute-based transitions replace complex render props
- New form components (Field, Input, Label, Description, Fieldset, Legend, Select, Textarea)
- New Checkbox component
- Improved hover/focus/active detection (based on React Aria research)
- Combobox virtual scrolling via TanStack Virtual
- Better React Server Component compatibility
- `useClose` hook and `CloseButton` component for imperative close

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Dialog (Modal)

Dialogs are always controlled components in Headless UI. You manage `open` state and pass `onClose`.

#### Basic Structure

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from "@headlessui/react";

export function ConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open dialog</button>
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <DialogPanel className="max-w-lg space-y-4 rounded-xl bg-white p-12">
            <DialogTitle className="text-lg font-bold">
              Confirm Action
            </DialogTitle>
            <Description>
              This will permanently delete your project.
            </Description>
            <div className="flex gap-4">
              <button onClick={() => setIsOpen(false)}>Cancel</button>
              <button onClick={() => setIsOpen(false)}>Confirm</button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
```

**Why good:** Controlled state via `open`/`onClose`, DialogTitle provides aria-labelledby, Description provides aria-describedby, DialogBackdrop dims content, focus automatically trapped in panel

#### Dialog with Transitions

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

export function AnimatedDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="relative z-50"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/30 duration-300 ease-out data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <DialogPanel
            transition
            className="max-w-lg rounded-xl bg-white p-12 duration-300 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <DialogTitle className="text-lg font-bold">
              Animated Dialog
            </DialogTitle>
            <p>Content with enter/exit transitions.</p>
            <button onClick={() => setIsOpen(false)}>Close</button>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
```

**Why good:** `transition` prop enables CSS transitions, `data-[closed]:` defines both enter-from and leave-to states, no JavaScript animation library needed

---

### Pattern 2: Menu (Dropdown)

Menus provide operating-system-style dropdown behavior: arrow key navigation, type-ahead search, automatic close on selection.

#### Basic Menu with Anchor Positioning

```tsx
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";

const ANCHOR_GAP_PX = "8px";

export function DropdownMenu() {
  return (
    <Menu>
      <MenuButton className="rounded-md bg-gray-800 px-4 py-2 text-sm text-white">
        Options
      </MenuButton>
      <MenuItems
        anchor="bottom start"
        transition
        className={`
          w-52 origin-top-left rounded-xl bg-white p-1 shadow-lg
          transition duration-200 ease-out
          [--anchor-gap:${ANCHOR_GAP_PX}]
          data-[closed]:scale-95 data-[closed]:opacity-0
        `}
      >
        <MenuItem>
          <button className="block w-full rounded-lg px-3 py-1.5 text-left data-[focus]:bg-gray-100">
            Edit
          </button>
        </MenuItem>
        <MenuItem>
          <button className="block w-full rounded-lg px-3 py-1.5 text-left data-[focus]:bg-gray-100">
            Duplicate
          </button>
        </MenuItem>
        <MenuItem>
          <button className="block w-full rounded-lg px-3 py-1.5 text-left text-red-600 data-[focus]:bg-red-50">
            Delete
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
```

**Why good:** `anchor="bottom start"` handles positioning automatically, `--anchor-gap` controls spacing, `data-[focus]` styles keyboard/mouse focus, items close menu on click by default

#### Menu with Sections and Separators

```tsx
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  MenuSection,
  MenuHeading,
  MenuSeparator,
} from "@headlessui/react";

export function SectionedMenu() {
  return (
    <Menu>
      <MenuButton className="rounded-md bg-gray-800 px-4 py-2 text-white">
        Account
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="w-56 rounded-xl bg-white p-1 shadow-lg"
      >
        <MenuSection>
          <MenuHeading className="px-3 py-1 text-xs font-semibold text-gray-500">
            Profile
          </MenuHeading>
          <MenuItem>
            <a
              href="/settings"
              className="block px-3 py-1.5 data-[focus]:bg-gray-100"
            >
              Settings
            </a>
          </MenuItem>
        </MenuSection>
        <MenuSeparator className="my-1 h-px bg-gray-200" />
        <MenuSection>
          <MenuItem>
            <button className="block w-full px-3 py-1.5 text-left data-[focus]:bg-gray-100">
              Sign out
            </button>
          </MenuItem>
        </MenuSection>
      </MenuItems>
    </Menu>
  );
}
```

**Why good:** MenuSection groups related items with accessibility semantics, MenuHeading labels sections, MenuSeparator provides visual dividers, anchor positioning handles viewport awareness

---

### Pattern 3: Listbox (Custom Select)

Listbox replaces the native `<select>` element with full styling control and keyboard navigation.

#### Single Selection

```tsx
import { useState } from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";

type Person = { id: number; name: string; unavailable: boolean };

const PEOPLE: Person[] = [
  { id: 1, name: "Wade Cooper", unavailable: false },
  { id: 2, name: "Arlene Mccoy", unavailable: false },
  { id: 3, name: "Devon Webb", unavailable: true },
];

export function PersonSelect() {
  const [selected, setSelected] = useState(PEOPLE[0]);

  return (
    <Listbox value={selected} onChange={setSelected}>
      <ListboxButton className="relative w-full rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md">
        {selected.name}
        <ChevronUpDownIcon className="absolute right-2 top-2.5 size-5 text-gray-400" />
      </ListboxButton>
      <ListboxOptions
        anchor="bottom"
        className="w-[var(--button-width)] rounded-xl bg-white p-1 shadow-lg [--anchor-gap:4px]"
      >
        {PEOPLE.map((person) => (
          <ListboxOption
            key={person.id}
            value={person}
            disabled={person.unavailable}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 data-[focus]:bg-blue-100 data-[disabled]:opacity-50"
          >
            <CheckIcon className="invisible size-4 text-blue-600 data-[selected]:visible" />
            {person.name}
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
```

**Why good:** Object comparison works via `id` by default, `data-[selected]` styles the current value, `data-[disabled]` handles unavailable items, `--button-width` CSS variable matches dropdown width to trigger

#### Multiple Selection with Form Integration

```tsx
import { useState } from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";

type Tag = { id: number; name: string };

const TAGS: Tag[] = [
  { id: 1, name: "React" },
  { id: 2, name: "TypeScript" },
  { id: 3, name: "Tailwind" },
];

export function TagSelect() {
  const [selectedTags, setSelectedTags] = useState<Tag[]>([TAGS[0]]);

  return (
    <Listbox
      value={selectedTags}
      onChange={setSelectedTags}
      multiple
      name="tags"
    >
      <ListboxButton className="rounded-lg border px-3 py-2">
        {selectedTags.map((tag) => tag.name).join(", ") || "Select tags"}
      </ListboxButton>
      <ListboxOptions
        anchor="bottom start"
        className="rounded-xl bg-white p-1 shadow-lg"
      >
        {TAGS.map((tag) => (
          <ListboxOption
            key={tag.id}
            value={tag}
            className="rounded-lg px-3 py-1.5 data-[focus]:bg-blue-100 data-[selected]:font-semibold"
          >
            {tag.name}
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
```

**Why good:** `multiple` enables array selection, `name="tags"` renders hidden inputs for form submission, `onChange` receives full updated array

---

### Pattern 4: Combobox (Autocomplete)

Combobox combines a text input with a filterable dropdown list. Filtering logic is your responsibility.

#### Basic Searchable Select

```tsx
import { useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid";

type Person = { id: number; name: string };

const PEOPLE: Person[] = [
  { id: 1, name: "Wade Cooper" },
  { id: 2, name: "Arlene Mccoy" },
  { id: 3, name: "Devon Webb" },
  { id: 4, name: "Tom Cook" },
];

export function PeopleCombobox() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Person | null>(null);

  const filtered =
    query === ""
      ? PEOPLE
      : PEOPLE.filter((person) =>
          person.name.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <Combobox
      value={selected}
      onChange={setSelected}
      onClose={() => setQuery("")}
    >
      <div className="relative">
        <ComboboxInput
          className="w-full rounded-lg border py-2 pl-3 pr-10"
          displayValue={(person: Person | null) => person?.name ?? ""}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people..."
        />
        <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronDownIcon className="size-5 text-gray-400" />
        </ComboboxButton>
      </div>
      <ComboboxOptions
        anchor="bottom"
        transition
        className="w-[var(--input-width)] rounded-xl bg-white p-1 shadow-lg [--anchor-gap:4px] duration-150 data-[closed]:opacity-0"
      >
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500">
            No results found
          </div>
        ) : (
          filtered.map((person) => (
            <ComboboxOption
              key={person.id}
              value={person}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 data-[focus]:bg-blue-100"
            >
              <CheckIcon className="invisible size-4 text-blue-600 data-[selected]:visible" />
              {person.name}
            </ComboboxOption>
          ))
        )}
      </ComboboxOptions>
    </Combobox>
  );
}
```

**Why good:** Filtering is explicit and customizable, `onClose` resets query, `displayValue` formats selected item in input, empty state handled, `data-[selected]` shows check mark

#### Virtual Scrolling for Large Lists

```tsx
import { useState } from "react";
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";

type Item = { id: number; name: string };

// Generates large dataset
const ITEMS: Item[] = Array.from({ length: 10000 }, (_, i) => ({
  id: i,
  name: `Item ${i + 1}`,
}));

export function VirtualCombobox() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);

  const filtered =
    query === ""
      ? ITEMS
      : ITEMS.filter((item) =>
          item.name.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <Combobox
      value={selected}
      onChange={setSelected}
      onClose={() => setQuery("")}
      virtual={{ options: filtered }}
    >
      <ComboboxInput
        className="w-full rounded-lg border py-2 px-3"
        displayValue={(item: Item | null) => item?.name ?? ""}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ComboboxOptions
        anchor="bottom"
        className="w-[var(--input-width)] rounded-xl bg-white shadow-lg [--anchor-gap:4px]"
      >
        {({ option: item }) => (
          <ComboboxOption
            value={item}
            className="px-3 py-1.5 data-[focus]:bg-blue-100"
          >
            {item.name}
          </ComboboxOption>
        )}
      </ComboboxOptions>
    </Combobox>
  );
}
```

**Why good:** `virtual` prop enables TanStack Virtual for 10k+ items, render function on ComboboxOptions receives each visible option, only visible items are in the DOM

---

### Pattern 5: Popover

Popovers display floating non-modal content triggered by click. They close on outside click, Escape, or tab-away.

```tsx
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  CloseButton,
} from "@headlessui/react";

export function InfoPopover() {
  return (
    <Popover className="relative">
      <PopoverButton className="rounded-md bg-gray-800 px-4 py-2 text-white">
        Solutions
      </PopoverButton>
      <PopoverPanel
        anchor="bottom start"
        transition
        className="w-80 rounded-xl bg-white p-4 shadow-lg [--anchor-gap:8px] duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        <div className="space-y-2">
          <CloseButton
            as="a"
            href="/analytics"
            className="block rounded-lg p-2 hover:bg-gray-50"
          >
            Analytics
          </CloseButton>
          <CloseButton
            as="a"
            href="/engagement"
            className="block rounded-lg p-2 hover:bg-gray-50"
          >
            Engagement
          </CloseButton>
        </div>
      </PopoverPanel>
    </Popover>
  );
}
```

**Why good:** `anchor` handles positioning, CloseButton closes popover when clicked (useful for navigation links), `transition` with `data-[closed]` for enter/exit animations

---

### Pattern 6: Tabs

Tab components manage tabbed content with keyboard navigation (arrow keys, Home/End).

#### Basic Tabs

```tsx
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";

const TABS = [
  { name: "Recent", content: "Recent content here" },
  { name: "Popular", content: "Popular content here" },
  { name: "Trending", content: "Trending content here" },
];

export function ContentTabs() {
  return (
    <TabGroup>
      <TabList className="flex gap-4 border-b">
        {TABS.map(({ name }) => (
          <Tab
            key={name}
            className="border-b-2 border-transparent px-3 py-2 text-sm font-medium data-[selected]:border-blue-500 data-[selected]:text-blue-600 data-[hover]:text-gray-700"
          >
            {name}
          </Tab>
        ))}
      </TabList>
      <TabPanels className="mt-4">
        {TABS.map(({ name, content }) => (
          <TabPanel key={name} className="rounded-xl p-3">
            {content}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
}
```

**Why good:** `data-[selected]` styles active tab, `data-[hover]` styles hover state, keyboard navigation automatic (Left/Right arrows), Tab/TabPanel order matches automatically

#### Controlled Tabs with Vertical Layout

```tsx
import { useState } from "react";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";

export function VerticalTabs() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <TabGroup
      selectedIndex={selectedIndex}
      onChange={setSelectedIndex}
      vertical
    >
      <div className="flex gap-4">
        <TabList className="flex flex-col gap-1">
          <Tab className="rounded-lg px-4 py-2 text-left data-[selected]:bg-blue-100 data-[selected]:text-blue-700">
            General
          </Tab>
          <Tab className="rounded-lg px-4 py-2 text-left data-[selected]:bg-blue-100 data-[selected]:text-blue-700">
            Security
          </Tab>
          <Tab className="rounded-lg px-4 py-2 text-left data-[selected]:bg-blue-100 data-[selected]:text-blue-700">
            Notifications
          </Tab>
        </TabList>
        <TabPanels className="flex-1">
          <TabPanel>General settings...</TabPanel>
          <TabPanel>Security settings...</TabPanel>
          <TabPanel>Notification preferences...</TabPanel>
        </TabPanels>
      </div>
    </TabGroup>
  );
}
```

**Why good:** `vertical` switches keyboard navigation to Up/Down arrows, `selectedIndex`/`onChange` for controlled state, layout is your responsibility via Tailwind

---

### Pattern 7: Disclosure (Accordion)

Disclosure provides show/hide toggle behavior, commonly used for accordion panels and FAQ sections.

```tsx
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

const FAQ_ITEMS = [
  {
    question: "What is your refund policy?",
    answer: "We offer a 30-day money-back guarantee.",
  },
  {
    question: "Do you offer support?",
    answer: "Yes, 24/7 email and chat support is included.",
  },
];

export function FaqAccordion() {
  return (
    <div className="w-full max-w-md space-y-2">
      {FAQ_ITEMS.map(({ question, answer }) => (
        <Disclosure key={question}>
          <DisclosureButton className="flex w-full items-center justify-between rounded-lg bg-gray-100 px-4 py-2 text-left text-sm font-medium">
            {question}
            <ChevronDownIcon className="size-5 transition-transform data-[open]:rotate-180" />
          </DisclosureButton>
          <DisclosurePanel
            transition
            className="origin-top px-4 pb-2 text-sm text-gray-500 transition duration-200 ease-out data-[closed]:-translate-y-6 data-[closed]:opacity-0"
          >
            {answer}
          </DisclosurePanel>
        </Disclosure>
      ))}
    </div>
  );
}
```

**Why good:** Each Disclosure manages its own state independently, `transition` on panel enables smooth expand/collapse, `data-[open]` rotates the chevron icon, multiple can be open simultaneously

---

### Pattern 8: Switch (Toggle)

Switch provides an accessible toggle with form integration.

```tsx
import { useState } from "react";
import { Field, Label, Description, Switch } from "@headlessui/react";

export function NotificationToggle() {
  const [enabled, setEnabled] = useState(false);

  return (
    <Field className="flex items-center justify-between">
      <span className="flex flex-grow flex-col">
        <Label className="text-sm font-medium" passive>
          Email notifications
        </Label>
        <Description className="text-sm text-gray-500">
          Receive notifications about account activity
        </Description>
      </span>
      <Switch
        checked={enabled}
        onChange={setEnabled}
        name="notifications"
        className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out data-[checked]:bg-blue-600"
      >
        <span className="pointer-events-none inline-block size-5 translate-x-0 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out group-data-[checked]:translate-x-5" />
      </Switch>
    </Field>
  );
}
```

**Why good:** Field groups Label, Description, and Switch with automatic ARIA association, `passive` on Label prevents toggle on label click (appropriate when label is far from switch), `name` enables form submission, `data-[checked]` styles on state, `group-data-[checked]` styles child elements

---

### Pattern 9: RadioGroup

RadioGroup provides custom radio buttons with full keyboard navigation (arrow keys cycle through options).

```tsx
import { useState } from "react";
import {
  Radio,
  RadioGroup,
  Label,
  Description,
  Field,
} from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";

type Plan = {
  name: string;
  ram: string;
  cpus: string;
  disk: string;
  price: string;
};

const PLANS: Plan[] = [
  {
    name: "Hobby",
    ram: "8GB",
    cpus: "4 CPUs",
    disk: "160 GB SSD",
    price: "$40/mo",
  },
  {
    name: "Startup",
    ram: "12GB",
    cpus: "6 CPUs",
    disk: "256 GB SSD",
    price: "$80/mo",
  },
  {
    name: "Business",
    ram: "16GB",
    cpus: "8 CPUs",
    disk: "512 GB SSD",
    price: "$160/mo",
  },
];

export function PlanSelector() {
  const [selected, setSelected] = useState(PLANS[0]);

  return (
    <RadioGroup value={selected} onChange={setSelected} className="space-y-2">
      {PLANS.map((plan) => (
        <Radio
          key={plan.name}
          value={plan}
          className="group relative flex cursor-pointer rounded-lg border px-5 py-4 shadow-md data-[checked]:border-blue-500 data-[checked]:bg-blue-50 data-[focus]:ring-2 data-[focus]:ring-blue-500"
        >
          <div className="flex w-full items-center justify-between">
            <div>
              <Label as="p" className="font-semibold">
                {plan.name}
              </Label>
              <Description as="span" className="text-sm text-gray-500">
                {plan.ram} / {plan.cpus} / {plan.disk}
              </Description>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{plan.price}</span>
              <CheckCircleIcon className="size-5 text-blue-600 opacity-0 group-data-[checked]:opacity-100" />
            </div>
          </div>
        </Radio>
      ))}
    </RadioGroup>
  );
}
```

**Why good:** `data-[checked]` styles selected card, `data-[focus]` shows keyboard focus ring, `group-data-[checked]` shows checkmark on parent checked state, Label and Description inside Radio provide accessibility, arrow keys navigate between options

---

### Pattern 10: Checkbox

The Checkbox component (new in v2) provides an unstyled, accessible checkbox with indeterminate state support.

```tsx
import { useState } from "react";
import { Checkbox, Field, Label, Description } from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/20/solid";

export function TermsCheckbox() {
  const [agreed, setAgreed] = useState(false);

  return (
    <Field className="flex items-center gap-3">
      <Checkbox
        checked={agreed}
        onChange={setAgreed}
        name="terms"
        className="group size-5 cursor-pointer rounded border bg-white data-[checked]:border-blue-500 data-[checked]:bg-blue-500 data-[focus]:ring-2 data-[focus]:ring-blue-500 data-[focus]:ring-offset-2"
      >
        <CheckIcon className="size-4 text-white opacity-0 group-data-[checked]:opacity-100" />
      </Checkbox>
      <div>
        <Label className="text-sm font-medium">Accept terms</Label>
        <Description className="text-sm text-gray-500">
          By checking this box you agree to our terms of service.
        </Description>
      </div>
    </Field>
  );
}
```

**Why good:** Field auto-associates Label and Description via ARIA, `data-[checked]` styles checked state, `group-data-[checked]` reveals checkmark icon, `name` enables form submission

---

### Pattern 11: Transition Component

The Transition component conditionally shows/hides elements with CSS transitions. Most Headless UI components support the `transition` prop directly, but Transition is useful for standalone elements.

#### Standalone Transition

```tsx
import { useState } from "react";
import { Transition } from "@headlessui/react";

export function FadePanel() {
  const [isShowing, setIsShowing] = useState(false);

  return (
    <>
      <button onClick={() => setIsShowing((prev) => !prev)}>Toggle</button>
      <Transition show={isShowing}>
        <div className="rounded-lg bg-white p-4 shadow-lg transition duration-300 ease-in-out data-[closed]:opacity-0 data-[closed]:scale-95">
          This content fades in and out.
        </div>
      </Transition>
    </>
  );
}
```

**Why good:** `show` controls visibility, `data-[closed]` defines initial/final state for transitions, Transition handles mount/unmount timing

#### Coordinated Nested Transitions

```tsx
import { useState } from "react";
import { Transition, TransitionChild } from "@headlessui/react";

export function CoordinatedTransition() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      <Transition show={isOpen}>
        {/* Backdrop */}
        <TransitionChild>
          <div
            className="fixed inset-0 bg-black/30 transition duration-300 ease-out data-[closed]:opacity-0"
            onClick={() => setIsOpen(false)}
          />
        </TransitionChild>
        {/* Panel */}
        <TransitionChild>
          <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-xl transition duration-300 ease-out data-[closed]:translate-x-full">
            <button onClick={() => setIsOpen(false)}>Close</button>
            <p>Slide-over panel content</p>
          </div>
        </TransitionChild>
      </Transition>
    </>
  );
}
```

**Why good:** Parent Transition coordinates children, waits for all TransitionChild animations to complete before unmounting, backdrop and panel animate independently

---

### Pattern 12: Form Components (Field, Input, Label, Description)

Headless UI v2 includes form components that auto-generate IDs and wire up ARIA attributes.

```tsx
import {
  Field,
  Fieldset,
  Input,
  Label,
  Legend,
  Description,
  Select,
  Textarea,
} from "@headlessui/react";

export function ShippingForm() {
  return (
    <Fieldset className="space-y-6">
      <Legend className="text-lg font-semibold">Shipping Details</Legend>

      <Field>
        <Label className="text-sm font-medium">Full name</Label>
        <Input
          name="name"
          className="mt-1 block w-full rounded-lg border px-3 py-2 data-[focus]:outline-2 data-[focus]:outline-blue-500"
        />
      </Field>

      <Field>
        <Label className="text-sm font-medium">Country</Label>
        <Description className="text-sm text-gray-500">
          We currently ship to these countries.
        </Description>
        <Select
          name="country"
          className="mt-1 block w-full rounded-lg border px-3 py-2 data-[focus]:outline-2 data-[focus]:outline-blue-500"
        >
          <option>United States</option>
          <option>Canada</option>
          <option>Mexico</option>
        </Select>
      </Field>

      <Field>
        <Label className="text-sm font-medium">Notes</Label>
        <Textarea
          name="notes"
          className="mt-1 block w-full rounded-lg border px-3 py-2 data-[focus]:outline-2 data-[focus]:outline-blue-500"
          rows={3}
        />
      </Field>

      <Field disabled>
        <Label className="text-sm font-medium data-[disabled]:opacity-50">
          Promo code
        </Label>
        <Input
          name="promo"
          className="mt-1 block w-full rounded-lg border px-3 py-2 data-[disabled]:bg-gray-100 data-[disabled]:opacity-50"
        />
        <Description className="text-sm text-gray-500 data-[disabled]:opacity-50">
          Promo codes are not available during this sale.
        </Description>
      </Field>
    </Fieldset>
  );
}
```

**Why good:** Field auto-generates unique IDs and wires `aria-labelledby`/`aria-describedby`, Fieldset groups related fields, disabled Field cascades to all children via `data-[disabled]`, Label/Description automatically associated without manual `htmlFor`/`id` wiring, Legend provides accessible fieldset title

---

### Pattern 13: Anchor Positioning

Floating panels (Menu, Listbox, Combobox, Popover) accept an `anchor` prop powered by Floating UI.

#### Positioning Options

```tsx
// Position string values
<MenuItems anchor="bottom">       {/* Below trigger, centered */}
<MenuItems anchor="bottom start"> {/* Below trigger, left-aligned */}
<MenuItems anchor="bottom end">   {/* Below trigger, right-aligned */}
<MenuItems anchor="top">          {/* Above trigger, centered */}
<MenuItems anchor="right start">  {/* Right of trigger, top-aligned */}
<MenuItems anchor="left end">     {/* Left of trigger, bottom-aligned */}

// Fine-tune with CSS variables (Tailwind classes)
<MenuItems
  anchor="bottom start"
  className="[--anchor-gap:8px] [--anchor-offset:4px] [--anchor-padding:12px]"
>
  {/* content */}
</MenuItems>

// Responsive spacing via breakpoints
<MenuItems
  anchor="bottom start"
  className="[--anchor-gap:4px] sm:[--anchor-gap:8px] lg:[--anchor-gap:12px]"
>
  {/* content */}
</MenuItems>

// Object syntax for full control
<MenuItems
  anchor={{ to: "bottom start", gap: 8, offset: 4, padding: 12 }}
>
  {/* content */}
</MenuItems>
```

**CSS Variables Reference:**

| Variable           | Purpose                                      | Default |
| ------------------ | -------------------------------------------- | ------- |
| `--anchor-gap`     | Space between trigger and panel              | `0`     |
| `--anchor-offset`  | Horizontal offset from anchor point          | `0`     |
| `--anchor-padding` | Minimum space from viewport edges            | `0`     |
| `--button-width`   | Width of trigger (available in panel)        | auto    |
| `--input-width`    | Width of input (available in Combobox panel) | auto    |

---

### Pattern 14: Data Attributes for Styling

Headless UI v2 exposes rich data attributes on all components for CSS-based state styling. These are preferred over render props.

#### Available Data Attributes

| Attribute            | Components                                           | Purpose                                    |
| -------------------- | ---------------------------------------------------- | ------------------------------------------ |
| `data-open`          | Dialog, Menu, Popover, Disclosure, Listbox, Combobox | Component is open                          |
| `data-closed`        | All with transition support                          | Component is closed (used for transitions) |
| `data-focus`         | MenuItem, ListboxOption, ComboboxOption, Tab, inputs | Item has keyboard/mouse focus              |
| `data-selected`      | ListboxOption, ComboboxOption, Tab                   | Item is currently selected                 |
| `data-checked`       | Checkbox, Switch, Radio                              | Control is checked/on                      |
| `data-disabled`      | All interactive components                           | Component is disabled                      |
| `data-hover`         | All interactive components                           | Mouse hover (ignored on touch)             |
| `data-active`        | All interactive components                           | Mouse press (cleared on drag-off)          |
| `data-indeterminate` | Checkbox                                             | Checkbox in indeterminate state            |
| `data-changing`      | Switch, Checkbox                                     | Briefly true during state change           |
| `data-autofocus`     | Components with autoFocus                            | Has autoFocus prop                         |

#### Tailwind Usage

```tsx
// Styling with data attributes using Tailwind's data-* modifier
<MenuItem>
  <button className="
    rounded-lg px-3 py-1.5 text-gray-700
    data-[focus]:bg-blue-100 data-[focus]:text-blue-900
    data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed
  ">
    Edit
  </button>
</MenuItem>

// Parent state styling with group-data-*
<Switch className="group ...">
  <span className="
    size-5 rounded-full bg-white transition
    group-data-[checked]:translate-x-5
  " />
</Switch>
```

**Why data attributes over render props:** Render props force client-side rendering (break RSC compatibility), data attributes work with CSS-only styling, simpler code, and Tailwind's `data-[*]:` modifier integrates naturally

</patterns>

---

<decision_framework>

## Decision Framework

### Component Selection

```
What interaction pattern do you need?

Modal blocking interaction?
  -> Dialog (close on Escape, outside click, focus trapped)

Dropdown with actions?
  -> Menu (arrow key navigation, type-ahead, auto-close on select)

Custom select (single/multi)?
  -> Listbox (keyboard navigation, form integration)

Searchable select?
  -> Combobox (text input + filterable dropdown)
  -> Large list (1000+)? -> Use virtual prop

Floating non-modal content?
  -> Popover (click to toggle, close on outside click)

Tabbed content?
  -> TabGroup (arrow key navigation, automatic ARIA)

Show/hide toggle?
  -> Disclosure (single toggle, accordion-style)

Boolean toggle?
  -> Switch (on/off, form integration)

Option selection from small set?
  -> RadioGroup (arrow key cycling, card-style options)

Custom checkbox?
  -> Checkbox (checked/unchecked/indeterminate)

Form field with auto ARIA?
  -> Field + Label + Description + Input/Select/Textarea
```

### Headless UI vs Radix UI

```
Which headless library?

Want Tailwind-first data-attribute styling?
  -> Headless UI (designed for Tailwind CSS)

Need asChild polymorphism (render as different element)?
  -> Radix UI (Slot/asChild pattern)

Need Portal control for overlays?
  -> Radix UI (explicit Portal component)
  -> Headless UI handles portals internally for Dialog

Need AlertDialog (no-dismiss confirmation)?
  -> Radix UI (has AlertDialog primitive)
  -> Headless UI: use Dialog with role="alertdialog"

Building a design system?
  -> Radix UI (more granular control, more primitives)

Building a product UI with Tailwind?
  -> Headless UI (tighter Tailwind integration)
```

### Transition Approach

```
How to animate components?

Simple fade/scale?
  -> transition prop + data-[closed] classes (recommended)

Different enter/leave animations?
  -> Stack data attributes: data-[closed]:data-[enter]: / data-[closed]:data-[leave]:

Coordinated multi-element animations?
  -> Transition + TransitionChild components

JavaScript animation library (Framer Motion)?
  -> Use static prop to disable internal state management
  -> Wrap in AnimatePresence, conditionally render
```

</decision_framework>

---

<integration>

## Integration Guide

**Headless UI is designed for Tailwind CSS** but works with any styling approach via `className`.

**Works with:**

- **Tailwind CSS**: Primary styling approach. Use `data-[state]:` modifiers for state-based styling and `group-data-[state]:` for parent state styling on children.
- **Heroicons**: Common pairing for icons (`@heroicons/react`). Used in Combobox buttons, Menu indicators, etc.
- **Framer Motion**: Use `static` prop on panels to disable internal state management, then wrap in `AnimatePresence` for JavaScript-powered animations.
- **React Hook Form / Formik**: Form components (Field, Input, Label) work alongside form libraries. Use Listbox/Combobox `onChange` to update form state.
- **Next.js**: Works with App Router. Data-attribute styling is RSC-compatible (no render props needed).
- **TanStack Virtual**: Built-in via Combobox's `virtual` prop for large lists.

**Replaces / Conflicts with:**

- **Radix UI**: Both provide unstyled accessible components. Choose one per component type (don't mix Menu from Headless UI with DropdownMenu from Radix for the same pattern).
- **React Aria / React Spectrum**: Overlapping accessibility primitives. Headless UI is higher-level with compound components.
- **Native HTML**: Replaces `<select>` (Listbox), `<input type="checkbox">` (Checkbox), `<details>` (Disclosure), `<dialog>` (Dialog).

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using render props for class toggling instead of `data-*` attributes (breaks RSC compatibility, verbose code)
- Missing controlled state for Dialog (`open` and `onClose` are both required)
- Building manual dropdown/popover positioning instead of using the `anchor` prop
- Not providing DialogTitle (screen readers have no context for the dialog)

**Medium Priority Issues:**

- Using the legacy Transition component `enter`/`enterFrom`/`enterTo`/`leave`/`leaveFrom`/`leaveTo` class props instead of `data-[closed]`/`data-[enter]`/`data-[leave]` (v2.1+ pattern is simpler)
- Manually wiring `id`, `htmlFor`, `aria-labelledby`, `aria-describedby` when Field/Label/Description auto-handle this
- Not using `onClose` callback to reset Combobox query state
- Forgetting `multiple` prop when Listbox/Combobox should support multiple selection

**Common Mistakes:**

- Filtering Combobox options inside the component instead of deriving from state (causes stale filter results)
- Using `data-[state]` with CSS `transition` but forgetting `duration-*` class (no visible animation)
- Nesting a Popover inside a Dialog without considering focus trap implications
- Using Menu for navigation (Menu is for actions; use links/buttons directly for navigation, or Popover for nav panels)

**Gotchas and Edge Cases:**

- `data-hover` is intelligently ignored on touch devices to prevent sticky hover states (this is intentional, not a bug)
- `data-active` is removed when dragging off the element (unlike CSS `:active` which persists)
- `data-changing` on Switch/Checkbox is only true for two animation frames (used for transition timing)
- Dialog renders in a `#headlessui-portal-root` container automatically (no explicit Portal component needed)
- Combobox `onClose` fires when dropdown closes (use it to reset query, not `onChange`)
- Listbox/Combobox compare objects by `id` field by default; use `by` prop for custom comparison
- Tab component renders as `Fragment` by default, not `button` (wrap content or use `as="button"`)
- Virtual scrolling in Combobox uses a render function on `ComboboxOptions`, not mapping `ComboboxOption` children
- Headless UI v2 is React-only; the Vue version remains at v1.x

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the v2 compound component anatomy - e.g. Menu/MenuButton/MenuItems/MenuItem - never render raw divs with click handlers)**

**(You MUST use `data-*` attributes for styling states (data-open, data-focus, data-selected, data-hover, data-active) - NOT render props for class toggling)**

**(You MUST use the `anchor` prop on floating panels (MenuItems, ListboxOptions, ComboboxOptions, PopoverPanel) instead of manual positioning)**

**(You MUST use the `transition` prop with data-closed/data-enter/data-leave classes for animations - NOT the legacy Transition component enter/leave props)**

**Failure to follow these rules will break accessibility, keyboard navigation, and viewport-aware positioning.**

</critical_reminders>
