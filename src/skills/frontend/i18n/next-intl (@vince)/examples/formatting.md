# next-intl - Advanced Formatting Examples

> Extended examples for relative time, list formatting, and advanced number/date patterns. See [core.md](core.md) for basic useFormatter usage.

**Prerequisites**: Understand useFormatter basics from core examples first.

---

## Relative Time with Auto-Update

### Good Example - Auto-Updating Relative Time

```typescript
"use client";

import { useFormatter, useNow } from "next-intl";

const UPDATE_INTERVAL_MS = 60000; // Update every minute

function LastUpdated({ timestamp }: { timestamp: Date }) {
  const format = useFormatter();
  const now = useNow({ updateInterval: UPDATE_INTERVAL_MS });

  return (
    <time dateTime={timestamp.toISOString()}>
      Updated {format.relativeTime(timestamp, now)}
    </time>
  );
}
```

**Why good:** useNow with updateInterval creates reactive "now" value, relative time updates automatically without manual intervals, named constant for interval

### Good Example - Relative Time Without Auto-Update

```typescript
import { useFormatter } from "next-intl";

function StaticRelativeTime({ timestamp }: { timestamp: Date }) {
  const format = useFormatter();

  // Static relative time (computed once)
  return (
    <time dateTime={timestamp.toISOString()}>
      {format.relativeTime(timestamp)}
    </time>
  );
}
```

**Why good:** simpler when auto-update not needed, avoids unnecessary re-renders

---

## Advanced Relative Time Options

### Good Example - Custom Relative Time Units

```typescript
import { useFormatter } from "next-intl";

function DetailedRelativeTime({ timestamp }: { timestamp: Date }) {
  const format = useFormatter();

  return (
    <time dateTime={timestamp.toISOString()}>
      {format.relativeTime(timestamp, {
        unit: "day", // Force specific unit
        style: "long", // "in 3 days" vs "in 3d"
      })}
    </time>
  );
}
```

**Why good:** explicit unit when you want consistent display, style option for verbosity control

### Good Example - Relative Time with Numeric Option

```typescript
import { useFormatter } from "next-intl";

function ConsistentRelativeTime({ timestamp }: { timestamp: Date }) {
  const format = useFormatter();

  return (
    <time dateTime={timestamp.toISOString()}>
      {format.relativeTime(timestamp, {
        numeric: "always", // "1 day ago" instead of "yesterday"
      })}
    </time>
  );
}
```

**Why good:** numeric: "always" ensures consistent format (no "yesterday", "tomorrow"), useful for data-dense UIs

### When to Use Each Option

| Option | Value | Effect | Use Case |
|--------|-------|--------|----------|
| `unit` | "day", "hour", etc. | Forces specific unit | Consistent display in tables |
| `style` | "long", "short", "narrow" | Controls verbosity | "in 3 days" vs "in 3d" |
| `numeric` | "always", "auto" | Controls word usage | "1 day ago" vs "yesterday" |

---

## List Formatting

### Good Example - Conjunction Lists

```typescript
import { useFormatter } from "next-intl";

function AuthorList({ authors }: { authors: string[] }) {
  const format = useFormatter();

  return (
    <span>
      By {format.list(authors, { type: "conjunction" })}
    </span>
  );
}

// en: "By Alice, Bob, and Charlie"
// de: "Von Alice, Bob und Charlie"
```

**Why good:** list formatting handles locale-specific conjunctions (and/und/et), serial comma usage varies by locale

### Good Example - Disjunction Lists

```typescript
import { useFormatter } from "next-intl";

function OptionList({ options }: { options: string[] }) {
  const format = useFormatter();

  return (
    <span>
      Choose {format.list(options, { type: "disjunction" })}
    </span>
  );
}

// en: "Choose red, blue, or green"
// de: "Wahlen Sie rot, blau oder grun"
```

**Why good:** disjunction type uses "or" instead of "and", useful for choice displays

### Good Example - Unit Lists

```typescript
import { useFormatter } from "next-intl";

function DimensionDisplay({ dimensions }: { dimensions: string[] }) {
  const format = useFormatter();

  return (
    <span>
      Size: {format.list(dimensions, { type: "unit" })}
    </span>
  );
}

// en: "Size: 10cm, 20cm, 5cm"
```

**Why good:** unit type for measurements without conjunctions

### List Type Reference

| Type | Connector | Example (en) | Use Case |
|------|-----------|--------------|----------|
| `conjunction` | "and" | "A, B, and C" | Author lists, features |
| `disjunction` | "or" | "A, B, or C" | Options, choices |
| `unit` | none | "A, B, C" | Measurements, units |

---

## Combined Formatting Patterns

### Good Example - Activity Feed with Multiple Formats

```typescript
"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";

const ACTIVITY_UPDATE_INTERVAL_MS = 30000;

type Activity = {
  user: string;
  action: string;
  timestamp: Date;
  collaborators: string[];
};

function ActivityItem({ activity }: { activity: Activity }) {
  const format = useFormatter();
  const now = useNow({ updateInterval: ACTIVITY_UPDATE_INTERVAL_MS });
  const t = useTranslations("Activity");

  return (
    <li>
      <span>
        {format.list([activity.user, ...activity.collaborators], {
          type: "conjunction",
        })}
      </span>
      <span>{t(activity.action)}</span>
      <time dateTime={activity.timestamp.toISOString()}>
        {format.relativeTime(activity.timestamp, now)}
      </time>
    </li>
  );
}
```

**Why good:** combines list formatting for collaborators, relative time with auto-update for timestamps, translations for action labels

---

_See [core.md](core.md) for basic formatting patterns including dateTime, number, and currency._
