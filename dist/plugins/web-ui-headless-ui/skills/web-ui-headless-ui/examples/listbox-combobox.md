# Headless UI - Listbox & Combobox Examples

> Complete code examples for Listbox (custom select) and Combobox (autocomplete) patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

**Related examples:** [menu.md](menu.md), [forms.md](forms.md), [switch-radio.md](switch-radio.md)

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
        <span
          className="pointer-events-none absolute right-2 top-2.5 size-5 text-gray-400"
          aria-hidden="true"
        >
          &#8645;
        </span>
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
            <svg
              className="invisible size-4 text-blue-600 data-[selected]:visible"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
            </svg>
            {person.name}
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
```

**Why good:** objects compare by `id` with no `by` prop needed, `data-selected` and `data-disabled`
carry the per-option state, and `--button-width` matches the panel to its trigger.

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
  { id: 1, name: "Frontend" },
  { id: 2, name: "Backend" },
  { id: 3, name: "Infrastructure" },
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

**Why good:** `multiple` makes the value an array and `onChange` receives the whole new one;
`name` renders one hidden input per selection for native form submission.

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
            <span className="size-5 text-gray-400" aria-hidden="true">
              &#8645;
            </span>
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
                <svg
                  className="invisible size-4 text-blue-600 data-[selected]:visible"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                </svg>
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

**Why good:** `onClose` is where the query resets — `onChange` fires on selection, which is a
different moment. `displayValue` decides what the input shows for the selected object, and
`--input-width` matches the panel to the input.

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

**Why good:** `virtual` keeps only the visible options in the DOM, with no windowing library.
Note the shape change: `ComboboxOptions` takes a render function rather than mapped children.
