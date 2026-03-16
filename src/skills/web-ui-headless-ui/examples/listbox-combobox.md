# Headless UI - Listbox & Combobox Examples

> Complete code examples for Listbox (custom select) and Combobox (autocomplete) patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Menu & Dropdowns](menu.md) - Action menus
- [Form Components](forms.md) - Field, Input, Label, Fieldset patterns
- [Switch & RadioGroup](switch-radio.md) - Toggle and option selection patterns

---

## Listbox: Single Selection

A custom select replacing native `<select>` with full styling control and keyboard navigation.

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

---

## Listbox: Multiple Selection with Form Integration

A multi-select Listbox that renders hidden inputs for form submission.

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

## Combobox: Searchable Select

A combobox for selecting a country with search filtering and "no results" state.

```tsx
import { useState } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";

type Country = { code: string; name: string };

const COUNTRIES: Country[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "Mexico" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "AU", name: "Australia" },
];

export function CountryCombobox() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Country | null>(null);

  const filtered =
    query === ""
      ? COUNTRIES
      : COUNTRIES.filter((country) =>
          country.name.toLowerCase().includes(query.toLowerCase()),
        );

  return (
    <div className="w-72">
      <Combobox
        value={selected}
        onChange={setSelected}
        onClose={() => setQuery("")}
        name="country"
      >
        <div className="relative">
          <ComboboxInput
            className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-10 text-sm data-[focus]:border-blue-500 data-[focus]:ring-2 data-[focus]:ring-blue-500/20"
            displayValue={(country: Country | null) => country?.name ?? ""}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search countries..."
          />
          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon
              className="size-5 text-gray-400"
              aria-hidden="true"
            />
          </ComboboxButton>
        </div>

        <ComboboxOptions
          anchor="bottom"
          transition
          className="w-[var(--input-width)] rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/5 empty:invisible [--anchor-gap:4px] duration-150 data-[closed]:opacity-0"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              No countries found for "{query}"
            </div>
          ) : (
            filtered.map((country) => (
              <ComboboxOption
                key={country.code}
                value={country}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm data-[focus]:bg-blue-50"
              >
                <CheckIcon className="invisible size-4 text-blue-600 data-[selected]:visible" />
                <span className="data-[selected]:font-medium">
                  {country.name}
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {country.code}
                </span>
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </Combobox>
    </div>
  );
}
```

**Why good:** `onClose` resets query, `displayValue` shows selected country name in input, `empty:invisible` hides dropdown when no content (Tailwind), `--input-width` matches dropdown width to input, `data-[selected]` shows checkmark and bolds text, `name` enables form submission

---

## Combobox: Basic People Search

A simpler combobox for searching and selecting from a list of people.

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

---

## Combobox: Virtual Scrolling for Large Lists

Use the `virtual` prop for lists with 1000+ items. Only visible items render in the DOM.

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
