# Headless UI - Practical Examples

> Complete, production-ready examples for common Headless UI patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for component API quick reference.

---

## Example 1: Modal Dialog with Form

A dialog containing a form that prevents dismissal during submission and closes on success.

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
  Field,
  Input,
  Label,
  Textarea,
} from "@headlessui/react";

type FeedbackDialogProps = {
  onSubmit: (data: { name: string; message: string }) => Promise<void>;
};

export function FeedbackDialog({ onSubmit }: FeedbackDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      await onSubmit({
        name: formData.get("name") as string,
        message: formData.get("message") as string,
      });
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Send Feedback
      </button>

      <Dialog
        open={isOpen}
        onClose={() => {
          if (!isSubmitting) setIsOpen(false);
        }}
        className="relative z-50"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-black/30 duration-300 ease-out data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <DialogPanel
            transition
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl duration-300 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <DialogTitle className="text-lg font-semibold">
              Send Feedback
            </DialogTitle>
            <Description className="mt-1 text-sm text-gray-500">
              We appreciate your input. Your feedback helps us improve.
            </Description>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <Field>
                <Label className="text-sm font-medium">Name</Label>
                <Input
                  name="name"
                  required
                  autoFocus
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm data-[focus]:border-blue-500 data-[focus]:outline-none data-[focus]:ring-2 data-[focus]:ring-blue-500/20"
                />
              </Field>

              <Field>
                <Label className="text-sm font-medium">Message</Label>
                <Textarea
                  name="message"
                  required
                  rows={4}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm data-[focus]:border-blue-500 data-[focus]:outline-none data-[focus]:ring-2 data-[focus]:ring-blue-500/20"
                />
              </Field>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
```

**Why good:** Dialog `onClose` prevented during submission, `autoFocus` on first field, Field/Label/Input auto-wire ARIA, DialogTitle and Description provide screen reader context, transitions on both backdrop and panel

---

## Example 2: Dropdown Menu with Icons and Keyboard Shortcuts

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

---

## Example 3: Searchable Select with Combobox

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

## Example 4: Tab Interface with Badges

Tabs displaying content sections with notification badges and controlled state.

```tsx
import { useState } from "react";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";

type TabConfig = {
  name: string;
  badge?: number;
  content: React.ReactNode;
};

const TAB_ITEMS: TabConfig[] = [
  {
    name: "Inbox",
    badge: 3,
    content: (
      <div className="space-y-2">
        <p>Message 1</p>
        <p>Message 2</p>
        <p>Message 3</p>
      </div>
    ),
  },
  {
    name: "Sent",
    content: <p>No sent messages.</p>,
  },
  {
    name: "Drafts",
    badge: 1,
    content: <p>1 draft saved.</p>,
  },
];

export function MailTabs() {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <TabGroup selectedIndex={selectedIndex} onChange={setSelectedIndex}>
      <TabList className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {TAB_ITEMS.map(({ name, badge }) => (
          <Tab
            key={name}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors data-[selected]:bg-white data-[selected]:text-gray-900 data-[selected]:shadow-sm data-[hover]:text-gray-800"
          >
            {name}
            {badge != null && badge > 0 && (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 data-[selected]:bg-blue-600 data-[selected]:text-white">
                {badge}
              </span>
            )}
          </Tab>
        ))}
      </TabList>
      <TabPanels className="mt-3">
        {TAB_ITEMS.map(({ name, content }) => (
          <TabPanel
            key={name}
            className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5"
          >
            {content}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  );
}
```

**Why good:** Controlled via `selectedIndex`/`onChange`, `data-[selected]` styles active tab with white background and shadow, badges show count, Tab/TabPanel order matches automatically, keyboard navigation (Left/Right arrows) built in

---

## Example 5: Popover Navigation Panel

A popover with navigation links that close the popover when clicked.

```tsx
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  PopoverGroup,
  CloseButton,
} from "@headlessui/react";
import {
  ChartBarIcon,
  CursorArrowRaysIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const SOLUTIONS = [
  {
    name: "Analytics",
    description: "Get a better understanding of your traffic",
    href: "/analytics",
    icon: ChartBarIcon,
  },
  {
    name: "Engagement",
    description: "Speak directly to your customers",
    href: "/engagement",
    icon: CursorArrowRaysIcon,
  },
  {
    name: "Security",
    description: "Your customers data will be safe and secure",
    href: "/security",
    icon: ShieldCheckIcon,
  },
];

export function NavPopover() {
  return (
    <PopoverGroup className="flex gap-4">
      <Popover>
        <PopoverButton className="flex items-center gap-1 text-sm font-semibold text-gray-900 data-[open]:text-blue-600">
          Solutions
          <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z" />
          </svg>
        </PopoverButton>

        <PopoverPanel
          anchor="bottom start"
          transition
          className="w-80 rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/5 [--anchor-gap:8px] duration-200 ease-out data-[closed]:translate-y-1 data-[closed]:opacity-0"
        >
          <div className="space-y-1">
            {SOLUTIONS.map(({ name, description, href, icon: Icon }) => (
              <CloseButton
                key={name}
                as="a"
                href={href}
                className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50"
              >
                <Icon className="size-6 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{name}</p>
                  <p className="text-xs text-gray-500">{description}</p>
                </div>
              </CloseButton>
            ))}
          </div>
        </PopoverPanel>
      </Popover>
    </PopoverGroup>
  );
}
```

**Why good:** `CloseButton as="a"` renders links that close the popover on click, `PopoverGroup` manages focus across sibling popovers, `data-[open]` styles button when panel is open, `anchor` handles positioning, transition slides panel down on enter/up on exit

---

## Example 6: Form with Field Components

A complete form using Headless UI's form primitives with auto-generated ARIA associations and cascading disabled state.

```tsx
import { useState } from "react";
import {
  Field,
  Fieldset,
  Input,
  Label,
  Legend,
  Description,
  Select,
  Textarea,
  Switch,
  Checkbox,
} from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/20/solid";

export function ProfileForm() {
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        console.log(Object.fromEntries(data));
      }}
      className="max-w-lg space-y-8"
    >
      <Fieldset className="space-y-4">
        <Legend className="text-lg font-semibold text-gray-900">
          Personal Information
        </Legend>

        <Field>
          <Label className="text-sm font-medium text-gray-700">Full name</Label>
          <Input
            name="fullName"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm data-[focus]:border-blue-500 data-[focus]:ring-1 data-[focus]:ring-blue-500"
          />
        </Field>

        <Field>
          <Label className="text-sm font-medium text-gray-700">Email</Label>
          <Description className="text-xs text-gray-500">
            We will never share your email with anyone.
          </Description>
          <Input
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm data-[focus]:border-blue-500 data-[focus]:ring-1 data-[focus]:ring-blue-500"
          />
        </Field>

        <Field>
          <Label className="text-sm font-medium text-gray-700">Role</Label>
          <Select
            name="role"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm data-[focus]:border-blue-500 data-[focus]:ring-1 data-[focus]:ring-blue-500"
          >
            <option value="developer">Developer</option>
            <option value="designer">Designer</option>
            <option value="manager">Manager</option>
          </Select>
        </Field>

        <Field>
          <Label className="text-sm font-medium text-gray-700">Bio</Label>
          <Textarea
            name="bio"
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm data-[focus]:border-blue-500 data-[focus]:ring-1 data-[focus]:ring-blue-500"
          />
        </Field>
      </Fieldset>

      <Fieldset className="space-y-4">
        <Legend className="text-lg font-semibold text-gray-900">
          Preferences
        </Legend>

        <Field className="flex items-center justify-between">
          <span>
            <Label className="text-sm font-medium text-gray-700" passive>
              Marketing emails
            </Label>
            <Description className="text-xs text-gray-500">
              Receive emails about new features and updates.
            </Description>
          </span>
          <Switch
            checked={marketingEnabled}
            onChange={setMarketingEnabled}
            name="marketing"
            className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 data-[checked]:bg-blue-600 data-[focus]:ring-2 data-[focus]:ring-blue-500 data-[focus]:ring-offset-2"
          >
            <span className="pointer-events-none inline-block size-5 translate-x-0 rounded-full bg-white shadow ring-0 transition duration-200 group-data-[checked]:translate-x-5" />
          </Switch>
        </Field>

        <Field className="flex items-center gap-3">
          <Checkbox
            checked={termsAccepted}
            onChange={setTermsAccepted}
            name="terms"
            className="group size-5 cursor-pointer rounded border border-gray-300 bg-white data-[checked]:border-blue-500 data-[checked]:bg-blue-500 data-[focus]:ring-2 data-[focus]:ring-blue-500 data-[focus]:ring-offset-2"
          >
            <CheckIcon className="size-4 text-white opacity-0 group-data-[checked]:opacity-100" />
          </Checkbox>
          <Label className="text-sm text-gray-700">
            I agree to the terms and conditions
          </Label>
        </Field>
      </Fieldset>

      <button
        type="submit"
        disabled={!termsAccepted}
        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        Save Profile
      </button>
    </form>
  );
}
```

**Why good:** Field auto-generates IDs and wires aria-labelledby/aria-describedby (no manual `htmlFor`/`id`), Fieldset groups related fields with Legend, Description provides helper text, Switch and Checkbox use `name` for form submission, `passive` on Label prevents toggle on click when label is separate from control, `data-[checked]`/`group-data-[checked]` style toggle states
