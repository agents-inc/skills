# date-fns Core Examples

> Formatting, parsing, and manipulation patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Formatting Dates

### Good Example - Format with Named Constants

```typescript
import { format, parseISO } from "date-fns";

// Format constants at module level
const ISO_DATE_FORMAT = "yyyy-MM-dd";
const ISO_DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'";
const DISPLAY_DATE_FORMAT = "MMMM d, yyyy";
const DISPLAY_DATETIME_FORMAT = "MMMM d, yyyy 'at' h:mm a";
const SHORT_DATE_FORMAT = "MMM d";
const TIME_FORMAT = "h:mm a";

const date = new Date(2026, 0, 15, 14, 30, 0);

// ISO formats for APIs and storage
const isoDate = format(date, ISO_DATE_FORMAT);         // "2026-01-15"
const isoDateTime = format(date, ISO_DATETIME_FORMAT); // "2026-01-15T14:30:00Z"

// Display formats for UI
const displayDate = format(date, DISPLAY_DATE_FORMAT);     // "January 15, 2026"
const displayDateTime = format(date, DISPLAY_DATETIME_FORMAT); // "January 15, 2026 at 2:30 PM"
const shortDate = format(date, SHORT_DATE_FORMAT);         // "Jan 15"
const time = format(date, TIME_FORMAT);                    // "2:30 PM"

// Named export for reuse
export {
  ISO_DATE_FORMAT,
  ISO_DATETIME_FORMAT,
  DISPLAY_DATE_FORMAT,
  DISPLAY_DATETIME_FORMAT,
};
```

**Why good:** format constants are reusable across the app, centralized for easy updates, self-documenting

### Bad Example - Magic Format Strings

```typescript
import { format } from "date-fns";

// Magic strings scattered in code
const date1 = format(someDate, "yyyy-MM-dd");
const date2 = format(otherDate, "yyyy-MM-dd");
const date3 = format(anotherDate, "YYYY-MM-DD"); // Wrong! Moment.js syntax
```

**Why bad:** duplicated magic strings, inconsistent usage, easy to use wrong syntax

---

## Parsing Dates

### Good Example - Safe Parsing with Validation

```typescript
import { parseISO, parse, isValid, format } from "date-fns";

const DATE_FORMAT = "yyyy-MM-dd";

// Parse ISO strings (from APIs)
function parseISODate(isoString: string): Date | null {
  const parsed = parseISO(isoString);
  return isValid(parsed) ? parsed : null;
}

// Parse custom format (from user input)
function parseDateString(
  dateString: string,
  formatString: string = DATE_FORMAT
): Date | null {
  const parsed = parse(dateString, formatString, new Date());
  return isValid(parsed) ? parsed : null;
}

// Strict parsing - verify round-trip to catch Feb 30, etc.
function strictParseDateString(
  dateString: string,
  formatString: string = DATE_FORMAT
): Date | null {
  const parsed = parse(dateString, formatString, new Date());

  if (!isValid(parsed)) {
    return null;
  }

  // Verify round-trip matches
  if (format(parsed, formatString) !== dateString) {
    return null;
  }

  return parsed;
}

// Usage
const validDate = parseISODate("2026-01-15");        // Date object
const invalidDate = parseISODate("not-a-date");     // null
const userDate = parseDateString("01/15/2026", "MM/dd/yyyy"); // Date object
const badDate = strictParseDateString("2026-02-30", DATE_FORMAT); // null (Feb 30 invalid)
```

**Why good:** validation prevents runtime errors, strict parsing catches invalid dates like Feb 30, clear null return for error handling

### Bad Example - Unsafe Parsing

```typescript
// No validation - crashes on invalid input
const date = parseISO(userInput);
const formatted = format(date, "yyyy-MM-dd"); // Throws if date is invalid!

// Using Date constructor - browser inconsistent
const date2 = new Date(userInput); // May be Invalid Date or wrong date
```

**Why bad:** no validation leads to runtime errors, Date constructor behavior varies by browser

---

## Date Arithmetic

### Good Example - Pure Functions with Constants

```typescript
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  subMonths,
  addHours,
  addMinutes,
} from "date-fns";

// Business rule constants
const TRIAL_PERIOD_DAYS = 14;
const BILLING_CYCLE_MONTHS = 1;
const EXPIRY_WARNING_DAYS = 7;
const APPOINTMENT_DURATION_MINUTES = 30;

const now = new Date();

// Calculate business dates
const trialEndDate = addDays(now, TRIAL_PERIOD_DAYS);
const nextBillingDate = addMonths(now, BILLING_CYCLE_MONTHS);
const expiryWarningDate = subDays(trialEndDate, EXPIRY_WARNING_DAYS);

// Appointment scheduling
function getAppointmentEnd(startTime: Date): Date {
  return addMinutes(startTime, APPOINTMENT_DURATION_MINUTES);
}

// Chain operations (still returns new dates)
function getQuarterEnd(date: Date): Date {
  const threeMonthsLater = addMonths(date, 3);
  const startOfQuarterEnd = startOfMonth(threeMonthsLater);
  return subDays(startOfQuarterEnd, 1);
}

// Original date is never modified
console.log(now); // Unchanged
```

