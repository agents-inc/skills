# date-fns Timezone Examples

> Timezone handling patterns for date-fns v3+ (@date-fns/tz) and v2.x (date-fns-tz). See [SKILL.md](../SKILL.md) for core concepts.

---

## Core Timezone Principles

1. **Store in UTC** - Always store dates as UTC/ISO 8601 in databases
2. **Display in Local** - Convert to user's timezone only for display
3. **Use IANA Identifiers** - Never use abbreviations (EST, PST)

---

## v4+ Timezone Handling (@date-fns/tz)

### Good Example - TZDate for Timezone-Aware Dates

```typescript
import { format, addDays } from "date-fns";
import { TZDate } from "@date-fns/tz";

// Timezone constants
const TZ_NEW_YORK = "America/New_York";
const TZ_LOS_ANGELES = "America/Los_Angeles";
const TZ_LONDON = "Europe/London";
const TZ_TOKYO = "Asia/Tokyo";

// Create date in specific timezone
const nyDate = new TZDate(2026, 0, 15, 10, 30, 0, TZ_NEW_YORK);
// January 15, 2026, 10:30 AM in New York

// Format preserves timezone context
const formatted = format(nyDate, "yyyy-MM-dd HH:mm:ss zzz");
// "2026-01-15 10:30:00 EST"

// Arithmetic maintains timezone
const nextWeek = addDays(nyDate, 7);
// Still in New York timezone

// Convert between timezones
function convertTimezone(date: TZDate, targetTimezone: string): TZDate {
  return new TZDate(
    date.getTime(),
    targetTimezone
  );
}

const laDate = convertTimezone(nyDate, TZ_LOS_ANGELES);
// Same instant, displayed as Los Angeles time
```

**Why good:** timezone is part of the date object, arithmetic preserves timezone, explicit timezone handling

---

## v3.x Timezone Handling (date-fns-tz)

### Good Example - formatInTimeZone

```typescript
import { parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

// Timezone constants
const TZ_UTC = "UTC";
const TZ_NEW_YORK = "America/New_York";
const TZ_TOKYO = "Asia/Tokyo";

// Format constants
const DISPLAY_FORMAT = "yyyy-MM-dd HH:mm:ss zzz";
const ISO_FORMAT = "yyyy-MM-dd'T'HH:mm:ssXXX";

// UTC timestamp from API
const utcDate = parseISO("2026-01-15T15:30:00Z");

// Display in specific timezone
function displayInTimezone(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, DISPLAY_FORMAT);
}

displayInTimezone(utcDate, TZ_NEW_YORK);
// "2026-01-15 10:30:00 EST" (UTC-5)

displayInTimezone(utcDate, TZ_TOKYO);
// "2026-01-16 00:30:00 JST" (UTC+9)

// Convert UTC to "zoned" Date for display calculations
const zonedDate = toZonedTime(utcDate, TZ_NEW_YORK);
// Date object adjusted to represent NY time (for local calculations)

// Convert user's local input back to UTC for storage
function localInputToUTC(localDate: Date, userTimezone: string): Date {
  return fromZonedTime(localDate, userTimezone);
}

// User enters "10:00 AM" in their timezone
const userInput = new Date(2026, 0, 15, 10, 0, 0);
const utcForStorage = localInputToUTC(userInput, TZ_NEW_YORK);
// Converts 10 AM EST to 3 PM UTC
```

**Why good:** clear separation of display vs storage, explicit timezone conversions

---

## Timezone Detection

### Good Example - Detecting User Timezone

```typescript
// Get user's timezone from browser
function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Returns: "America/New_York", "Europe/London", etc.
}

// Get timezone offset in minutes
function getTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
  // Returns: 300 for EST (5 hours * 60 = 300 minutes behind UTC)
}

// Create timezone-aware date info
interface TimezoneAwareDate {
  utc: string;
  local: string;
  timezone: string;
  offsetMinutes: number;
}

function createTimezoneAwareDate(date: Date): TimezoneAwareDate {
  const timezone = getUserTimezone();
  return {
    utc: date.toISOString(),
    local: date.toLocaleString("en-US", { timeZone: timezone }),
    timezone,
    offsetMinutes: date.getTimezoneOffset(),
  };
}

// Timezone preference storage
interface UserTimezonePreference {
  timezone: string;
  autoDetected: boolean;
}

function getTimezonePreference(): UserTimezonePreference {
  const stored = localStorage.getItem("userTimezone");

  if (stored) {
    return { timezone: stored, autoDetected: false };
  }

  return { timezone: getUserTimezone(), autoDetected: true };
}
```

