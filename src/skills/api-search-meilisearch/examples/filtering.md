# Meilisearch -- Filtering & Facets Examples

> Filter syntax, faceted search, geo search, and sorting patterns. Reference from [SKILL.md](../SKILL.md).

**Prerequisites:** Understand client setup and document operations from [core.md](core.md) first.

**Related examples:**

- [core.md](core.md) -- Client setup, document operations, search basics
- [settings.md](settings.md) -- Configuring filterableAttributes, sortableAttributes
- [security.md](security.md) -- Tenant tokens restrict filters per user

---

## Configuring Filterable and Sortable Attributes

This must happen BEFORE any filter or sort is used in search. Changes trigger a re-index.

```typescript
import type { Meilisearch } from "meilisearch";

const INDEX_NAME = "products";

async function configureProductIndex(client: Meilisearch): Promise<void> {
  const index = client.index(INDEX_NAME);

  await index
    .updateSettings({
      filterableAttributes: [
        "price",
        "categories",
        "brand",
        "inStock",
        "rating",
        "_geo", // Required for geo search
      ],
      sortableAttributes: [
        "price",
        "rating",
        "createdAt",
        "_geo", // Required for geo sort
      ],
    })
    .waitTask(); // OK in setup/seed script
}

export { configureProductIndex };
```

**Why good:** `_geo` explicitly listed in both filterable and sortable (required for geo search), `.waitTask()` used in setup script, all filter/sort attributes declared upfront

---

## Filter Syntax Examples

### String Equality

```typescript
// Exact match (case-sensitive for filters)
const results = await index.search("shoes", {
  filter: 'brand = "Nike"',
});

// Multiple values with IN
const results2 = await index.search("shoes", {
  filter: 'brand IN ["Nike", "Adidas", "Puma"]',
});
```

### Numeric Comparison

```typescript
const MIN_PRICE = 50;
const MAX_PRICE = 200;
const MIN_RATING = 4;

const results = await index.search("headphones", {
  filter: `price >= ${MIN_PRICE} AND price <= ${MAX_PRICE} AND rating >= ${MIN_RATING}`,
});
```

### Boolean and Existence

```typescript
// Boolean filter
const results = await index.search("laptop", {
  filter: "inStock = true",
});

// Existence check -- documents where field exists
const results2 = await index.search("", {
  filter: "discount EXISTS",
});

// Null check
const results3 = await index.search("", {
  filter: "deletedAt IS NULL",
});
```

### Combining with Parentheses

```typescript
// AND has higher precedence than OR -- always use parentheses
// Correct: electronics or computers, both under $500
const results = await index.search("", {
  filter:
    '(categories = "electronics" OR categories = "computers") AND price < 500',
});

// WITHOUT parentheses: "electronics" OR ("computers" AND price < 500)
// This is almost certainly NOT what you want
```

**Why good:** Explicit parentheses prevent precedence bugs, named constants for filter values

### Negation

```typescript
// Exclude specific values
const results = await index.search("phone", {
  filter: 'NOT brand = "Apple"',
});

// Combine negation with other filters
const results2 = await index.search("", {
  filter: 'categories = "electronics" AND NOT brand IN ["Apple", "Samsung"]',
});
```

---

## Faceted Search

Facets return counts of matching documents per attribute value. Useful for building filter UIs.

```typescript
import type { Meilisearch, SearchResponse } from "meilisearch";

interface FacetedSearchResult {
  hits: Product[];
  facetDistribution: Record<string, Record<string, number>>;
  totalHits: number;
}

async function facetedSearch(
  client: Meilisearch,
  query: string,
  activeFilters?: { categories?: string; brand?: string },
): Promise<FacetedSearchResult> {
  const index = client.index<Product>("products");

  const filterParts: string[] = [];
  if (activeFilters?.categories) {
    filterParts.push(`categories = "${activeFilters.categories}"`);
  }
  if (activeFilters?.brand) {
    filterParts.push(`brand = "${activeFilters.brand}"`);
  }

  const response = await index.search(query, {
    facets: ["categories", "brand", "inStock"],
    filter: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
    limit: 20,
  });

  return {
    hits: response.hits,
    facetDistribution: response.facetDistribution ?? {},
    totalHits: response.estimatedTotalHits ?? 0,
  };
}

// Usage:
// const result = await facetedSearch(client, "laptop");
// result.facetDistribution.brand == { "Apple": 12, "Dell": 8, "Lenovo": 6 }
// result.facetDistribution.categories == { "electronics": 20, "computers": 15 }

export { facetedSearch };
```

