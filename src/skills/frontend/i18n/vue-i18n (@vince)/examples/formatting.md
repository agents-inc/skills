# vue-i18n Formatting Examples

> DateTime and number formatting patterns for vue-i18n. See [core.md](core.md) for basic setup and translations.

---

## DateTime Formatting

### Good Example - Complete DateTime Configuration

```typescript
// src/i18n/datetime-formats.ts
import type { DateTimeFormats } from "vue-i18n";

export const datetimeFormats: DateTimeFormats = {
  "en-US": {
    short: {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
    long: {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "numeric",
      minute: "numeric",
    },
    time: {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    },
    monthYear: {
      year: "numeric",
      month: "long",
    },
  },
  "ja-JP": {
    short: {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
    long: {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "numeric",
      minute: "numeric",
      hour12: false, // 24-hour format for Japan
    },
    time: {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    },
    monthYear: {
      year: "numeric",
      month: "long",
    },
  },
  "de-DE": {
    short: {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
    long: {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "numeric",
      minute: "numeric",
    },
    time: {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    },
    monthYear: {
      year: "numeric",
      month: "long",
    },
  },
};
```

```typescript
// src/i18n/index.ts
import { createI18n } from "vue-i18n";
import { datetimeFormats } from "./datetime-formats";

export const i18n = createI18n({
  legacy: false,
  locale: "en-US",
  datetimeFormats, // Note: camelCase property name
});
```

**Why good:** named formats ensure consistency, locale-specific options (hour12), separate file for maintainability, TypeScript provides autocomplete for format names

### Good Example - DateTime Usage in Components

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref } from "vue";

const { d } = useI18n();

const eventDate = ref(new Date("2024-06-15T14:30:00"));
const createdAt = ref(new Date());
</script>

<template>
  <article>
    <header>
      <time :datetime="eventDate.toISOString()">
        {{ d(eventDate, "long") }}
      </time>
      <!-- en-US: "Saturday, June 15, 2024 at 2:30 PM" -->
      <!-- ja-JP: "2024年6月15日土曜日 14:30" -->
    </header>

    <p>
      Event date: {{ d(eventDate, "short") }}
      <!-- en-US: "Jun 15, 2024" -->
      <!-- de-DE: "15.06.2024" -->
    </p>

    <p>
      Time: {{ d(eventDate, "time") }}
      <!-- en-US: "2:30:00 PM" -->
      <!-- ja-JP: "14:30:00" -->
    </p>

    <footer>
      <small>Created: {{ d(createdAt, "monthYear") }}</small>
      <!-- "June 2024" -->
    </footer>
  </article>
</template>
```

**Why good:** semantic `<time>` element with ISO datetime attribute, named formats instead of inline options, locale-appropriate output

### Good Example - Relative Time Formatting

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref, computed } from "vue";

const { locale } = useI18n();

const UPDATE_INTERVAL_MS = 60000; // 1 minute

const commentDate = ref(new Date(Date.now() - 3600000)); // 1 hour ago
const now = ref(new Date());

// Update "now" periodically for live relative time
setInterval(() => {
  now.value = new Date();
}, UPDATE_INTERVAL_MS);

const relativeTime = computed(() => {
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: "auto" });

  const diffMs = commentDate.value.getTime() - now.value.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, "minute");
  } else if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, "hour");
  } else {
    return rtf.format(diffDays, "day");
  }
});
</script>

<template>
  <span>{{ relativeTime }}</span>
  <!-- "1 hour ago", "昨日", "vor 2 Tagen" -->
</template>
```

**Why good:** uses Intl.RelativeTimeFormat for locale-aware output, reactive locale from useI18n, periodic updates for live time, named constant for interval

---

## Number Formatting

### Good Example - Complete Number Configuration