**Why good:** respects user preference, falls back to browser detection, tracks auto vs manual

---

## DST-Safe Operations

### Good Example - Handling Daylight Saving Time

```typescript
import { addDays, addHours, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const TZ_NEW_YORK = "America/New_York";

// DST transition example (US Spring Forward: March 8, 2026, 2 AM → 3 AM)
const beforeDST = new Date("2026-03-08T06:00:00Z"); // 1 AM EST

// Adding hours across DST transition
const afterDSTTransition = addHours(beforeDST, 3);

// Display in local timezone shows the DST effect
console.log(formatInTimeZone(beforeDST, TZ_NEW_YORK, "HH:mm zzz"));
// "01:00 EST"

console.log(formatInTimeZone(afterDSTTransition, TZ_NEW_YORK, "HH:mm zzz"));
// "05:00 EDT" (not 04:00 because of spring forward)

// Safe way to add calendar days (not affected by DST)
function addCalendarDays(date: Date, days: number): Date {
  // addDays works in UTC, so DST doesn't cause issues
  return addDays(date, days);
}

// Check if date is in DST for a timezone
function isDST(date: Date, timezone: string): boolean {
  const janOffset = formatInTimeZone(
    new Date(date.getFullYear(), 0, 1),
    timezone,
    "xxx"
  );
  const julOffset = formatInTimeZone(
    new Date(date.getFullYear(), 6, 1),
    timezone,
    "xxx"
  );
  const dateOffset = formatInTimeZone(date, timezone, "xxx");

  // If current offset matches July but not January, it's DST (Northern Hemisphere)
  // This is simplified - real DST detection is more complex
  return dateOffset !== janOffset && dateOffset === julOffset;
}
```

**Why good:** handles DST transitions correctly, uses UTC internally, provides DST detection

---

## Timezone Conversion Utilities

### Good Example - Complete Timezone Conversion Module

```typescript
import { parseISO, format } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

// Common timezones
const TIMEZONES = {
  UTC: "UTC",
  US_EASTERN: "America/New_York",
  US_CENTRAL: "America/Chicago",
  US_MOUNTAIN: "America/Denver",
  US_PACIFIC: "America/Los_Angeles",
  UK: "Europe/London",
  CENTRAL_EUROPE: "Europe/Berlin",
  JAPAN: "Asia/Tokyo",
  CHINA: "Asia/Shanghai",
  INDIA: "Asia/Kolkata",
  AUSTRALIA_SYDNEY: "Australia/Sydney",
} as const;

type TimezoneKey = keyof typeof TIMEZONES;

const ISO_FORMAT = "yyyy-MM-dd'T'HH:mm:ssXXX";
const DISPLAY_FORMAT = "MMM d, yyyy h:mm a zzz";

// Convert ISO string to display in timezone
function isoToTimezone(isoString: string, timezone: string): string {
  const date = parseISO(isoString);
  return formatInTimeZone(date, timezone, DISPLAY_FORMAT);
}

// Convert local time to ISO UTC for API
function localToISOUTC(
  localDate: Date,
  sourceTimezone: string
): string {
  const utcDate = fromZonedTime(localDate, sourceTimezone);
  return utcDate.toISOString();
}

// Get current time in timezone
function nowInTimezone(timezone: string): string {
  return formatInTimeZone(new Date(), timezone, DISPLAY_FORMAT);
}

// Convert between timezones
function convertTimezone(
  isoString: string,
  fromTimezone: string,
  toTimezone: string
): string {
  const date = parseISO(isoString);
  return formatInTimeZone(date, toTimezone, DISPLAY_FORMAT);
}

// Get timezone offset string
function getTimezoneOffset(timezone: string, date: Date = new Date()): string {
  return formatInTimeZone(date, timezone, "xxx"); // "+05:30", "-05:00"
}

// Get timezone abbreviation
function getTimezoneAbbr(timezone: string, date: Date = new Date()): string {
  return formatInTimeZone(date, timezone, "zzz"); // "EST", "PST", "JST"
}

// Usage
const apiDate = "2026-01-15T15:30:00Z";

console.log(isoToTimezone(apiDate, TIMEZONES.US_EASTERN));
// "Jan 15, 2026 10:30 AM EST"

console.log(isoToTimezone(apiDate, TIMEZONES.JAPAN));
// "Jan 16, 2026 12:30 AM JST"
```

