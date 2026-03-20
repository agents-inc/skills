# Meilisearch -- Index Settings Examples

> Ranking rules, typo tolerance, synonyms, stop words, searchable attributes, and pagination configuration. Reference from [SKILL.md](../SKILL.md).

**Prerequisites:** Understand client setup and document operations from [core.md](core.md) first.

**Related examples:**

- [core.md](core.md) -- Client setup, document operations
- [filtering.md](filtering.md) -- filterableAttributes, sortableAttributes
- [security.md](security.md) -- API keys, tenant tokens

---

## Complete Index Setup

Configure all settings in a single call before adding documents. This avoids multiple re-indexes.

```typescript
import type { Meilisearch } from "meilisearch";

const INDEX_NAME = "products";

async function configureProductIndex(client: Meilisearch): Promise<void> {
  const index = client.index(INDEX_NAME);

  await index
    .updateSettings({
      // Fields to search (order = weight: first field has highest relevance)
      searchableAttributes: [
        "name", // Highest weight
        "brand",
        "description", // Lowest weight
      ],

      // Fields available for filtering and facets
      filterableAttributes: [
        "price",
        "categories",
        "brand",
        "inStock",
        "rating",
      ],

      // Fields available for sorting
      sortableAttributes: ["price", "rating", "createdAt"],

      // Ranking rules (order matters -- first rule has highest priority)
      rankingRules: [
        "words", // Documents containing more query terms rank higher
        "typo", // Fewer typos rank higher
        "proximity", // Query terms closer together rank higher
        "attribute", // Matches in higher-weight searchableAttributes rank higher
        "sort", // Custom sort (only active when sort parameter is used)
        "exactness", // Exact matches rank higher than prefix/typo matches
      ],

      // Typo tolerance configuration
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 5, // Words < 5 chars: no typos allowed
          twoTypos: 9, // Words < 9 chars: max 1 typo
        },
        disableOnAttributes: ["sku", "barcode", "partNumber"],
        disableOnWords: ["iPhone", "MacBook"],
      },

      // Synonyms
      synonyms: {
        phone: ["smartphone", "mobile", "cell phone"],
        laptop: ["notebook", "portable computer"],
        tv: ["television", "monitor", "screen"],
      },

      // Stop words (ignored in search queries)
      stopWords: ["the", "a", "an", "is", "at", "of", "on"],

      // Pagination limits
      pagination: {
        maxTotalHits: 5000, // Default is 1000
      },

      // Faceting limits
      faceting: {
        maxValuesPerFacet: 200, // Default is 100
      },
    })
    .waitTask(); // OK in setup script
}

export { configureProductIndex };
```

**Why good:** Single `updateSettings` call avoids multiple re-indexes, searchableAttributes ordered by relevance weight, typo tolerance disabled on exact-match fields, pagination limit increased from default 1000

---

## Ranking Rules

### Default Ranking Rules

The default order is: `words > typo > proximity > attribute > sort > exactness`. Meilisearch applies these in sequence as tiebreakers.

| Rule        | What it does                                                   |
| ----------- | -------------------------------------------------------------- |
| `words`     | Documents containing more query terms rank higher              |
| `typo`      | Documents with fewer typos rank higher                         |
| `proximity` | Documents where query terms appear closer together rank higher |
| `attribute` | Matches in higher-weight `searchableAttributes` rank higher    |
| `sort`      | Applies custom sort (only when `sort` parameter is used)       |
| `exactness` | Exact matches rank higher than prefix or typo matches          |

### Custom Ranking Rules

Add custom attribute-based sorting to the ranking pipeline:

```typescript
// Boost products by rating, then by number of reviews
await index
  .updateRankingRules([
    "words",
    "typo",
    "proximity",
    "attribute",
    "sort",
    "exactness",
    "rating:desc", // Custom: higher rating ranks higher
    "reviewCount:desc", // Custom: more reviews ranks higher
  ])
  .waitTask();
```

**Important:** Custom ranking rules (`attribute:asc` or `attribute:desc`) act as tiebreakers AFTER all built-in rules. Place them at the end.

**Gotcha:** If you move `sort` before `attribute`, the user's explicit sort parameter takes priority over attribute weight matching. This is rarely what you want.

---

## Searchable Attributes

Order determines relevance weight -- first attribute has the highest weight.

