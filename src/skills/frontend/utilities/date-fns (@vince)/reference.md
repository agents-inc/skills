# date-fns Reference

> Decision frameworks, anti-patterns, and red flags for date-fns. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use date-fns vs Alternatives

```
Need date/time handling?
├─ Is Temporal API available (no polyfill needed)?
│   ├─ YES → Use Temporal (future-proof standard)
│   └─ NO → Continue below
├─ Just formatting for display?
│   ├─ YES → Intl.DateTimeFormat (zero bundle cost)
│   └─ NO → Continue below
├─ Is bundle size critical?
│   ├─ YES → date-fns (tree-shakeable, ~2KB per function)
│   └─ NO → Continue below
├─ Migrating from Moment.js?
│   ├─ YES → Consider Day.js (same API) or date-fns
│   └─ NO → Use date-fns
├─ Need complex timezone handling?
│   ├─ YES → date-fns + @date-fns/tz (v4) or date-fns-tz (v3)
│   └─ NO → date-fns alone
└─ Need recurring dates?
    └─ Use rrule.js alongside date-fns
```

### Choosing Between Native Date and date-fns

```
What operations do you need?
├─ Simple date display → Intl.DateTimeFormat
├─ Get current timestamp → new Date()
├─ Parse ISO strings → parseISO (date-fns)
├─ Custom format parsing → parse (date-fns)
├─ Add/subtract time → addDays, subMonths (date-fns)
├─ Compare dates → isAfter, isBefore (date-fns)
├─ Format for display → format (date-fns)
├─ Date boundaries → startOfMonth, endOfDay (date-fns)
└─ Date ranges → eachDayOfInterval (date-fns)
```

### Format Token Quick Reference

```
Need date parts?
├─ Full year → yyyy (2026)
├─ 2-digit year → yy (26)
├─ Full month name → MMMM (January)
├─ Short month name → MMM (Jan)
├─ 2-digit month → MM (01)
├─ Day with ordinal → do (15th)
├─ 2-digit day → dd (15)
├─ Full weekday → EEEE (Thursday)
└─ Short weekday → EEE (Thu)

Need time parts?
├─ 24-hour → HH:mm (14:30)
├─ 12-hour → h:mm a (2:30 PM)
├─ With seconds → HH:mm:ss (14:30:00)
└─ Timezone → zzz (EST)

Need locale-aware format?
├─ Short date → P (01/15/2026)
├─ Medium date → PP (Jan 15, 2026)
├─ Long date → PPP (January 15th, 2026)
├─ Full date → PPPP (Thursday, January 15th, 2026)
└─ With time → PPpp (Jan 15, 2026, 2:30:00 PM)
```

### Timezone Handling Decision

```
Does the date have timezone significance?
├─ YES → Which date-fns version?
│   ├─ v4+ → Use TZDate from @date-fns/tz
│   │   ├─ Need timezone context? → Use `in: tz("America/New_York")` option
│   │   ├─ Convert between zones? → Use transpose()
│   │   └─ Create zoned date? → new TZDate(2026, 0, 15, "America/New_York")
│   └─ v3.x → Use date-fns-tz package
│       ├─ Format in zone → formatInTimeZone()
│       ├─ UTC to local → toZonedTime()
│       └─ Local to UTC → fromZonedTime()
└─ NO → Is it date-only (no time)?
    ├─ YES → Use startOfDay to normalize
    └─ NO → Store/transmit as ISO UTC, use parseISO to read
```

---

## v4 Breaking Changes

### Constants Import Path (v3+)

```typescript
// ❌ WRONG (v2 style - no longer works)
import { daysInYear } from 'date-fns';

// ✅ CORRECT (v3+ and v4)
import { daysInYear } from 'date-fns/constants';
```

### Named Exports for CommonJS (v4)

```typescript
// ❌ WRONG (v3 style)
const addDays = require('date-fns/addDays');

// ✅ CORRECT (v4)
const { addDays } = require('date-fns/addDays');
```

### Error Handling (v4)

