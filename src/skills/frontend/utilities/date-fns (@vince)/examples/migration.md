# Moment.js to date-fns Migration Guide

> Patterns for migrating from Moment.js to date-fns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Key Differences

| Aspect | Moment.js | date-fns |
|--------|-----------|----------|
| API Style | Chainable, OOP | Functional, pure functions |
| Mutability | Mutable | Immutable (returns new Date) |
| Tree-shaking | None (full 67KB) | Full (import only what you need) |
| Format tokens | `YYYY`, `DD`, `dddd` | `yyyy`, `dd`, `EEEE` |
| TypeScript | `@types/moment` | Built-in types |
| Timezone | moment-timezone | @date-fns/tz or date-fns-tz |

---

## Token Mapping

### Date Tokens

| Moment.js | date-fns | Description | Example |
|-----------|----------|-------------|---------|
| `YYYY` | `yyyy` | 4-digit year | 2026 |
| `YY` | `yy` | 2-digit year | 26 |
| `MMMM` | `MMMM` | Full month | January |
| `MMM` | `MMM` | Short month | Jan |
| `MM` | `MM` | 2-digit month | 01 |
| `M` | `M` | Month | 1 |
| `DD` | `dd` | 2-digit day | 15 |
| `D` | `d` | Day | 15 |
| `Do` | `do` | Day with ordinal | 15th |
| `dddd` | `EEEE` | Full weekday | Thursday |
| `ddd` | `EEE` | Short weekday | Thu |
| `dd` | `EEEEEE` | Min weekday | Th |
| `d` | `e` | Day of week (0-6) | 4 |

### Time Tokens

| Moment.js | date-fns | Description | Example |
|-----------|----------|-------------|---------|
| `HH` | `HH` | 24-hour (2-digit) | 14 |
| `H` | `H` | 24-hour | 14 |
| `hh` | `hh` | 12-hour (2-digit) | 02 |
| `h` | `h` | 12-hour | 2 |
| `mm` | `mm` | Minutes | 30 |
| `ss` | `ss` | Seconds | 00 |
| `SSS` | `SSS` | Milliseconds | 123 |
| `A` | `a` | AM/PM | PM |
| `a` | `aaaa` | am/pm | p.m. |

### Other Tokens

| Moment.js | date-fns | Description |
|-----------|----------|-------------|
| `X` | `t` | Unix timestamp (seconds) |
| `x` | `T` | Unix timestamp (ms) |
| `Z` | `xxx` | Offset (+05:30) |
| `ZZ` | `xx` | Offset (+0530) |

---

## Method Mapping

### Creation

```typescript
// MOMENT
moment()                          // Current time
moment('2026-01-15')             // Parse string
moment('15/01/2026', 'DD/MM/YYYY') // Parse with format
moment.utc()                      // UTC mode

// DATE-FNS
import { parseISO, parse } from "date-fns";
import { UTCDate } from "@date-fns/utc";

new Date()                        // Current time
parseISO('2026-01-15')           // Parse ISO string
parse('15/01/2026', 'dd/MM/yyyy', new Date()) // Parse with format
new UTCDate()                     // UTC mode
```

### Formatting

```typescript
// MOMENT
moment().format('YYYY-MM-DD')
moment().format('MMMM Do, YYYY')
moment().format('dddd')

// DATE-FNS
import { format } from "date-fns";

format(new Date(), 'yyyy-MM-dd')
format(new Date(), 'MMMM do, yyyy')
format(new Date(), 'EEEE')
```

### Arithmetic

```typescript
// MOMENT (mutates by default!)
moment().add(7, 'days')
moment().subtract(1, 'month')
moment().add(2, 'hours')

// DATE-FNS (always returns new Date)
import { addDays, subMonths, addHours } from "date-fns";

addDays(new Date(), 7)
subMonths(new Date(), 1)
addHours(new Date(), 2)
```

### Boundaries

