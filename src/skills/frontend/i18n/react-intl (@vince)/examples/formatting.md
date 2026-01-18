# React-Intl Formatting Examples

> Date, time, number, currency, and relative time formatting examples. See [core.md](core.md) for setup and basic patterns.

---

## Date Formatting

### Good Example - FormattedDate Component

```typescript
// src/components/event-card.tsx
import { FormattedDate } from "react-intl";

type Props = {
  event: {
    name: string;
    startDate: Date;
    endDate: Date;
  };
};

export function EventCard({ event }: Props) {
  return (
    <article>
      <h3>{event.name}</h3>
      <dl>
        <dt>Start</dt>
        <dd>
          <time dateTime={event.startDate.toISOString()}>
            <FormattedDate
              value={event.startDate}
              weekday="long"
              year="numeric"
              month="long"
              day="numeric"
            />
          </time>
        </dd>
        <dt>End</dt>
        <dd>
          <time dateTime={event.endDate.toISOString()}>
            <FormattedDate
              value={event.endDate}
              weekday="long"
              year="numeric"
              month="long"
              day="numeric"
            />
          </time>
        </dd>
      </dl>
    </article>
  );
}

// Output (en-US): "Monday, January 15, 2024"
// Output (de-DE): "Montag, 15. Januar 2024"

export { EventCard };
```

**Why good:** time element with dateTime attribute improves semantics and SEO, explicit format options ensure consistent display, locale-aware formatting automatic

### Good Example - Date Formatting with useIntl

```typescript
// src/hooks/use-formatted-date.ts
import { useIntl } from "react-intl";
import { useMemo } from "react";

type DateFormatStyle = "short" | "medium" | "long" | "full";

export function useFormattedDate(date: Date, style: DateFormatStyle = "medium") {
  const intl = useIntl();

  const formatted = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      short: { month: "numeric", day: "numeric", year: "2-digit" },
      medium: { month: "short", day: "numeric", year: "numeric" },
      long: { month: "long", day: "numeric", year: "numeric" },
      full: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
    }[style];

    return intl.formatDate(date, options);
  }, [intl, date, style]);

  return formatted;
}

export { useFormattedDate };
```

**Why good:** memoized to prevent unnecessary reformatting, style presets for consistency, returns string for use in any context

---

## Time Formatting

### Good Example - FormattedTime Component

```typescript
// src/components/meeting-time.tsx
import { FormattedTime } from "react-intl";

type Props = {
  startTime: Date;
  endTime: Date;
  showTimezone?: boolean;
};

export function MeetingTime({ startTime, endTime, showTimezone = false }: Props) {
  return (
    <span>
      <FormattedTime
        value={startTime}
        hour="numeric"
        minute="numeric"
        timeZoneName={showTimezone ? "short" : undefined}
      />
      {" - "}
      <FormattedTime
        value={endTime}
        hour="numeric"
        minute="numeric"
        timeZoneName={showTimezone ? "short" : undefined}
      />
    </span>
  );
}

// Output (en-US): "3:30 PM - 4:30 PM" or "3:30 PM EST - 4:30 PM EST"
// Output (de-DE): "15:30 - 16:30" or "15:30 MEZ - 16:30 MEZ"

export { MeetingTime };
```

**Why good:** optional timezone display, locale-aware time format (12h vs 24h), clean range formatting

### Good Example - Combined Date and Time

```typescript
// src/components/timestamp.tsx
import { FormattedDate, FormattedTime } from "react-intl";

type Props = {
  date: Date;
  showTime?: boolean;
};

export function Timestamp({ date, showTime = true }: Props) {
  return (
    <time dateTime={date.toISOString()}>
      <FormattedDate
        value={date}
        month="short"
        day="numeric"
        year="numeric"
      />
      {showTime && (
        <>
          {" at "}
          <FormattedTime
            value={date}
            hour="numeric"
            minute="numeric"
          />
        </>
      )}
    </time>
  );
}

// Output (en-US): "Jan 15, 2024 at 3:30 PM"
// Output (de-DE): "15. Jan. 2024 um 15:30"

export { Timestamp };
```

