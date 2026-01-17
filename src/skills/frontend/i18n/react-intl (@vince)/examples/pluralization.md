# React-Intl Pluralization Examples

> ICU Message Format pluralization, select, and ordinal patterns. See [core.md](core.md) for setup and basic patterns.

---

## Cardinal Pluralization

### Good Example - Basic Plural with All Cases

```typescript
// src/components/notification-badge.tsx
import { FormattedMessage } from "react-intl";

type Props = {
  count: number;
};

export function NotificationBadge({ count }: Props) {
  return (
    <span aria-label={`${count} notifications`} role="status">
      <FormattedMessage
        id="notifications.count"
        defaultMessage="{count, plural, =0 {No notifications} one {# notification} other {# notifications}}"
        values={{ count }}
      />
    </span>
  );
}

// Output (count=0): "No notifications"
// Output (count=1): "1 notification"
// Output (count=5): "5 notifications"

export { NotificationBadge };
```

**Why good:** `=0` provides zero-specific message, `#` formats the count with locale-appropriate separators, `other` category is REQUIRED (omission causes runtime error), accessible with aria-label and role

### Good Example - Plural with Multiple Variables

```typescript
// src/components/shopping-cart-summary.tsx
import { FormattedMessage } from "react-intl";

type Props = {
  itemCount: number;
  totalPrice: string;
};

export function ShoppingCartSummary({ itemCount, totalPrice }: Props) {
  return (
    <p>
      <FormattedMessage
        id="cart.summary"
        defaultMessage="{itemCount, plural, =0 {Your cart is empty} one {# item in cart - {total}} other {# items in cart - {total}}}"
        values={{ itemCount, total: totalPrice }}
      />
    </p>
  );
}

// Output (itemCount=0): "Your cart is empty"
// Output (itemCount=1): "1 item in cart - $29.99"
// Output (itemCount=3): "3 items in cart - $89.97"

export { ShoppingCartSummary };
```

**Why good:** combines pluralization with other variables, `total` interpolated in plural branches, zero case provides meaningful empty state

### Good Example - Nested Pluralization

```typescript
// src/components/activity-summary.tsx
import { FormattedMessage } from "react-intl";

type Props = {
  followerCount: number;
  postCount: number;
};

export function ActivitySummary({ followerCount, postCount }: Props) {
  return (
    <p>
      <FormattedMessage
        id="activity.summary"
        defaultMessage="{followerCount, plural, =0 {No followers yet} one {# follower} other {# followers}} and {postCount, plural, =0 {no posts} one {# post} other {# posts}}"
        values={{ followerCount, postCount }}
      />
    </p>
  );
}

// Output: "5 followers and 3 posts"
// Output: "1 follower and no posts"
// Output: "No followers yet and 1 post"

export { ActivitySummary };
```

**Why good:** multiple plural expressions in one message, maintains sentence structure for translators

---

## Ordinal Pluralization

### Good Example - Ordinal Numbers (1st, 2nd, 3rd)

```typescript
// src/components/ranking-badge.tsx
import { FormattedMessage } from "react-intl";

type Props = {
  position: number;
};

export function RankingBadge({ position }: Props) {
  return (
    <span>
      <FormattedMessage
        id="ranking.position"
        defaultMessage="{position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place"
        values={{ position }}
      />
    </span>
  );
}

// Output (position=1): "1st place"
// Output (position=2): "2nd place"
// Output (position=3): "3rd place"
// Output (position=4): "4th place"
// Output (position=21): "21st place"

export { RankingBadge };
```

**Why good:** `selectordinal` handles language-specific ordinal rules, English has four categories (one, two, few, other), `#` is replaced with formatted number

### Good Example - Ordinal with Context

```typescript
// src/components/anniversary-message.tsx
import { FormattedMessage } from "react-intl";

type Props = {
  years: number;
  userName: string;
};

export function AnniversaryMessage({ years, userName }: Props) {
  return (
    <p>
      <FormattedMessage
        id="anniversary.celebration"
        defaultMessage="Happy {years, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} anniversary, {name}!"
        values={{ years, name: userName }}
      />
    </p>
  );
}

// Output: "Happy 1st anniversary, Alice!"
// Output: "Happy 3rd anniversary, Bob!"
// Output: "Happy 10th anniversary, Carol!"

export { AnniversaryMessage };
```

**Why good:** ordinal combined with other interpolation, celebratory context clear for translators

---

## Select (Enum/Gender)

### Good Example - Gender Selection