```typescript
// MOMENT
moment().startOf('day')
moment().endOf('month')
moment().startOf('week')

// DATE-FNS
import { startOfDay, endOfMonth, startOfWeek } from "date-fns";

startOfDay(new Date())
endOfMonth(new Date())
startOfWeek(new Date(), { weekStartsOn: 1 }) // Option for week start
```

### Comparison

```typescript
// MOMENT
moment(a).isBefore(b)
moment(a).isAfter(b)
moment(a).isSame(b, 'day')
moment(a).isBetween(start, end)

// DATE-FNS
import {
  isBefore,
  isAfter,
  isSameDay,
  isWithinInterval
} from "date-fns";

isBefore(a, b)
isAfter(a, b)
isSameDay(a, b)
isWithinInterval(a, { start, end })
```

### Difference

```typescript
// MOMENT
moment(a).diff(b, 'days')
moment(a).diff(b, 'months')
moment(a).diff(b, 'years')

// DATE-FNS
import {
  differenceInDays,
  differenceInMonths,
  differenceInYears
} from "date-fns";

differenceInDays(a, b)
differenceInMonths(a, b)
differenceInYears(a, b)
```

### Relative Time

```typescript
// MOMENT
moment(date).fromNow()
moment(date).toNow()
moment(a).from(b)

// DATE-FNS
import { formatDistanceToNow, formatDistance } from "date-fns";

formatDistanceToNow(date, { addSuffix: true })
formatDistanceToNow(date, { addSuffix: true }) // Same as toNow
formatDistance(a, b, { addSuffix: true })
```

### Validation

```typescript
// MOMENT
moment(date).isValid()
moment.isMoment(value)
moment.isDate(value)

// DATE-FNS
import { isValid, isDate } from "date-fns";

isValid(date)                    // Check if Date is valid
isDate(value)                    // Check if value is Date instance
```

### Getters/Setters

```typescript
// MOMENT
moment().year()
moment().month()
moment().date()
moment().day()
moment().hour()

// DATE-FNS
import {
  getYear,
  getMonth,
  getDate,
  getDay,
  getHours
} from "date-fns";

getYear(date)
getMonth(date)     // 0-11 (same as Moment)
getDate(date)      // Day of month
getDay(date)       // Day of week (0-6)
getHours(date)
```

---

## Common Migration Patterns

### Chained Operations

```typescript
// MOMENT - Chaining (mutable, affects original)
const result = moment(date)
  .add(7, 'days')
  .startOf('month')
  .format('YYYY-MM-DD');

// DATE-FNS - Functional (immutable)
import { addDays, startOfMonth, format } from "date-fns";

const ISO_FORMAT = "yyyy-MM-dd";
const withDays = addDays(date, 7);
const monthStart = startOfMonth(withDays);
const result = format(monthStart, ISO_FORMAT);

// Or nested (right-to-left reading)
const result = format(
  startOfMonth(addDays(date, 7)),
  ISO_FORMAT
);
```

### Clone Pattern

```typescript
// MOMENT - Explicit clone to prevent mutation
const original = moment();
const cloned = original.clone().add(7, 'days');

// DATE-FNS - No clone needed (always immutable)
const original = new Date();
const modified = addDays(original, 7);
// original is unchanged
```

### Locale Usage

```typescript
// MOMENT - Global locale
moment.locale('de');
moment().format('MMMM');

// DATE-FNS - Per-call locale (no global state)
import { format } from "date-fns";
import { de } from "date-fns/locale";

format(new Date(), 'MMMM', { locale: de });
```

### Duration

```typescript
// MOMENT
const duration = moment.duration(7200000); // 2 hours
duration.hours();      // 2
duration.asMinutes();  // 120

// DATE-FNS
import { intervalToDuration, formatDuration } from "date-fns";

const MS_PER_HOUR = 3600000;
const start = new Date(0);
const end = new Date(MS_PER_HOUR * 2); // 2 hours

const duration = intervalToDuration({ start, end });
// { hours: 2 }

// For total in single unit
const totalMinutes = (end.getTime() - start.getTime()) / 60000; // 120
```

---

## Step-by-Step Migration

### Step 1: Audit Usage

