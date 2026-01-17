# date-fns Comparison & Interval Examples

> Comparison, validation, and interval patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Date Comparisons

### Good Example - Semantic Comparison Functions

```typescript
import {
  isAfter,
  isBefore,
  isEqual,
  isSameDay,
  isSameMonth,
  isSameYear,
  isSameWeek,
  isSameHour,
  compareAsc,
  compareDesc,
} from "date-fns";

const date1 = new Date(2026, 0, 15, 10, 0);
const date2 = new Date(2026, 0, 20, 14, 30);
const date3 = new Date(2026, 0, 15, 18, 0);

// Basic comparisons
const isLater = isAfter(date2, date1);     // true
const isEarlier = isBefore(date1, date2);  // true
const areSame = isEqual(date1, date1);     // true

// Same period comparisons (ignore smaller units)
const sameDay = isSameDay(date1, date3);   // true (both Jan 15)
const sameMonth = isSameMonth(date1, date2); // true (both January)
const sameYear = isSameYear(date1, date2); // true (both 2026)
const sameWeek = isSameWeek(date1, date2, { weekStartsOn: 1 }); // true/false

// Sorting arrays of dates
const dates = [date2, date1, date3];
const ascending = dates.sort(compareAsc);  // [date1, date3, date2]
const descending = dates.sort(compareDesc); // [date2, date3, date1]

// Type-safe comparison utility
function sortByDate<T>(
  items: T[],
  getDate: (item: T) => Date,
  direction: "asc" | "desc" = "asc"
): T[] {
  const compareFn = direction === "asc" ? compareAsc : compareDesc;
  return [...items].sort((a, b) => compareFn(getDate(a), getDate(b)));
}

// Usage
interface Event {
  name: string;
  date: Date;
}

const events: Event[] = [
  { name: "Meeting", date: new Date(2026, 0, 20) },
  { name: "Lunch", date: new Date(2026, 0, 15) },
];

const sortedEvents = sortByDate(events, (e) => e.date, "asc");
```

**Why good:** semantic function names are self-documenting, handles edge cases like different times on same day, type-safe sorting utility

### Bad Example - Manual Timestamp Comparison

```typescript
// Verbose and error-prone
const isLater = date2.getTime() > date1.getTime();

// Same day check is complex
const sameDay =
  date1.getFullYear() === date2.getFullYear() &&
  date1.getMonth() === date2.getMonth() &&
  date1.getDate() === date2.getDate();
```

**Why bad:** verbose, easy to make mistakes, doesn't handle edge cases

---

## Convenience Checks

### Good Example - Common Date Checks

```typescript
import {
  isToday,
  isYesterday,
  isTomorrow,
  isPast,
  isFuture,
  isWeekend,
  isMonday,
  isTuesday,
  isWednesday,
  isThursday,
  isFriday,
  isSaturday,
  isSunday,
  isFirstDayOfMonth,
  isLastDayOfMonth,
  isLeapYear,
} from "date-fns";

const date = new Date(2026, 0, 15);

// Relative to now
const todayCheck = isToday(date);       // depends on current date
const yesterdayCheck = isYesterday(date);
const tomorrowCheck = isTomorrow(date);
const pastCheck = isPast(date);         // true if before now
const futureCheck = isFuture(date);     // true if after now

// Day of week
const weekendCheck = isWeekend(date);   // false (Thursday)
const fridayCheck = isFriday(date);     // false

// Month boundaries
const firstOfMonth = isFirstDayOfMonth(date); // false
const lastOfMonth = isLastDayOfMonth(date);   // false

// Year check
const leapYear = isLeapYear(date);      // false (2026 is not leap year)

// Practical example: conditional rendering
function getDateBadge(date: Date): string | null {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isTomorrow(date)) return "Tomorrow";
  return null;
}

// Practical example: business day check
function isBusinessDay(date: Date): boolean {
  return !isWeekend(date);
}
```

**Why good:** readable intent, handles timezone-aware "today" check, useful for UI badges

---

## Interval Operations

### Good Example - Date Range Generation

