# Layout Animations

> Layout animations and shared element transitions. See [core.md](core.md) for basic patterns.

**Prerequisites**: Understand AnimatePresence Patterns from [core.md](core.md) first.

---

## Expandable Card

### Good Example - Card with Animated Expansion

```typescript
import { motion, AnimatePresence } from "framer-motion";
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

**Why good:** layout="position" on children prevents text distortion, AnimatePresence handles content exit, keyboard accessible with aria-expanded

---

## Shared Element Transition

### Good Example - Animated Tab Indicator

```typescript
import { motion, LayoutGroup } from "framer-motion";

const INDICATOR_SPRING = { type: "spring" as const, stiffness: 500, damping: 35 };

type Tab = {
  id: string;
  label: string;
};

type TabsProps = {
  tabs: Tab[];
  activeId: string;
  onTabChange: (id: string) => void;
  layoutGroupId?: string;
};

export const Tabs = ({ tabs, activeId, onTabChange, layoutGroupId }: TabsProps) => {
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

**Why good:** LayoutGroup isolates layoutId to this component instance, layoutId enables seamless indicator movement, proper ARIA attributes for tabs
