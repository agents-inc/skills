# MongoDB Aggregation Examples

> Aggregation pipeline patterns: $match, $group, $lookup, $project, $facet, pagination, and performance. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Queries:** See [queries.md](queries.md). **Advanced:** See [patterns.md](patterns.md). **Indexes:** See [indexes.md](indexes.md).

---

## Pattern 1: Basic Aggregation Pipeline

### Good Example -- Sales Report

```typescript
import { PipelineStage } from "mongoose";

const MIN_ORDER_COUNT = 5;

async function getSalesReport(startDate: Date, endDate: Date) {
  const pipeline: PipelineStage[] = [
    // 1. Filter early to reduce dataset (uses index on createdAt)
    {
      $match: {
        status: "completed",
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    // 2. Group by category
    {
      $group: {
        _id: "$category",
        totalRevenue: { $sum: "$total" },
        orderCount: { $sum: 1 },
        avgOrderValue: { $avg: "$total" },
        minOrder: { $min: "$total" },
        maxOrder: { $max: "$total" },
      },
    },
    // 3. Filter groups with significant volume
    {
      $match: {
        orderCount: { $gte: MIN_ORDER_COUNT },
      },
    },
    // 4. Shape the output
    {
      $project: {
        category: "$_id",
        _id: 0,
        totalRevenue: { $round: ["$totalRevenue", 2] },
        orderCount: 1,
        avgOrderValue: { $round: ["$avgOrderValue", 2] },
        minOrder: 1,
        maxOrder: 1,
      },
    },
    // 5. Sort by revenue descending
    { $sort: { totalRevenue: -1 } },
  ];

  return Order.aggregate(pipeline);
}

export { getSalesReport };
```

**Why good:** `$match` first to leverage indexes and reduce dataset, typed `PipelineStage[]`, named constant for threshold, `$round` for clean output, `$project` reshapes output without \_id

### Bad Example -- $match After $group

```typescript
// BAD: Processing all documents before filtering
const result = await Order.aggregate([
  { $group: { _id: "$category", total: { $sum: "$total" } } },
  { $match: { _id: { $ne: "test" } } }, // Filter AFTER grouping all documents
]);
```

**Why bad:** Groups ALL documents before filtering, processes unnecessary data, placing `$match` before `$group` would filter first and reduce the grouping workload

---

## Pattern 2: $lookup (Joins)

### Good Example -- Join with Pipeline

```typescript
async function getOrdersWithCustomerDetails(status: string) {
  return Order.aggregate([
    { $match: { status } },
    // Join with customers collection
    {
      $lookup: {
        from: "customers",
        localField: "customerId",
        foreignField: "_id",
        as: "customer",
        // Pipeline $lookup for selective fields
        pipeline: [{ $project: { name: 1, email: 1, tier: 1 } }],
      },
    },
    // Flatten the array to a single object
    { $unwind: "$customer" },
    // Join with products for line items
    {
      $lookup: {
        from: "products",
        localField: "items.productId",
        foreignField: "_id",
        as: "productDetails",
        pipeline: [{ $project: { name: 1, sku: 1, price: 1 } }],
      },
    },
    {
      $project: {
        orderNumber: 1,
        status: 1,
        total: 1,
        createdAt: 1,
        customer: 1,
        items: 1,
        productDetails: 1,
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
}

export { getOrdersWithCustomerDetails };
```

**Why good:** Pipeline-based `$lookup` limits fields from joined collection, `$unwind` after `$lookup` for one-to-one join, separate lookups for different references

### Bad Example -- Lookup Without Field Selection

```typescript
// BAD: Fetches ALL fields from joined collection
const result = await Order.aggregate([
  {
    $lookup: {
      from: "customers",
      localField: "customerId",
      foreignField: "_id",
      as: "customer", // Returns entire customer document
    },
  },
]);
```

**Why bad:** Returns all customer fields including potentially sensitive data, no pipeline to filter fields, wasteful for large documents

---

## Pattern 3: $facet for Multi-Result Queries

### Good Example -- Search with Faceted Results

```typescript
const PAGE_SIZE = 20;

async function searchProducts(searchTerm: string, page: number = 1) {
  const matchStage: PipelineStage = {
    $match: {
      isActive: true,
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { tags: { $in: [searchTerm.toLowerCase()] } },
      ],
    },
  };

  const result = await Product.aggregate([
    matchStage,
    {
      $facet: {
        // Paginated results
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * PAGE_SIZE },
          { $limit: PAGE_SIZE },
          { $project: { name: 1, price: 1, category: 1, tags: 1 } },
        ],
        // Total count
        totalCount: [{ $count: "count" }],
        // Category breakdown
        categoryFacets: [
          { $group: { _id: "$category", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
        // Price range
        priceRange: [
          {
            $group: {
              _id: null,
              minPrice: { $min: "$price" },
              maxPrice: { $max: "$price" },
              avgPrice: { $avg: "$price" },
            },
          },
        ],
      },
    },
  ]);

  const { data, totalCount, categoryFacets, priceRange } = result[0];

  return {
    data,
    total: totalCount[0]?.count ?? 0,
    categories: categoryFacets,
    priceRange: priceRange[0] ?? null,
    page,
    pageSize: PAGE_SIZE,
  };
}

export { searchProducts };
```

