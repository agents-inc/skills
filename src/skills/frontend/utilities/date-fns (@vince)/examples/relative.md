# date-fns Relative Time Examples

> Relative time formatting and distance patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Relative Time Formatting

### Good Example - formatDistance and formatDistanceToNow

```typescript
import {
  formatDistance,
  formatDistanceToNow,
  formatDistanceStrict,
  formatRelative,
} from "date-fns";

const pastDate = new Date(2026, 0, 1);
const futureDate = new Date(2026, 1, 15);
const now = new Date(2026, 0, 15);

// Basic distance (approximate, human-friendly)
const distance = formatDistance(pastDate, now);
// "14 days"

// With suffix (includes "ago" or "in")
const distanceWithSuffix = formatDistance(pastDate, now, { addSuffix: true });
// "14 days ago"

const futureDistance = formatDistance(futureDate, now, { addSuffix: true });
// "about 1 month"

// Convenience: distance to now (most common use case)
const toNow = formatDistanceToNow(pastDate);
// "14 days"

const toNowWithSuffix = formatDistanceToNow(pastDate, { addSuffix: true });
// "14 days ago"

// Strict distance (no "about", "almost", "over")
const strict = formatDistanceStrict(pastDate, now);
// "14 days"

// Force specific unit
const strictHours = formatDistanceStrict(pastDate, now, { unit: "hour" });
// "336 hours"

// Include seconds for recent times
const recentDate = new Date(Date.now() - 30000); // 30 seconds ago
const withSeconds = formatDistanceToNow(recentDate, { includeSeconds: true });
// "half a minute ago" (instead of "less than a minute ago")
```

**Why good:** human-friendly output, handles singular/plural automatically, configurable precision

---

## Relative Calendar Formatting

### Good Example - formatRelative for Calendar Context

```typescript
import { formatRelative } from "date-fns";
import { enUS, de } from "date-fns/locale";

const now = new Date(2026, 0, 15, 14, 0); // Wednesday, Jan 15, 2026

// formatRelative provides context-aware formatting
const yesterday = new Date(2026, 0, 14, 10, 0);
const lastWeek = new Date(2026, 0, 8, 10, 0);
const tomorrow = new Date(2026, 0, 16, 10, 0);
const nextWeek = new Date(2026, 0, 22, 10, 0);

// English output
formatRelative(yesterday, now);  // "yesterday at 10:00 AM"
formatRelative(lastWeek, now);   // "last Thursday at 10:00 AM"
formatRelative(tomorrow, now);   // "tomorrow at 10:00 AM"
formatRelative(nextWeek, now);   // "Thursday at 10:00 AM"

// German output
formatRelative(yesterday, now, { locale: de });
// "gestern um 10:00"

// Utility: Smart relative formatting with fallback
function smartFormatRelative(
  date: Date,
  baseDate: Date = new Date(),
  fallbackFormat: string = "PPp"
): string {
  const daysDiff = Math.abs(differenceInDays(date, baseDate));

  // Use formatRelative for nearby dates (within a week)
  const RELATIVE_THRESHOLD_DAYS = 7;
  if (daysDiff <= RELATIVE_THRESHOLD_DAYS) {
    return formatRelative(date, baseDate);
  }

  // Fall back to absolute format for distant dates
  return format(date, fallbackFormat);
}
```

**Why good:** context-aware (shows "yesterday", "last Monday"), natural language output

---

## Duration Formatting

### Good Example - formatDuration and intervalToDuration

```typescript
import { formatDuration, intervalToDuration, add } from "date-fns";

// Create duration from interval
const start = new Date(2026, 0, 1);
const end = new Date(2026, 5, 15, 14, 30);

const duration = intervalToDuration({ start, end });
// { months: 5, days: 14, hours: 14, minutes: 30 }

// Format duration to human-readable string
const formatted = formatDuration(duration);
// "5 months 14 days 14 hours 30 minutes"

// Customize which units to show
const formattedShort = formatDuration(duration, {
  format: ["months", "days"],
});
// "5 months 14 days"

// Custom delimiter
const formattedDelim = formatDuration(duration, {
  format: ["days", "hours", "minutes"],
  delimiter: ", ",
});
// "14 days, 14 hours, 30 minutes"

// Zero padding
const formattedPadded = formatDuration(duration, {
  format: ["hours", "minutes"],
  zero: true,
});
// "14 hours 30 minutes" (would show "0 hours" if hours was 0)

// Utility: Format duration concisely
function formatDurationConcise(duration: Duration): string {
  if (duration.years && duration.years > 0) {
    return formatDuration(duration, { format: ["years", "months"] });
  }
  if (duration.months && duration.months > 0) {
    return formatDuration(duration, { format: ["months", "days"] });
  }
  if (duration.days && duration.days > 0) {
    return formatDuration(duration, { format: ["days", "hours"] });
  }
  return formatDuration(duration, { format: ["hours", "minutes"] });
}
```

