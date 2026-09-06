---
name: web-utilities-date-fns
description: date-fns patterns for TypeScript - formatting, parsing, manipulation, comparison, timezone handling, and internationalization
---

# date-fns Date Utility Patterns

> **Quick Guide:** date-fns is a tree-shakeable set of pure functions — each returns a new `Date` and
> nothing mutates. Parse with `parseISO` for ISO strings or `parse` for custom formats, then check
> `isValid`, because v4 returns Invalid Date where v3 threw. Format tokens are Unicode TR35 (`yyyy`,
> `dd`, `EEEE`) and differ from Moment's. Timezone support lives in a companion package whose name
> depends on the major version.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — formatting, parsing with validation, arithmetic, boundaries, preset ranges
- [examples/timezone.md](examples/timezone.md) — TZDate, the `in` option, `transpose`, DST detection, UTC classes
- [examples/i18n.md](examples/i18n.md) — locale maps, localized month and weekday names, week start days
- [examples/relative.md](examples/relative.md) — distances, durations, relative-vs-absolute display
- [examples/comparison.md](examples/comparison.md) — comparisons, interval generation, overlap detection, validation
- [reference.md](reference.md) — format token table, function index, v4 breaking changes, Moment migration table

---

## Which path applies

- **v4, and the dates carry a timezone** — `@date-fns/tz` supplies `TZDate` and `tz()`, `@date-fns/utc` supplies `UTCDate`, and `transpose` ships in the core package. Follow [examples/timezone.md](examples/timezone.md).
- **v3.x, and the dates carry a timezone** — `date-fns-tz` supplies `formatInTimeZone`, `toZonedTime` and `fromZonedTime`. Same file, second half.
- **No timezone significance** — store and transmit ISO UTC, read with `parseISO`, normalise date-only values with `startOfDay`, and skip the timezone file.

---

<critical_requirements>

## Before writing date-fns code

**Parse ISO 8601 strings with `parseISO`.** `new Date(string)` parsing is engine-dependent, so
`new Date("01/15/2026")` can succeed, fail, or mean a different day depending on the runtime.

**Check `isValid()` on anything you parsed.** v4 returns Invalid Date and `NaN` where v3 threw, so
an unchecked parse stays silent until the first `format` call downstream.

**Import each function by name.** `import * as dateFns` defeats tree-shaking and pulls the whole
library; a named `format` import costs roughly 2 KB.

**Build new dates with `add*` / `sub*` / `startOf*` rather than the `Date` setters.**
`date.setDate(...)` mutates the object every holder of that reference shares; every date-fns
function returns a new one.

</critical_requirements>

---

**Auto-detection:** date-fns, format, parseISO, addDays, subMonths, differenceInDays,
formatDistance, formatDistanceToNow, isAfter, isBefore, eachDayOfInterval, startOfWeek,
weekStartsOn, date-fns-tz, @date-fns/tz, @date-fns/utc, TZDate, TZDateMini, UTCDate, UTCDateMini,
tz(), transpose, tzName, tzScan, tzOffset, withTimeZone

**Applies to:**

- Formatting dates for display, with or without a locale
- Parsing date strings and validating what came back
- Arithmetic — adding and subtracting days, months, years, business days
- Period boundaries, and generating date ranges for calendars
- Comparisons, interval containment and overlap detection
- Relative and duration phrasing ("2 hours ago", "5 months 14 days")

**Handled elsewhere:**

- Display-only formatting with no arithmetic — the platform's own `Intl.DateTimeFormat` covers it at zero bundle cost, and a runtime that ships the `Temporal` standard makes most of this library optional
- Recurrence rules — expanding a repeating event into occurrences is a separate concern; date-fns operates on the instants that expansion produces
- The tz database itself — the companion packages read the runtime's IANA data rather than bundling their own

---

<philosophy>

Functions, not methods. There is no chainable wrapper object: `format(date, "PP")` takes a `Date`
and returns a string, `addDays(date, 7)` takes a `Date` and returns a new `Date`. That is what makes
the library tree-shakeable — a bundler can drop the 200 functions you did not import — and it is
what makes every operation testable in isolation.

Two consequences worth holding: composition reads inside-out (`format(startOfMonth(addDays(d, 7)), F)`),
and there is no ambient configuration, so a locale or a timezone reaches a call only as an option
you pass.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Format tokens are Unicode TR35

Tokens follow Unicode Technical Standard #35, which differs from Moment: `yyyy` not `YYYY`, `dd` not
`DD`, `EEEE` not `dddd`. A Moment token is not an error — it produces a different value.

