# Elasticsearch -- Aggregation Examples

> Terms, range, date_histogram, nested, and pipeline aggregation patterns. Reference from [SKILL.md](../SKILL.md).

**Prerequisites:** Understand client setup and index management from [core.md](core.md) first.

**Related examples:**

- [core.md](core.md) -- Client setup, document operations, search basics
- [pagination.md](pagination.md) -- Paginating aggregation results

---

## Terms Aggregation

Group by field values and get document counts.

```typescript
import type { Client } from "@elastic/elasticsearch";

const INDEX_NAME = "products";
const AGGREGATION_SIZE = 50;

async function getCategoryDistribution(
  client: Client,
): Promise<Array<{ key: string; count: number }>> {
  const result = await client.search({
    index: INDEX_NAME,
    size: 0, // No hits needed -- only aggregations
    aggs: {
      categories: {
        terms: { field: "categories", size: AGGREGATION_SIZE },
      },
    },
  });

  const buckets =
    (
      result.aggregations?.categories as {
        buckets: Array<{ key: string; doc_count: number }>;
      }
    )?.buckets ?? [];

  return buckets.map((b) => ({ key: b.key, count: b.doc_count }));
}

export { getCategoryDistribution };
```

**Why good:** `size: 0` skips hits (faster when only aggregations matter), named constant for aggregation size, typed bucket extraction

**Important:** `terms` aggregation returns an approximate count. The `size` parameter controls how many top buckets to return (default: 10), NOT how many documents to scan.

---

## Terms with Sub-Aggregations

Nest metric aggregations inside bucket aggregations.

```typescript
async function getCategoryStats(
  client: Client,
): Promise<
  Array<{ category: string; count: number; avgPrice: number; maxPrice: number }>
> {
  const result = await client.search({
    index: INDEX_NAME,
    size: 0,
    aggs: {
      categories: {
        terms: { field: "categories", size: AGGREGATION_SIZE },
        aggs: {
          avgPrice: { avg: { field: "price" } },
          maxPrice: { max: { field: "price" } },
        },
      },
    },
  });

  const buckets =
    (
      result.aggregations?.categories as {
        buckets: Array<{
          key: string;
          doc_count: number;
          avgPrice: { value: number | null };
          maxPrice: { value: number | null };
        }>;
      }
    )?.buckets ?? [];

  return buckets.map((b) => ({
    category: b.key,
    count: b.doc_count,
    avgPrice: b.avgPrice.value ?? 0,
    maxPrice: b.maxPrice.value ?? 0,
  }));
}

export { getCategoryStats };
```

**Why good:** Nested sub-aggregations compute per-bucket metrics, `value` can be null (e.g., empty buckets), null handled with fallback

---

## Range Aggregation

Create custom numeric ranges for bucketing.

```typescript
async function getPriceRanges(
  client: Client,
): Promise<Array<{ range: string; count: number }>> {
  const result = await client.search({
    index: INDEX_NAME,
    size: 0,
    aggs: {
      priceRanges: {
        range: {
          field: "price",
          ranges: [
            { key: "budget", to: 50 },
            { key: "mid-range", from: 50, to: 200 },
            { key: "premium", from: 200, to: 500 },
            { key: "luxury", from: 500 },
          ],
        },
      },
    },
  });

  const buckets =
    (
      result.aggregations?.priceRanges as {
        buckets: Array<{ key: string; doc_count: number }>;
      }
    )?.buckets ?? [];

  return buckets.map((b) => ({ range: b.key, count: b.doc_count }));
}

export { getPriceRanges };
```

**Why good:** Named keys make bucket identification readable, ranges cover the full spectrum with no gaps

**Gotcha:** `from` is inclusive, `to` is exclusive. A document with `price: 50` falls into "mid-range" (50-200), not "budget" (to: 50).

---

## Date Histogram

Time-based bucketing for time series data.

```typescript
async function getMonthlySales(
  client: Client,
  year: number,
): Promise<Array<{ month: string; count: number; revenue: number }>> {
  const result = await client.search({
    index: "orders",
    size: 0,
    query: {
      range: {
        orderDate: {
          gte: `${year}-01-01`,
          lt: `${year + 1}-01-01`,
        },
      },
    },
    aggs: {
      monthly: {
        date_histogram: {
          field: "orderDate",
          calendar_interval: "month",
          format: "yyyy-MM",
          min_doc_count: 0, // Include empty months
        },
        aggs: {
          revenue: { sum: { field: "totalAmount" } },
        },
      },
    },
  });

  const buckets =
    (
      result.aggregations?.monthly as {
        buckets: Array<{
          key_as_string: string;
          doc_count: number;
          revenue: { value: number };
        }>;
      }
    )?.buckets ?? [];

  return buckets.map((b) => ({
    month: b.key_as_string,
    count: b.doc_count,
    revenue: b.revenue.value,
  }));
}

export { getMonthlySales };
```

