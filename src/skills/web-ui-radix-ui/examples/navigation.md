# Radix UI - Navigation Examples

> Accordion and Tabs for content organization and navigation.

---

## Pattern 1: Accordion Component

Height cannot animate from `auto`. Radix measures the panel and publishes the number as
`--radix-accordion-content-height` while the animation runs, which is what makes a keyframe possible.

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
  from {
    height: 0;
  }
  to {
    height: var(--radix-accordion-content-height);
  }
}

@keyframes slideUp {
  from {
    height: var(--radix-accordion-content-height);
  }
  to {
    height: 0;
  }
}

/* Rotate chevron on open */
.accordion-trigger[data-state="open"] > .accordion-chevron {
  transform: rotate(180deg);
}
```

**Why good:** `type="single"` without `collapsible` leaves one item permanently open, since closing
the last one is refused; the pair is what allows an all-closed state. `overflow: hidden` on the
content is load-bearing rather than cosmetic — without it the panel's contents spill out during the
height animation. The chevron rotates off `data-state` on the trigger, so no state is duplicated to
drive it.

---

## Pattern 2: Tabs Component

Tabs carries the full WAI-ARIA tab pattern: roving tabindex, arrow-key movement between triggers,
Home and End, and `aria-controls` wiring between each trigger and its panel.

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

**Why good:** `aria-label` on `List` names the tab set, which is otherwise announced as an unlabelled
group. Trigger and panel pair by matching `value` rather than by document order, so the two arrays
can be built and reordered independently.
