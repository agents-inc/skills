# date-fns Reference

> Token tables, function index, version differences and the Moment migration. See
> [SKILL.md](SKILL.md) for the decisions and red flags, and [examples/](examples/) for full code.

---

## Format Token Reference

| Token  | Output               | Example                      |
| ------ | -------------------- | ---------------------------- |
| `yyyy` | 4-digit year         | 2026                         |
| `yy`   | 2-digit year         | 26                           |
| `MMMM` | Full month           | January                      |
| `MMM`  | Short month          | Jan                          |
| `MM`   | 2-digit month        | 01                           |
| `LLLL` | Standalone month     | January                      |
| `dd`   | 2-digit day          | 15                           |
| `d`    | Day                  | 15                           |
| `do`   | Day with ordinal     | 15th                         |
| `EEEE` | Full weekday         | Thursday                     |
| `EEE`  | Short weekday        | Thu                          |
| `HH`   | 24-hour (2-digit)    | 14                           |
| `h`    | 12-hour              | 2                            |
| `mm`   | Minutes              | 30                           |
| `ss`   | Seconds              | 00                           |
| `a`    | AM/PM                | PM                           |
| `z`    | Timezone             | EST                          |
| `xxx`  | UTC offset           | -05:00                       |
| `P`    | Locale date (short)  | 01/15/2026                   |
| `PP`   | Locale date (medium) | Jan 15, 2026                 |
| `PPP`  | Locale date (long)   | January 15th, 2026           |
| `PPPP` | Locale date (full)   | Thursday, January 15th, 2026 |
| `p`    | Locale time          | 2:30 PM                      |
| `PPpp` | Locale date and time | Jan 15, 2026, 2:30:00 PM     |

Literal text inside a format string is single-quoted: `"yyyy-MM-dd'T'HH:mm:ss'Z'"`.

---

## Function Index

| Category   | Functions                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------ |
| Formatting | `format`, `formatDistance`, `formatDistanceToNow`, `formatRelative`, `formatDuration`      |
| Parsing    | `parseISO`, `parse`, `isValid`                                                             |
| Arithmetic | `add`, `addDays`, `addMonths`, `addYears`, `sub`, `subDays`, `subMonths`                   |
| Comparison | `isAfter`, `isBefore`, `isEqual`, `isSameDay`, `isSameMonth`, `isWithinInterval`           |
| Boundaries | `startOfDay`, `endOfDay`, `startOfWeek`, `startOfMonth`, `startOfYear`                     |
| Intervals  | `eachDayOfInterval`, `eachWeekOfInterval`, `eachMonthOfInterval`, `eachWeekendOfInterval`  |
| Difference | `differenceInDays`, `differenceInMonths`, `differenceInBusinessDays`, `intervalToDuration` |
| Checks     | `isToday`, `isPast`, `isFuture`, `isWeekend`, `isLeapYear`                                 |
| Getters    | `getDay`, `getMonth`, `getYear`, `getHours`, `getMinutes`                                  |
| Setters    | `setDay`, `setMonth`, `setYear`, `setHours`, `setMinutes`                                  |
| Sorting    | `compareAsc`, `compareDesc`                                                                |

---

## Locale Imports

All locales come from `date-fns/locale`, one named export per locale:

```typescript
import {
  enUS,
  enGB,
  de,
  fr,
  es,
  it,
  ja,
  ko,
  zhCN,
  pt,
  ptBR,
  ru,
  ar,
} from "date-fns/locale";
```

Regional variants exist where the conventions differ (`enUS`/`enGB`, `pt`/`ptBR`,
`zhCN`/`zhTW`); everything else falls back to the language-level locale.

---

## Version Differences

| Concern             | v3.x                            | v4                                                   |
| ------------------- | ------------------------------- | ---------------------------------------------------- |
| Timezone package    | `date-fns-tz`                   | `@date-fns/tz` and `@date-fns/utc`                   |
| Zoned conversion    | `toZonedTime` / `fromZonedTime` | `transpose`, exported from `date-fns` itself         |
| Timezone context    | pass a zone string per call     | the `in` option: `addDays(d, 7, { in: tz(zone) })`   |
| Invalid input       | throws                          | returns Invalid Date or `NaN`                        |
| Difference rounding | `Math.floor` (toward −∞)        | `Math.trunc` (toward zero) — negatives differ by one |
| Module format       | dual                            | ESM-first                                            |
| CommonJS require    | `require("date-fns/addDays")`   | `const { addDays } = require("date-fns/addDays")`    |