```typescript
import {
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachYearOfInterval,
  eachHourOfInterval,
  eachWeekendOfInterval,
  isWithinInterval,
  areIntervalsOverlapping,
  intervalToDuration,
} from "date-fns";

interface DateRange {
  start: Date;
  end: Date;
}

// Generate all days in a range (for calendars)
function getDaysInRange(range: DateRange): Date[] {
  return eachDayOfInterval(range);
}

// Generate weeks (for weekly views)
const WEEK_STARTS_ON_MONDAY = 1;

function getWeeksInRange(range: DateRange): Date[] {
  return eachWeekOfInterval(range, { weekStartsOn: WEEK_STARTS_ON_MONDAY });
}

// Generate months (for month pickers)
function getMonthsInRange(range: DateRange): Date[] {
  return eachMonthOfInterval(range);
}

// Check if date is within range
function isDateInRange(date: Date, range: DateRange): boolean {
  return isWithinInterval(date, range);
}

// Check if two ranges overlap
function doRangesOverlap(range1: DateRange, range2: DateRange): boolean {
  return areIntervalsOverlapping(range1, range2);
}

// Get duration between dates
function getRangeDuration(range: DateRange): Duration {
  return intervalToDuration(range);
}

// Usage
const january = {
  start: new Date(2026, 0, 1),
  end: new Date(2026, 0, 31),
};

const daysInJanuary = getDaysInRange(january);
// [Jan 1, Jan 2, ..., Jan 31] - 31 Date objects

const weeksInJanuary = getWeeksInRange(january);
// [Jan 1 (or week start), Jan 6, Jan 13, Jan 20, Jan 27]

const isInJanuary = isDateInRange(new Date(2026, 0, 15), january);
// true

const duration = getRangeDuration(january);
// { days: 30 } (Jan 1 to Jan 31 = 30 day difference)
```

**Why good:** generates arrays directly usable for rendering, handles edge cases, typed intervals

### Good Example - Weekend and Business Day Iteration

```typescript
import { eachWeekendOfInterval, eachDayOfInterval, isWeekend } from "date-fns";

interface DateRange {
  start: Date;
  end: Date;
}

// Get all weekends in a range
function getWeekendsInRange(range: DateRange): Date[] {
  return eachWeekendOfInterval(range);
}

// Get business days only
function getBusinessDaysInRange(range: DateRange): Date[] {
  return eachDayOfInterval(range).filter((date) => !isWeekend(date));
}

// Count business days
function countBusinessDays(range: DateRange): number {
  return getBusinessDaysInRange(range).length;
}

// Usage
const q1 = {
  start: new Date(2026, 0, 1),
  end: new Date(2026, 2, 31),
};

const weekends = getWeekendsInRange(q1);
const businessDays = getBusinessDaysInRange(q1);
const workingDaysCount = countBusinessDays(q1);
```

**Why good:** efficient iteration, useful for business day calculations, calendar generation

---

## Date Differences

### Good Example - Calculating Differences

```typescript
import {
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  differenceInMilliseconds,
  differenceInBusinessDays,
  intervalToDuration,
} from "date-fns";

const start = new Date(2026, 0, 1);
const end = new Date(2026, 5, 15);

// Simple differences (returns integer, rounds down)
const daysDiff = differenceInDays(end, start);       // 165
const weeksDiff = differenceInWeeks(end, start);     // 23
const monthsDiff = differenceInMonths(end, start);   // 5
const yearsDiff = differenceInYears(end, start);     // 0

// Time differences
const hoursDiff = differenceInHours(end, start);     // 3960
const minutesDiff = differenceInMinutes(end, start); // 237600

// Business days (excludes weekends)
const businessDaysDiff = differenceInBusinessDays(end, start);

// Full duration breakdown
const duration = intervalToDuration({ start, end });
// { months: 5, days: 14 }

// Utility: Human-readable duration
function formatDuration(duration: Duration): string {
  const parts: string[] = [];

  if (duration.years && duration.years > 0) {
    parts.push(`${duration.years} year${duration.years > 1 ? "s" : ""}`);
  }
  if (duration.months && duration.months > 0) {
    parts.push(`${duration.months} month${duration.months > 1 ? "s" : ""}`);
  }
  if (duration.days && duration.days > 0) {
    parts.push(`${duration.days} day${duration.days > 1 ? "s" : ""}`);
  }

  return parts.join(", ") || "0 days";
}

// Usage
const d = intervalToDuration({ start, end });
const readable = formatDuration(d); // "5 months, 14 days"
```