```typescript
// src/components/profile-action.tsx
import { FormattedMessage } from "react-intl";

type Gender = "male" | "female" | "other";

type Props = {
  userName: string;
  gender: Gender;
  action: "like" | "comment" | "share";
};

export function ProfileAction({ userName, gender, action }: Props) {
  return (
    <p>
      <FormattedMessage
        id="profile.action"
        defaultMessage="{gender, select, male {He} female {She} other {They}} {action, select, like {liked} comment {commented on} share {shared} other {interacted with}} your post."
        values={{ gender, action }}
      />
    </p>
  );
}

// Output (male, like): "He liked your post."
// Output (female, comment): "She commented on your post."
// Output (other, share): "They shared your post."

export { ProfileAction };
```

**Why good:** `other` category is REQUIRED as fallback, multiple select expressions compose well, type-safe enum values

### Good Example - Status Selection

```typescript
// src/components/order-status.tsx
import { FormattedMessage } from "react-intl";

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

type Props = {
  status: OrderStatus;
  orderNumber: string;
};

export function OrderStatusMessage({ status, orderNumber }: Props) {
  return (
    <p>
      <FormattedMessage
        id="order.statusMessage"
        defaultMessage="Order {orderNumber}: {status, select, pending {is awaiting confirmation} processing {is being prepared} shipped {is on its way} delivered {has been delivered} cancelled {has been cancelled} other {status unknown}}"
        values={{ status, orderNumber }}
      />
    </p>
  );
}

// Output: "Order #12345: is on its way"
// Output: "Order #12345: has been delivered"

export { OrderStatusMessage };
```

**Why good:** enum-like status maps to full phrases, `other` handles unexpected values gracefully, order number interpolated

---

## Complex Nested Patterns

### Good Example - Gender with Plural

```typescript
// src/components/follower-notification.tsx
import { FormattedMessage } from "react-intl";

type Gender = "male" | "female" | "other";

type Props = {
  userName: string;
  gender: Gender;
  followerCount: number;
};

export function FollowerNotification({ userName, gender, followerCount }: Props) {
  return (
    <p>
      <FormattedMessage
        id="follower.notification"
        defaultMessage="{gender, select, male {He has {count, plural, =0 {no followers} one {# follower} other {# followers}}} female {She has {count, plural, =0 {no followers} one {# follower} other {# followers}}} other {They have {count, plural, =0 {no followers} one {# follower} other {# followers}}}}"
        values={{ gender, count: followerCount }}
      />
    </p>
  );
}

// Output (male, 5): "He has 5 followers"
// Output (female, 1): "She has 1 follower"
// Output (other, 0): "They have no followers"

export { FollowerNotification };
```

**Why good:** nested plural inside select handles both dimensions, verb agreement ("has" vs "have") varies with gender

### Good Example - Plural with Date

```typescript
// src/components/expiration-notice.tsx
import { FormattedMessage } from "react-intl";

type Props = {
  daysRemaining: number;
  expirationDate: Date;
};

export function ExpirationNotice({ daysRemaining, expirationDate }: Props) {
  return (
    <p>
      <FormattedMessage
        id="subscription.expiration"
        defaultMessage="{days, plural, =0 {Your subscription expires today ({date, date, medium})} =1 {Your subscription expires tomorrow ({date, date, medium})} other {Your subscription expires in # days ({date, date, medium})}}"
        values={{ days: daysRemaining, date: expirationDate }}
      />
    </p>
  );
}

// Output (days=0): "Your subscription expires today (Jan 15, 2024)"
// Output (days=1): "Your subscription expires tomorrow (Jan 16, 2024)"
// Output (days=5): "Your subscription expires in 5 days (Jan 20, 2024)"

export { ExpirationNotice };
```

**Why good:** special cases for 0 and 1 days, date formatting embedded in message, contextual information preserved

---

## Language-Specific Plural Rules

### Reference: Plural Categories by Language

| Language | Categories |
|----------|------------|
| English | one, other |
| German | one, other |
| French | one, many, other |
| Russian | one, few, many, other |
| Arabic | zero, one, two, few, many, other |
| Polish | one, few, many, other |
| Japanese | other (no plural forms) |

### Good Example - Language-Aware Pluralization

```typescript
// messages/en.json
{
  "items.count": "{count, plural, one {# item} other {# items}}"
}

// messages/ru.json (Russian has 4 categories)
{
  "items.count": "{count, plural, one {# товар} few {# товара} many {# товаров} other {# товара}}"
}

// messages/ar.json (Arabic has 6 categories)
{
  "items.count": "{count, plural, zero {لا عناصر} one {عنصر واحد} two {عنصران} few {# عناصر} many {# عنصرًا} other {# عنصر}}"
}

// messages/ja.json (Japanese has no plural forms)
{
  "items.count": "{count}個のアイテム"
}
```