```typescript
// src/i18n/number-formats.ts
import type { NumberFormats } from "vue-i18n";

export const numberFormats: NumberFormats = {
  "en-US": {
    currency: {
      style: "currency",
      currency: "USD",
      notation: "standard",
    },
    decimal: {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
    percent: {
      style: "percent",
      useGrouping: false,
    },
    compact: {
      notation: "compact",
      compactDisplay: "short",
    },
    integer: {
      style: "decimal",
      maximumFractionDigits: 0,
    },
  },
  "de-DE": {
    currency: {
      style: "currency",
      currency: "EUR",
      notation: "standard",
    },
    decimal: {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
    percent: {
      style: "percent",
      useGrouping: false,
    },
    compact: {
      notation: "compact",
      compactDisplay: "short",
    },
    integer: {
      style: "decimal",
      maximumFractionDigits: 0,
    },
  },
  "ja-JP": {
    currency: {
      style: "currency",
      currency: "JPY",
      useGrouping: true,
      currencyDisplay: "symbol",
    },
    decimal: {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
    percent: {
      style: "percent",
      useGrouping: false,
    },
    compact: {
      notation: "compact",
      compactDisplay: "short",
    },
    integer: {
      style: "decimal",
      maximumFractionDigits: 0,
    },
  },
};
```

**Why good:** locale-specific currencies (USD, EUR, JPY), compact notation for large numbers, consistent format names across locales

### Good Example - Number Usage in Components

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { n } = useI18n();

const price = 1234.56;
const discount = 0.25;
const followers = 1234567;
const rating = 4.5;
</script>

<template>
  <div class="product-card">
    <p class="price">
      {{ n(price, "currency") }}
      <!-- en-US: "$1,234.56" -->
      <!-- de-DE: "1.234,56 €" -->
      <!-- ja-JP: "¥1,235" (no decimals for JPY) -->
    </p>

    <p class="discount">
      {{ n(discount, "percent") }}
      <!-- "25%" -->
    </p>

    <p class="followers">
      {{ n(followers, "compact") }}
      <!-- en-US: "1.2M" -->
      <!-- de-DE: "1,2 Mio." -->
    </p>

    <p class="rating">
      {{ n(rating, "decimal") }}
      <!-- "4.50" -->
    </p>
  </div>
</template>
```

**Why good:** named formats for consistent styling, locale handles separators and symbols automatically, compact format for large numbers

### Good Example - Dynamic Currency

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed } from "vue";

const { locale } = useI18n();

interface Product {
  price: number;
  currency: string;
}

const props = defineProps<{
  product: Product;
}>();

const formattedPrice = computed(() => {
  return new Intl.NumberFormat(locale.value, {
    style: "currency",
    currency: props.product.currency,
  }).format(props.product.price);
});
</script>

<template>
  <span class="price">{{ formattedPrice }}</span>
</template>
```

**Why good:** currency from data instead of config, uses Intl.NumberFormat directly for dynamic currency, reactive to locale changes

---

## i18n-n Component Examples

### Good Example - Styled Currency Parts

```vue
<script setup lang="ts">
import { ref } from "vue";

const originalPrice = ref(99.99);
const salePrice = ref(74.99);
</script>

<template>
  <div class="price-display">
    <!-- Original price with strikethrough -->
    <i18n-n :value="originalPrice" format="currency" tag="span" class="original">
      <template #currency="{ currency }">
        <span class="currency">{{ currency }}</span>
      </template>
      <template #integer="{ integer }">
        <span class="integer strikethrough">{{ integer }}</span>
      </template>
      <template #decimal="{ decimal }">
        <span class="decimal strikethrough">{{ decimal }}</span>
      </template>
      <template #fraction="{ fraction }">
        <span class="fraction strikethrough">{{ fraction }}</span>
      </template>
    </i18n-n>

    <!-- Sale price with emphasis -->
    <i18n-n :value="salePrice" format="currency" tag="span" class="sale">
      <template #currency="{ currency }">
        <span class="currency sale-currency">{{ currency }}</span>
      </template>
      <template #integer="{ integer }">
        <span class="integer sale-integer">{{ integer }}</span>
      </template>
      <template #decimal="{ decimal }">
        <span class="decimal">{{ decimal }}</span>
      </template>
      <template #fraction="{ fraction }">
        <span class="fraction sale-fraction">{{ fraction }}</span>
      </template>
    </i18n-n>
  </div>
</template>

<style scoped>
.strikethrough {
  text-decoration: line-through;
  color: var(--color-muted);
}

.sale-integer {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-sale);
}

.sale-fraction {
  font-size: 0.875rem;
  vertical-align: super;
}
</style>
```

