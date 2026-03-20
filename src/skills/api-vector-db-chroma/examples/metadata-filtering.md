# Chroma -- Metadata Filtering Examples

> Filter operators, compound filters, document content filters, and where/whereDocument patterns. See [core.md](core.md) for basic query patterns and [reference.md](../reference.md) for the operator table.

**Related examples:**

- [core.md](core.md) -- Client setup, basic query with filters
- [embedding-functions.md](embedding-functions.md) -- Embedding function configuration

---

## Comparison Operators

```typescript
const N_RESULTS = 10;

// Exact match (explicit)
const drama = await collection.query({
  queryTexts: ["dramatic story"],
  nResults: N_RESULTS,
  where: { genre: { $eq: "drama" } },
});

// Exact match (shorthand -- equivalent to $eq)
const dramaShorthand = await collection.query({
  queryTexts: ["dramatic story"],
  nResults: N_RESULTS,
  where: { genre: "drama" },
});

// Not equal
const notComedy = await collection.query({
  queryTexts: ["funny story"],
  nResults: N_RESULTS,
  where: { genre: { $ne: "comedy" } },
});

// Numeric range (greater than or equal)
const recent = await collection.query({
  queryTexts: ["recent articles"],
  nResults: N_RESULTS,
  where: { year: { $gte: 2023 } },
});

// Numeric range (less than)
const older = await collection.query({
  queryTexts: ["historical articles"],
  nResults: N_RESULTS,
  where: { year: { $lt: 2020 } },
});
```

**Why good:** Each operator targets specific types, shorthand `{ genre: "drama" }` is equivalent to `{ genre: { $eq: "drama" } }`

---

## Set Membership Operators

```typescript
const N_RESULTS = 10;

// $in -- value in set
const selectedGenres = await collection.query({
  queryTexts: ["search query"],
  nResults: N_RESULTS,
  where: { genre: { $in: ["drama", "action", "thriller"] } },
});

// $nin -- value not in set
const excludedGenres = await collection.query({
  queryTexts: ["search query"],
  nResults: N_RESULTS,
  where: { genre: { $nin: ["horror", "comedy"] } },
});
```

**Why good:** `$in` replaces multiple `$or` / `$eq` clauses, cleaner and more efficient

---

## Array Metadata Operators

For metadata fields that are arrays (e.g., tags, authors). Requires Chroma >= 1.5.0.

```typescript
const N_RESULTS = 10;

// $contains -- array includes specific value
const chenPapers = await collection.query({
  queryTexts: ["machine learning"],
  nResults: N_RESULTS,
  where: { authors: { $contains: "Chen" } },
});

// $not_contains -- array excludes specific value
const withoutDraft = await collection.query({
  queryTexts: ["published papers"],
  nResults: N_RESULTS,
  where: { tags: { $not_contains: "draft" } },
});
```

**Why good:** `$contains` checks if an array metadata field includes a scalar value, works with string/int/float/boolean arrays

**Gotcha:** `$contains` and `$not_contains` only work on array metadata fields, not on scalar values. For scalar equality, use `$eq`.

---

## Compound Filters with $and / $or

```typescript
const N_RESULTS = 10;

// AND: all conditions must match
const filteredResults = await collection.query({
  queryTexts: ["search query"],
  nResults: N_RESULTS,
  where: {
    $and: [
      { genre: { $eq: "drama" } },
      { year: { $gte: 2020 } },
      { rating: { $gt: 7.5 } },
    ],
  },
});

// OR: any condition matches
const broadResults = await collection.query({
  queryTexts: ["search query"],
  nResults: N_RESULTS,
  where: {
    $or: [{ genre: { $eq: "drama" } }, { genre: { $eq: "documentary" } }],
  },
});

// Nested AND + OR
const complexResults = await collection.query({
  queryTexts: ["search query"],
  nResults: N_RESULTS,
  where: {
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

## Document Content Filtering (whereDocument)

Filter by document text content using `$contains`, `$not_contains`, `$regex`, and `$not_regex`.

```typescript
const N_RESULTS = 10;

// $contains -- case-sensitive substring match
const containsNeural = await collection.query({
  queryTexts: ["deep learning"],
  nResults: N_RESULTS,
  whereDocument: { $contains: "neural network" },
});

// $not_contains -- exclude documents with substring
const excludeDeprecated = await collection.query({
  queryTexts: ["current practices"],
  nResults: N_RESULTS,
  whereDocument: { $not_contains: "deprecated" },
});

// $regex -- pattern matching
const regexMatch = await collection.query({
  queryTexts: ["technical papers"],
  nResults: N_RESULTS,
  whereDocument: { $regex: "deep\\s+learning" },
});

