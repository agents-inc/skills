# next-intl - Advanced Pluralization Examples

> Extended examples for ordinal numbers and complex plural patterns. See [core.md](core.md) for cardinal plurals and select patterns.

**Prerequisites**: Understand basic pluralization from core examples first.

---

## Ordinal Plurals

Ordinal plurals handle position-based text like "1st", "2nd", "3rd", "4th".

### Good Example - Ordinal Numbers

```typescript
import { useTranslations } from "next-intl";

function RankingPosition({ position }: { position: number }) {
  const t = useTranslations("Ranking");

  return <span>{t("position", { position })}</span>;
}
```

```json
{
  "Ranking": {
    "position": "You are in {position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place!"
  }
}
```

**Why good:** selectordinal handles English ordinal rules (1st, 2nd, 3rd, 4th...), locale-specific rules applied automatically

### Ordinal Categories by Locale

| Category | English | Usage |
|----------|---------|-------|
| `one` | 1st, 21st, 31st | Numbers ending in 1 (except 11) |
| `two` | 2nd, 22nd, 32nd | Numbers ending in 2 (except 12) |
| `few` | 3rd, 23rd, 33rd | Numbers ending in 3 (except 13) |
| `other` | 4th, 11th, 12th | Everything else |

### When to Use Ordinals

- Ranking displays (1st place, 2nd place)
- Date ordinals in some contexts (1st of January)
- Sequential items (1st step, 2nd step)
- Competition results
- Leaderboards

---

## Complex Plural Patterns

### Good Example - Nested Plurals with Select

```typescript
import { useTranslations } from "next-intl";

type NotificationData = {
  count: number;
  type: "message" | "mention" | "follow";
};

function NotificationSummary({ data }: { data: NotificationData }) {
  const t = useTranslations("Notifications");

  return <span>{t("summary", { count: data.count, type: data.type })}</span>;
}
```

```json
{
  "Notifications": {
    "summary": "{type, select, message {{count, plural, =0 {No messages} one {# new message} other {# new messages}}} mention {{count, plural, =0 {No mentions} one {# new mention} other {# new mentions}}} follow {{count, plural, =0 {No follows} one {# new follower} other {# new followers}}} other {{count, plural, =0 {No notifications} one {# notification} other {# notifications}}}}"
  }
}
```

**Why good:** combines select for type variation with plural for count variation, handles all combinations in single string

### Good Example - Plural with Range

```typescript
import { useTranslations } from "next-intl";

function ItemCount({ count, max }: { count: number; max: number }) {
  const t = useTranslations("Items");

  return <span>{t("showing", { count, max })}</span>;
}
```

```json
{
  "Items": {
    "showing": "Showing {count, plural, one {# item} other {# items}} of {max}"
  }
}
```

**Why good:** plural applies to dynamic count while max is static, clear sentence structure maintained

---

## Plural Edge Cases

### Good Example - Zero Handling Options

```typescript
import { useTranslations } from "next-intl";

function CartSummary({ itemCount }: { itemCount: number }) {
  const t = useTranslations("Cart");

  return <span>{t("items", { count: itemCount })}</span>;
}
```

```json
{
  "Cart": {
    "items": "{count, plural, =0 {Your cart is empty} one {# item in cart} other {# items in cart}}"
  }
}
```

**Why good:** `=0` provides specific zero-case message distinct from plural "zero" category

### Difference Between =0 and zero

| Syntax | Behavior |
|--------|----------|
| `=0` | Exact match for value 0 |
| `zero` | CLDR plural category (some languages like Arabic have different rules) |

For English, use `=0` for explicit zero handling since English has no "zero" plural category.

---

_See [core.md](core.md) for basic cardinal plurals and select patterns._
