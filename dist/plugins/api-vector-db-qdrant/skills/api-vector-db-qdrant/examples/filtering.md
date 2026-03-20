# Qdrant -- Filtering Examples

> Payload filtering with must/should/must_not conditions, match/range operators, and payload indexing. See [core.md](core.md) for basic query patterns and [reference.md](../reference.md) for the operator table.

**Related examples:**

- [core.md](core.md) -- Client setup, upsert, query, scroll, delete
- [named-vectors-quantization.md](named-vectors-quantization.md) -- Named vectors, quantization config

---

## Create Payload Indexes

**Always create indexes on fields used in filter conditions.** Without indexes, filters cause full collection scans.

```typescript
import type { QdrantClient } from "@qdrant/js-client-rest";

async function setupPayloadIndexes(
  client: QdrantClient,
  collectionName: string,
): Promise<void> {
  // Keyword index for exact match / enum-like fields
  await client.createPayloadIndex(collectionName, {
    field_name: "category",
    field_schema: "keyword",
    wait: true,
  });

  // Integer index for range queries
  await client.createPayloadIndex(collectionName, {
    field_name: "publishedAt",
    field_schema: "integer",
    wait: true,
  });

  // Text index for full-text search
  await client.createPayloadIndex(collectionName, {
    field_name: "description",
    field_schema: "text",
    wait: true,
  });

  // Float index for numeric range
  await client.createPayloadIndex(collectionName, {
    field_name: "score",
    field_schema: "float",
    wait: true,
  });
}

export { setupPayloadIndexes };
```

**Why good:** Indexes created per field type, `wait: true` ensures index is ready before queries, covers common field types

**Gotcha:** Create indexes BEFORE bulk data ingestion when possible. Retroactive indexing after millions of points is slower than indexing during upsert.

---

## Must (AND) Conditions

All conditions must match. Equivalent to logical AND.

```typescript
const TOP_K = 10;

const results = await client.query("documents", {
  query: embedding,
  filter: {
    must: [
      { key: "category", match: { value: "tutorial" } },
      { key: "publishedAt", range: { gte: 1700000000 } },
    ],
  },
  with_payload: true,
  limit: TOP_K,
});
```

**Why good:** Both conditions enforced, explicit match and range operators with correct nesting

---

## Should (OR) Conditions

At least one condition must match. Equivalent to logical OR.

```typescript
const TOP_K = 10;

const results = await client.query("documents", {
  query: embedding,
  filter: {
    should: [
      { key: "category", match: { value: "tutorial" } },
      { key: "category", match: { value: "guide" } },
    ],
  },
  with_payload: true,
  limit: TOP_K,
});
```

**Why good:** OR logic via `should`, each condition independent

---

## Must Not (NOT) Conditions

No listed conditions may match. Equivalent to logical NOT.

```typescript
const TOP_K = 10;

const results = await client.query("documents", {
  query: embedding,
  filter: {
    must_not: [
      { key: "category", match: { value: "archived" } },
      { key: "status", match: { value: "draft" } },
    ],
  },
  with_payload: true,
  limit: TOP_K,
});
```

**Why good:** Excludes both archived and draft documents, clean negation syntax

---

## Combined must + should + must_not

Mix filter logic at the top level.

```typescript
const TOP_K = 10;

const results = await client.query("documents", {
  query: embedding,
  filter: {
    must: [{ key: "publishedAt", range: { gte: 1700000000 } }],
    should: [
      { key: "category", match: { value: "tutorial" } },
      { key: "category", match: { value: "guide" } },
    ],
    must_not: [{ key: "status", match: { value: "draft" } }],
  },
  with_payload: true,
  limit: TOP_K,
});
```

**Why good:** AND + OR + NOT in a single filter, readable structure

**Semantics:** `must AND (at least one should) AND (none of must_not)` -- all three clauses are combined with AND at the top level.

---

## Match Operators

```typescript
const TOP_K = 10;

// Exact value match
const exact = await client.query("products", {
  query: embedding,
  filter: { must: [{ key: "brand", match: { value: "Acme" } }] },
  limit: TOP_K,
});

// Match any value from a list (like SQL IN)
const anyOf = await client.query("products", {
  query: embedding,
  filter: {
    must: [{ key: "brand", match: { any: ["Acme", "Globex", "Initech"] } }],
  },
  limit: TOP_K,
});

// Exclude values from a list (like SQL NOT IN)
const exceptThese = await client.query("products", {
  query: embedding,
  filter: { must: [{ key: "brand", match: { except: ["Acme", "Globex"] } }] },
  limit: TOP_K,
});

// Full-text substring match (requires text index)
const textMatch = await client.query("products", {
  query: embedding,
  filter: { must: [{ key: "description", match: { text: "wireless" } }] },
  limit: TOP_K,
});
```

