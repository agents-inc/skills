# Headless UI - Popover & Disclosure Examples

> Complete code examples for Popover (floating panels) and Disclosure (accordion) patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Dialog & Modal](dialog.md) - Modal overlays
- [Menu & Dropdowns](menu.md) - Dropdown action menus
- [Tabs](tabs.md) - Tabbed content navigation

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

**Why good:** `anchor` handles positioning, CloseButton closes popover when clicked (useful for navigation links), `transition` with `data-[closed]` for enter/exit animations

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

const SOLUTIONS = [
  {
    name: "Analytics",
    description: "Get a better understanding of your traffic",
    href: "/analytics",
    icon: (
      <svg
        className="size-6 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
  },
  {
    name: "Engagement",
    description: "Speak directly to your customers",
    href: "/engagement",
    icon: (
      <svg
        className="size-6 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
        />
      </svg>
    ),
  },
  {
    name: "Security",
    description: "Your customers data will be safe and secure",
    href: "/security",
    icon: (
      <svg
        className="size-6 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
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

**Why good:** `CloseButton as="a"` renders links that close the popover on click, `PopoverGroup` manages focus across sibling popovers, `data-[open]` styles button when panel is open, `anchor` handles positioning, transition slides panel down on enter/up on exit

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

**Why good:** Each Disclosure manages its own state independently, `transition` on panel enables smooth expand/collapse, `data-[open]` rotates the chevron icon, multiple can be open simultaneously

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

**Why good:** `show` controls visibility, `data-[closed]` defines initial/final state for transitions, Transition handles mount/unmount timing