**Why good:** centralized timezone handling, consistent formatting, handles all conversion directions

---

## Meeting/Event Time Display

### Good Example - Multi-Timezone Event Display

```typescript
import { formatInTimeZone } from "date-fns-tz";

interface MeetingTime {
  timezone: string;
  displayTime: string;
  isPrimary: boolean;
}

const DISPLAY_FORMAT = "EEE, MMM d 'at' h:mm a zzz";

function getMeetingTimesForTimezones(
  utcDate: Date,
  timezones: string[],
  primaryTimezone: string
): MeetingTime[] {
  return timezones.map((timezone) => ({
    timezone,
    displayTime: formatInTimeZone(utcDate, timezone, DISPLAY_FORMAT),
    isPrimary: timezone === primaryTimezone,
  }));
}

// Usage: Meeting scheduled for 3 PM UTC
const meetingUTC = new Date("2026-01-15T15:00:00Z");

const attendeeTimezones = [
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Tokyo",
];

const meetingTimes = getMeetingTimesForTimezones(
  meetingUTC,
  attendeeTimezones,
  "America/New_York" // Organizer's timezone
);

// Output:
// [
//   { timezone: "America/New_York", displayTime: "Thu, Jan 15 at 10:00 AM EST", isPrimary: true },
//   { timezone: "America/Los_Angeles", displayTime: "Thu, Jan 15 at 7:00 AM PST", isPrimary: false },
//   { timezone: "Europe/London", displayTime: "Thu, Jan 15 at 3:00 PM GMT", isPrimary: false },
//   { timezone: "Asia/Tokyo", displayTime: "Fri, Jan 16 at 12:00 AM JST", isPrimary: false },
// ]
```

**Why good:** shows meeting time in all relevant timezones, identifies organizer timezone, handles date changes

---

## Anti-Patterns

### Bad Example - Using Timezone Abbreviations

```typescript
// ❌ BAD - Abbreviations are ambiguous
const options = { timeZone: "EST" }; // EST could be US or Australian!

// ✅ GOOD - Use IANA identifiers
const options = { timeZone: "America/New_York" };
```

**Why bad:** "EST" is ambiguous (US Eastern vs Australia Eastern), DST changes abbreviation

### Bad Example - Storing Local Time

```typescript
// ❌ BAD - Storing local time string
localStorage.setItem("lastVisit", new Date().toString());
// "Thu Jan 15 2026 10:30:00 GMT-0500 (Eastern Standard Time)"
// Loses timezone info when parsed!

// ✅ GOOD - Store ISO UTC
localStorage.setItem("lastVisit", new Date().toISOString());
// "2026-01-15T15:30:00.000Z"
// Unambiguous, always UTC
```

**Why bad:** local time strings are unparseable across timezones, lose DST context

### Bad Example - Manual Offset Calculation

```typescript
// ❌ BAD - Manual offset doesn't account for DST
const EST_OFFSET_HOURS = -5;
const utcTime = localDate.getTime() + EST_OFFSET_HOURS * 60 * 60 * 1000;

// ✅ GOOD - Use timezone library
const utcDate = fromZonedTime(localDate, "America/New_York");
```

**Why bad:** hardcoded offset ignores DST, causes wrong times half the year