**Why good:** clear function names, handles rounding correctly, business day calculation is built-in

---

## Interval Overlap Detection

### Good Example - Booking Conflict Detection

```typescript
import { areIntervalsOverlapping, isWithinInterval } from "date-fns";

interface Booking {
  id: string;
  start: Date;
  end: Date;
}

// Check if new booking conflicts with existing bookings
function hasBookingConflict(
  newBooking: { start: Date; end: Date },
  existingBookings: Booking[]
): boolean {
  return existingBookings.some((booking) =>
    areIntervalsOverlapping(
      { start: newBooking.start, end: newBooking.end },
      { start: booking.start, end: booking.end }
    )
  );
}

// Find all conflicting bookings
function findConflicts(
  newBooking: { start: Date; end: Date },
  existingBookings: Booking[]
): Booking[] {
  return existingBookings.filter((booking) =>
    areIntervalsOverlapping(
      { start: newBooking.start, end: newBooking.end },
      { start: booking.start, end: booking.end }
    )
  );
}

// Check if time slot is available
function isSlotAvailable(
  slotStart: Date,
  slotEnd: Date,
  bookings: Booking[]
): boolean {
  return !hasBookingConflict({ start: slotStart, end: slotEnd }, bookings);
}

// Usage
const existingBookings: Booking[] = [
  {
    id: "1",
    start: new Date(2026, 0, 15, 10, 0),
    end: new Date(2026, 0, 15, 11, 0),
  },
  {
    id: "2",
    start: new Date(2026, 0, 15, 14, 0),
    end: new Date(2026, 0, 15, 15, 0),
  },
];

const newBooking = {
  start: new Date(2026, 0, 15, 10, 30),
  end: new Date(2026, 0, 15, 11, 30),
};

const hasConflict = hasBookingConflict(newBooking, existingBookings);
// true (overlaps with booking "1")

const conflicts = findConflicts(newBooking, existingBookings);
// [{ id: "1", ... }]
```

**Why good:** handles edge cases (adjacent bookings, contained bookings), reusable for any scheduling system

---

## Validation Patterns

### Good Example - Comprehensive Date Validation

```typescript
import { isValid, parse, isAfter, isBefore, format } from "date-fns";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  date: Date | null;
}

interface ValidationOptions {
  format?: string;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  allowPast?: boolean;
  allowFuture?: boolean;
}

const DEFAULT_DATE_FORMAT = "yyyy-MM-dd";

function validateDate(
  value: string,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const {
    format: dateFormat = DEFAULT_DATE_FORMAT,
    minDate,
    maxDate,
    required = false,
    allowPast = true,
    allowFuture = true,
  } = options;

  // Empty check
  if (!value || value.trim() === "") {
    if (required) {
      errors.push("Date is required");
    }
    return { isValid: !required, errors, date: null };
  }

  // Parse
  const parsed = parse(value, dateFormat, new Date());

  if (!isValid(parsed)) {
    errors.push(`Invalid date format. Expected: ${dateFormat}`);
    return { isValid: false, errors, date: null };
  }

  // Verify round-trip (catches Feb 30, etc.)
  if (format(parsed, dateFormat) !== value) {
    errors.push("Invalid date");
    return { isValid: false, errors, date: null };
  }

  const now = new Date();

  // Past/future restrictions
  if (!allowPast && isBefore(parsed, now)) {
    errors.push("Date cannot be in the past");
  }

  if (!allowFuture && isAfter(parsed, now)) {
    errors.push("Date cannot be in the future");
  }

  // Range validation
  if (minDate && isBefore(parsed, minDate)) {
    errors.push(`Date must be after ${format(minDate, dateFormat)}`);
  }

  if (maxDate && isAfter(parsed, maxDate)) {
    errors.push(`Date must be before ${format(maxDate, dateFormat)}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    date: errors.length === 0 ? parsed : null,
  };
}

// Usage
const result = validateDate("2026-01-15", {
  required: true,
  minDate: new Date(2026, 0, 1),
  maxDate: new Date(2026, 11, 31),
});

if (result.isValid && result.date) {
  // Safe to use result.date
}
```

**Why good:** comprehensive validation, returns structured result, handles all edge cases, round-trip verification