**Why good:** `calendar_interval: "month"` handles varying month lengths correctly, `min_doc_count: 0` ensures empty months appear in results, `format` controls the `key_as_string` output

**Gotcha:** Use `calendar_interval` for months/quarters/years (variable length). Use `fixed_interval` for exact durations like "30d", "1h", "5m". Using `fixed_interval: "1M"` is an error -- months are not a fixed duration.

---

## Nested Aggregation

Aggregate inside nested objects.

```typescript
// Requires "reviews" field mapped as "nested" type

async function getRatingDistribution(
  client: Client,
): Promise<Array<{ rating: number; count: number }>> {
  const result = await client.search({
    index: INDEX_NAME,
    size: 0,
    aggs: {
      reviewsNested: {
        nested: { path: "reviews" },
        aggs: {
          ratingBuckets: {
            histogram: {
              field: "reviews.rating",
              interval: 1,
              min_doc_count: 0,
            },
          },
        },
      },
    },
  });

  const buckets =
    (
      result.aggregations?.reviewsNested as {
        ratingBuckets: {
          buckets: Array<{ key: number; doc_count: number }>;
        };
      }
    )?.ratingBuckets.buckets ?? [];

  return buckets.map((b) => ({ rating: b.key, count: b.doc_count }));
}

export { getRatingDistribution };
```

**Why good:** `nested` aggregation scope enters the nested documents before aggregating, histogram with interval 1 creates one bucket per rating value

**Important:** Without the `nested` aggregation wrapper, aggregating on `reviews.rating` would aggregate on the flattened array values, giving incorrect counts.

---

## Pipeline Aggregation

Compute values from the output of other aggregations.

```typescript
async function getMonthlyRevenueWithMovingAvg(
  client: Client,
): Promise<
  Array<{ month: string; revenue: number; movingAvg: number | null }>
> {
  const MOVING_FN_WINDOW = 3;

  const result = await client.search({
    index: "orders",
    size: 0,
    aggs: {
      monthly: {
        date_histogram: {
          field: "orderDate",
          calendar_interval: "month",
        },
        aggs: {
          revenue: { sum: { field: "totalAmount" } },
          revenueMovingAvg: {
            moving_fn: {
              buckets_path: "revenue",
              window: MOVING_FN_WINDOW,
              script: "MovingFunctions.unweightedAvg(values)",
            },
          },
        },
      },
    },
  });

  const buckets =
    (
      result.aggregations?.monthly as {
        buckets: Array<{
          key_as_string: string;
          revenue: { value: number };
          revenueMovingAvg?: { value: number };
        }>;
      }
    )?.buckets ?? [];

  return buckets.map((b) => ({
    month: b.key_as_string,
    revenue: b.revenue.value,
    movingAvg: b.revenueMovingAvg?.value ?? null,
  }));
}

export { getMonthlyRevenueWithMovingAvg };
```

**Why good:** `moving_fn` pipeline aggregation computes a rolling average from the `revenue` sub-aggregation using `MovingFunctions.unweightedAvg(values)`, `buckets_path` references the sibling aggregation by name, first N-1 buckets have null moving average (not enough data)

**Important:** `moving_avg` was removed in Elasticsearch 8.0. Use `moving_fn` with a script instead. Available predefined functions: `MovingFunctions.unweightedAvg(values)`, `MovingFunctions.linearWeightedAvg(values)`, `MovingFunctions.ewma(values, alpha)`, `MovingFunctions.holt(values, alpha, beta)`, `MovingFunctions.holtWinters(values, alpha, beta, gamma, period, multiplicative)`

---

## Aggregation with Filtered Scope

Apply a filter to an aggregation without affecting the main query.

```typescript
async function getInStockVsOutOfStock(
  client: Client,
): Promise<{ inStock: number; outOfStock: number }> {
  const result = await client.search({
    index: INDEX_NAME,
    size: 0,
    aggs: {
      inStockCount: {
        filter: { term: { inStock: true } },
      },
      outOfStockCount: {
        filter: { term: { inStock: false } },
      },
    },
  });

  return {
    inStock:
      (result.aggregations?.inStockCount as { doc_count: number })?.doc_count ??
      0,
    outOfStock:
      (result.aggregations?.outOfStockCount as { doc_count: number })
        ?.doc_count ?? 0,
  };
}

export { getInStockVsOutOfStock };
```

**Why good:** `filter` aggregation applies a separate filter scope per aggregation, each counting only matching documents

---

## Cardinality (Approximate Distinct Count)

```typescript
async function getUniqueBrandCount(client: Client): Promise<number> {
  const result = await client.search({
    index: INDEX_NAME,
    size: 0,
    aggs: {
      uniqueBrands: {
        cardinality: { field: "brand" },
      },
    },
  });

  return (result.aggregations?.uniqueBrands as { value: number })?.value ?? 0;
}

export { getUniqueBrandCount };
```

**Gotcha:** `cardinality` is an approximation using HyperLogLog++. For fields with < 1000 unique values, it's exact. For larger cardinalities, expect ~2-3% error margin.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