**Why good:** `$facet` runs multiple aggregations in a single pass, returns data + metadata + facets in one query, `$match` before `$facet` filters early

---

## Pattern 4: Aggregation with Date Operations

### Good Example -- Time-Series Analytics

```typescript
async function getDailyRevenue(startDate: Date, endDate: Date) {
  return Order.aggregate([
    {
      $match: {
        status: "completed",
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        },
        revenue: { $sum: "$total" },
        orderCount: { $sum: 1 },
        avgOrderValue: { $avg: "$total" },
      },
    },
    {
      $project: {
        _id: 0,
        date: {
          $dateFromParts: {
            year: "$_id.year",
            month: "$_id.month",
            day: "$_id.day",
          },
        },
        revenue: { $round: ["$revenue", 2] },
        orderCount: 1,
        avgOrderValue: { $round: ["$avgOrderValue", 2] },
      },
    },
    { $sort: { date: 1 } },
  ]);
}

export { getDailyRevenue };
```

**Why good:** Date extraction operators for grouping by day, `$dateFromParts` to reconstruct a proper Date for output, `$round` for clean monetary values

---

## Pattern 5: $bucket and $bucketAuto

### Good Example -- Price Distribution

```typescript
const PRICE_BOUNDARIES = [0, 10, 25, 50, 100, 250, 500, 1000, Infinity];

async function getPriceDistribution() {
  return Product.aggregate([
    { $match: { isActive: true } },
    {
      $bucket: {
        groupBy: "$price",
        boundaries: PRICE_BOUNDARIES,
        default: "other",
        output: {
          count: { $sum: 1 },
          avgPrice: { $avg: "$price" },
          products: { $push: { name: "$name", price: "$price" } },
        },
      },
    },
  ]);
}

export { getPriceDistribution };
```

**Why good:** Named constant for boundaries, `$bucket` for predefined ranges, output includes count, average, and sample products

---

## Pattern 6: $merge for Materialized Views

### Good Example -- Pre-Computed Analytics

```typescript
async function refreshCategorySummary(): Promise<void> {
  await Product.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$category",
        productCount: { $sum: 1 },
        avgPrice: { $avg: "$price" },
        totalStock: { $sum: "$stock" },
        priceRange: {
          min: { $min: "$price" },
          max: { $max: "$price" },
        },
      },
    },
    {
      $project: {
        _id: 0,
        category: "$_id",
        productCount: 1,
        avgPrice: { $round: ["$avgPrice", 2] },
        totalStock: 1,
        priceRange: 1,
        updatedAt: new Date(),
      },
    },
    {
      $merge: {
        into: "category_summaries",
        on: "category",
        whenMatched: "replace",
        whenNotMatched: "insert",
      },
    },
  ]);
}

export { refreshCategorySummary };
```

**Why good:** `$merge` writes results to a separate collection as a materialized view, upsert behavior with `whenMatched`/`whenNotMatched`, timestamp for cache freshness, avoids running heavy aggregation on every read

---

## Pattern 7: $setWindowFields (Mongoose 7+)

### Good Example -- Running Totals and Rankings

```typescript
async function getProductRankings() {
  return Product.aggregate([
    { $match: { isActive: true } },
    {
      $setWindowFields: {
        partitionBy: "$category",
        sortBy: { salesCount: -1 },
        output: {
          categoryRank: {
            $rank: {},
          },
          categorySalesTotal: {
            $sum: "$salesCount",
            window: { documents: ["unbounded", "unbounded"] },
          },
          runningTotal: {
            $sum: "$salesCount",
            window: { documents: ["unbounded", "current"] },
          },
        },
      },
    },
    { $sort: { category: 1, categoryRank: 1 } },
  ]);
}

export { getProductRankings };
```

**Why good:** Window functions for analytics without separate queries, `$rank` for within-group ranking, running totals and partition totals in one pass

---

## Performance Tips for Aggregation

1. **Place `$match` and `$limit` as early as possible** -- reduces documents flowing through the pipeline
2. **Use indexes on `$match` fields** -- the first `$match` can use indexes, subsequent stages cannot
3. **Avoid `$unwind` + `$group` for array transformations** -- use array operators (`$map`, `$filter`, `$reduce`) instead
4. **Use `$project` early to drop unnecessary fields** -- reduces memory per document
5. **Set `allowDiskUse: true` for large pipelines** -- prevents memory limit errors on 100 MB+ working sets
6. **Use `$merge` for frequently-accessed aggregations** -- pre-compute results instead of running on every request
7. **Limit `$lookup` results** -- add `pipeline` with `$limit` to prevent joining unbounded datasets
8. **Use `explain("executionStats")` to analyze pipeline performance**

```typescript
// Enable disk use for large aggregations
const result = await Order.aggregate(pipeline).option({ allowDiskUse: true });

// Explain aggregation performance
const explanation = await Order.aggregate(pipeline).explain("executionStats");
```

---

_For core patterns, see [core.md](core.md). For query patterns, see [queries.md](queries.md). For schema design, see [patterns.md](patterns.md). For indexes, see [indexes.md](indexes.md)._
