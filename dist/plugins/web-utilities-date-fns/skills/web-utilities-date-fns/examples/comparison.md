# date-fns Comparison & Interval Examples

> Comparisons, interval generation, overlap detection and validation. See [SKILL.md](../SKILL.md)
> for the decisions and [relative.md](relative.md) for duration rendering.

---

## Comparisons

The `isSame*` family truncates to the unit named, which is what the hand-rolled version keeps
getting wrong.

```typescript
import {
  isAfter,
  isBefore,
  isEqual,
  isSameDay,
  isSameMonth,
  isSameWeek,
  compareAsc,
  compareDesc,
} from "date-fns";

const morning = new Date(2026, 0, 15, 10, 0);
const evening = new Date(2026, 0, 15, 18, 0);

isAfter(evening, morning); // true
isEqual(morning, morning); // true — exact instant
isSameDay(morning, evening); // true — time-of-day ignored
isSameWeek(morning, evening, { weekStartsOn: 1 });

// compareAsc / compareDesc are comparator functions, not predicates
const sorted = [...dates].sort(compareAsc);

function sortByDate<T>(
  items: readonly T[],
  getDate: (item: T) => Date,
  direction: "asc" | "desc" = "asc",
): T[] {
  const compare = direction === "asc" ? compareAsc : compareDesc;
  return [...items].sort((a, b) => compare(getDate(a), getDate(b)));
}
```

`sort` mutates in place, so the spread is what keeps the caller's array intact.

---

## Convenience Checks

```typescript
import {
  isToday,
  isYesterday,
  isTomorrow,
  isPast,
  isFuture,
  isWeekend,
  isFirstDayOfMonth,
  isLastDayOfMonth,
  isLeapYear,
} from "date-fns";

// These read the host clock and the host zone, which makes them awkward to test —
// the `is*Day` family has no reference-date argument
function dateBadge(date: Date): string | null {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isTomorrow(date)) return "Tomorrow";
  return null;
}

const isBusinessDay = (date: Date) => !isWeekend(date);
```

For a testable equivalent, compare with `isSameDay(date, referenceDate)` and pass the reference in.

---

## Interval Generation

An interval is a plain `{ start, end }` object, and every `each*OfInterval` function returns an
array ready to render.

```typescript
import {
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachWeekendOfInterval,
  isWithinInterval,
  isWeekend,
} from "date-fns";

const january = { start: new Date(2026, 0, 1), end: new Date(2026, 0, 31) };

eachDayOfInterval(january); // 31 Dates
eachWeekOfInterval(january, { weekStartsOn: 1 }); // week-start Dates
eachMonthOfInterval({ start: jan, end: dec }); // month-start Dates
eachWeekendOfInterval(january); // Saturdays and Sundays

// Business days: filter, since there is no eachBusinessDayOfInterval
const businessDays = eachDayOfInterval(january).filter((d) => !isWeekend(d));

// Inclusive of both endpoints
isWithinInterval(new Date(2026, 0, 15), january); // true
```

Validate user-supplied ranges before passing them. Since v3, `isWithinInterval` and
`areIntervalsOverlapping` sort the two endpoints internally, and `eachDayOfInterval` walks an
inverted interval and hands the array back reversed. None of the three reports the inversion, so a
range the user got backwards produces a plausible answer rather than an error.

---

## Differences

```typescript
import {
  differenceInDays,
  differenceInCalendarDays,
  differenceInMonths,
  differenceInHours,
  differenceInBusinessDays,
  intervalToDuration,
} from "date-fns";

const start = new Date(2026, 0, 1);
const end = new Date(2026, 5, 15);

differenceInDays(end, start); // 165 — whole 24-hour spans
differenceInMonths(end, start); // 5 — truncated, never 5.5
differenceInHours(end, start); // 3960
differenceInBusinessDays(end, start); // weekends excluded

// The whole breakdown at once
intervalToDuration({ start, end }); // { months: 5, days: 14 }
```

`differenceInDays` counts elapsed 24-hour spans while `differenceInCalendarDays` counts date
boundaries crossed — 23:00 to 01:00 the next night is `0` and `1` respectively. Calendar days are
almost always what a UI means.

---

## Overlap Detection

```typescript
import { areIntervalsOverlapping } from "date-fns";

interface Booking {
  id: string;
  start: Date;
  end: Date;
}

function findConflicts(
  candidate: { start: Date; end: Date },
  existing: readonly Booking[],
): Booking[] {
  return existing.filter((booking) =>
    areIntervalsOverlapping(candidate, booking),
  );
}

// Back-to-back slots do not overlap by default: 10:00–11:00 and 11:00–12:00 are clear.
// Pass inclusive: true to treat a shared endpoint as a conflict.
areIntervalsOverlapping(slotA, slotB, { inclusive: true });
```

---

## Validation

Parsing, existence, range and direction, returning every failure rather than the first.

```typescript
import { isValid, parse, isAfter, isBefore, format } from "date-fns";

interface ValidationOptions {
  pattern?: string;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  allowPast?: boolean;
  allowFuture?: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  date: Date | null;
}

function validateDate(
  value: string,
  options: ValidationOptions = {},
): ValidationResult {
  const {
    pattern = "yyyy-MM-dd",
    minDate,
    maxDate,
    required = false,
    allowPast = true,
    allowFuture = true,
  } = options;
  const errors: string[] = [];

  if (value.trim() === "") {
    if (required) errors.push("Date is required");
    return { isValid: !required, errors, date: null };
  }

  const parsed = parse(value, pattern, new Date());

  if (!isValid(parsed)) {
    return {
      isValid: false,
      errors: [`Invalid date format. Expected ${pattern}`],
      date: null,
    };
  }

  // Round-trip rejects "2026-02-30", which parse rolls forward into March
  if (format(parsed, pattern) !== value) {
    return { isValid: false, errors: ["That date does not exist"], date: null };
  }

  const now = new Date();
  if (!allowPast && isBefore(parsed, now))
    errors.push("Date cannot be in the past");
  if (!allowFuture && isAfter(parsed, now))
    errors.push("Date cannot be in the future");
  if (minDate && isBefore(parsed, minDate))
    errors.push(`Date must be on or after ${format(minDate, pattern)}`);
  if (maxDate && isAfter(parsed, maxDate))
    errors.push(`Date must be on or before ${format(maxDate, pattern)}`);

  return {
    isValid: errors.length === 0,
    errors,
    date: errors.length === 0 ? parsed : null,
  };
}
```

The round-trip check is the step most validators skip, and it is the one that catches Feb 30, Apr
31 and Feb 29 in a non-leap year — all of which `parse` accepts and rolls into the next month.
