# date-fns Core Examples

> Formatting, parsing, arithmetic, boundaries and preset ranges. See [SKILL.md](../SKILL.md) for the
> decisions, [comparison.md](comparison.md) for intervals and validation, [i18n.md](i18n.md) for
> locales, [relative.md](relative.md) for distances, [timezone.md](timezone.md) for zoned dates.

---

## Formatting

```typescript
import { format } from "date-fns";

const date = new Date(2026, 0, 15, 14, 30, 0);

format(date, "yyyy-MM-dd"); // "2026-01-15"
format(date, "MMM d"); // "Jan 15"
format(date, "MMMM d, yyyy 'at' h:mm a"); // "January 15, 2026 at 2:30 PM"

// Literal characters are single-quoted, including the ISO T and Z
format(date, "yyyy-MM-dd'T'HH:mm:ss'Z'"); // "2026-01-15T14:30:00Z"
```

That last one writes a literal `Z` regardless of the actual offset, so it is only honest for a date
already known to be UTC. For a real offset use `xxx` (`+05:30`) or `date.toISOString()`.

---

## Parsing

`parseISO` for machine input, `parse` for human input. Neither throws, so both are validated before
use; the round-trip check additionally rejects dates that parsed but do not exist.

```typescript
import { parseISO, parse, isValid, format } from "date-fns";

function parseApiDate(isoString: string): Date | null {
  const parsed = parseISO(isoString);
  return isValid(parsed) ? parsed : null;
}

function parseUserDate(input: string, pattern: string): Date | null {
  // Third argument supplies any field the pattern omits (year, month, time)
  const parsed = parse(input, pattern, new Date());
  if (!isValid(parsed)) return null;

  // Round-trip rejects "2026-02-30", which parse happily rolls into March
  return format(parsed, pattern) === input ? parsed : null;
}

parseApiDate("not-a-date"); // null
parseUserDate("2026-02-30", "yyyy-MM-dd"); // null
parseUserDate("15/01/2026", "dd/MM/yyyy"); // Date
```

---

## Arithmetic

Every function returns a new `Date`. The trap is the native setter, which does not.

```typescript
import { addDays, addMonths, subDays, add } from "date-fns";

// ✅ Pure — the caller's date survives
function reminderFor(meeting: Date): Date {
  return subDays(meeting, 1);
}

// ❌ Mutating — the caller's date is now the reminder date
function badReminderFor(meeting: Date): Date {
  meeting.setDate(meeting.getDate() - 1);
  return meeting;
}

// `add` takes several units at once
const later = add(start, { months: 1, days: 3, hours: 12 });

// Day-of-month clamps to the target month's length
addMonths(new Date(2026, 0, 31), 1); // Feb 28, not Mar 3
addDays(new Date(2026, 0, 31), 31); // Mar 3
```

---

## Period Boundaries

`startOf*` / `endOf*` handle month lengths and leap years, and `endOf*` lands on `.999` so an
inclusive range covers the whole final second.

```typescript
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

interface DateRange {
  start: Date;
  end: Date;
}

const dayRange = (date: Date): DateRange => ({
  start: startOfDay(date),
  end: endOfDay(date), // 23:59:59.999 — safe for `created_at <= ?`
});

const monthRange = (date: Date): DateRange => ({
  start: startOfMonth(date),
  end: endOfMonth(date),
});

// ISO weeks start Monday; the default is Sunday
const isoWeekRange = (date: Date): DateRange => ({
  start: startOfWeek(date, { weekStartsOn: 1 }),
  end: endOfWeek(date, { weekStartsOn: 1 }),
});
```

The same shape gives quarter and year ranges through `startOfQuarter`/`endOfQuarter` and
`startOfYear`/`endOfYear`.

---

## Preset Ranges

The off-by-one in "last 7 days" is the reason to write this once: seven days inclusive of today is
`subDays(today, 6)`.

```typescript
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";

type PresetRange =
  | "today"
  | "yesterday"
  | "last7days"
  | "last30days"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "lastQuarter"
  | "thisYear"
  | "lastYear";

interface DateRange {
  start: Date;
  end: Date;
}

function getPresetRange(
  preset: PresetRange,
  referenceDate: Date = new Date(),
): DateRange {
  const today = startOfDay(referenceDate);
  const week = { weekStartsOn: 1 } as const;

  const presets: Record<PresetRange, DateRange> = {
    today: { start: today, end: endOfDay(today) },
    yesterday: {
      start: startOfDay(subDays(today, 1)),
      end: endOfDay(subDays(today, 1)),
    },
    // Inclusive of today, so 7 days is today plus 6
    last7days: { start: subDays(today, 6), end: endOfDay(today) },
    last30days: { start: subDays(today, 29), end: endOfDay(today) },
    thisWeek: { start: startOfWeek(today, week), end: endOfWeek(today, week) },
    lastWeek: {
      start: startOfWeek(subWeeks(today, 1), week),
      end: endOfWeek(subWeeks(today, 1), week),
    },
    thisMonth: { start: startOfMonth(today), end: endOfMonth(today) },
    lastMonth: {
      start: startOfMonth(subMonths(today, 1)),
      end: endOfMonth(subMonths(today, 1)),
    },
    thisQuarter: { start: startOfQuarter(today), end: endOfQuarter(today) },
    lastQuarter: {
      start: startOfQuarter(subQuarters(today, 1)),
      end: endOfQuarter(subQuarters(today, 1)),
    },
    thisYear: { start: startOfYear(today), end: endOfYear(today) },
    lastYear: {
      start: startOfYear(subYears(today, 1)),
      end: endOfYear(subYears(today, 1)),
    },
  };

  return presets[preset];
}
```

A typed `PresetRange` union makes the lookup total, so adding a preset is a compile error until
every branch exists.