**Why good:** semantic time element, optional time display, combines date and time formatting

### Good Example - FormattedDateTimeRange Component

```typescript
// src/components/event-date-range.tsx
import { FormattedDateTimeRange } from "react-intl";

type Props = {
  startDate: Date;
  endDate: Date;
};

export function EventDateRange({ startDate, endDate }: Props) {
  return (
    <span>
      <FormattedDateTimeRange
        from={startDate}
        to={endDate}
        year="numeric"
        month="short"
        day="numeric"
      />
    </span>
  );
}

// Output (en-US): "Jan 15 - 20, 2024" (same month) or "Jan 15 - Feb 3, 2024"
// Output (de-DE): "15. - 20. Jan. 2024" or "15. Jan. - 3. Feb. 2024"

export { EventDateRange };
```

**Why good:** built-in range formatting handles same-month vs cross-month cases intelligently, locale-aware separators and format

---

## Number Formatting

### Good Example - FormattedNumber Variations

```typescript
// src/components/stats-card.tsx
import { FormattedNumber } from "react-intl";

const PERCENT_DECIMAL_PLACES = 1;

type Props = {
  visitors: number;
  conversionRate: number;
  revenue: number;
  currency: string;
};

export function StatsCard({ visitors, conversionRate, revenue, currency }: Props) {
  return (
    <dl>
      <dt>Visitors</dt>
      <dd>
        <FormattedNumber value={visitors} />
      </dd>

      <dt>Conversion Rate</dt>
      <dd>
        <FormattedNumber
          value={conversionRate}
          style="percent"
          minimumFractionDigits={PERCENT_DECIMAL_PLACES}
          maximumFractionDigits={PERCENT_DECIMAL_PLACES}
        />
      </dd>

      <dt>Revenue</dt>
      <dd>
        <FormattedNumber
          value={revenue}
          style="currency"
          currency={currency}
        />
      </dd>
    </dl>
  );
}

// Output (en-US): "1,234,567" | "12.5%" | "$45,678.90"
// Output (de-DE): "1.234.567" | "12,5 %" | "45.678,90 $"

export { StatsCard };
```

**Why good:** named constant for decimal places, locale-aware thousand separators, currency symbol position varies by locale

### Good Example - Number Formatting with useIntl

```typescript
// src/utils/format-file-size.ts
import { useIntl } from "react-intl";

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1048576;
const BYTES_PER_GB = 1073741824;
const SIZE_DECIMAL_PLACES = 1;

export function useFormatFileSize() {
  const intl = useIntl();

  return (bytes: number): string => {
    if (bytes >= BYTES_PER_GB) {
      return intl.formatNumber(bytes / BYTES_PER_GB, {
        style: "unit",
        unit: "gigabyte",
        maximumFractionDigits: SIZE_DECIMAL_PLACES,
      });
    }

    if (bytes >= BYTES_PER_MB) {
      return intl.formatNumber(bytes / BYTES_PER_MB, {
        style: "unit",
        unit: "megabyte",
        maximumFractionDigits: SIZE_DECIMAL_PLACES,
      });
    }

    if (bytes >= BYTES_PER_KB) {
      return intl.formatNumber(bytes / BYTES_PER_KB, {
        style: "unit",
        unit: "kilobyte",
        maximumFractionDigits: SIZE_DECIMAL_PLACES,
      });
    }

    return intl.formatNumber(bytes, {
      style: "unit",
      unit: "byte",
      maximumFractionDigits: 0,
    });
  };
}

// Usage: formatFileSize(1536000) -> "1.5 MB" (en-US) | "1,5 MB" (de-DE)

export { useFormatFileSize };
```

**Why good:** named constants for byte conversions, unit style for proper localization, returns hook for reusable formatting

