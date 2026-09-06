# Motion - Layout Animation Examples

> `layout` and `layoutId`, continuing the numbering from [core.md](core.md).

**Prerequisites:** `AnimatePresence` from [core.md](core.md) Pattern 3.

---

## Pattern 6: Expandable Card

### Good Example - Card Grown by Its Own Content

```typescript
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";

const LAYOUT_SPRING = { type: "spring" as const, stiffness: 500, damping: 30 };
const CONTENT_DURATION_S = 0.2;

type ExpandableCardProps = {
  title: string;
  summary: string;
  details: string;
  className?: string;
};

export const ExpandableCard = ({
  title,
  summary,
  details,
  className,
}: ExpandableCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.article
      className={className}
      layout
      transition={LAYOUT_SPRING}
      onClick={() => setIsExpanded(!isExpanded)}
      role="button"
      aria-expanded={isExpanded}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsExpanded(!isExpanded);
        }
      }}
    >
      <motion.h3 layout="position">{title}</motion.h3>
      <motion.p layout="position">{summary}</motion.p>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: CONTENT_DURATION_S }}
          >
            <p>{details}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};
```

**Why good:** `layout` needs no from-height — it measures the card before and after the commit. The
`layout="position"` on the heading and summary moves them without scaling them, which is what stops
the type stretching as the card grows. `aria-expanded` carries the state to assistive technology,
which the animation alone does not.

---

## Pattern 7: Shared Element Between Siblings

### Good Example - Tab Indicator That Travels

```typescript
import { motion, LayoutGroup } from "motion/react";

const INDICATOR_SPRING = {
  type: "spring" as const,
  stiffness: 500,
  damping: 35,
};

type Tab = { id: string; label: string };

type TabsProps = {
  tabs: Tab[];
  activeId: string;
  onTabChange: (id: string) => void;
  layoutGroupId?: string;
};

export const Tabs = ({
  tabs,
  activeId,
  onTabChange,
  layoutGroupId,
}: TabsProps) => {
  return (
    <LayoutGroup id={layoutGroupId}>
      <div role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeId === tab.id}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {activeId === tab.id && (
              <motion.span
                layoutId={`${layoutGroupId ?? "tabs"}-indicator`}
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "currentColor",
                }}
                transition={INDICATOR_SPRING}
              />
            )}
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
};
```

**Why good:** Only one indicator is mounted at a time — the shared `layoutId` is what makes the new
one animate from where the old one was rather than fading in. `LayoutGroup` scopes that id, so two
tab strips on one page do not pull each other's indicators across the screen.