```typescript
// v3: Throws errors for invalid inputs
// v4: Returns Invalid Date or NaN instead

import { parse, isValid } from "date-fns";

const result = parse("invalid", "yyyy-MM-dd", new Date());
// v4 returns Invalid Date, doesn't throw

// Always check validity
if (isValid(result)) {
  // Safe to use
}
```

### Rounding Method (v4)

```typescript
// v3: Used Math.floor (rounds toward -Infinity)
// v4: Uses Math.trunc (rounds toward zero)

// This affects negative differences:
// v3: differenceInDays(earlier, later) might return -4
// v4: differenceInDays(earlier, later) might return -3
```

---

## RED FLAGS

### High Priority Issues

- **Using `new Date(string)` for parsing** - Browser-inconsistent, fails silently. Use `parseISO` for ISO strings, `parse` for custom formats.
- **Mutating dates directly** - `date.setDate()` causes side effects. Use pure functions like `addDays`.
- **Importing entire library** - `import * as dateFns` defeats tree-shaking. Import individual functions.
- **Magic format strings** - `format(date, 'yyyy-MM-dd')` scattered in code. Use named constants.
- **Ignoring `isValid` check** - Parsed dates can be invalid. Always check with `isValid` after parsing.

### Medium Priority Issues

- **Not handling timezone for user times** - User-entered times need timezone context. Use `@date-fns/tz`.
- **Hardcoded locale formats** - `MM/dd/yyyy` is US-only. Use `P`/`PP`/`PPP` with locale.
- **Using Moment.js tokens** - `YYYY` (Moment) vs `yyyy` (date-fns). They differ!
- **Not normalizing date-only values** - Use `startOfDay` to remove time for date comparisons.
- **Recreating dates in loops** - Cache formatted values or memoize formatters.

### Common Mistakes

- Using `YYYY` (Moment.js) instead of `yyyy` (date-fns) - wrong year format
- Using `DD` (Moment.js) instead of `dd` (date-fns) - wrong day format
- Forgetting locale import for non-English formatting
- Using `isWithinInterval` with inverted start/end - throws error
- Not passing reference date to `parse` - third argument is required

### Gotchas & Edge Cases

- **`parseISO` returns Invalid Date for non-ISO strings** - Check with `isValid` before using
- **Month boundaries with `addMonths`** - Jan 31 + 1 month = Feb 28 (last day of month)
- **Week start varies by locale** - Use `weekStartsOn` option for `startOfWeek`
- **`format` with 'z' timezone** - Requires native Date, not UTCDate
- **`differenceInMonths` rounds down** - 45 days difference = 1 month, not 1.5
- **Leap year handling** - Feb 29 + 1 year = Feb 28 (no Feb 29 in non-leap year)

---

## Anti-Patterns

### Using Date Constructor for Parsing

Browser behavior varies, causing silent failures.

```typescript
// ❌ WRONG - Browser-inconsistent parsing
const date1 = new Date("2026-01-15");     // Works but timezone varies
const date2 = new Date("01/15/2026");     // May fail in non-US browsers
const date3 = new Date("January 15, 2026"); // Unreliable

// ✅ CORRECT - Use parseISO or parse
import { parseISO, parse, isValid } from "date-fns";

const date1 = parseISO("2026-01-15");
const date2 = parse("01/15/2026", "MM/dd/yyyy", new Date());

if (isValid(date1)) {
  // Safe to use
}
```

### Mutating Date Objects

Side effects cause bugs when dates are shared.

```typescript
// ❌ WRONG - Mutation causes side effects
function getNextWeek(date: Date): Date {
  date.setDate(date.getDate() + 7);
  return date;  // Original is mutated!
}

const original = new Date();
const nextWeek = getNextWeek(original);
// original is now ALSO next week!

// ✅ CORRECT - Pure functions return new dates
import { addDays } from "date-fns";

function getNextWeek(date: Date): Date {
  return addDays(date, 7);  // Returns new Date
}

const original = new Date();
const nextWeek = getNextWeek(original);
// original is unchanged
```

### Importing Entire Library

Bloats bundle with unused code.