**Why good:** handles all duration units, customizable output format, locale-aware

---

## Live Relative Time Updates

### Good Example - React Hook for Auto-Updating Relative Time

```typescript
import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow, differenceInSeconds } from "date-fns";

// Update intervals based on how old the date is
const SECOND_IN_MS = 1000;
const MINUTE_IN_MS = 60 * SECOND_IN_MS;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;

const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 3600;
const SECONDS_IN_DAY = 86400;

interface UseRelativeTimeOptions {
  addSuffix?: boolean;
  includeSeconds?: boolean;
}

function getUpdateInterval(date: Date): number {
  const secondsAgo = Math.abs(differenceInSeconds(new Date(), date));

  if (secondsAgo < SECONDS_IN_MINUTE) {
    return SECOND_IN_MS * 10; // Update every 10 seconds for recent
  }
  if (secondsAgo < SECONDS_IN_HOUR) {
    return MINUTE_IN_MS; // Update every minute
  }
  if (secondsAgo < SECONDS_IN_DAY) {
    return MINUTE_IN_MS * 5; // Update every 5 minutes
  }
  return HOUR_IN_MS; // Update every hour for old dates
}

function useRelativeTime(
  date: Date | null,
  options: UseRelativeTimeOptions = {}
): string {
  const { addSuffix = true, includeSeconds = false } = options;

  const getRelativeTime = useCallback(() => {
    if (!date) return "";
    return formatDistanceToNow(date, { addSuffix, includeSeconds });
  }, [date, addSuffix, includeSeconds]);

  const [relativeTime, setRelativeTime] = useState(getRelativeTime);

  useEffect(() => {
    if (!date) return;

    // Update immediately
    setRelativeTime(getRelativeTime());

    // Set up interval with dynamic timing
    let intervalId: NodeJS.Timeout;

    const scheduleUpdate = () => {
      const interval = getUpdateInterval(date);
      intervalId = setTimeout(() => {
        setRelativeTime(getRelativeTime());
        scheduleUpdate(); // Reschedule with potentially new interval
      }, interval);
    };

    scheduleUpdate();

    return () => {
      if (intervalId) clearTimeout(intervalId);
    };
  }, [date, getRelativeTime]);

  return relativeTime;
}

// Usage in component
function CommentTimestamp({ createdAt }: { createdAt: Date }) {
  const relativeTime = useRelativeTime(createdAt);

  return <time dateTime={createdAt.toISOString()}>{relativeTime}</time>;
}
```

**Why good:** auto-updates displayed time, smart update intervals (faster for recent), cleans up properly

---

## Smart Relative vs Absolute Time

### Good Example - Choose Format Based on Age

