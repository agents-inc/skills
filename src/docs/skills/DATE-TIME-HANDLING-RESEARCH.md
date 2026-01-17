# Date/Time Handling Best Practices for Atomic Skills

> Research conducted: 2026-01-15
> Purpose: Comprehensive patterns for TypeScript date/time handling

---

## Table of Contents

1. [date-fns Patterns](#1-date-fns-patterns)
2. [Day.js Patterns](#2-dayjs-patterns)
3. [Temporal API (New Standard)](#3-temporal-api-new-standard)
4. [Timezone Handling](#4-timezone-handling)
5. [Date Range Patterns](#5-date-range-patterns)
6. [Calendar/Datepicker Patterns](#6-calendardatepicker-patterns)
7. [Relative Time Formatting](#7-relative-time-formatting)
8. [Date Validation](#8-date-validation)
9. [Recurring Date Patterns](#9-recurring-date-patterns)
10. [Internationalized Dates](#10-internationalized-dates)

---

## 1. date-fns Patterns

### Overview

date-fns is a modular, tree-shakeable date utility library with 200+ pure functions. Version 3 is 100% TypeScript with built-in type definitions.

### Core Patterns

#### Basic Date Operations

```typescript
import {
  format,
  parseISO,
  addDays,
  subMonths,
  startOfMonth,
  endOfMonth,
  isAfter,
  isBefore,
  differenceInDays,
} from 'date-fns';

// Parsing ISO strings
const date = parseISO('2026-01-15T10:30:00Z');

// Formatting dates
const formatted = format(date, 'MMMM d, yyyy'); // "January 15, 2026"
const iso = format(date, "yyyy-MM-dd'T'HH:mm:ss'Z'"); // ISO format

// Date arithmetic
const nextWeek = addDays(date, 7);
const lastMonth = subMonths(date, 1);

// Date boundaries
const monthStart = startOfMonth(date);
const monthEnd = endOfMonth(date);

// Comparisons
const isDateAfter = isAfter(nextWeek, date); // true
const daysDiff = differenceInDays(nextWeek, date); // 7
```

#### Working with UTC Dates

```typescript
import { format } from 'date-fns';
import { UTCDate } from '@date-fns/utc';

// Create UTC date (avoids timezone issues)
const utcDate = new UTCDate(2026, 0, 15, 10, 30, 0);

// All operations maintain UTC
const formatted = format(utcDate, 'yyyy-MM-dd HH:mm:ss'); // UTC time
```

#### Timezone-Aware Operations

```typescript
import { format } from 'date-fns';
import { TZDate } from '@date-fns/tz';

// Create date in specific timezone
const tzDate = new TZDate(2026, 0, 15, 10, 30, 0, 'America/New_York');

// Format preserves timezone context
const formatted = format(tzDate, 'yyyy-MM-dd HH:mm:ss zzz');
// "2026-01-15 10:30:00 EST"
```

#### Duration and Distance Formatting

```typescript
import {
  formatDistance,
  formatDistanceToNow,
  formatDuration,
  intervalToDuration,
} from 'date-fns';

const start = new Date(2026, 0, 1);
const end = new Date(2026, 0, 15);

// Human-readable distance
const distance = formatDistance(end, start); // "14 days"
const toNow = formatDistanceToNow(start, { addSuffix: true });
// "14 days ago"

// Duration object
const duration = intervalToDuration({ start, end });
// { days: 14, hours: 0, minutes: 0, seconds: 0 }

// Formatted duration
const formatted = formatDuration(duration); // "14 days"
```

#### Locale Support

```typescript
import { format, formatDistance } from 'date-fns';
import { de, fr, ja } from 'date-fns/locale';

const date = new Date(2026, 0, 15);

// German locale
format(date, 'PPPP', { locale: de }); // "Donnerstag, 15. Januar 2026"

// French locale
formatDistance(date, new Date(), { locale: fr, addSuffix: true });

// Japanese locale
format(date, 'PPP', { locale: ja }); // "2026年1月15日"
```

### Anti-Patterns

```typescript
// BAD: Using string concatenation for dates
const badDate = year + '-' + month + '-' + day;

// GOOD: Use format function
const goodDate = format(date, 'yyyy-MM-dd');

// BAD: Mutating dates directly
date.setDate(date.getDate() + 7);

// GOOD: Use pure functions (returns new Date)
const newDate = addDays(date, 7);

// BAD: Importing entire library
import * as dateFns from 'date-fns';

// GOOD: Import only what you need (tree-shaking)
import { format, addDays } from 'date-fns';

// BAD: Using deprecated string parsing
const date = new Date('2026-01-15'); // Browser-inconsistent

// GOOD: Use parseISO for ISO strings
const date = parseISO('2026-01-15');
```

### When to Use

| Use date-fns When | Avoid When |
|-------------------|------------|
| Bundle size is critical | Need Moment.js API compatibility |
| Prefer functional programming style | Very simple date operations |
| Need comprehensive date operations | Native Intl/Temporal API suffices |
| TypeScript project with strict typing | Runtime performance is critical |

---

## 2. Day.js Patterns

### Overview

Day.js is a lightweight (2KB) Moment.js alternative with the same API. Uses chainable, immutable operations.

### Core Patterns

#### Basic Operations

```typescript
import dayjs from 'dayjs';

// Parse dates
const date = dayjs('2026-01-15');
const now = dayjs();

// Format dates
date.format('MMMM D, YYYY'); // "January 15, 2026"
date.format('YYYY-MM-DD'); // "2026-01-15"

// Date arithmetic (immutable - returns new instance)
const nextWeek = date.add(7, 'day');
const lastMonth = date.subtract(1, 'month');

// Get/Set
const year = date.year(); // 2026
const month = date.month(); // 0 (January)
const day = date.date(); // 15

// Comparisons
date.isBefore(nextWeek); // true
date.isAfter(lastMonth); // true
date.isSame(date, 'day'); // true
```

#### Plugin System

```typescript
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';
import isBetween from 'dayjs/plugin/isBetween';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.extend(isBetween);

// UTC operations
const utcDate = dayjs.utc('2026-01-15T10:30:00Z');

// Timezone operations
const nyDate = dayjs.tz('2026-01-15 10:30', 'America/New_York');
nyDate.tz('Europe/London').format(); // Convert to London time

// Relative time
dayjs('2026-01-01').fromNow(); // "14 days ago"
dayjs('2026-01-01').toNow(); // "in 14 days"

// Duration
const dur = dayjs.duration(7200000); // 2 hours in ms
dur.hours(); // 2
dur.asMinutes(); // 120

// Range checking
date.isBetween('2026-01-01', '2026-01-31'); // true
```

#### TypeScript Configuration

```typescript
// types/dayjs.d.ts - Extend types for plugins
import 'dayjs';

declare module 'dayjs' {
  interface Dayjs {
    tz(timezone?: string, keepLocalTime?: boolean): Dayjs;
    utcOffset(offset: number | string, keepLocalTime?: boolean): Dayjs;
  }
}

// Usage with full type safety
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(timezone);

const date: dayjs.Dayjs = dayjs.tz('2026-01-15', 'America/New_York');
```

### Anti-Patterns

```typescript
// BAD: Not extending plugins before use
dayjs().fromNow(); // Error: fromNow is not a function

// GOOD: Extend plugins first
dayjs.extend(relativeTime);
dayjs().fromNow();

// BAD: Treating dayjs objects as mutable
const date = dayjs();
date.add(7, 'day'); // Returns new instance, original unchanged!
console.log(date); // Still original date

// GOOD: Capture the returned instance
const date = dayjs();
const nextWeek = date.add(7, 'day');

// BAD: Multiple plugin imports in components
// Each component imports and extends

// GOOD: Centralized plugin setup
// lib/dayjs.ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export default dayjs;
```

### When to Use

| Use Day.js When | Avoid When |
|-----------------|------------|
| Migrating from Moment.js | Need smallest possible bundle |
| Prefer chainable API | Prefer functional style |
| Simple date operations | Need complex timezone handling |
| Quick prototyping | Tree-shaking is critical |

---

## 3. Temporal API (New Standard)

### Overview

Temporal is the new JavaScript standard for date/time handling. All objects are immutable with explicit types for different use cases.

**Browser Support (as of Jan 2026):**
- Firefox 139+: Shipped (May 2025)
- Chrome 144+: Shipping (Jan 2026)
- Safari: In development
- Polyfill: `@js-temporal/polyfill` or `temporal-polyfill`

### Core Patterns

#### Basic Types

```typescript
import { Temporal } from '@js-temporal/polyfill';

// PlainDate - Date without time or timezone
const date = Temporal.PlainDate.from('2026-01-15');
const date2 = Temporal.PlainDate.from({ year: 2026, month: 1, day: 15 });

// PlainTime - Time without date or timezone
const time = Temporal.PlainTime.from('10:30:00');
const time2 = Temporal.PlainTime.from({ hour: 10, minute: 30 });

// PlainDateTime - Date and time without timezone
const dateTime = Temporal.PlainDateTime.from('2026-01-15T10:30:00');

// ZonedDateTime - Full date/time with timezone
const zoned = Temporal.ZonedDateTime.from({
  timeZone: 'America/New_York',
  year: 2026,
  month: 1,
  day: 15,
  hour: 10,
  minute: 30,
});

// Instant - Exact point in time (like Unix timestamp)
const instant = Temporal.Instant.from('2026-01-15T15:30:00Z');
const now = Temporal.Now.instant();

// Duration - Length of time
const duration = Temporal.Duration.from({ hours: 2, minutes: 30 });
```

#### Date Arithmetic

```typescript
import { Temporal } from '@js-temporal/polyfill';

const date = Temporal.PlainDate.from('2026-01-15');

// Add/subtract (immutable - returns new instance)
const nextWeek = date.add({ days: 7 }); // 2026-01-22
const lastMonth = date.subtract({ months: 1 }); // 2025-12-15

// With specific field changes
const endOfMonth = date.with({ day: 31 }); // 2026-01-31
const firstOfMonth = date.with({ day: 1 }); // 2026-01-01

// Duration between dates
const duration = date.until(nextWeek); // P7D (7 days)
const days = date.until(nextWeek, { largestUnit: 'day' }).days; // 7

// Comparison
const comparison = Temporal.PlainDate.compare(date, nextWeek); // -1
date.equals(nextWeek); // false
```

#### Timezone Handling

```typescript
import { Temporal } from '@js-temporal/polyfill';

// Current time in specific timezone
const now = Temporal.Now.zonedDateTimeISO('America/New_York');

// Convert between timezones
const nyTime = Temporal.ZonedDateTime.from('2026-01-15T10:30:00[America/New_York]');
const londonTime = nyTime.withTimeZone('Europe/London');
console.log(londonTime.toString()); // 2026-01-15T15:30:00+00:00[Europe/London]

// Get timezone offset
const offset = nyTime.offset; // "-05:00"
const offsetNanoseconds = nyTime.offsetNanoseconds;

// DST-aware operations
const beforeDST = Temporal.ZonedDateTime.from('2026-03-08T01:30:00[America/New_York]');
const afterDST = beforeDST.add({ hours: 2 });
// Correctly handles spring forward
```

#### Duration Operations

```typescript
import { Temporal } from '@js-temporal/polyfill';

// Create durations
const duration1 = Temporal.Duration.from({ hours: 2, minutes: 30 });
const duration2 = Temporal.Duration.from('PT2H30M'); // ISO 8601

// Arithmetic
const total = duration1.add(duration2); // PT5H
const diff = duration1.subtract({ minutes: 30 }); // PT2H

// Get total in specific unit
const totalMinutes = duration1.total('minutes'); // 150
const totalHours = duration1.total('hours'); // 2.5

// Round durations
const rounded = duration1.round({
  largestUnit: 'hour',
  smallestUnit: 'minute',
  roundingMode: 'halfExpand',
});

// Compare durations
const cmp = Temporal.Duration.compare(duration1, duration2); // 0
```

#### Calendar Support

```typescript
import { Temporal } from '@js-temporal/polyfill';

// Hebrew calendar
const hebrewDate = Temporal.PlainDate.from({
  year: 5786,
  month: 5,
  day: 15,
  calendar: 'hebrew',
});

// Convert to ISO calendar
const isoDate = hebrewDate.withCalendar('iso8601');

// Japanese calendar
const japaneseDate = Temporal.PlainDate.from({
  era: 'reiwa',
  eraYear: 8,
  month: 1,
  day: 15,
  calendar: 'japanese',
});
```

### Anti-Patterns

```typescript
// BAD: Mixing Temporal with native Date
const temporal = Temporal.PlainDate.from('2026-01-15');
const native = new Date(temporal); // Won't work as expected

// GOOD: Convert explicitly
const temporal = Temporal.PlainDate.from('2026-01-15');
const instant = temporal.toZonedDateTime('UTC').toInstant();
const native = new Date(Number(instant.epochMilliseconds));

// BAD: Using PlainDateTime when timezone matters
const meeting = Temporal.PlainDateTime.from('2026-01-15T10:30:00');
// Lost timezone context!

// GOOD: Use ZonedDateTime for real-world times
const meeting = Temporal.ZonedDateTime.from('2026-01-15T10:30:00[America/New_York]');

// BAD: Assuming months are 0-indexed (like Date)
const date = Temporal.PlainDate.from({ year: 2026, month: 0, day: 15 });
// Error! Months are 1-indexed in Temporal

// GOOD: Use 1-indexed months
const date = Temporal.PlainDate.from({ year: 2026, month: 1, day: 15 });
```

### When to Use

| Use Temporal When | Avoid When |
|-------------------|------------|
| Building new applications | Supporting legacy browsers without polyfill |
| Complex timezone requirements | Simple date display only |
| Need calendar system support | Bundle size is critical |
| Type safety is important | Team unfamiliar with new API |

---

## 4. Timezone Handling

### Core Principles

1. **Store in UTC** - Always store dates in UTC (ISO 8601 format)
2. **Display in Local** - Convert to user's timezone only for display
3. **Use IANA Identifiers** - Never use abbreviations (EST, PST)

### Core Patterns

#### Storing and Retrieving Dates

```typescript
// Constants for timezone handling
const TIMEZONE_UTC = 'UTC' as const;
const DEFAULT_TIMEZONE = 'America/New_York' as const;

// Store: Convert local to UTC before saving
function toUTC(localDate: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_UTC,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(localDate);
}

// Better: Use ISO string
function toISOUTC(date: Date): string {
  return date.toISOString(); // Always UTC
}

// Retrieve: Convert UTC to local for display
function toLocalTime(utcString: string, timezone: string): string {
  const date = new Date(utcString);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(date);
}
```

#### Detecting User Timezone

```typescript
// Get user's timezone
function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Returns: "America/New_York", "Europe/London", etc.
}

// Get timezone offset in minutes
function getTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
  // Returns: 300 for EST (5 hours behind UTC)
}

// Timezone-aware date creation
interface TimezoneAwareDate {
  utc: string;
  local: string;
  timezone: string;
  offset: number;
}

function createTimezoneAwareDate(date: Date): TimezoneAwareDate {
  const timezone = getUserTimezone();
  return {
    utc: date.toISOString(),
    local: date.toLocaleString('en-US', { timeZone: timezone }),
    timezone,
    offset: date.getTimezoneOffset(),
  };
}
```

#### Working with date-fns-tz

```typescript
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';

const UTC_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'" as const;

// Convert UTC to specific timezone for display
function displayInTimezone(utcDate: Date, timezone: string): string {
  return formatInTimeZone(utcDate, timezone, 'PPpp');
  // "Jan 15, 2026, 10:30:00 AM EST"
}

// Get Date object representing time in specific timezone
function getZonedDate(utcDate: Date, timezone: string): Date {
  return toZonedTime(utcDate, timezone);
}

// Convert zoned time back to UTC for storage
function toUTCDate(localDate: Date, timezone: string): Date {
  return fromZonedTime(localDate, timezone);
}

// Example workflow
const userTimezone = 'America/Los_Angeles';
const utcDate = new Date('2026-01-15T15:30:00Z');

// Display to user (converts UTC to their timezone)
const display = displayInTimezone(utcDate, userTimezone);
// "Jan 15, 2026, 7:30:00 AM PST"

// User enters new time in their local timezone
const userInput = new Date(2026, 0, 15, 10, 0, 0); // 10 AM local
const utcToStore = toUTCDate(userInput, userTimezone);
// Stores as 6 PM UTC
```

#### DST-Safe Operations

```typescript
import { addDays, addHours } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

// DST transition example (US Spring Forward: March 8, 2026)
const beforeDST = new Date('2026-03-08T06:00:00Z'); // 1 AM EST
const afterDST = addHours(beforeDST, 3); // Should be 5 AM EDT (skips 2-3 AM)

// Safe way to add days across DST
function addDaysSafe(date: Date, days: number, timezone: string): Date {
  // Add days in UTC, then format for timezone
  const result = addDays(date, days);
  return result;
}

// Check if date is in DST
function isDST(date: Date, timezone: string): boolean {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);

  const janOffset = formatInTimeZone(jan, timezone, 'xxx');
  const julOffset = formatInTimeZone(jul, timezone, 'xxx');
  const dateOffset = formatInTimeZone(date, timezone, 'xxx');

  return dateOffset !== janOffset && dateOffset === julOffset;
}
```

### Anti-Patterns

```typescript
// BAD: Using timezone abbreviations
const options = { timeZone: 'EST' }; // Ambiguous!

// GOOD: Use IANA timezone identifiers
const options = { timeZone: 'America/New_York' };

// BAD: Storing local time strings
localStorage.setItem('lastVisit', new Date().toString());
// "Thu Jan 15 2026 10:30:00 GMT-0500 (Eastern Standard Time)"

// GOOD: Store ISO UTC strings
localStorage.setItem('lastVisit', new Date().toISOString());
// "2026-01-15T15:30:00.000Z"

// BAD: Calculating timezone offset manually
const offset = -5 * 60; // Doesn't account for DST!

// GOOD: Use library or Intl API
const offset = new Date().getTimezoneOffset();

// BAD: Assuming server and client have same timezone
const serverDate = new Date(serverTimestamp); // Wrong if different TZ

// GOOD: Always use UTC for data exchange
const serverDate = new Date(isoUtcString);
```

### When to Handle Timezones

| Handle Timezones When | Skip When |
|----------------------|-----------|
| Scheduling meetings across regions | Displaying relative times ("2 hours ago") |
| Storing user-entered times | Date-only operations (birthdays) |
| Log timestamps | Internal calculations |
| Event start/end times | Comparing dates only |

---

## 5. Date Range Patterns

### Core Patterns

#### Date Range Type

```typescript
// Date range interface
interface DateRange {
  start: Date;
  end: Date;
}

// Strict date range with validation
interface StrictDateRange {
  readonly start: Date;
  readonly end: Date;
}

function createDateRange(start: Date, end: Date): StrictDateRange {
  if (start > end) {
    throw new Error('Start date must be before end date');
  }
  return Object.freeze({ start, end });
}

// Nullable range (for "from X onwards" or "until Y")
interface OpenDateRange {
  start: Date | null;
  end: Date | null;
}
```

#### Range Operations

```typescript
import {
  isWithinInterval,
  areIntervalsOverlapping,
  eachDayOfInterval,
  differenceInDays,
  max,
  min,
} from 'date-fns';

// Check if date is in range
function isInRange(date: Date, range: DateRange): boolean {
  return isWithinInterval(date, { start: range.start, end: range.end });
}

// Check if ranges overlap
function rangesOverlap(range1: DateRange, range2: DateRange): boolean {
  return areIntervalsOverlapping(
    { start: range1.start, end: range1.end },
    { start: range2.start, end: range2.end }
  );
}

// Get all dates in range
function getDatesInRange(range: DateRange): Date[] {
  return eachDayOfInterval({ start: range.start, end: range.end });
}

// Get range duration in days
function getRangeDuration(range: DateRange): number {
  return differenceInDays(range.end, range.start);
}

// Merge overlapping ranges
function mergeRanges(ranges: DateRange[]): DateRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: DateRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping - extend the end
      last.end = max([last.end, current.end]);
    } else {
      // Non-overlapping - add new range
      merged.push(current);
    }
  }

  return merged;
}

// Find intersection of ranges
function intersectRanges(range1: DateRange, range2: DateRange): DateRange | null {
  const start = max([range1.start, range2.start]);
  const end = min([range1.end, range2.end]);

  if (start > end) return null;
  return { start, end };
}
```

#### Preset Ranges

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
  subMonths,
  subYears,
} from 'date-fns';

type PresetRange = 'today' | 'yesterday' | 'last7days' | 'last30days' |
  'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' |
  'thisQuarter' | 'lastQuarter' | 'thisYear' | 'lastYear';

function getPresetRange(preset: PresetRange, referenceDate: Date = new Date()): DateRange {
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
      start: startOfDay(subDays(today, 6)),
      end: endOfDay(today),
    },
    last30days: {
      start: startOfDay(subDays(today, 29)),
      end: endOfDay(today),
    },
    thisWeek: {
      start: startOfWeek(today, { weekStartsOn: 1 }), // Monday
      end: endOfWeek(today, { weekStartsOn: 1 }),
    },
    lastWeek: {
      start: startOfWeek(subDays(today, 7), { weekStartsOn: 1 }),
      end: endOfWeek(subDays(today, 7), { weekStartsOn: 1 }),
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
      start: startOfQuarter(subMonths(today, 3)),
      end: endOfQuarter(subMonths(today, 3)),
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
```

### Anti-Patterns

```typescript
// BAD: Not handling end-of-day for inclusive ranges
const range = { start: new Date('2026-01-01'), end: new Date('2026-01-31') };
// Misses most of Jan 31!

// GOOD: Use end of day for inclusive ranges
const range = {
  start: startOfDay(new Date('2026-01-01')),
  end: endOfDay(new Date('2026-01-31')),
};

// BAD: Mutating range dates
range.start.setDate(1); // Mutates original!

// GOOD: Create new range
const newRange = { ...range, start: setDate(range.start, 1) };

// BAD: Not validating range order
function getRange(start: Date, end: Date) {
  return { start, end }; // Could be inverted!
}

// GOOD: Validate and normalize
function getRange(start: Date, end: Date): DateRange {
  if (start > end) {
    return { start: end, end: start }; // Auto-correct
  }
  return { start, end };
}
```

### When to Use

| Use Date Ranges When | Consider Alternatives When |
|---------------------|---------------------------|
| Filtering data by period | Single date selection |
| Booking/reservation systems | Point-in-time events |
| Analytics dashboards | Recurring patterns |
| Event duration tracking | Relative time queries |

---

## 6. Calendar/Datepicker Patterns

### Core Patterns

#### Calendar Grid Generation

```typescript
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  formattedDate: string;
}

interface CalendarMonth {
  year: number;
  month: number;
  weeks: CalendarDay[][];
}

function generateCalendarMonth(
  referenceDate: Date,
  selectedDate: Date | null,
  disabledDates: Date[] = [],
  weekStartsOn: 0 | 1 = 0 // 0 = Sunday, 1 = Monday
): CalendarMonth {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const calendarDays: CalendarDay[] = days.map((date) => ({
    date,
    isCurrentMonth: isSameMonth(date, referenceDate),
    isToday: isToday(date),
    isSelected: selectedDate ? isSameDay(date, selectedDate) : false,
    isDisabled: disabledDates.some((d) => isSameDay(d, date)),
    formattedDate: format(date, 'd'),
  }));

  // Split into weeks
  const DAYS_PER_WEEK = 7;
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < calendarDays.length; i += DAYS_PER_WEEK) {
    weeks.push(calendarDays.slice(i, i + DAYS_PER_WEEK));
  }

  return {
    year: referenceDate.getFullYear(),
    month: referenceDate.getMonth(),
    weeks,
  };
}
```

#### Date Constraints

```typescript
import { isBefore, isAfter, startOfDay, isWeekend, getDay } from 'date-fns';

interface DateConstraints {
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  disabledDaysOfWeek?: number[]; // 0-6, where 0 is Sunday
  disableWeekends?: boolean;
  disablePastDates?: boolean;
  disableFutureDates?: boolean;
}

function isDateDisabled(date: Date, constraints: DateConstraints): boolean {
  const normalizedDate = startOfDay(date);
  const today = startOfDay(new Date());

  // Check min/max bounds
  if (constraints.minDate && isBefore(normalizedDate, startOfDay(constraints.minDate))) {
    return true;
  }
  if (constraints.maxDate && isAfter(normalizedDate, startOfDay(constraints.maxDate))) {
    return true;
  }

  // Check past/future
  if (constraints.disablePastDates && isBefore(normalizedDate, today)) {
    return true;
  }
  if (constraints.disableFutureDates && isAfter(normalizedDate, today)) {
    return true;
  }

  // Check weekends
  if (constraints.disableWeekends && isWeekend(normalizedDate)) {
    return true;
  }

  // Check specific days of week
  if (constraints.disabledDaysOfWeek?.includes(getDay(normalizedDate))) {
    return true;
  }

  // Check specific disabled dates
  if (constraints.disabledDates?.some((d) => isSameDay(d, normalizedDate))) {
    return true;
  }

  return false;
}
```

#### React Datepicker Integration (Example)

```typescript
import { useState, useCallback } from 'react';
import { format, parse, isValid } from 'date-fns';

interface UseDatePickerOptions {
  initialDate?: Date;
  dateFormat?: string;
  constraints?: DateConstraints;
  onChange?: (date: Date | null) => void;
}

interface UseDatePickerReturn {
  selectedDate: Date | null;
  inputValue: string;
  isOpen: boolean;
  calendarMonth: Date;
  handleInputChange: (value: string) => void;
  handleDateSelect: (date: Date) => void;
  handleMonthChange: (direction: 'prev' | 'next') => void;
  toggleCalendar: () => void;
  clear: () => void;
}

const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';

function useDatePicker(options: UseDatePickerOptions = {}): UseDatePickerReturn {
  const {
    initialDate,
    dateFormat = DEFAULT_DATE_FORMAT,
    constraints = {},
    onChange,
  } = options;

  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate ?? null);
  const [inputValue, setInputValue] = useState(
    initialDate ? format(initialDate, dateFormat) : ''
  );
  const [isOpen, setIsOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(initialDate ?? new Date());

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);

    const parsed = parse(value, dateFormat, new Date());
    if (isValid(parsed) && !isDateDisabled(parsed, constraints)) {
      setSelectedDate(parsed);
      setCalendarMonth(parsed);
      onChange?.(parsed);
    }
  }, [dateFormat, constraints, onChange]);

  const handleDateSelect = useCallback((date: Date) => {
    if (isDateDisabled(date, constraints)) return;

    setSelectedDate(date);
    setInputValue(format(date, dateFormat));
    setIsOpen(false);
    onChange?.(date);
  }, [dateFormat, constraints, onChange]);

  const handleMonthChange = useCallback((direction: 'prev' | 'next') => {
    setCalendarMonth((current) => {
      const newMonth = new Date(current);
      newMonth.setMonth(current.getMonth() + (direction === 'next' ? 1 : -1));
      return newMonth;
    });
  }, []);

  const toggleCalendar = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const clear = useCallback(() => {
    setSelectedDate(null);
    setInputValue('');
    onChange?.(null);
  }, [onChange]);

  return {
    selectedDate,
    inputValue,
    isOpen,
    calendarMonth,
    handleInputChange,
    handleDateSelect,
    handleMonthChange,
    toggleCalendar,
    clear,
  };
}
```

### Anti-Patterns

```typescript
// BAD: Hardcoding week start
const weekStart = 0; // Sunday - wrong for many locales!

// GOOD: Make it configurable
const weekStart = userLocale === 'en-US' ? 0 : 1;

// BAD: Not handling keyboard navigation
<div onClick={selectDate}>15</div>

// GOOD: Full keyboard support
<button
  onClick={selectDate}
  onKeyDown={handleKeyNavigation}
  aria-label={format(date, 'EEEE, MMMM d, yyyy')}
  role="gridcell"
  tabIndex={isSelected ? 0 : -1}
>
  15
</button>

// BAD: Not announcing changes to screen readers
setSelectedDate(date);

// GOOD: Announce to assistive technology
setSelectedDate(date);
announceToScreenReader(`Selected ${format(date, 'MMMM d, yyyy')}`);
```

### When to Use

| Use Custom Calendar When | Use Library When |
|-------------------------|------------------|
| Unique design requirements | Standard functionality needed |
| Complex business rules | Time constraints |
| Need full control | Accessibility out of the box |
| Learning/education | Production applications |

---

## 7. Relative Time Formatting

### Core Patterns

#### Using Intl.RelativeTimeFormat

```typescript
// Unit thresholds in seconds
const TIME_UNITS = {
  year: 31536000,    // 365 * 24 * 60 * 60
  month: 2592000,    // 30 * 24 * 60 * 60
  week: 604800,      // 7 * 24 * 60 * 60
  day: 86400,        // 24 * 60 * 60
  hour: 3600,        // 60 * 60
  minute: 60,
  second: 1,
} as const;

type TimeUnit = keyof typeof TIME_UNITS;

function getRelativeTime(
  date: Date,
  locale: string = 'en',
  style: 'long' | 'short' | 'narrow' = 'long',
  numeric: 'always' | 'auto' = 'auto'
): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { style, numeric });
  const diffInSeconds = Math.floor((date.getTime() - Date.now()) / 1000);
  const absoluteDiff = Math.abs(diffInSeconds);

  // Find appropriate unit
  for (const [unit, secondsInUnit] of Object.entries(TIME_UNITS)) {
    if (absoluteDiff >= secondsInUnit || unit === 'second') {
      const value = Math.round(diffInSeconds / secondsInUnit);
      return formatter.format(value, unit as Intl.RelativeTimeFormatUnit);
    }
  }

  return formatter.format(0, 'second');
}

// Examples:
// getRelativeTime(new Date(Date.now() - 3600000)) => "1 hour ago"
// getRelativeTime(new Date(Date.now() - 86400000), 'en', 'long', 'auto') => "yesterday"
// getRelativeTime(new Date(Date.now() + 604800000)) => "in 1 week"
```

#### Smart Relative Time with Fallback

```typescript
import { format, differenceInSeconds, differenceInMinutes, differenceInHours,
  differenceInDays, differenceInWeeks, differenceInMonths } from 'date-fns';

interface RelativeTimeOptions {
  locale?: string;
  maxDays?: number; // After this many days, show absolute date
  absoluteFormat?: string;
}

const DEFAULT_MAX_DAYS = 7;
const DEFAULT_ABSOLUTE_FORMAT = 'MMM d, yyyy';

function getSmartRelativeTime(
  date: Date,
  options: RelativeTimeOptions = {}
): string {
  const {
    locale = 'en',
    maxDays = DEFAULT_MAX_DAYS,
    absoluteFormat = DEFAULT_ABSOLUTE_FORMAT,
  } = options;

  const now = new Date();
  const diffDays = Math.abs(differenceInDays(date, now));

  // Show absolute date if beyond threshold
  if (diffDays > maxDays) {
    return format(date, absoluteFormat);
  }

  return getRelativeTime(date, locale, 'long', 'auto');
}

// With live updates
function useRelativeTime(date: Date, updateIntervalMs: number = 60000) {
  const [relativeTime, setRelativeTime] = useState(() => getSmartRelativeTime(date));

  useEffect(() => {
    const interval = setInterval(() => {
      setRelativeTime(getSmartRelativeTime(date));
    }, updateIntervalMs);

    return () => clearInterval(interval);
  }, [date, updateIntervalMs]);

  return relativeTime;
}
```

#### date-fns Relative Time

```typescript
import {
  formatDistance,
  formatDistanceToNow,
  formatDistanceStrict,
  formatRelative,
} from 'date-fns';
import { enUS, de, ja } from 'date-fns/locale';

const pastDate = new Date(2026, 0, 1);
const now = new Date(2026, 0, 15);

// Human-readable distance
formatDistance(pastDate, now); // "14 days"
formatDistance(pastDate, now, { addSuffix: true }); // "14 days ago"

// Distance from now
formatDistanceToNow(pastDate); // "14 days"
formatDistanceToNow(pastDate, { addSuffix: true }); // "14 days ago"

// Strict distance (no "about" or "almost")
formatDistanceStrict(pastDate, now); // "14 days"
formatDistanceStrict(pastDate, now, { unit: 'hour' }); // "336 hours"

// Relative to now with day context
formatRelative(pastDate, now); // "last Thursday at 12:00 AM"

// With locale
formatDistanceToNow(pastDate, { locale: de, addSuffix: true }); // "vor 14 Tagen"
formatDistanceToNow(pastDate, { locale: ja, addSuffix: true }); // "14日前"
```

### Anti-Patterns

```typescript
// BAD: Hardcoding relative time strings
function getRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' minutes ago';
  // ... non-localizable!
}

// GOOD: Use Intl or library
function getRelative(date: Date, locale: string): string {
  return getRelativeTime(date, locale);
}

// BAD: Not updating relative times
<span>{formatDistanceToNow(createdAt)}</span>
// Shows "5 minutes ago" forever

// GOOD: Update periodically
const relativeTime = useRelativeTime(createdAt);
<span>{relativeTime}</span>

// BAD: Using relative time for precision-critical displays
<span>Meeting starts {formatDistanceToNow(meetingTime)}</span>
// "in about 2 hours" - not helpful!

// GOOD: Show exact time for important events
<span>Meeting starts at {format(meetingTime, 'h:mm a')} ({formatDistanceToNow(meetingTime, { addSuffix: true })})</span>
// "Meeting starts at 2:30 PM (in 2 hours)"
```

### When to Use

| Use Relative Time When | Use Absolute Time When |
|-----------------------|------------------------|
| Social media timestamps | Appointments/meetings |
| Activity feeds | Legal/financial documents |
| Comments/notifications | Historical records |
| "Last updated" indicators | Scheduling |

---

## 8. Date Validation

### Core Patterns

#### Basic Validation

```typescript
import { isValid, parse, isAfter, isBefore, isDate } from 'date-fns';

// Check if value is a valid Date
function isValidDate(value: unknown): value is Date {
  return isDate(value) && isValid(value);
}

// Parse and validate string
function parseAndValidate(
  dateString: string,
  formatString: string
): Date | null {
  const parsed = parse(dateString, formatString, new Date());
  return isValid(parsed) ? parsed : null;
}

// Validate date is within range
function isDateInRange(date: Date, min: Date, max: Date): boolean {
  return !isBefore(date, min) && !isAfter(date, max);
}

// Comprehensive validation
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  date: Date | null;
}

function validateDate(
  value: string,
  options: {
    format?: string;
    minDate?: Date;
    maxDate?: Date;
    required?: boolean;
  } = {}
): ValidationResult {
  const errors: string[] = [];
  const {
    format: dateFormat = 'yyyy-MM-dd',
    minDate,
    maxDate,
    required = false,
  } = options;

  // Empty check
  if (!value || value.trim() === '') {
    if (required) {
      errors.push('Date is required');
    }
    return { isValid: !required, errors, date: null };
  }

  // Parse
  const parsed = parse(value, dateFormat, new Date());
  if (!isValid(parsed)) {
    errors.push(`Invalid date format. Expected: ${dateFormat}`);
    return { isValid: false, errors, date: null };
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
```

#### Zod Schema Validation

```typescript
import { z } from 'zod';
import { parse, isValid, isBefore, isAfter } from 'date-fns';

// Basic date string schema
const dateStringSchema = z.string().refine(
  (val) => {
    const parsed = parse(val, 'yyyy-MM-dd', new Date());
    return isValid(parsed);
  },
  { message: 'Invalid date format. Use YYYY-MM-DD' }
);

// Date string that transforms to Date object
const dateSchema = z
  .string()
  .transform((val) => parse(val, 'yyyy-MM-dd', new Date()))
  .refine((date) => isValid(date), { message: 'Invalid date' });

// Date with range constraints
function dateRangeSchema(min?: Date, max?: Date) {
  return z
    .string()
    .transform((val) => parse(val, 'yyyy-MM-dd', new Date()))
    .refine((date) => isValid(date), { message: 'Invalid date' })
    .refine(
      (date) => !min || !isBefore(date, min),
      { message: `Date must be after ${min?.toISOString().split('T')[0]}` }
    )
    .refine(
      (date) => !max || !isAfter(date, max),
      { message: `Date must be before ${max?.toISOString().split('T')[0]}` }
    );
}

// Date range schema (start and end)
const dateRangePairSchema = z
  .object({
    start: dateSchema,
    end: dateSchema,
  })
  .refine(
    (data) => !isAfter(data.start, data.end),
    { message: 'Start date must be before end date' }
  );

// ISO timestamp schema
const isoTimestampSchema = z.string().datetime({ message: 'Invalid ISO timestamp' });

// Usage
const eventSchema = z.object({
  name: z.string().min(1),
  date: dateSchema,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
});

// With safeParse
const result = eventSchema.safeParse({
  name: 'Meeting',
  date: '2026-01-15',
  startTime: '10:00',
  endTime: '11:00',
});

if (result.success) {
  console.log(result.data.date); // Date object
} else {
  console.log(result.error.issues);
}
```

#### React Hook Form Integration

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { parse, isValid, isAfter, addYears, subYears } from 'date-fns';

const MIN_AGE_YEARS = 18;
const MAX_AGE_YEARS = 120;

const birthDateSchema = z.object({
  birthDate: z
    .string()
    .min(1, 'Birth date is required')
    .refine(
      (val) => isValid(parse(val, 'yyyy-MM-dd', new Date())),
      'Invalid date format'
    )
    .refine(
      (val) => {
        const date = parse(val, 'yyyy-MM-dd', new Date());
        const minDate = subYears(new Date(), MAX_AGE_YEARS);
        return isAfter(date, minDate);
      },
      `You must be under ${MAX_AGE_YEARS} years old`
    )
    .refine(
      (val) => {
        const date = parse(val, 'yyyy-MM-dd', new Date());
        const maxDate = subYears(new Date(), MIN_AGE_YEARS);
        return !isAfter(date, maxDate);
      },
      `You must be at least ${MIN_AGE_YEARS} years old`
    ),
});

type BirthDateForm = z.infer<typeof birthDateSchema>;

function BirthDateInput() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BirthDateForm>({
    resolver: zodResolver(birthDateSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input type="date" {...register('birthDate')} />
      {errors.birthDate && <span>{errors.birthDate.message}</span>}
    </form>
  );
}
```

### Anti-Patterns

```typescript
// BAD: Using Date constructor for validation
const isValid = !isNaN(new Date(userInput).getTime());
// Accepts many invalid formats like "2026/1/5" inconsistently

// GOOD: Use strict parsing
const parsed = parse(userInput, 'yyyy-MM-dd', new Date());
const isValid = isValid(parsed);

// BAD: Trusting client-side validation only
if (isValidDate(input)) {
  await saveToDatabase(input);
}

// GOOD: Validate on both client and server
// Client: immediate feedback
// Server: security and data integrity

// BAD: Not handling edge cases
parse('2026-02-30', 'yyyy-MM-dd', new Date()); // Returns March 2!

// GOOD: Verify the date matches input
function strictParse(dateString: string, formatStr: string): Date | null {
  const parsed = parse(dateString, formatStr, new Date());
  if (!isValid(parsed)) return null;

  // Verify round-trip
  if (format(parsed, formatStr) !== dateString) return null;

  return parsed;
}
```

### When to Use

| Validation Type | Use Case |
|----------------|----------|
| Format validation | User input fields |
| Range validation | Age restrictions, booking windows |
| Business rules | Working days, holidays |
| Cross-field | Start/end dates, dependencies |

---

## 9. Recurring Date Patterns

### Core Patterns

#### Using rrule.js

```typescript
import { RRule, RRuleSet, rrulestr } from 'rrule';

// Daily recurrence
const dailyRule = new RRule({
  freq: RRule.DAILY,
  interval: 1,
  dtstart: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
  until: new Date(Date.UTC(2026, 11, 31)),
});

// Weekly on specific days
const weeklyMWF = new RRule({
  freq: RRule.WEEKLY,
  interval: 1,
  byweekday: [RRule.MO, RRule.WE, RRule.FR],
  dtstart: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
  count: 52, // 52 occurrences
});

// Monthly on the 15th
const monthly15th = new RRule({
  freq: RRule.MONTHLY,
  interval: 1,
  bymonthday: 15,
  dtstart: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
});

// Monthly on the second Tuesday
const secondTuesday = new RRule({
  freq: RRule.MONTHLY,
  interval: 1,
  byweekday: [RRule.TU.nth(2)], // 2nd Tuesday
  dtstart: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
});

// Get occurrences
const dates = dailyRule.all(); // All dates
const next10 = dailyRule.all((date, i) => i < 10); // First 10
const between = dailyRule.between(
  new Date(Date.UTC(2026, 0, 1)),
  new Date(Date.UTC(2026, 1, 28))
);

// To/from iCalendar string
const rruleString = dailyRule.toString();
// "DTSTART:20260115T100000Z\nRRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20261231T000000Z"

const parsed = rrulestr('FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10');
```

#### Rule Sets with Exceptions

```typescript
import { RRule, RRuleSet } from 'rrule';

// Create a rule set
const ruleSet = new RRuleSet();

// Add main rule
ruleSet.rrule(new RRule({
  freq: RRule.WEEKLY,
  byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR],
  dtstart: new Date(Date.UTC(2026, 0, 1, 9, 0, 0)),
}));

// Add exception dates (holidays)
ruleSet.exdate(new Date(Date.UTC(2026, 0, 20))); // MLK Day
ruleSet.exdate(new Date(Date.UTC(2026, 1, 17))); // Presidents Day
ruleSet.exdate(new Date(Date.UTC(2026, 6, 3))); // Independence Day (observed)

// Add extra dates (makeup days)
ruleSet.rdate(new Date(Date.UTC(2026, 0, 24, 9, 0, 0)));

// Get all dates
const workdays = ruleSet.all();
```

#### TypeScript Types for Recurrence

```typescript
// Recurrence frequency
type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Day of week
type DayOfWeek = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

// Recurrence rule definition
interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  startDate: Date;
  endDate?: Date;
  count?: number;
  byWeekday?: DayOfWeek[];
  byMonthDay?: number[];
  byMonth?: number[];
  bySetPos?: number; // For "nth weekday of month"
  exceptions?: Date[];
  timezone?: string;
}

// Convert to RRule
function toRRule(rule: RecurrenceRule): RRule {
  const weekdayMap: Record<DayOfWeek, typeof RRule.MO> = {
    MO: RRule.MO,
    TU: RRule.TU,
    WE: RRule.WE,
    TH: RRule.TH,
    FR: RRule.FR,
    SA: RRule.SA,
    SU: RRule.SU,
  };

  const freqMap: Record<RecurrenceFrequency, number> = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
    yearly: RRule.YEARLY,
  };

  return new RRule({
    freq: freqMap[rule.frequency],
    interval: rule.interval,
    dtstart: rule.startDate,
    until: rule.endDate,
    count: rule.count,
    byweekday: rule.byWeekday?.map((d) => weekdayMap[d]),
    bymonthday: rule.byMonthDay,
    bymonth: rule.byMonth,
    bysetpos: rule.bySetPos,
    tzid: rule.timezone,
  });
}

// Human-readable description
function describeRecurrence(rule: RecurrenceRule): string {
  const rrule = toRRule(rule);
  return rrule.toText();
  // "every week on Monday, Wednesday, Friday"
}
```

#### Common Recurrence Patterns

```typescript
// Preset recurrence patterns
const RECURRENCE_PRESETS = {
  everyDay: {
    frequency: 'daily' as const,
    interval: 1,
  },
  everyWeekday: {
    frequency: 'weekly' as const,
    interval: 1,
    byWeekday: ['MO', 'TU', 'WE', 'TH', 'FR'] as DayOfWeek[],
  },
  everyWeek: {
    frequency: 'weekly' as const,
    interval: 1,
  },
  everyTwoWeeks: {
    frequency: 'weekly' as const,
    interval: 2,
  },
  everyMonth: {
    frequency: 'monthly' as const,
    interval: 1,
  },
  everyYear: {
    frequency: 'yearly' as const,
    interval: 1,
  },
};

// Factory function
function createRecurrence(
  preset: keyof typeof RECURRENCE_PRESETS,
  startDate: Date,
  options?: { count?: number; endDate?: Date }
): RecurrenceRule {
  return {
    ...RECURRENCE_PRESETS[preset],
    startDate,
    ...options,
  };
}
```

### Anti-Patterns

```typescript
// BAD: Storing all occurrences
const event = {
  title: 'Daily Standup',
  dates: [...], // 365 dates for a year!
};

// GOOD: Store the rule, compute occurrences
const event = {
  title: 'Daily Standup',
  rrule: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR',
  dtstart: '2026-01-01T09:00:00Z',
};

// BAD: Not handling timezone in recurrence
new RRule({
  freq: RRule.DAILY,
  dtstart: new Date(2026, 0, 1, 9, 0, 0), // Local time - ambiguous!
});

// GOOD: Use UTC or explicit timezone
new RRule({
  freq: RRule.DAILY,
  dtstart: new Date(Date.UTC(2026, 0, 1, 14, 0, 0)), // 9 AM EST = 14:00 UTC
  tzid: 'America/New_York',
});

// BAD: Infinite recurrence without limit
new RRule({
  freq: RRule.DAILY,
  dtstart: new Date(),
  // No until or count - infinite!
});

// GOOD: Always set bounds
new RRule({
  freq: RRule.DAILY,
  dtstart: new Date(),
  count: 365, // Or use until
});
```

### When to Use

| Use Recurrence When | Use Individual Dates When |
|--------------------|-----------------------|
| Calendar events | One-time events |
| Subscriptions/billing | Irregular schedules |
| Scheduled tasks | Manual scheduling |
| Shift patterns | Ad-hoc meetings |

---

## 10. Internationalized Dates

### Core Patterns

#### Using Intl.DateTimeFormat

```typescript
// Basic formatting with locale
function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale).format(date);
}

// Examples:
formatDate(new Date(2026, 0, 15), 'en-US'); // "1/15/2026"
formatDate(new Date(2026, 0, 15), 'en-GB'); // "15/01/2026"
formatDate(new Date(2026, 0, 15), 'de-DE'); // "15.1.2026"
formatDate(new Date(2026, 0, 15), 'ja-JP'); // "2026/1/15"

// With options
function formatDateTime(
  date: Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

// Style shortcuts (dateStyle/timeStyle)
formatDateTime(new Date(), 'en-US', { dateStyle: 'full' });
// "Thursday, January 15, 2026"

formatDateTime(new Date(), 'en-US', { dateStyle: 'long' });
// "January 15, 2026"

formatDateTime(new Date(), 'en-US', { dateStyle: 'medium' });
// "Jan 15, 2026"

formatDateTime(new Date(), 'en-US', { dateStyle: 'short' });
// "1/15/26"

// Full date and time
formatDateTime(new Date(), 'en-US', {
  dateStyle: 'full',
  timeStyle: 'long',
});
// "Thursday, January 15, 2026 at 10:30:00 AM EST"

// Component options (fine-grained control)
formatDateTime(new Date(), 'en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});
// "Thursday, January 15, 2026, 10:30 AM EST"
```

#### Date Range Formatting

```typescript
function formatDateRange(
  start: Date,
  end: Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const formatter = new Intl.DateTimeFormat(locale, options);
  return formatter.formatRange(start, end);
}

// Examples:
const start = new Date(2026, 0, 15);
const end = new Date(2026, 0, 20);

formatDateRange(start, end, 'en-US', { dateStyle: 'medium' });
// "Jan 15 – 20, 2026" (smart - omits repeated parts)

formatDateRange(start, new Date(2026, 1, 15), 'en-US', { dateStyle: 'medium' });
// "Jan 15 – Feb 15, 2026"

formatDateRange(start, new Date(2027, 0, 15), 'en-US', { dateStyle: 'medium' });
// "Jan 15, 2026 – Jan 15, 2027"
```

#### Locale-Aware Formatting with date-fns

```typescript
import { format, formatRelative } from 'date-fns';
import {
  enUS, enGB, de, fr, es, ja, zhCN, ar, ko, pt, ru, it
} from 'date-fns/locale';

// Locale map
const locales: Record<string, Locale> = {
  'en-US': enUS,
  'en-GB': enGB,
  'de-DE': de,
  'fr-FR': fr,
  'es-ES': es,
  'ja-JP': ja,
  'zh-CN': zhCN,
  'ar-SA': ar,
  'ko-KR': ko,
  'pt-BR': pt,
  'ru-RU': ru,
  'it-IT': it,
};

function formatLocalized(
  date: Date,
  formatString: string,
  localeCode: string
): string {
  const locale = locales[localeCode] || enUS;
  return format(date, formatString, { locale });
}

// Examples:
const date = new Date(2026, 0, 15);

formatLocalized(date, 'PPPP', 'en-US'); // "Thursday, January 15th, 2026"
formatLocalized(date, 'PPPP', 'de-DE'); // "Donnerstag, 15. Januar 2026"
formatLocalized(date, 'PPPP', 'ja-JP'); // "2026年1月15日木曜日"
formatLocalized(date, 'PPPP', 'ar-SA'); // "الخميس، 15 يناير 2026"

// Relative formatting
formatRelative(date, new Date(), { locale: de });
// "letzten Donnerstag um 00:00"
```

#### Utility Functions for i18n

```typescript
// Get localized month names
function getMonthNames(locale: string, format: 'long' | 'short' | 'narrow' = 'long'): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: format });
  return Array.from({ length: 12 }, (_, i) =>
    formatter.format(new Date(2026, i, 1))
  );
}

// Get localized weekday names
function getWeekdayNames(
  locale: string,
  format: 'long' | 'short' | 'narrow' = 'long',
  weekStartsOn: number = 0
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: format });
  // Start from a known Sunday (Jan 4, 2026)
  const baseSunday = new Date(2026, 0, 4);

  return Array.from({ length: 7 }, (_, i) => {
    const dayIndex = (i + weekStartsOn) % 7;
    const date = new Date(baseSunday);
    date.setDate(baseSunday.getDate() + dayIndex);
    return formatter.format(date);
  });
}

// Get first day of week for locale
function getFirstDayOfWeek(locale: string): number {
  // Use Intl.Locale if available (newer browsers)
  try {
    const localeObj = new Intl.Locale(locale);
    // @ts-ignore - weekInfo is newer API
    return localeObj.weekInfo?.firstDay ?? 0;
  } catch {
    // Fallback based on common patterns
    const sundayFirst = ['en-US', 'en-CA', 'ja-JP', 'ko-KR', 'zh-CN'];
    return sundayFirst.includes(locale) ? 0 : 1;
  }
}

// Format with user's preferred format
function formatUserDate(date: Date): string {
  const userLocale = navigator.language;
  return new Intl.DateTimeFormat(userLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
```

### Anti-Patterns

```typescript
// BAD: Hardcoding date format
function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}
// "1/15/2026" - wrong for most of the world!

// GOOD: Use locale-aware formatting
function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale).format(date);
}

// BAD: Assuming month/day order
const [month, day, year] = dateString.split('/'); // Only works for US!

// GOOD: Parse with known format or use library
const date = parse(dateString, 'yyyy-MM-dd', new Date()); // Unambiguous ISO format

// BAD: Hardcoding week start
const weekStart = 0; // Sunday - wrong for most countries

// GOOD: Use locale-appropriate week start
const weekStart = getFirstDayOfWeek(userLocale);

// BAD: Not handling RTL languages
<span>Date: {formattedDate}</span>
// Breaks in Arabic, Hebrew

// GOOD: Use CSS direction or Intl
<span dir="auto">Date: {formattedDate}</span>
```

### When to Use

| Use Full i18n When | Lighter Approach When |
|-------------------|----------------------|
| Public-facing apps | Internal tools |
| Multi-region users | Single-locale apps |
| Legal/compliance needs | Prototyping |
| E-commerce | Date-time not critical |

---

## Summary Decision Tree

```
Need date/time handling in your app?
│
├─ Is the Temporal API available (no polyfill needed)?
│   ├─ YES → Use Temporal (future-proof standard)
│   └─ NO → Continue below
│
├─ Migrating from Moment.js?
│   ├─ YES → Use Day.js (same API)
│   └─ NO → Continue below
│
├─ Is bundle size critical?
│   ├─ YES → Use date-fns (tree-shakeable)
│   └─ NO → Continue below
│
├─ Need complex timezone handling?
│   ├─ YES → Use date-fns + date-fns-tz OR Luxon
│   └─ NO → Continue below
│
├─ Just formatting for display?
│   ├─ YES → Use Intl.DateTimeFormat (zero bundle cost)
│   └─ NO → Use date-fns (most comprehensive)
│
└─ Need recurring dates?
    └─ Use rrule.js (iCalendar standard)
```

---

## Sources

- [date-fns Documentation](https://date-fns.org/)
- [date-fns v3 Blog Post](https://blog.date-fns.org/v3-is-out/)
- [date-fns-tz Guide](https://generalistprogrammer.com/tutorials/date-fns-tz-npm-package-guide)
- [Day.js vs date-fns Comparison](https://how-to.dev/dayjs-vs-date-fns)
- [npm-compare: Date Libraries](https://npm-compare.com/date-fns,dayjs,moment)
- [MDN: Temporal API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)
- [JavaScript Temporal is Coming (MDN Blog)](https://developer.mozilla.org/en-US/blog/javascript-temporal-is-coming/)
- [Temporal API Browser Support](https://caniuse.com/temporal)
- [Temporal Deep Dive (DEV)](https://dev.to/pockit_tools/a-deep-dive-into-javascripts-temporal-api-finally-escaping-date-hell-in-2025-16hg)
- [Timezone Handling Best Practices](https://dev.to/corykeane/3-simple-rules-for-effectively-handling-dates-and-timezones-1pe0)
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)
- [MDN: Intl.RelativeTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat)
- [Smashing Magazine: Intl API Guide](https://www.smashingmagazine.com/2025/08/power-intl-api-guide-browser-native-internationalization/)
- [React DayPicker](https://daypicker.dev/)
- [Zod vs Yup Comparison](https://betterstack.com/community/guides/scaling-nodejs/yup-vs-zod/)
- [rrule.js GitHub](https://github.com/jkbrzt/rrule)
- [iCalendar RRULE Specification](https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html)
