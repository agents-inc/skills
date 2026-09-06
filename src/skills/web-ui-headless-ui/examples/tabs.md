# Headless UI - Tabs Examples

> Complete code examples for TabGroup patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

**Related examples:** [popover-disclosure.md](popover-disclosure.md), [switch-radio.md](switch-radio.md), [dialog.md](dialog.md)

---

## Basic Horizontal Tabs

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

**Why good:** Left/Right arrow navigation is automatic, `data-selected` styles the active tab, and
Tab and TabPanel pair up by order rather than by an id you maintain.

---

## Controlled Tabs with Vertical Layout

Vertical tabs with controlled state (`selectedIndex`/`onChange`) and Up/Down arrow navigation.

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

**Why good:** `vertical` switches keyboard navigation to Up/Down arrows, and `selectedIndex`/`onChange` make the group controlled. The two-column layout is yours.

---

## Tabs with Badges

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

**Why good:** the badge is ordinary markup inside the `Tab` — nothing about it needs the library's
cooperation, and the tab keeps its keyboard behaviour and `data-selected` regardless.
