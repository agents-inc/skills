# date-fns Timezone Examples

> Zoned dates in v4 (`@date-fns/tz`) and v3.x (`date-fns-tz`). See [SKILL.md](../SKILL.md) for which
> path applies and [reference.md](../reference.md) for the package API tables.

Three rules underneath everything here: store and transmit UTC, convert only for display, and name
zones with IANA identifiers (`America/New_York`) rather than abbreviations.

---

## v4 — `@date-fns/tz`

### TZDate carries its zone through arithmetic

```typescript
import { format, addDays } from "date-fns";
import { TZDate } from "@date-fns/tz";

const nyDate = new TZDate(2026, 0, 15, 10, 30, 0, "America/New_York");

format(nyDate, "yyyy-MM-dd HH:mm:ss zzz"); // "2026-01-15 10:30:00 EST"

// The input type decides the output type
addDays(nyDate, 7); // TZDate, still New York
addDays(new Date(), 7); // Date
```

### The `in` option applies a zone without constructing one

```typescript
import { differenceInBusinessDays, addDays } from "date-fns";
import { tz } from "@date-fns/tz";

const from = new Date("2026-01-15T10:00:00Z");
const to = new Date("2026-01-20T10:00:00Z");

// "Business days" depends on where the day boundaries fall
differenceInBusinessDays(to, from, { in: tz("America/New_York") });

// Returns a TZDate in Tokyo
addDays(from, 7, { in: tz("Asia/Tokyo") });
```

This matters for any calculation whose answer depends on a local midnight —
`differenceInCalendarDays`, `startOfDay`, `isSameDay`, business-day counts.

### transpose converts between zones

```typescript
import { transpose } from "date-fns";
import { TZDate, tz } from "@date-fns/tz";

const tokyoDate = new TZDate(2026, 0, 15, 10, 0, 0, "Asia/Tokyo");
const nyDate = transpose(tokyoDate, tz("America/New_York"));
// Same instant, rendered in New York
```

`transpose` replaces both `toZonedTime` and `fromZonedTime` from the v3 package.

### withTimeZone re-renders the same instant

```typescript
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

const sgDate = new TZDate(2026, 0, 15, 10, 30, 0, "Asia/Singapore");
format(sgDate, "yyyy-MM-dd HH:mm:ss zzz"); // "2026-01-15 10:30:00 SGT"

const nyDate = sgDate.withTimeZone("America/New_York");
format(nyDate, "yyyy-MM-dd HH:mm:ss zzz"); // "2026-01-14 21:30:00 EST"

sgDate.timeZone; // "Asia/Singapore"
```

Note the date rolled back a day — display code that assumes the calendar date is stable across
zones is wrong for roughly a third of the clock.

### tzName for human-readable zone labels

```typescript
import { tzName } from "@date-fns/tz";

const winter = new Date(2026, 0, 15);
const summer = new Date(2026, 6, 15);

tzName("America/New_York", winter, "short"); // "EST"
tzName("America/New_York", summer, "short"); // "EDT"
tzName("America/New_York", winter, "long"); // "Eastern Standard Time"

// Generic forms do not move with DST — better for a settings dropdown
tzName("America/New_York", winter, "shortGeneric"); // "ET"
tzName("America/New_York", summer, "longGeneric"); // "Eastern Time"
```

### tzScan finds DST transitions

```typescript
import { tzScan } from "@date-fns/tz";

const transitions = tzScan("America/New_York", {
  start: new Date(2026, 0, 1),
  end: new Date(2026, 11, 31),
});
// [{ date, change: 60, offset: -240 }, { date, change: -60, offset: -300 }]
// `change` is the offset delta in minutes and `offset` the new offset, both
// positive for east of UTC — so spring forward is +60 onto -240 (EDT), and
// autumn back is -60 onto -300 (EST). `date` is the exact transition instant.

const HOURS = 60 * 60 * 1000;

function nextTransitionWithin(
  date: Date,
  timeZone: string,
  hours: number,
): Date | null {
  const found = tzScan(timeZone, {
    start: date,
    end: new Date(date.getTime() + hours * HOURS),
  });
  return found.length > 0 ? found[0].date : null;
}
```