**Why good:** `facets` parameter returns count distribution per attribute value, facet counts reflect the CURRENT filter state (applying a category filter updates brand counts), handles null `facetDistribution`

**Important:** Faceted attributes must be in `filterableAttributes`. The `facets` parameter only controls which attribute counts are returned -- it does not enable filtering.

---

## Sorting

```typescript
// Sort by single attribute
const results = await index.search("laptop", {
  sort: ["price:asc"],
});

// Sort by multiple attributes (tiebreaker)
const results2 = await index.search("laptop", {
  sort: ["rating:desc", "price:asc"],
});

// Sort by distance (geo)
const results3 = await index.search("restaurant", {
  sort: ["_geoPoint(48.8566, 2.3522):asc"], // Sort by distance from Paris
});
```

**Important:** Sort attributes must be in `sortableAttributes`. The `sort` ranking rule must be present in `rankingRules` (it is by default).

---

## Geo Search

### Configuring Geo Data

Documents with geographic coordinates must use the `_geo` field:

```typescript
interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  _geo: {
    lat: number;
    lng: number; // Must be "lng", NOT "longitude"
  };
}

const restaurants: Restaurant[] = [
  {
    id: "r1",
    name: "Chez Pierre",
    cuisine: "french",
    _geo: { lat: 48.8566, lng: 2.3522 },
  },
];
```

**Important:** The `_geo` field must use exactly `lat` and `lng` as keys. Using `latitude`/`longitude` causes an `invalid_document_geo_field` error and the document fails to index.

### Filtering by Radius

```typescript
const SEARCH_RADIUS_METERS = 5000; // 5km

// Find restaurants within 5km of a point
const results = await index.search("", {
  filter: `_geoRadius(48.8566, 2.3522, ${SEARCH_RADIUS_METERS})`,
});
```

### Filtering by Bounding Box

```typescript
// Find within a rectangular area
// _geoBoundingBox([topLeftLat, topLeftLng], [bottomRightLat, bottomRightLng])
const results = await index.search("", {
  filter: "_geoBoundingBox([48.90, 2.25], [48.80, 2.42])",
});
```

### Sorting by Distance

```typescript
// Sort results by distance from user's location
async function searchNearby(
  client: Meilisearch,
  query: string,
  userLat: number,
  userLng: number,
): Promise<SearchResponse<Restaurant>> {
  const index = client.index<Restaurant>("restaurants");
  return index.search(query, {
    sort: [`_geoPoint(${userLat}, ${userLng}):asc`],
    limit: 20,
  });
}

// Each hit includes _geoDistance (meters from the point) in the response
// results.hits[0]._geoDistance == 342

export { searchNearby };
```

**Why good:** `_geoPoint(lat, lng):asc` sorts by proximity, `_geoDistance` automatically included in results when geo sorting

### Combining Geo with Other Filters

```typescript
const NEARBY_RADIUS_METERS = 2000;

const results = await index.search("pizza", {
  filter: `_geoRadius(48.8566, 2.3522, ${NEARBY_RADIUS_METERS}) AND cuisine = "italian"`,
  sort: ["_geoPoint(48.8566, 2.3522):asc"],
});
```

**Why good:** Geo filter (radius) combined with attribute filter (cuisine), sorted by proximity

---

## Distinct Attribute

Deduplicate results by a field -- useful when the same product appears in multiple variants.

```typescript
// Return only one result per product (even if multiple color variants exist)
const results = await index.search("sneakers", {
  distinct: "productGroupId",
});
```

**Important:** The `distinct` attribute must be in `filterableAttributes` to work.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