```typescript
// ❌ WRONG - Imports entire 80KB library
import * as dateFns from "date-fns";
dateFns.format(date, "yyyy-MM-dd");

// ✅ CORRECT - Tree-shakeable imports (~2KB each)
import { format, parseISO, addDays } from "date-fns";
format(date, "yyyy-MM-dd");
```

### Magic Format Strings

Scattered strings are hard to maintain.

```typescript
// ❌ WRONG - Magic strings everywhere
format(date1, "yyyy-MM-dd");
format(date2, "yyyy-MM-dd");
format(date3, "yyyy-MM-dd");
// What if you need to change the format?

// ✅ CORRECT - Named constants
const ISO_DATE_FORMAT = "yyyy-MM-dd";
const DISPLAY_FORMAT = "MMMM d, yyyy";

format(date1, ISO_DATE_FORMAT);
format(date2, ISO_DATE_FORMAT);
format(date3, ISO_DATE_FORMAT);
```

### Hardcoded Locale Formats

Assumes all users are from one region.

```typescript
// ❌ WRONG - US-only format
format(date, "MM/dd/yyyy"); // Confusing for non-US users

// ✅ CORRECT - Locale-aware
import { format } from "date-fns";
import { de } from "date-fns/locale";

format(date, "P", { locale: de }); // "15.01.2026" for German users
```

### Using Moment.js Token Syntax

Tokens differ between libraries.

```typescript
// ❌ WRONG - Moment.js tokens
format(date, "YYYY-MM-DD");  // Wrong! 'YYYY' means week year
format(date, "DD/MM/YYYY");  // Wrong! 'DD' means day of year

// ✅ CORRECT - date-fns tokens
format(date, "yyyy-MM-dd");  // "2026-01-15"
format(date, "dd/MM/yyyy");  // "15/01/2026"
```

---

## Quick Reference

### Function Categories

| Category | Functions |
|----------|-----------|
| Formatting | `format`, `formatDistance`, `formatDistanceToNow`, `formatRelative`, `formatDuration` |
| Parsing | `parseISO`, `parse`, `isValid` |
| Arithmetic | `add`, `addDays`, `addMonths`, `addYears`, `sub`, `subDays`, `subMonths` |
| Comparison | `isAfter`, `isBefore`, `isEqual`, `isSameDay`, `isSameMonth`, `isWithinInterval` |
| Boundaries | `startOfDay`, `endOfDay`, `startOfWeek`, `startOfMonth`, `startOfYear` |
| Intervals | `eachDayOfInterval`, `eachWeekOfInterval`, `eachMonthOfInterval` |
| Difference | `differenceInDays`, `differenceInMonths`, `differenceInYears`, `intervalToDuration` |
| Checks | `isToday`, `isPast`, `isFuture`, `isWeekend`, `isLeapYear` |
| Getters | `getDay`, `getMonth`, `getYear`, `getHours`, `getMinutes` |
| Setters | `setDay`, `setMonth`, `setYear`, `setHours`, `setMinutes` |

### Format Token Reference

| Token | Output | Example |
|-------|--------|---------|
| `yyyy` | 4-digit year | 2026 |
| `yy` | 2-digit year | 26 |
| `MMMM` | Full month | January |
| `MMM` | Short month | Jan |
| `MM` | 2-digit month | 01 |
| `dd` | 2-digit day | 15 |
| `d` | Day | 15 |
| `do` | Day with ordinal | 15th |
| `EEEE` | Full weekday | Thursday |
| `EEE` | Short weekday | Thu |
| `HH` | 24-hour (2-digit) | 14 |
| `h` | 12-hour | 2 |
| `mm` | Minutes | 30 |
| `ss` | Seconds | 00 |
| `a` | AM/PM | PM |
| `z` | Timezone | EST |
| `P` | Locale date (short) | 01/15/2026 |
| `PP` | Locale date (medium) | Jan 15, 2026 |
| `PPP` | Locale date (long) | January 15th, 2026 |
| `PPPP` | Locale date (full) | Thursday, January 15th, 2026 |
| `p` | Locale time | 2:30 PM |