```typescript
import { format } from "date-fns";

const date = new Date(2026, 0, 15, 14, 30, 0);

format(date, "yyyy-MM-dd"); // "2026-01-15"
format(date, "MMMM d, yyyy 'at' h:mm a"); // "January 15, 2026 at 2:30 PM"
format(date, "EEEE"); // "Thursday"
```

Full token table: [reference.md](reference.md). Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Locale-aware format shortcuts

`P`, `PP`, `PPP`, `PPPP` (and `p`, `pp` for time) render the locale's own conventions, so the same
call reads correctly in every region. A hardcoded `MM/dd/yyyy` is US-only.

```typescript
import { format } from "date-fns";
import { enUS, de, ja } from "date-fns/locale";

format(date, "P", { locale: enUS }); // "01/15/2026"
format(date, "P", { locale: de }); // "15.01.2026"
format(date, "P", { locale: ja }); // "2026/01/15"
format(date, "PPPP", { locale: de }); // "Donnerstag, 15. Januar 2026"
```

Full code: [examples/i18n.md](examples/i18n.md)

---

### Pattern 3: Parse, then validate

`parseISO` for ISO 8601, `parse` for a custom format with a reference date as the third argument.
Neither throws — validate before use. Round-tripping through `format` additionally rejects dates
that parsed but do not exist, such as Feb 30.

```typescript
import { parseISO, parse, isValid, format } from "date-fns";

const fromApi = parseISO("2026-01-15T14:30:00Z");
const fromUser = parse("15/01/2026", "dd/MM/yyyy", new Date());

if (!isValid(fromUser)) return null;
if (format(fromUser, "dd/MM/yyyy") !== "15/01/2026") return null; // Feb 30 etc.
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Arithmetic returns new dates

Every `add*` and `sub*` function leaves its input untouched, so a date held in state or passed as a
prop is safe to compute from.

```typescript
import { addDays, addMonths, subDays } from "date-fns";

const trialEnd = addDays(signupDate, 14);
const nextBilling = addMonths(signupDate, 1);
const warnAt = subDays(trialEnd, 7);
// signupDate is unchanged
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Period boundaries

`startOf*` / `endOf*` handle month lengths, leap years and week-start conventions, and give the
inclusive ranges a `>= start AND <= end` filter needs. `endOfDay` is `23:59:59.999`, not midnight.

```typescript
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

const today = { start: startOfDay(date), end: endOfDay(date) };
const thisMonth = { start: startOfMonth(date), end: endOfMonth(date) };
const isoWeekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Comparison functions over timestamp maths

`isSameDay`, `isWithinInterval` and friends express the intent and handle the unit-truncation the
manual version gets wrong.

```typescript
import { isAfter, isSameDay, isWithinInterval, isWeekend } from "date-fns";

isAfter(end, start);
isSameDay(a, b); // ignores time-of-day
isWithinInterval(candidate, { start, end }); // endpoints sorted, so order is not checked
isWeekend(date);
```

Full code: [examples/comparison.md](examples/comparison.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Formatting an unvalidated parse — `format` on an Invalid Date throws, and in v4 the parse itself gave no warning. Gate on `isValid`.
- `parse` called with two arguments — the reference date is required, and its year/month supply anything the format string omits.
- `format(date, "z")` on a `UTCDate` — the `z` token needs a native `Date`.

**Surprising behaviour:**

- An interval with `start` later than `end` is not rejected — since v3 `isWithinInterval` and `areIntervalsOverlapping` sort the endpoints and `eachDayOfInterval` returns the days reversed, so a range the user got backwards answers plausibly instead of failing. Order the interval yourself.
- A pasted Moment format string produces a wrong value rather than an error — the commonest defect in a migrated codebase.
- `new Date("2026-01-15")` is UTC midnight, because a date-only ISO string is specified as UTC; every other string shape is implementation-defined, so the same input can shift a whole day between runtimes.
- `addMonths(jan31, 1)` is Feb 28, and `addYears(feb29, 1)` is Feb 28 — the day clamps to the target month's length.
- `differenceIn*` truncates: 45 days is `differenceInMonths` 1, not 1.5. v4 truncates toward zero where v3 floored, which changes negative results.
- Week start varies by region and defaults to Sunday — pass `weekStartsOn` or a locale for anything user-facing.
- Constants such as `daysInYear` import from `date-fns/constants`, not from the package root.

</red_flags>