// $not_regex -- exclude by pattern
const excludePattern = await collection.query({
  queryTexts: ["final papers"],
  nResults: N_RESULTS,
  whereDocument: { $not_regex: "draft.*v[0-9]" },
});
```

**Why good:** `$contains` for simple substring search, `$regex` for pattern matching, `$not_*` variants for exclusion

**Gotcha:** `$contains` is case-sensitive -- "Neural" will not match "neural". Use `$regex` with case-insensitive patterns if needed.

---

## Compound Document Filters

```typescript
const N_RESULTS = 10;

// AND -- both substrings must appear in document
const bothTerms = await collection.query({
  queryTexts: ["AI research"],
  nResults: N_RESULTS,
  whereDocument: {
    $and: [{ $contains: "transformer" }, { $contains: "attention" }],
  },
});

// OR -- either substring matches
const eitherTerm = await collection.query({
  queryTexts: ["AI research"],
  nResults: N_RESULTS,
  whereDocument: {
    $or: [{ $contains: "transformer" }, { $contains: "recurrent" }],
  },
});
```

**Why good:** Compound document filters for multi-term matching

---

## Combined Metadata + Document Filters

Use `where` and `whereDocument` together for maximum filtering precision.

```typescript
const N_RESULTS = 10;

const results = await collection.query({
  queryTexts: ["machine learning tutorial"],
  nResults: N_RESULTS,
  where: {
    $and: [{ category: { $eq: "tutorial" } }, { year: { $gte: 2023 } }],
  },
  whereDocument: { $contains: "neural network" },
  include: ["documents", "metadatas", "distances"],
});

// Access results (nested arrays for query)
for (let i = 0; i < results.ids[0].length; i++) {
  console.log(
    results.ids[0][i],
    results.distances?.[0]?.[i],
    results.metadatas?.[0]?.[i],
  );
}
```

**Why good:** Combined metadata + document filters for precise retrieval, correct nested array access

---

## Filtering with get() (No Vector Query)

Use `get()` with filters to retrieve documents without similarity search.

```typescript
const PAGE_SIZE = 50;

// Get by metadata filter
const tutorials = await collection.get({
  where: { category: { $eq: "tutorial" } },
  limit: PAGE_SIZE,
  include: ["documents", "metadatas"],
});

// Get by document content filter
const withCode = await collection.get({
  whereDocument: { $contains: "function" },
  limit: PAGE_SIZE,
  include: ["documents"],
});

// Combined metadata + document filter
const recentTutorialsWithCode = await collection.get({
  where: {
    $and: [{ category: { $eq: "tutorial" } }, { year: { $gte: 2023 } }],
  },
  whereDocument: { $contains: "function" },
  limit: PAGE_SIZE,
  include: ["documents", "metadatas"],
});
```

**Why good:** `get()` does not require a query vector, useful for data management and non-similarity-based retrieval

---

## Delete by Metadata Filter

```typescript
// Delete all records matching a filter
await collection.delete({
  where: {
    $and: [{ status: { $eq: "archived" } }, { year: { $lt: 2020 } }],
  },
});
```

**Why good:** Bulk deletion without knowing record IDs, compound filter for precise targeting

---

## Common Filter Mistakes

```typescript
// Bad: $gt on string value (only works on numbers)
where: {
  title: {
    $gt: "A";
  }
}
// Fix: use $eq, $ne, $in, or $nin for strings

// Bad: Nested object in metadata
metadatas: [{ author: { name: "Alice", org: "Acme" } }];
// Fix: flatten to top-level keys
metadatas: [{ authorName: "Alice", authorOrg: "Acme" }];

// Bad: Mixed types in array metadata
metadatas: [{ tags: ["draft", 2024, true] }]; // INVALID: mixed types
// Fix: arrays must be homogeneous
metadatas: [{ tags: ["draft", "2024"] }]; // All strings

// Bad: $contains on scalar metadata field
where: {
  category: {
    $contains: "tut";
  }
} // INVALID: $contains is for arrays
// Fix: use $eq for scalar fields, $contains for array fields
where: {
  category: {
    $eq: "tutorial";
  }
}

// Bad: Case-sensitive surprise with whereDocument
whereDocument: {
  $contains: "Neural";
} // Won't match "neural"
// Fix: use $regex for case-insensitive matching
whereDocument: {
  $regex: "(?i)neural";
}
```

**Why bad:** Each mistake causes either a rejection or silently empty results; type-restricted operators and case sensitivity are common sources of "no results" bugs

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