**Why good:** scoped slots expose formatted parts, each part styled independently, locale-aware formatting preserved, semantic class names

### Good Example - Percentage with Visual Indicator

```vue
<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  value: number; // 0-1 range
}>();

const percentValue = computed(() => props.value * 100);
</script>

<template>
  <div class="progress-indicator">
    <i18n-n :value="props.value" format="percent" tag="span">
      <template #integer="{ integer }">
        <span class="percent-value">{{ integer }}</span>
      </template>
      <template #percentSign="{ percentSign }">
        <span class="percent-sign">{{ percentSign }}</span>
      </template>
    </i18n-n>

    <div class="progress-bar" role="progressbar" :aria-valuenow="percentValue">
      <div class="progress-fill" :style="{ width: `${percentValue}%` }"></div>
    </div>
  </div>
</template>

<style scoped>
.percent-value {
  font-size: 2rem;
  font-weight: bold;
}

.percent-sign {
  font-size: 1rem;
  color: var(--color-muted);
}

.progress-bar {
  height: 8px;
  background: var(--color-background-muted);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}
</style>
```

**Why good:** percent sign available as scoped slot, visual progress bar synchronized, ARIA attributes for accessibility

---

## i18n-d Component Examples

### Good Example - Event Date with Styled Parts

```vue
<script setup lang="ts">
import { ref } from "vue";

const eventDate = ref(new Date("2024-12-25T09:00:00"));
</script>

<template>
  <div class="event-date-card">
    <i18n-d :value="eventDate" format="long" tag="div" class="date-display">
      <template #weekday="{ weekday }">
        <span class="weekday">{{ weekday }}</span>
      </template>
      <template #month="{ month }">
        <span class="month">{{ month }}</span>
      </template>
      <template #day="{ day }">
        <span class="day">{{ day }}</span>
      </template>
      <template #year="{ year }">
        <span class="year">{{ year }}</span>
      </template>
      <template #hour="{ hour }">
        <span class="hour">{{ hour }}</span>
      </template>
      <template #minute="{ minute }">
        <span class="minute">{{ minute }}</span>
      </template>
      <template #dayPeriod="{ dayPeriod }">
        <span class="day-period">{{ dayPeriod }}</span>
      </template>
    </i18n-d>
  </div>
</template>

<style scoped>
.date-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: var(--color-background-card);
  border-radius: 8px;
}

.weekday {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--color-muted);
}

.month {
  font-size: 1rem;
  color: var(--color-primary);
  font-weight: 600;
}

.day {
  font-size: 3rem;
  font-weight: bold;
  line-height: 1;
}

.year {
  font-size: 0.875rem;
  color: var(--color-muted);
}

.hour,
.minute {
  font-size: 1.25rem;
}

.day-period {
  font-size: 0.75rem;
  text-transform: uppercase;
}
</style>
```

**Why good:** calendar-style display, each date part independently styled, dayPeriod slot for AM/PM (locale-dependent)

### Good Example - Time Display with Timezone

```vue
<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref, computed } from "vue";

const { locale } = useI18n();

const meetingTime = ref(new Date("2024-06-15T15:00:00Z"));

const formattedWithTimezone = computed(() => {
  return new Intl.DateTimeFormat(locale.value, {
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
  }).format(meetingTime.value);
});

const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
</script>

<template>
  <div class="meeting-time">
    <span class="time">{{ formattedWithTimezone }}</span>
    <span class="timezone-info">({{ userTimezone }})</span>
  </div>
</template>
```

**Why good:** shows user's local time with timezone indicator, uses Intl.DateTimeFormat for timezone name, helps avoid confusion in global teams

---

_For lazy loading patterns, see [lazy-loading.md](lazy-loading.md)._