**Why good:** each language file uses appropriate categories, translators handle language-specific rules, `other` is always required as fallback

---

## Common Pluralization Patterns

### Good Example - Time Durations

```typescript
// src/components/duration-display.tsx
import { FormattedMessage } from "react-intl";

type Props = {
  hours: number;
  minutes: number;
};

export function DurationDisplay({ hours, minutes }: Props) {
  if (hours === 0) {
    return (
      <span>
        <FormattedMessage
          id="duration.minutesOnly"
          defaultMessage="{minutes, plural, one {# minute} other {# minutes}}"
          values={{ minutes }}
        />
      </span>
    );
  }

  if (minutes === 0) {
    return (
      <span>
        <FormattedMessage
          id="duration.hoursOnly"
          defaultMessage="{hours, plural, one {# hour} other {# hours}}"
          values={{ hours }}
        />
      </span>
    );
  }

  return (
    <span>
      <FormattedMessage
        id="duration.hoursAndMinutes"
        defaultMessage="{hours, plural, one {# hour} other {# hours}} and {minutes, plural, one {# minute} other {# minutes}}"
        values={{ hours, minutes }}
      />
    </span>
  );
}

// Output: "2 hours and 30 minutes"
// Output: "1 hour"
// Output: "45 minutes"

export { DurationDisplay };
```

**Why good:** handles edge cases (zero hours, zero minutes), separate message IDs for different formats, clean composition

### Good Example - File Count

```typescript
// src/components/file-selection.tsx
import { FormattedMessage } from "react-intl";

type Props = {
  selectedCount: number;
  totalCount: number;
};

export function FileSelection({ selectedCount, totalCount }: Props) {
  return (
    <p>
      <FormattedMessage
        id="files.selection"
        defaultMessage="{selected, plural, =0 {No files selected} one {# file selected} other {# files selected}} of {total, plural, one {# file} other {# files}}"
        values={{ selected: selectedCount, total: totalCount }}
      />
    </p>
  );
}

// Output: "No files selected of 10 files"
// Output: "1 file selected of 10 files"
// Output: "5 files selected of 10 files"

export { FileSelection };
```

**Why good:** `=0` provides meaningful zero state, two pluralizations in one message, maintains sentence flow

---

## ICU Message Escaping

### Good Example - Escaping Special Characters

```typescript
// src/components/syntax-help.tsx
import { FormattedMessage } from "react-intl";

export function SyntaxHelp() {
  return (
    <div>
      <p>
        <FormattedMessage
          id="syntax.braces"
          defaultMessage="To display literal braces, use ''{'' and ''}''"
        />
      </p>
      <p>
        <FormattedMessage
          id="syntax.apostrophe"
          defaultMessage="It''s a nice day! (double apostrophe for literal)"
        />
      </p>
    </div>
  );
}

// Output: "To display literal braces, use '{' and '}'"
// Output: "It's a nice day! (double apostrophe for literal)"

export { SyntaxHelp };
```

**Why good:** single quotes escape syntax characters, double single quotes produce literal apostrophe, clear examples for edge cases

---

## Testing Pluralization

### Good Example - Testing All Plural Branches

```typescript
// src/components/notification-badge.test.tsx
import { screen } from "@testing-library/react";
import { renderWithIntl } from "../test/test-utils";
import { NotificationBadge } from "./notification-badge";

describe("NotificationBadge", () => {
  it("displays zero case correctly", () => {
    renderWithIntl(<NotificationBadge count={0} />);
    expect(screen.getByText("No notifications")).toBeInTheDocument();
  });

  it("displays singular case correctly", () => {
    renderWithIntl(<NotificationBadge count={1} />);
    expect(screen.getByText("1 notification")).toBeInTheDocument();
  });

  it("displays plural case correctly", () => {
    renderWithIntl(<NotificationBadge count={5} />);
    expect(screen.getByText("5 notifications")).toBeInTheDocument();
  });

  it("handles large numbers with locale formatting", () => {
    renderWithIntl(<NotificationBadge count={1000} />);
    // Note: en-US formats as "1,000"
    expect(screen.getByText("1,000 notifications")).toBeInTheDocument();
  });
});
```

**Why good:** tests all plural branches (zero, one, other), tests locale formatting for large numbers, uses custom render helper

---

_For date, number, and currency formatting, see [formatting.md](formatting.md). For setup and basic patterns, see [core.md](core.md)._