```typescript
// Good: ordered by relevance weight
await index
  .updateSearchableAttributes([
    "title", // Highest weight -- title matches are most relevant
    "author", // Medium weight
    "description", // Lowest weight -- description matches are less relevant
  ])
  .waitTask();

// Bad: using ["*"] (default) -- all fields have equal weight
// A match in "internalNotes" ranks equally with a match in "title"
```

**Gotcha:** `searchableAttributes` with `["*"]` (the default) indexes ALL fields with equal weight, including fields you may not want searched (internal IDs, timestamps, metadata). Always set this explicitly.

---

## Typo Tolerance

### Disabling for Specific Fields

```typescript
// Disable typo tolerance on fields that require exact matching
await index
  .updateTypoTolerance({
    enabled: true, // Keep global typo tolerance on
    disableOnAttributes: [
      "sku", // Product codes must match exactly
      "barcode", // Barcodes must match exactly
      "partNumber", // Part numbers must match exactly
      "email", // Email addresses must match exactly
    ],
  })
  .waitTask();
```

**Why good:** Typo tolerance stays enabled for natural language fields (name, description) but disabled for structured identifiers

### Disabling for Specific Words

```typescript
// Prevent typo corrections on brand names
await index
  .updateTypoTolerance({
    disableOnWords: [
      "iPhone", // Don't correct "iPhone" to "iPhobe"
      "MacBook", // Don't correct "MacBook" to "MacBoot"
      "PlayStation",
    ],
  })
  .waitTask();
```

### Adjusting Word Size Thresholds

```typescript
// Make typo tolerance stricter for short words
await index
  .updateTypoTolerance({
    minWordSizeForTypos: {
      oneTypo: 6, // Words shorter than 6 chars: no typos (default: 5)
      twoTypos: 12, // Words shorter than 12 chars: max 1 typo (default: 9)
    },
  })
  .waitTask();
```

**When to use:** When too many irrelevant results appear due to typo corrections on short common words.

---

## Synonyms

Synonyms expand search queries -- searching for "phone" also returns results containing "smartphone".

```typescript
await index
  .updateSynonyms({
    // One-way synonyms: searching "phone" matches "smartphone" and "mobile"
    // But searching "smartphone" does NOT match "phone"
    phone: ["smartphone", "mobile"],

    // For bidirectional: define both directions
    smartphone: ["phone", "mobile"],
    mobile: ["phone", "smartphone"],

    // Abbreviations
    tv: ["television"],
    television: ["tv"],
  })
  .waitTask();
```

**Gotcha:** Synonyms are NOT bidirectional by default. Defining `phone: ["smartphone"]` means searching "phone" matches "smartphone", but NOT the reverse. Define both directions explicitly.

**Gotcha:** Synonyms do NOT apply to filters. Filtering by `brand = "phone"` will NOT match documents where `brand = "smartphone"`, even if they are defined as synonyms.

---

## Stop Words

Stop words are ignored during search indexing and queries.

```typescript
// Common English stop words
const ENGLISH_STOP_WORDS = [
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "to",
  "with",
];

await index.updateStopWords(ENGLISH_STOP_WORDS).waitTask();
```

**When to use:** When common words pollute search results (searching "the matrix" returns too many results containing just "the").

**When NOT to use:** Domain-specific applications where common words are meaningful (medical: "the" is part of "The Lancet").

---

## Pagination Settings

### Increasing maxTotalHits

```typescript
const MAX_TOTAL_HITS = 10000;

// Default is 1000 -- increase if you need deep pagination
await index
  .updateSettings({
    pagination: { maxTotalHits: MAX_TOTAL_HITS },
  })
  .waitTask();
```

**Why this matters:** By default, Meilisearch caps searchable results at 1000. Even with `offset: 1500`, you will get 0 results. Increase `maxTotalHits` to paginate deeper.

**Tradeoff:** Higher `maxTotalHits` increases memory usage and search latency for large datasets. Only increase as far as your use case requires.

---

## Faceting Settings

```typescript
const MAX_FACET_VALUES = 500;

await index
  .updateSettings({
    faceting: {
      maxValuesPerFacet: MAX_FACET_VALUES, // Default: 100
      sortFacetValuesBy: {
        "*": "alpha", // Default: alphabetical for all facets
        price: "count", // Sort price facet by frequency (most common first)
      },
    },
  })
  .waitTask();
```

**When to use:** When a faceted attribute has more than 100 unique values and you need all of them in the facet distribution.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
