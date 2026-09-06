# Headless UI - Popover & Disclosure Examples

> Complete code examples for Popover (floating panels) and Disclosure (accordion) patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

**Related examples:** [dialog.md](dialog.md), [menu.md](menu.md), [tabs.md](tabs.md)

---

## Basic Popover with CloseButton Links

A popover with navigation links that close the popover when clicked.

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

**Why good:** `CloseButton as="a"` is a real link that also closes the panel — a plain `<a>` would
navigate and leave the popover open behind it.

---

## Navigation Popover with Icons and PopoverGroup

A full navigation popover with icon descriptions and PopoverGroup for managing multiple sibling popovers.

```tsx
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  PopoverGroup,
  CloseButton,
} from "@headlessui/react";

// `icon` is whatever your project renders icons with — the popover does not care.
const SOLUTIONS = [
  {
    name: "Analytics",
    description: "Get a better understanding of your traffic",
    href: "/analytics",
    icon: <AnalyticsIcon className="size-6 text-gray-400" aria-hidden />,
  },
  {
    name: "Engagement",
    description: "Speak directly to your customers",
    href: "/engagement",
    icon: <EngagementIcon className="size-6 text-gray-400" aria-hidden />,
  },
  {
    name: "Security",
    description: "Your customers' data stays safe",
    href: "/security",
    icon: <SecurityIcon className="size-6 text-gray-400" aria-hidden />,
  },
];

export function NavPopover() {
  return (
    <PopoverGroup className="flex gap-4">
      <Popover>
        <PopoverButton className="group flex items-center gap-1 text-sm font-semibold text-gray-900 data-[open]:text-blue-600">
          Solutions
          <span className="group-data-[open]:rotate-180" aria-hidden="true">
            &#9662;
          </span>
        </PopoverButton>

        <PopoverPanel
          anchor="bottom start"
          transition
          className="w-80 rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/5 [--anchor-gap:8px] duration-200 ease-out data-[closed]:translate-y-1 data-[closed]:opacity-0"
        >
          <div className="space-y-1">
            {SOLUTIONS.map(({ name, description, href, icon }) => (
              <CloseButton
                key={name}
                as="a"
                href={href}
                className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-gray-50"
              >
                {icon}
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

**Why good:** `PopoverGroup` keeps sibling popovers from closing each other as focus moves between
them, which is what a navigation bar of dropdowns needs.

---

## FAQ Accordion with Disclosure

Multiple independent Disclosure components forming an accordion-style FAQ section.

```tsx
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";

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
            <span
              className="size-5 transition-transform data-[open]:rotate-180"
              aria-hidden="true"
            >
              &#9662;
            </span>
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

**Why good:** each Disclosure owns its own state, so several can be open at once — a single-open
accordion means lifting `open` yourself.

---

## Standalone Transition

The Transition component for conditionally showing/hiding standalone elements with CSS transitions.

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

**Why good:** `Transition` delays the unmount until the leave transition finishes, which is the part
a bare conditional render cannot do.