### Common Locale Imports

```typescript
import {
  enUS,   // English (US)
  enGB,   // English (UK)
  de,     // German
  fr,     // French
  es,     // Spanish
  ja,     // Japanese
  zhCN,   // Chinese (Simplified)
  ko,     // Korean
  pt,     // Portuguese
  ru,     // Russian
  ar,     // Arabic
  it,     // Italian
} from "date-fns/locale";
```

### @date-fns/tz Utilities (v4+)

| Function | Purpose | Example |
|----------|---------|---------|
| `TZDate` | Timezone-aware Date (1.2 KB) | `new TZDate(2026, 0, 15, "America/New_York")` |
| `TZDateMini` | Lightweight TZDate (916 B) | `new TZDateMini(2026, 0, 15, "America/New_York")` |
| `tz()` | Context function for `in` option | `addDays(date, 7, { in: tz("America/New_York") })` |
| `transpose()` | Convert between timezones | `transpose(sgDate, tz("America/New_York"))` |
| `tzName()` | Get timezone display name | `tzName("America/New_York", date, "long")` |
| `tzScan()` | Find DST transitions | `tzScan("America/New_York", startDate, endDate)` |
| `tzOffset()` | Get UTC offset in minutes | `tzOffset("America/New_York", date)` |
| `.withTimeZone()` | TZDate method for conversion | `nyDate.withTimeZone("Europe/London")` |
| `.timeZone` | TZDate property (read-only) | `nyDate.timeZone // "America/New_York"` |

### @date-fns/utc Utilities (v4+)

| Class | Size | Use Case |
|-------|------|----------|
| `UTCDate` | 504 B | Full API, formats in UTC - use for library APIs |
| `UTCDateMini` | 239 B | Minimal API - use for internal calculations |

---

## Moment.js to date-fns Migration

### Token Differences

| Moment.js | date-fns | Description |
|-----------|----------|-------------|
| `YYYY` | `yyyy` | 4-digit year |
| `YY` | `yy` | 2-digit year |
| `DD` | `dd` | 2-digit day |
| `D` | `d` | Day of month |
| `dddd` | `EEEE` | Full weekday |
| `ddd` | `EEE` | Short weekday |
| `A` | `a` | AM/PM |
| `X` | `t` | Unix timestamp (seconds) |
| `x` | `T` | Unix timestamp (milliseconds) |

### Method Equivalents

| Moment.js | date-fns |
|-----------|----------|
| `moment()` | `new Date()` |
| `moment(string)` | `parseISO(string)` |
| `moment(string, format)` | `parse(string, format, new Date())` |
| `.format(string)` | `format(date, string)` |
| `.add(n, 'days')` | `addDays(date, n)` |
| `.subtract(n, 'months')` | `subMonths(date, n)` |
| `.startOf('day')` | `startOfDay(date)` |
| `.endOf('month')` | `endOfMonth(date)` |
| `.diff(other, 'days')` | `differenceInDays(date, other)` |
| `.isBefore(other)` | `isBefore(date, other)` |
| `.isAfter(other)` | `isAfter(date, other)` |
| `.isSame(other, 'day')` | `isSameDay(date, other)` |
| `.isValid()` | `isValid(date)` |
| `.fromNow()` | `formatDistanceToNow(date, { addSuffix: true })` |
| `.calendar()` | `formatRelative(date, new Date())` |
| `.locale(locale)` | Pass `{ locale }` option to format functions |

### Chaining to Functional

```typescript
// Moment.js - Chaining (mutable)
const result = moment(date)
  .add(7, 'days')
  .startOf('month')
  .format('YYYY-MM-DD');

// date-fns - Functional (immutable)
import { addDays, startOfMonth, format } from "date-fns";

const ISO_FORMAT = "yyyy-MM-dd";
const withWeek = addDays(date, 7);
const monthStart = startOfMonth(withWeek);
const result = format(monthStart, ISO_FORMAT);

// Or compose in one line
const result = format(startOfMonth(addDays(date, 7)), ISO_FORMAT);
```
