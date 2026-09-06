# date-fns Relative Time Examples

> Distances, durations and choosing between relative and absolute display. See
> [SKILL.md](../SKILL.md) for the decisions and [i18n.md](i18n.md) for passing a locale.

---

## Distance Between Two Instants

Four functions, differing in how much they smooth.

```typescript
import {
  formatDistance,
  formatDistanceToNow,
  formatDistanceStrict,
} from "date-fns";

const pastDate = new Date(2026, 0, 1);
const now = new Date(2026, 0, 15);

formatDistance(pastDate, now); // "14 days"
formatDistance(pastDate, now, { addSuffix: true }); // "14 days ago"
formatDistanceToNow(pastDate, { addSuffix: true }); // same, against Date.now()

// Strict drops the hedging words
formatDistance(new Date(2026, 1, 15), now); // "about 1 month"
formatDistanceStrict(new Date(2026, 1, 15), now); // "1 month"

// It still picks its own unit — past 30 days that unit is months, so name
// the one you want when the number matters more than the phrasing
formatDistanceStrict(pastDate, now, { unit: "hour" }); // "336 hours"

// Under a minute, the default says "less than a minute"
formatDistanceToNow(new Date(Date.now() - 30_000), { includeSeconds: true });
// "half a minute" — `addSuffix` is what adds the "ago"
```

`addSuffix` reads the sign, so the same call produces "in 3 days" for a future date.

---

## Calendar-Relative Phrasing

`formatRelative` names the day the way a person would, but only within roughly a week either side —
outside that window it falls back to a plain date, which is usually not what you want on its own.

```typescript
import { formatRelative, differenceInCalendarDays, format } from "date-fns";

const now = new Date(2026, 0, 15, 14, 0);

formatRelative(new Date(2026, 0, 14, 10, 0), now); // "yesterday at 10:00 AM"
formatRelative(new Date(2026, 0, 9, 10, 0), now); // "last Friday at 10:00 AM"
formatRelative(new Date(2026, 0, 16, 10, 0), now); // "tomorrow at 10:00 AM"
formatRelative(new Date(2026, 0, 8, 10, 0), now); // "01/08/2026" — 7 days out

function relativeOrAbsolute(date: Date, base = new Date()): string {
  const days = Math.abs(differenceInCalendarDays(date, base));
  return days <= 6 ? formatRelative(date, base) : format(date, "PPp");
}
```

---

## Durations

`intervalToDuration` decomposes a span into calendar units; `formatDuration` renders one.

```typescript
import { formatDuration, intervalToDuration } from "date-fns";
import type { Duration } from "date-fns";

const duration = intervalToDuration({
  start: new Date(2026, 0, 1),
  end: new Date(2026, 5, 15, 14, 30),
});
// { months: 5, days: 14, hours: 14, minutes: 30 }

formatDuration(duration); // "5 months 14 days 14 hours 30 minutes"
formatDuration(duration, { format: ["months", "days"] }); // "5 months 14 days"
formatDuration(duration, {
  format: ["days", "hours", "minutes"],
  delimiter: ", ",
}); // "14 days, 14 hours, 30 minutes"

// Zero-valued units are omitted unless asked for
formatDuration({ hours: 0, minutes: 30 }); // "30 minutes"
formatDuration({ hours: 0, minutes: 30 }, { zero: true }); // "0 hours 30 minutes"

// Show the two largest units that are actually populated
function formatDurationConcise(duration: Duration): string {
  const pairs: [keyof Duration, keyof Duration][] = [
    ["years", "months"],
    ["months", "days"],
    ["days", "hours"],
  ];

  const chosen = pairs.find(([unit]) => (duration[unit] ?? 0) > 0);
  return formatDuration(duration, {
    format: chosen ?? ["hours", "minutes"],
  });
}
```

`intervalToDuration` works in calendar units, so a 31-day February-to-March span is `{ months: 1 }`
while the same 31 days in one month is `{ days: 31 }`.

---

## Relative or Absolute

Relative time is friendly while it is short and useless once it is long — "8 months ago" tells a
reader less than a date does. Switch on age.

```typescript
import {
  formatDistanceToNow,
  format,
  differenceInCalendarDays,
} from "date-fns";

const RELATIVE_WINDOW_DAYS = 7;

function formatSmartDate(date: Date, absolutePattern = "MMM d, yyyy"): string {
  const days = Math.abs(differenceInCalendarDays(date, new Date()));

  if (days <= RELATIVE_WINDOW_DAYS) {
    return formatDistanceToNow(date, { addSuffix: true }); // "3 days ago"
  }

  return format(date, absolutePattern); // "Jan 8, 2026"
}
```

Two refinements worth knowing: a `title`/`aria-label` carrying the absolute date keeps the exact
value reachable from a relative label, and a relative label rendered on a server goes stale the
moment it is cached — compute it where the clock is live.