```typescript
import {
  formatDistanceToNow,
  format,
  differenceInDays,
  differenceInHours,
} from "date-fns";

// Thresholds for switching format
const RELATIVE_THRESHOLD_DAYS = 7;
const SHOW_TIME_THRESHOLD_HOURS = 24;

interface SmartDateFormatOptions {
  absoluteFormat?: string;
  todayFormat?: string;
  relativeThresholdDays?: number;
}

const DEFAULT_ABSOLUTE_FORMAT = "MMM d, yyyy";
const DEFAULT_TODAY_FORMAT = "h:mm a";

function formatSmartDate(
  date: Date,
  options: SmartDateFormatOptions = {}
): string {
  const {
    absoluteFormat = DEFAULT_ABSOLUTE_FORMAT,
    todayFormat = DEFAULT_TODAY_FORMAT,
    relativeThresholdDays = RELATIVE_THRESHOLD_DAYS,
  } = options;

  const now = new Date();
  const hoursDiff = Math.abs(differenceInHours(date, now));
  const daysDiff = Math.abs(differenceInDays(date, now));

  // Within last day: show time
  if (hoursDiff < SHOW_TIME_THRESHOLD_HOURS) {
    const relative = formatDistanceToNow(date, { addSuffix: true });
    return relative; // "2 hours ago"
  }

  // Within threshold: use relative
  if (daysDiff <= relativeThresholdDays) {
    return formatDistanceToNow(date, { addSuffix: true });
    // "3 days ago"
  }

  // Older: use absolute date
  return format(date, absoluteFormat);
  // "Jan 8, 2026"
}

// Extended version with time for recent dates
function formatSmartDateTime(
  date: Date,
  options: SmartDateFormatOptions = {}
): string {
  const now = new Date();
  const hoursDiff = Math.abs(differenceInHours(date, now));

  // Very recent: relative time
  if (hoursDiff < SHOW_TIME_THRESHOLD_HOURS) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  // Within a week: show day and time
  const daysDiff = Math.abs(differenceInDays(date, now));
  if (daysDiff <= RELATIVE_THRESHOLD_DAYS) {
    return format(date, "EEEE 'at' h:mm a"); // "Monday at 2:30 PM"
  }

  // Older: full date and time
  return format(date, "MMM d, yyyy 'at' h:mm a"); // "Jan 8, 2026 at 2:30 PM"
}

// Usage
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

formatSmartDate(twoHoursAgo);  // "2 hours ago"
formatSmartDate(threeDaysAgo); // "3 days ago"
formatSmartDate(twoWeeksAgo);  // "Jan 1, 2026"
```

**Why good:** balances readability with precision, user-friendly for recent dates, unambiguous for old dates

---

## Localized Relative Time

### Good Example - Multi-Language Relative Formatting

```typescript
import { formatDistanceToNow, formatRelative } from "date-fns";
import { enUS, de, fr, ja, es, zhCN } from "date-fns/locale";
import type { Locale } from "date-fns";

// Locale map
const locales: Record<string, Locale> = {
  "en-US": enUS,
  "en-GB": enUS, // Use enUS as fallback
  "de-DE": de,
  "fr-FR": fr,
  "ja-JP": ja,
  "es-ES": es,
  "zh-CN": zhCN,
};

function getLocale(localeCode: string): Locale {
  return locales[localeCode] || enUS;
}

// Localized relative time
function formatRelativeLocalized(
  date: Date,
  localeCode: string,
  addSuffix: boolean = true
): string {
  const locale = getLocale(localeCode);
  return formatDistanceToNow(date, { locale, addSuffix });
}

// Localized calendar-style relative
function formatRelativeCalendarLocalized(
  date: Date,
  localeCode: string,
  baseDate: Date = new Date()
): string {
  const locale = getLocale(localeCode);
  return formatRelative(date, baseDate, { locale });
}

// Usage
const pastDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago

formatRelativeLocalized(pastDate, "en-US"); // "14 days ago"
formatRelativeLocalized(pastDate, "de-DE"); // "vor 14 Tagen"
formatRelativeLocalized(pastDate, "fr-FR"); // "il y a 14 jours"
formatRelativeLocalized(pastDate, "ja-JP"); // "14日前"
formatRelativeLocalized(pastDate, "es-ES"); // "hace 14 días"
formatRelativeLocalized(pastDate, "zh-CN"); // "14 天前"
```

**Why good:** proper localization of relative time phrases, easy locale switching, fallback to English

---

## Anti-Pattern: Static Relative Time

### Bad Example - Not Updating Relative Time

```typescript
// ❌ BAD - Shows "5 minutes ago" forever
function CommentTime({ createdAt }: { createdAt: Date }) {
  // Calculated once on mount, never updates
  const relativeTime = formatDistanceToNow(createdAt, { addSuffix: true });

  return <span>{relativeTime}</span>;
}
```

**Why bad:** relative time becomes stale, "5 minutes ago" stays even hours later

### Good Example - Use the Hook

```typescript
// ✅ GOOD - Auto-updates
function CommentTime({ createdAt }: { createdAt: Date }) {
  const relativeTime = useRelativeTime(createdAt);

  return (
    <time dateTime={createdAt.toISOString()} title={format(createdAt, "PPpp")}>
      {relativeTime}
    </time>
  );
}
```

**Why good:** updates automatically, title shows full date on hover, proper semantic HTML
