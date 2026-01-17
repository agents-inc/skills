# Radix UI - Navigation Examples

> Accordion and Tabs for content organization and navigation.

---

## Pattern 1: Accordion Component

CSS custom properties exposed by Radix enable smooth height animations.

### Good Example - FAQ Accordion

```typescript
import { Accordion } from "radix-ui";

type FAQItem = {
  question: string;
  answer: string;
};

type FAQAccordionProps = {
  items: FAQItem[];
  defaultOpen?: string;
};

export function FAQAccordion({ items, defaultOpen }: FAQAccordionProps) {
  return (
    <Accordion.Root
      type="single"
      collapsible
      defaultValue={defaultOpen}
      className="accordion-root"
    >
      {items.map((item, index) => (
        <Accordion.Item
          key={index}
          value={`item-${index}`}
          className="accordion-item"
        >
          <Accordion.Header className="accordion-header">
            <Accordion.Trigger className="accordion-trigger">
              {item.question}
              <span className="accordion-chevron" aria-hidden="true">
                &#9660;
              </span>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="accordion-content">
            <div className="accordion-content-inner">{item.answer}</div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
```

```css
/* Animate accordion content height */
.accordion-content {
  overflow: hidden;
}

.accordion-content[data-state="open"] {
  animation: slideDown 300ms ease-out;
}

.accordion-content[data-state="closed"] {
  animation: slideUp 300ms ease-out;
}

@keyframes slideDown {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes slideUp {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

/* Rotate chevron on open */
.accordion-trigger[data-state="open"] > .accordion-chevron {
  transform: rotate(180deg);
}
```

**Why good:** type="single" collapsible allows closing all items, --radix-accordion-content-height CSS variable enables smooth height animation, data-state on trigger enables chevron rotation

---

## Pattern 2: Tabs Component

Radix Tabs provide automatic keyboard navigation with Arrow keys.

### Good Example - Tabbed Content

```typescript
import { Tabs } from "radix-ui";

type TabItem = {
  value: string;
  label: string;
  content: React.ReactNode;
};

type TabbedContentProps = {
  tabs: TabItem[];
  defaultTab?: string;
};

export function TabbedContent({ tabs, defaultTab }: TabbedContentProps) {
  return (
    <Tabs.Root
      defaultValue={defaultTab || tabs[0]?.value}
      className="tabs-root"
    >
      <Tabs.List className="tabs-list" aria-label="Content tabs">
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className="tabs-trigger"
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content
          key={tab.value}
          value={tab.value}
          className="tabs-content"
        >
          {tab.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

// Usage
const TABS = [
  { value: "overview", label: "Overview", content: <OverviewPanel /> },
  { value: "settings", label: "Settings", content: <SettingsPanel /> },
  { value: "billing", label: "Billing", content: <BillingPanel /> },
];

<TabbedContent tabs={TABS} defaultTab="overview" />
```

**Why good:** Tabs.List has aria-label for screen readers, keyboard navigation (Arrow keys) works automatically, data-state on triggers enables active tab styling