Constants have imported from `date-fns/constants` rather than the package root since v3:

```typescript
import { daysInYear } from "date-fns/constants";
```

Both v3 and v4 ship their own TypeScript types — there is no `@types/date-fns`.

---

## Timezone Package API (v4)

`@date-fns/tz`:

| Export            | Purpose                                                   | Example                                            |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `TZDate`          | Timezone-aware Date, 1.2 KB                               | `new TZDate(2026, 0, 15, "America/New_York")`      |
| `TZDateMini`      | Getters and setters only, 916 B                           | `new TZDateMini(2026, 0, 15, "America/New_York")`  |
| `tz()`            | Context value for the `in` option                         | `addDays(date, 7, { in: tz("America/New_York") })` |
| `tzName()`        | Display name, `short`/`long`/`shortGeneric`/`longGeneric` | `tzName("America/New_York", date, "long")`         |
| `tzScan()`        | DST transitions in a range                                | `tzScan("America/New_York", { start, end })`       |
| `tzOffset()`      | UTC offset in minutes                                     | `tzOffset("America/New_York", date)`               |
| `.withTimeZone()` | `TZDate` method, same instant                             | `nyDate.withTimeZone("Europe/London")`             |
| `.timeZone`       | `TZDate` property, read-only                              | `nyDate.timeZone`                                  |

`TZDateMini` formats in the **system** timezone via `toString()` while calculating in the specified
one — use it for internal maths, and `TZDate` anywhere the string form is read.

`@date-fns/utc`:

| Class         | Size  | Use for                                        |
| ------------- | ----- | ---------------------------------------------- |
| `UTCDate`     | 504 B | Full API, formats in UTC — values you hand out |
| `UTCDateMini` | 239 B | Minimal API — internal calculations            |

`transpose(date, tz(zone))` ships in `date-fns` core and replaces both `toZonedTime` and
`fromZonedTime`.

---

## Moment.js Migration

### Token differences

| Moment.js | date-fns | Description                   |
| --------- | -------- | ----------------------------- |
| `YYYY`    | `yyyy`   | 4-digit year                  |
| `YY`      | `yy`     | 2-digit year                  |
| `DD`      | `dd`     | 2-digit day                   |
| `D`       | `d`      | Day of month                  |
| `dddd`    | `EEEE`   | Full weekday                  |
| `ddd`     | `EEE`    | Short weekday                 |
| `A`       | `a`      | AM/PM                         |
| `X`       | `t`      | Unix timestamp (seconds)      |
| `x`       | `T`      | Unix timestamp (milliseconds) |

### Method equivalents

| Moment.js                | date-fns                                         |
| ------------------------ | ------------------------------------------------ |
| `moment()`               | `new Date()`                                     |
| `moment(string)`         | `parseISO(string)`                               |
| `moment(string, format)` | `parse(string, format, new Date())`              |
| `.format(string)`        | `format(date, string)`                           |
| `.add(n, 'days')`        | `addDays(date, n)`                               |
| `.subtract(n, 'months')` | `subMonths(date, n)`                             |
| `.startOf('day')`        | `startOfDay(date)`                               |
| `.endOf('month')`        | `endOfMonth(date)`                               |
| `.diff(other, 'days')`   | `differenceInDays(date, other)`                  |
| `.isBefore(other)`       | `isBefore(date, other)`                          |
| `.isAfter(other)`        | `isAfter(date, other)`                           |
| `.isSame(other, 'day')`  | `isSameDay(date, other)`                         |
| `.isValid()`             | `isValid(date)`                                  |
| `.fromNow()`             | `formatDistanceToNow(date, { addSuffix: true })` |
| `.calendar()`            | `formatRelative(date, new Date())`               |
| `.locale(locale)`        | Pass `{ locale }` to each call                   |

### Chains become composition

```typescript
// Moment — mutable chain
moment(date).add(7, "days").startOf("month").format("YYYY-MM-DD");

// date-fns — immutable composition, read inside-out
format(startOfMonth(addDays(date, 7)), "yyyy-MM-dd");
```