Scheduling UIs use this to warn that a chosen slot sits inside a transition, where the wall clock
either repeats an hour or skips one.

### UTCDate for calculations that must not see a local zone

```typescript
import { UTCDate } from "@date-fns/utc";
import { addDays, format } from "date-fns";

const utcDate = new UTCDate(2026, 0, 15, 10, 30, 0);
utcDate.toISOString(); // "2026-01-15T10:30:00.000Z"

addDays(utcDate, 7) instanceof UTCDate; // true
format(utcDate, "yyyy-MM-dd HH:mm:ss"); // always UTC, whatever the host zone
```

`UTCDate` for timestamps a server produces or an API returns; `TZDate` for anything a person reads.

---

## v3.x — `date-fns-tz`

```typescript
import { parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

const utcDate = parseISO("2026-01-15T15:30:00Z");

// Render an instant in a zone
formatInTimeZone(utcDate, "America/New_York", "yyyy-MM-dd HH:mm:ss zzz");
// "2026-01-15 10:30:00 EST"
formatInTimeZone(utcDate, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss zzz");
// "2026-01-16 00:30:00 JST"

// Shift a Date's fields so local getters read as the target zone — for display maths only
const zoned = toZonedTime(utcDate, "America/New_York");

// The inverse: a wall-clock time the user typed, back to the instant it names
const userTyped = new Date(2026, 0, 15, 10, 0, 0);
fromZonedTime(userTyped, "America/New_York"); // 15:00 UTC
```

`toZonedTime` returns a `Date` whose underlying instant is deliberately wrong — it exists so that
`getHours()` reads as the target zone. Never store or transmit one.

---

## Detecting the User's Zone

```typescript
function detectTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone; // "Europe/London"
}

function resolveTimeZone(stored: string | null): {
  timeZone: string;
  autoDetected: boolean;
} {
  return stored
    ? { timeZone: stored, autoDetected: false }
    : { timeZone: detectTimeZone(), autoDetected: true };
}
```

Detection is a default, not an answer — a traveller's browser reports where they are, not where
their appointments are.

---

## DST-Safe Operations

```typescript
import { addHours, addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

// US spring forward: 2026-03-08, 02:00 → 03:00 local
const beforeDST = new Date("2026-03-08T06:00:00Z"); // 01:00 EST

formatInTimeZone(beforeDST, "America/New_York", "HH:mm zzz"); // "01:00 EST"
formatInTimeZone(addHours(beforeDST, 3), "America/New_York", "HH:mm zzz");
// "05:00 EDT" — three elapsed hours, four wall-clock hours
```

`addHours` adds elapsed time; `addDays` adds calendar days. "Same time tomorrow" is `addDays`, and
"three hours from now" is `addHours` — swapping them is wrong twice a year.

---

## Multi-Zone Display

```typescript
import { formatInTimeZone } from "date-fns-tz";

const meetingUTC = new Date("2026-01-15T15:00:00Z");
const FORMAT = "EEE, MMM d 'at' h:mm a zzz";

const attendees = ["America/New_York", "Europe/London", "Asia/Tokyo"].map(
  (timeZone) => ({
    timeZone,
    displayTime: formatInTimeZone(meetingUTC, timeZone, FORMAT),
  }),
);
// Thu, Jan 15 at 10:00 AM EST
// Thu, Jan 15 at 3:00 PM GMT
// Fri, Jan 16 at 12:00 AM JST  ← different day
```

---

## Anti-Patterns

```typescript
// ❌ Abbreviations are ambiguous — "EST" is US Eastern or Australian Eastern,
//    and it silently means the wrong thing for half the year
const bad = { timeZone: "EST" };
const good = { timeZone: "America/New_York" };

// ❌ toString() loses the zone on the way back in
localStorage.setItem("lastVisit", new Date().toString());
// "Thu Jan 15 2026 10:30:00 GMT-0500 (Eastern Standard Time)"
localStorage.setItem("lastVisit", new Date().toISOString()); // ✅ unambiguous

// ❌ A hardcoded offset is right for part of the year and wrong for the rest
const utcTime = localDate.getTime() + -5 * 60 * 60 * 1000;
const utcDate = fromZonedTime(localDate, "America/New_York"); // ✅
```
