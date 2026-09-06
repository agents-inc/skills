# Headless UI - Menu & Dropdown Examples

> Complete code examples for Menu dropdown patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

**Related examples:** [dialog.md](dialog.md), [listbox-combobox.md](listbox-combobox.md), [popover-disclosure.md](popover-disclosure.md)

---

## Basic Menu with Anchor Positioning

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

**Why good:** `anchor` does the positioning, `--anchor-gap` sets the distance from the trigger,
`data-focus` covers keyboard and pointer focus together, and items close the menu on activation.

---

## Menu with Sections, Headings, and Separators

A structured menu with grouped items, section headings, and visual dividers.

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

**Why good:** `MenuSection` carries the grouping semantics a screen reader announces, and
`MenuHeading` names each group — a plain div and an hr would carry neither.

---

## Menu with Icons, Shortcut Hints and a Disabled Item

Each item marks itself `group`, so an icon inside it reacts to the item's own focus state. `Icon` is
whatever your project renders icons with.

```tsx
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  MenuSection,
  MenuSeparator,
} from "@headlessui/react";

const ACTIONS = [
  { label: "Edit", shortcut: "Ctrl+E" },
  { label: "Duplicate", shortcut: "Ctrl+D" },
];

export function ActionMenu() {
  return (
    <Menu>
      <MenuButton className="rounded-lg bg-gray-800 px-4 py-2 text-sm text-white data-[open]:bg-gray-700 data-[focus]:outline-2 data-[focus]:outline-white">
        Actions
      </MenuButton>

      <MenuItems
        anchor="bottom end"
        transition
        className="w-56 origin-top-right rounded-xl bg-white p-1 shadow-lg transition duration-150 [--anchor-gap:4px] data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        <MenuSection>
          {ACTIONS.map(({ label, shortcut }) => (
            <MenuItem key={label}>
              <button className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm data-[focus]:bg-gray-100">
                <Icon
                  className="size-4 text-gray-400 group-data-[focus]:text-gray-600"
                  aria-hidden
                />
                {label}
                <kbd className="ml-auto text-xs text-gray-400">{shortcut}</kbd>
              </button>
            </MenuItem>
          ))}
        </MenuSection>

        <MenuSeparator className="my-1 h-px bg-gray-100" />

        <MenuItem disabled>
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm data-[disabled]:opacity-50">
            Delete
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
```

**Why good:** `anchor="bottom end"` right-aligns the panel, `data-open` styles the trigger while the
menu is open, `group-data-[focus]` reaches the icon from the item, and `data-disabled` dims the item
Headless UI has already made unreachable by keyboard. The shortcut hints are labels — binding the
keys is separate work.