```bash
# Find all moment imports
grep -r "from 'moment'" src/
grep -r 'require("moment")' src/
grep -r "moment(" src/
```

### Step 2: Create Format Constants

```typescript
// Before: Magic strings scattered
moment(date).format('YYYY-MM-DD');
moment(date).format('YYYY-MM-DD');

// After: Named constants
const ISO_DATE_FORMAT = 'yyyy-MM-dd';
format(date, ISO_DATE_FORMAT);
```

### Step 3: Replace Token by Token

```typescript
// Moment tokens → date-fns tokens
const FORMAT_MAP: Record<string, string> = {
  'YYYY': 'yyyy',
  'YY': 'yy',
  'DD': 'dd',
  'D': 'd',
  'dddd': 'EEEE',
  'ddd': 'EEE',
  'A': 'a',
};

// Manual conversion needed for each format string
```

### Step 4: Handle Mutability

```typescript
// DANGER: Moment mutates
function addWeekMoment(date: moment.Moment): moment.Moment {
  return date.add(7, 'days'); // Mutates original!
}

// SAFE: date-fns is pure
function addWeekDateFns(date: Date): Date {
  return addDays(date, 7); // Returns new Date
}
```

### Step 5: Update Tests

```typescript
// Moment test
it('should add 7 days', () => {
  const date = moment('2026-01-15');
  const result = date.add(7, 'days');
  expect(result.format('YYYY-MM-DD')).toBe('2026-01-22');
});

// date-fns test
it('should add 7 days', () => {
  const date = parseISO('2026-01-15');
  const result = addDays(date, 7);
  expect(format(result, 'yyyy-MM-dd')).toBe('2026-01-22');
});
```

---

## Migration Utilities

### Helper for Gradual Migration

```typescript
// Wrapper to ease migration
import { format as fnsFormat, parseISO, addDays, subMonths } from "date-fns";

const MOMENT_TO_FNS_TOKENS: Record<string, string> = {
  'YYYY': 'yyyy',
  'YY': 'yy',
  'DD': 'dd',
  'D': 'd',
  'dddd': 'EEEE',
  'ddd': 'EEE',
  'A': 'a',
};

// Convert Moment format string to date-fns
function convertFormatString(momentFormat: string): string {
  let fnsFormat = momentFormat;
  for (const [moment, fns] of Object.entries(MOMENT_TO_FNS_TOKENS)) {
    fnsFormat = fnsFormat.replace(new RegExp(moment, 'g'), fns);
  }
  return fnsFormat;
}

// Compatibility wrapper (for gradual migration)
function formatCompat(date: Date, momentFormatString: string): string {
  const fnsFormatString = convertFormatString(momentFormatString);
  return fnsFormat(date, fnsFormatString);
}

// Usage during migration
formatCompat(new Date(), 'YYYY-MM-DD'); // Works with Moment tokens
// After migration, replace with:
fnsFormat(new Date(), 'yyyy-MM-dd');    // Native date-fns
```

---

## Bundle Size Comparison

```typescript
// MOMENT: ~67KB (full library, always included)
import moment from 'moment';
moment().format('YYYY-MM-DD');

// DATE-FNS: ~2-3KB per function used
import { format } from "date-fns";
format(new Date(), 'yyyy-MM-dd');

// Typical app using:
// - format (~2KB)
// - parseISO (~1KB)
// - addDays, subMonths (~1KB each)
// - isAfter, isBefore (~1KB each)
// Total: ~8-10KB vs 67KB
```

---

## Timezone Migration

```typescript
// MOMENT-TIMEZONE
import moment from 'moment-timezone';

moment.tz('2026-01-15 10:00', 'America/New_York');
moment.tz(date, 'Europe/London').format();

// DATE-FNS-TZ (v3)
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

// Format in timezone
formatInTimeZone(date, 'America/New_York', 'yyyy-MM-dd HH:mm zzz');

// @DATE-FNS/TZ (v4)
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

const nyDate = new TZDate(2026, 0, 15, 10, 0, 0, 'America/New_York');
format(nyDate, 'yyyy-MM-dd HH:mm zzz');
```