**Why good:** Four match variants for different use cases, comments clarify SQL equivalents

---

## Range Operators

```typescript
const TOP_K = 10;

// Numeric range (price between 10 and 100)
const priceRange = await client.query("products", {
  query: embedding,
  filter: {
    must: [{ key: "price", range: { gte: 10, lte: 100 } }],
  },
  limit: TOP_K,
});

// Open-ended range (published after a date)
const recent = await client.query("documents", {
  query: embedding,
  filter: {
    must: [{ key: "publishedAt", range: { gt: 1700000000 } }],
  },
  limit: TOP_K,
});
```

**Why good:** Range supports `gt`, `gte`, `lt`, `lte` -- any subset can be used, both bounded and open-ended ranges shown

---

## Existence and Null Checks

```typescript
const TOP_K = 10;

// Points where "summary" field has no value
const empty = await client.query("documents", {
  query: embedding,
  filter: {
    must: [{ is_empty: { key: "summary" } }],
  },
  limit: TOP_K,
});

// Points where "deleted_at" is explicitly null
const nullField = await client.query("documents", {
  query: embedding,
  filter: {
    must: [{ is_null: { key: "deleted_at" } }],
  },
  limit: TOP_K,
});

// Points by specific IDs
const byId = await client.query("documents", {
  query: embedding,
  filter: {
    must: [{ has_id: [1, 42, 100] }],
  },
  limit: TOP_K,
});
```

**Why good:** `is_empty` checks for missing/empty fields, `is_null` checks for explicit nulls, `has_id` filters by point IDs

**Gotcha:** `is_empty` matches when the field does not exist OR has an empty value. `is_null` matches only when the field exists and is explicitly `null`.

---

## Nested Payload Filtering

Filter on fields inside nested JSON objects.

```typescript
const TOP_K = 10;

// Payload structure: { items: [{ name: "Widget", price: 29.99 }] }
const results = await client.query("orders", {
  query: embedding,
  filter: {
    must: [
      {
        nested: {
          key: "items",
          filter: {
            must: [
              { key: "name", match: { value: "Widget" } },
              { key: "price", range: { lte: 50 } },
            ],
          },
        },
      },
    ],
  },
  limit: TOP_K,
});
```

**Why good:** Nested filter reaches into array-of-objects payload structure, conditions apply within each nested object

**Gotcha:** Nested filtering requires the parent field to be an array of objects. Conditions within a `nested` block apply to each object independently -- a point matches if ANY object in the array satisfies ALL conditions.

---

## Values Count Filter

Filter by the number of values a multi-value payload field has.

```typescript
const TOP_K = 10;

// Points with at least 3 tags
const wellTagged = await client.query("documents", {
  query: embedding,
  filter: {
    must: [{ key: "tags", values_count: { gte: 3 } }],
  },
  limit: TOP_K,
});
```

**Why good:** Filters by cardinality of multi-value fields, useful for quality filtering

---

## Common Filter Mistakes

```typescript
// Bad: Pinecone-style syntax (does NOT work in Qdrant)
filter: {
  $and: [{ category: { $eq: "tutorial" } }];
}
// Fix: Use Qdrant must/match syntax
filter: {
  must: [{ key: "category", match: { value: "tutorial" } }];
}

// Bad: Missing "key" field in condition
filter: {
  must: [{ match: { value: "tutorial" } }];
}
// Fix: Always include the payload field key
filter: {
  must: [{ key: "category", match: { value: "tutorial" } }];
}

// Bad: Range on unindexed field (full scan)
filter: {
  must: [{ key: "price", range: { gte: 10 } }];
}
// Fix: Create index first
await client.createPayloadIndex("products", {
  field_name: "price",
  field_schema: "float",
});

// Bad: Using "or" instead of "should"
filter: {
  or: [{ key: "a", match: { value: 1 } }];
}
// Fix: Use "should" for OR logic
filter: {
  should: [{ key: "a", match: { value: 1 } }];
}
```

**Why bad:** Each mistake causes either query rejection, silent empty results, or severe performance degradation

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