---

## Currency Formatting

### Good Example - Price Display

```typescript
// src/components/price-display.tsx
import { FormattedNumber } from "react-intl";

const CURRENCY_DECIMALS = 2;

type Props = {
  amount: number;
  currency: string;
  showOriginal?: boolean;
  originalAmount?: number;
};

export function PriceDisplay({
  amount,
  currency,
  showOriginal = false,
  originalAmount,
}: Props) {
  return (
    <span>
      {showOriginal && originalAmount && (
        <s aria-label="Original price">
          <FormattedNumber
            value={originalAmount}
            style="currency"
            currency={currency}
            minimumFractionDigits={CURRENCY_DECIMALS}
            maximumFractionDigits={CURRENCY_DECIMALS}
          />
        </s>
        {" "}
      )}
      <FormattedNumber
        value={amount}
        style="currency"
        currency={currency}
        minimumFractionDigits={CURRENCY_DECIMALS}
        maximumFractionDigits={CURRENCY_DECIMALS}
      />
    </span>
  );
}

// Output (en-US): "$99.99" or "$149.99 $99.99"
// Output (de-DE): "99,99 EUR" or "149,99 EUR 99,99 EUR"

export { PriceDisplay };
```

**Why good:** named constant for decimal places, accessible strikethrough for original price, currency code determines symbol and position

### Good Example - Currency Range

```typescript
// src/components/price-range.tsx
import { useIntl } from "react-intl";

type Props = {
  min: number;
  max: number;
  currency: string;
};

export function PriceRange({ min, max, currency }: Props) {
  const intl = useIntl();

  const minFormatted = intl.formatNumber(min, {
    style: "currency",
    currency,
  });

  const maxFormatted = intl.formatNumber(max, {
    style: "currency",
    currency,
  });

  return (
    <span>
      {minFormatted} - {maxFormatted}
    </span>
  );
}

// Output (en-US): "$50.00 - $100.00"
// Output (ja-JP): "5,000 - 10,000"

export { PriceRange };
```

**Why good:** useIntl for string manipulation, consistent formatting for both values

---

## Relative Time Formatting

### Good Example - FormattedRelativeTime with Auto-Update

```typescript
// src/components/time-ago.tsx
import { FormattedRelativeTime } from "react-intl";
import { useMemo } from "react";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_WEEK = 604800;
const AUTO_UPDATE_INTERVAL = 10;

type Unit = "second" | "minute" | "hour" | "day" | "week";

function getRelativeTimeUnit(deltaSeconds: number): { value: number; unit: Unit } {
  const absDelta = Math.abs(deltaSeconds);

  if (absDelta < SECONDS_PER_MINUTE) {
    return { value: deltaSeconds, unit: "second" };
  }

  if (absDelta < SECONDS_PER_HOUR) {
    return { value: Math.round(deltaSeconds / SECONDS_PER_MINUTE), unit: "minute" };
  }

  if (absDelta < SECONDS_PER_DAY) {
    return { value: Math.round(deltaSeconds / SECONDS_PER_HOUR), unit: "hour" };
  }

  if (absDelta < SECONDS_PER_WEEK) {
    return { value: Math.round(deltaSeconds / SECONDS_PER_DAY), unit: "day" };
  }

  return { value: Math.round(deltaSeconds / SECONDS_PER_WEEK), unit: "week" };
}

type Props = {
  timestamp: Date;
  autoUpdate?: boolean;
};

export function TimeAgo({ timestamp, autoUpdate = true }: Props) {
  const { value, unit } = useMemo(() => {
    const deltaSeconds = Math.round((timestamp.getTime() - Date.now()) / 1000);
    return getRelativeTimeUnit(deltaSeconds);
  }, [timestamp]);

  return (
    <time dateTime={timestamp.toISOString()}>
      <FormattedRelativeTime
        value={value}
        unit={unit}
        updateIntervalInSeconds={autoUpdate ? AUTO_UPDATE_INTERVAL : undefined}
      />
    </time>
  );
}

// Output: "5 minutes ago", "in 2 hours", "3 days ago"

export { TimeAgo };
```

