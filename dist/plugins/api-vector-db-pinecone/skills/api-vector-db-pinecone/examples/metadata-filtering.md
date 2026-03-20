# Pinecone -- Metadata Filtering Examples

> Filter operators, compound filters, and best practices. See [core.md](core.md) for basic query patterns and [reference.md](../reference.md) for the operator table.

**Related examples:**

- [core.md](core.md) -- Client setup, basic query with filters
- [namespaces.md](namespaces.md) -- Alternative to filtering for multi-tenancy

---

## Comparison Operators

```typescript
const TOP_K = 10;

// Exact match
const drama = await index.namespace(ns).query({
  vector: embedding,
  topK: TOP_K,
  includeMetadata: true,
  filter: { genre: { $eq: "drama" } },
});

// Not equal
const notComedy = await index.namespace(ns).query({
  vector: embedding,
  topK: TOP_K,
  includeMetadata: true,
  filter: { genre: { $ne: "comedy" } },
});

// Numeric range
const recent = await index.namespace(ns).query({
  vector: embedding,
  topK: TOP_K,
  includeMetadata: true,
  filter: { year: { $gte: 2020 } },
});

// Set membership
const selected = await index.namespace(ns).query({
  vector: embedding,
  topK: TOP_K,
  includeMetadata: true,
  filter: { genre: { $in: ["drama", "action", "thriller"] } },
});
```

**Why good:** Each operator targets specific types (see reference.md for full operator table), `$in` for set membership avoids multiple `$or` clauses

---

## Compound Filters with $and / $or

Only `$and` and `$or` are allowed at the top level of a filter expression.

```typescript
const TOP_K = 10;

// AND: all conditions must match
const filteredResults = await index.namespace(ns).query({
  vector: embedding,
  topK: TOP_K,
  includeMetadata: true,
  filter: {
    $and: [
      { genre: { $eq: "drama" } },
      { year: { $gte: 2020 } },
      { rating: { $gt: 7.5 } },
    ],
  },
});

// OR: any condition matches
const broadResults = await index.namespace(ns).query({
  vector: embedding,
  topK: TOP_K,
  includeMetadata: true,
  filter: {
    $or: [{ genre: { $eq: "drama" } }, { genre: { $eq: "documentary" } }],
  },
});

// Combined AND + OR
const complexResults = await index.namespace(ns).query({
  vector: embedding,
  topK: TOP_K,
  includeMetadata: true,
  filter: {
    $and: [
      { year: { $gte: 2020 } },
      {
        $or: [{ genre: { $eq: "drama" } }, { genre: { $eq: "thriller" } }],
      },
    ],
  },
});
```

**Why good:** Nested logical operators for complex queries, `$or` inside `$and` for flexible filtering

---

## Field Existence Check

```typescript
const TOP_K = 10;

// Only records that have a "summary" field
const withSummary = await index.namespace(ns).query({
  vector: embedding,
  topK: TOP_K,
  includeMetadata: true,
  filter: { summary: { $exists: true } },
});

// Records missing a "category" field
const uncategorized = await index.namespace(ns).query({
  vector: embedding,
  topK: TOP_K,
  includeMetadata: true,
  filter: { category: { $exists: false } },
});
```

**Why good:** `$exists` checks for field presence without requiring a specific value, useful for incremental data enrichment workflows

---

## Delete by Metadata Filter

```typescript
// Delete all records matching a filter
await index.namespace(ns).deleteMany({
  filter: {
    $and: [{ status: { $eq: "archived" } }, { createdAt: { $lt: 1700000000 } }],
  },
});
```

**Why good:** Bulk deletion without knowing vector IDs, combines metadata filter with namespace targeting

---

## Fetch by Metadata Filter

```typescript
// Fetch records by metadata (no vector required)
const response = await index.namespace(ns).fetchByMetadata({
  filter: { category: { $eq: "tutorial" } },
  limit: 50,
});

for (const record of response.records ?? []) {
  console.log(record.id, record.metadata);
}
```

**Why good:** Retrieves records by metadata without needing vector IDs or a query vector, useful for data management tasks

---

## Common Filter Mistakes

```typescript
// ❌ Bad: Array as filter value (not valid syntax)
filter: { genre: ["drama", "action"] }
// Fix: use $in operator
filter: { genre: { $in: ["drama", "action"] } }

// ❌ Bad: Nested object in metadata
metadata: { author: { name: "Alice", org: "Acme" } }
// Fix: flatten to top-level keys
metadata: { authorName: "Alice", authorOrg: "Acme" }

// ❌ Bad: $eq with array value
filter: { genre: { $eq: ["drama", "action"] } }
// Fix: use $in for set membership
filter: { genre: { $in: ["drama", "action"] } }

// ❌ Bad: Type mismatch in comparison
// Metadata: { year: 2024 } (number)
filter: { year: { $eq: "2024" } } // String "2024" does NOT match number 2024
// Fix: use matching type
filter: { year: { $eq: 2024 } }

// ❌ Bad: Null value in metadata
metadata: { category: null }
// Fix: omit the field entirely, or use a sentinel value
metadata: { category: "uncategorized" }
```

**Why bad:** Each mistake causes either a rejection or silently empty results; type-strict comparisons are a common source of "no results" bugs

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