**Why good:** constants document business rules, pure functions prevent side effects, easy to test

### Bad Example - Mutating Dates

```typescript
// Mutation causes side effects
function getNextWeek(date: Date): Date {
  date.setDate(date.getDate() + 7);
  return date;
}

const meeting = new Date(2026, 0, 15);
const reminder = getNextWeek(meeting);

// BUG: meeting is now also changed!
console.log(meeting); // Jan 22, not Jan 15!
```

**Why bad:** mutation changes original date, causes bugs when date is shared between components

---

## Date Boundaries

### Good Example - Consistent Range Generation

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
} from "date-fns";

// Week start option (1 = Monday for ISO weeks)
const WEEK_STARTS_ON_MONDAY = 1;

interface DateRange {
  start: Date;
  end: Date;
}

// Day range for "today" queries
function getDayRange(date: Date): DateRange {
  return {
    start: startOfDay(date),
    end: endOfDay(date),
  };
}

// Week range (ISO week starting Monday)
function getWeekRange(date: Date): DateRange {
  return {
    start: startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON_MONDAY }),
    end: endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON_MONDAY }),
  };
}

// Month range for monthly reports
function getMonthRange(date: Date): DateRange {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

// Quarter range for quarterly analysis
function getQuarterRange(date: Date): DateRange {
  return {
    start: startOfQuarter(date),
    end: endOfQuarter(date),
  };
}

// Year range
function getYearRange(date: Date): DateRange {
  return {
    start: startOfYear(date),
    end: endOfYear(date),
  };
}

// Usage for database queries
const today = new Date();
const monthRange = getMonthRange(today);

// Query: WHERE created_at >= ? AND created_at <= ?
// params: [monthRange.start.toISOString(), monthRange.end.toISOString()]
```

**Why good:** handles month lengths automatically, endOfDay includes full day, consistent for database queries

---

## Preset Date Ranges

### Good Example - Common Dashboard Ranges

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

const WEEK_STARTS_ON_MONDAY = 1;
const DAYS_IN_WEEK = 7;
const LAST_N_DAYS_7 = 6;  // Today + 6 previous = 7 days
const LAST_N_DAYS_30 = 29; // Today + 29 previous = 30 days

function getPresetRange(
  preset: PresetRange,
  referenceDate: Date = new Date()
): DateRange {
  const today = startOfDay(referenceDate);

  const presets: Record<PresetRange, DateRange> = {
    today: {
      start: startOfDay(today),
      end: endOfDay(today),
    },
    yesterday: {
      start: startOfDay(subDays(today, 1)),
      end: endOfDay(subDays(today, 1)),
    },
    last7days: {
      start: startOfDay(subDays(today, LAST_N_DAYS_7)),
      end: endOfDay(today),
    },
    last30days: {
      start: startOfDay(subDays(today, LAST_N_DAYS_30)),
      end: endOfDay(today),
    },
    thisWeek: {
      start: startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON_MONDAY }),
      end: endOfWeek(today, { weekStartsOn: WEEK_STARTS_ON_MONDAY }),
    },
    lastWeek: {
      start: startOfWeek(subWeeks(today, 1), { weekStartsOn: WEEK_STARTS_ON_MONDAY }),
      end: endOfWeek(subWeeks(today, 1), { weekStartsOn: WEEK_STARTS_ON_MONDAY }),
    },
    thisMonth: {
      start: startOfMonth(today),
      end: endOfMonth(today),
    },
    lastMonth: {
      start: startOfMonth(subMonths(today, 1)),
      end: endOfMonth(subMonths(today, 1)),
    },
    thisQuarter: {
      start: startOfQuarter(today),
      end: endOfQuarter(today),
    },
    lastQuarter: {
      start: startOfQuarter(subQuarters(today, 1)),
      end: endOfQuarter(subQuarters(today, 1)),
    },
    thisYear: {
      start: startOfYear(today),
      end: endOfYear(today),
    },
    lastYear: {
      start: startOfYear(subYears(today, 1)),
      end: endOfYear(subYears(today, 1)),
    },
  };

  return presets[preset];
}

// Usage
const range = getPresetRange("last7days");
// { start: Date(Jan 9, 00:00:00), end: Date(Jan 15, 23:59:59.999) }
```

**Why good:** handles all edge cases (month lengths, week boundaries), constants document business logic, typed presets prevent typos