**Why good:** named constants for time conversions, automatic unit selection, optional auto-update, semantic time element

### Good Example - Relative Time with useIntl

```typescript
// src/hooks/use-relative-time.ts
import { useIntl } from "react-intl";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

type RelativeTimeUnit = "second" | "minute" | "hour" | "day";

export function useRelativeTime() {
  const intl = useIntl();

  return (date: Date): string => {
    const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000);
    const absDelta = Math.abs(deltaSeconds);

    let value: number;
    let unit: RelativeTimeUnit;

    if (absDelta < SECONDS_PER_MINUTE) {
      value = deltaSeconds;
      unit = "second";
    } else if (absDelta < SECONDS_PER_HOUR) {
      value = Math.round(deltaSeconds / SECONDS_PER_MINUTE);
      unit = "minute";
    } else if (absDelta < SECONDS_PER_DAY) {
      value = Math.round(deltaSeconds / SECONDS_PER_HOUR);
      unit = "hour";
    } else {
      value = Math.round(deltaSeconds / SECONDS_PER_DAY);
      unit = "day";
    }

    return intl.formatRelativeTime(value, unit, { numeric: "auto" });
  };
}

// Usage: formatRelativeTime(pastDate) -> "5 minutes ago" | "yesterday"

export { useRelativeTime };
```

**Why good:** numeric: "auto" uses words like "yesterday" when appropriate, reusable hook pattern, string return for any context

---

## List Formatting

### Good Example - FormattedList Component

```typescript
// src/components/author-list.tsx
import { FormattedList } from "react-intl";

type Props = {
  authors: string[];
  type?: "conjunction" | "disjunction" | "unit";
};

export function AuthorList({ authors, type = "conjunction" }: Props) {
  if (authors.length === 0) {
    return null;
  }

  return (
    <FormattedList
      type={type}
      value={authors}
    />
  );
}

// Conjunction (en): "Alice, Bob, and Charlie"
// Conjunction (es): "Alice, Bob y Charlie"
// Disjunction (en): "Alice, Bob, or Charlie"

export { AuthorList };
```

**Why good:** supports different list types, locale-aware conjunctions, handles empty array

### Good Example - List Formatting with useIntl

```typescript
// src/utils/format-list.ts
import { useIntl } from "react-intl";

export function useFormatList() {
  const intl = useIntl();

  return {
    and: (items: string[]) => intl.formatList(items, { type: "conjunction" }),
    or: (items: string[]) => intl.formatList(items, { type: "disjunction" }),
    unit: (items: string[]) => intl.formatList(items, { type: "unit" }),
  };
}

// Usage:
// formatList.and(["Red", "Blue", "Green"]) -> "Red, Blue, and Green"
// formatList.or(["Red", "Blue", "Green"]) -> "Red, Blue, or Green"

export { useFormatList };
```

**Why good:** returns object with named methods, consistent API, string return for any context

---

## Display Name Formatting

### Good Example - Language and Region Names

```typescript
// src/components/locale-name.tsx
import { useIntl } from "react-intl";

type Props = {
  localeCode: string;
  type?: "language" | "region" | "script" | "currency";
};

export function LocaleName({ localeCode, type = "language" }: Props) {
  const intl = useIntl();

  const displayName = intl.formatDisplayName(localeCode, { type });

  return <span>{displayName}</span>;
}

// Usage: <LocaleName localeCode="de" type="language" />
// Output (en): "German"
// Output (de): "Deutsch"

export { LocaleName };
```

**Why good:** formats language/region codes as localized names, supports multiple display types

---

_For pluralization and select patterns, see [pluralization.md](pluralization.md). For setup and basic patterns, see [core.md](core.md)._
