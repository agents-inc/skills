# React - Icon Examples

> lucide-react usage, accessibility patterns, and color inheritance. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [core.md](core.md) - Component architecture, variants, event handlers
- [hooks.md](hooks.md) - usePagination, useDebounce, useLocalStorage
- [error-boundaries.md](error-boundaries.md) - Error boundary implementation and recovery

---

## Icon in Button with Accessibility

### Good Example - Icon with proper accessibility

```tsx
import { ChevronDown } from "lucide-react";
import { Button } from "@repo/ui/button";

<Button size="icon" title="Expand details" aria-label="Expand details">
  <ChevronDown />
</Button>;
```

**Why good:** lucide-react provides tree-shakeable imports reducing bundle size, title attribute shows tooltip on hover, aria-label provides accessible name for screen readers, icon inherits color from button reducing CSS duplication

### Bad Example - Icon without accessibility

```tsx
import { ChevronDown } from "lucide-react";
import { Button } from "@repo/ui/button";

<Button size="icon">
  <ChevronDown />
</Button>;
```

**Why bad:** missing title means no tooltip for sighted users, missing aria-label means screen readers announce "button" with no context, unusable for keyboard-only and screen reader users

---

## Conditional Icon Rendering

### Good Example - Dynamic icon based on state

```typescript
// packages/ui/src/patterns/feature/feature.tsx
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../../components/button/button";

export type FeatureProps = {
  id: string;
  title: string;
  description: string;
  status: string;
};

export const Feature = ({ id, title, description, status }: FeatureProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <li onClick={() => setIsExpanded(!isExpanded)}>
      <h2>{title}</h2>
      <Button
        variant="ghost"
        size="icon"
        aria-label={isExpanded ? "Collapse details" : "Expand details"}
      >
        {isExpanded ? <ChevronUp /> : <ChevronDown />}
      </Button>
      {isExpanded && <p>{description}</p>}
    </li>
  );
};
```

**Why good:** dynamic aria-label accurately describes current state, conditional icon rendering provides visual feedback, icons inherit color from button via currentColor

---

## Icon Color Inheritance

### Good Example - Icons inherit color from parent

Icons from lucide-react inherit `currentColor` by default, keeping them in sync with text color automatically.

```tsx
// Icon inherits button's text color automatically
<Button variant="primary">
  <CheckCircle />  {/* Inherits button text color */}
  Save
</Button>

// Apply className if custom styling needed
<Button>
  <WarningIcon className="custom-icon-class" />
  Warning
</Button>
```

**Why good:** color inheritance via currentColor keeps icons synced with text color without manual management

### Good Example - Icons match button variants

```tsx
// Icons automatically inherit button's text color via currentColor
<Button data-variant="success">
  <CheckCircle />  {/* Icon inherits green color from button */}
  Save
</Button>

<Button data-variant="danger">
  <XCircle />  {/* Icon inherits red color from button */}
  Delete
</Button>
```

**Why good:** using currentColor keeps icon colors synced with text, reduces styling complexity, automatic color consistency across themes

### Bad Example - Manually overriding icon colors

```tsx
// Don't override icon colors with explicit classes
<Button data-variant="success">
  <CheckCircle color="green" /> {/* Manual color override */}
  Save
</Button>
```

**Why bad:** explicitly setting icon color overrides currentColor inheritance, icons can get out of sync with button text color, breaks color consistency when themes change

---

## Accessible Icon-Only Buttons

### Good Example - Icon buttons with full accessibility

```typescript
import { CircleUserRound, CodeXml } from "lucide-react";
import { Button } from "../../components/button/button";

const GITHUB_URL = "https://github.com/username";
const BLOG_URL = "https://blog.example.com";

export const Socials = () => {
  return (
    <ul>
      <li>
        <Button
          size="icon"
          title="View GitHub profile"
          aria-label="View GitHub profile"
          onClick={() => window.open(GITHUB_URL, "_blank")}
        >
          <CodeXml />
        </Button>
      </li>
      <li>
        <Button
          size="icon"
          title="Visit blog"
          aria-label="Visit blog"
          onClick={() => window.open(BLOG_URL, "_blank")}
        >
          <CircleUserRound />
        </Button>
      </li>
    </ul>
  );
};
```

**Why good:** both title and aria-label provide accessibility for different user needs, named constants for URLs prevent magic strings, title shows tooltip on hover, aria-label provides context for screen readers
