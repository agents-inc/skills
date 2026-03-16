# Headless UI - Menu & Dropdown Examples

> Complete code examples for Menu dropdown patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Dialog & Modal](dialog.md) - Modal overlays, forms in dialogs
- [Listbox & Combobox](listbox-combobox.md) - Select/autocomplete patterns
- [Popover & Disclosure](popover-disclosure.md) - Floating panels, accordion patterns

---

## Basic Menu with Anchor Positioning

A dropdown menu with automatic positioning and keyboard navigation.

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

**Why good:** MenuSection groups related items with accessibility semantics, MenuHeading labels sections, MenuSeparator provides visual dividers, anchor positioning handles viewport awareness

---

## Menu with Icons and Keyboard Shortcut Hints

A dropdown menu showing actions with icons, keyboard shortcut hints, disabled items, and sections.

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
import {
  PencilIcon,
  Square2StackIcon,
  ArchiveBoxIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";

export function ActionMenu() {
  return (
    <Menu>
      <MenuButton className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-inner hover:bg-gray-700 data-[open]:bg-gray-700 data-[focus]:outline-2 data-[focus]:outline-white">
        Actions
        <svg className="size-4 fill-white/60" viewBox="0 0 16 16">
          <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" />
        </svg>
      </MenuButton>

      <MenuItems
        anchor="bottom end"
        transition
        className="w-56 origin-top-right rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/5 transition duration-150 ease-out [--anchor-gap:4px] data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        <MenuSection>
          <MenuItem>
            <button className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100">
              <PencilIcon className="size-4 text-gray-400 group-data-[focus]:text-gray-500" />
              Edit
              <kbd className="ml-auto text-xs text-gray-400">Ctrl+E</kbd>
            </button>
          </MenuItem>
          <MenuItem>
            <button className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100">
              <Square2StackIcon className="size-4 text-gray-400 group-data-[focus]:text-gray-500" />
              Duplicate
              <kbd className="ml-auto text-xs text-gray-400">Ctrl+D</kbd>
            </button>
          </MenuItem>
        </MenuSection>

        <MenuSeparator className="my-1 h-px bg-gray-100" />

        <MenuSection>
          <MenuItem>
            <button className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100">
              <ArchiveBoxIcon className="size-4 text-gray-400 group-data-[focus]:text-gray-500" />
              Archive
              <kbd className="ml-auto text-xs text-gray-400">Ctrl+A</kbd>
            </button>
          </MenuItem>
          <MenuItem disabled>
            <button className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 data-[disabled]:opacity-50">
              <TrashIcon className="size-4 text-gray-400" />
              Delete
              <kbd className="ml-auto text-xs text-gray-400">Ctrl+Del</kbd>
            </button>
          </MenuItem>
        </MenuSection>
      </MenuItems>
    </Menu>
  );
}
```

**Why good:** `anchor="bottom end"` right-aligns dropdown, `data-[open]` styles button when menu is open, `group` + `group-data-[focus]` styles icons on item focus, `data-[disabled]` visually dims disabled item, MenuSection/MenuSeparator provide structure, keyboard shortcuts shown as hints (not functional - implement separately)
