# Hono + OpenAPI - Route Examples

> Filtering, pagination, and data transformation patterns. See [core.md](core.md) for basic route setup.

**Prerequisites**: Understand Pattern 2 (List Endpoint) and Pattern 3 (Detail Endpoint) from core examples first.

---

## Filtering Patterns

### Good Example - Comma-Separated Multi-Value Filters

The Hono route validates and extracts query params. The filter logic shows the pattern for parsing comma-separated values.

```typescript
app.openapi(getJobsRoute, async (c) => {
  const { country, employment_type } = c.req.valid("query");

  // Parse comma-separated values and normalize case
  const filters: Record<string, string[]> = {};

  if (country) {
    filters.country = country.split(",").map((c) => c.trim().toLowerCase());
  }

  if (employment_type) {
    filters.employment_type = employment_type.split(",").map((e) => e.trim());
  }

  // Pass normalized filters to your database query layer
  // Use case-insensitive matching (LOWER() or ILIKE) for text fields
  const results = await fetchJobs({ filters, limit: DEFAULT_QUERY_LIMIT });

  return c.json({ jobs: results, total: results.length }, 200);
});
```

**Why good:** comma-separated values support `?country=germany,france,spain` in one request, case normalization prevents "Germany" vs "germany" mismatches, `c.req.valid()` ensures type-safe extraction

### Bad Example - No multiple value support

```typescript
// BAD Example
app.get("/jobs", async (c) => {
  // BAD: c.req.query() bypasses Zod validation
  const country = c.req.query("country");

  // BAD: Only handles single value, case-sensitive
  const results = await fetchJobs({ country, limit: 100 }); // BAD: Magic number

  return c.json({ jobs: results });
});
```

**Why bad:** `c.req.query()` bypasses validation, single-value filter forces multiple API calls, case-sensitive breaks user input, magic 100

---

## Pagination Patterns

### Good Example - Offset-Based Pagination

```typescript
const DEFAULT_LIMIT = 50;
const DEFAULT_OFFSET = 0;
const RADIX_DECIMAL = 10;

export const parsePagination = (limit?: string, offset?: string) => ({
  limit: limit ? parseInt(limit, RADIX_DECIMAL) : DEFAULT_LIMIT,
  offset: offset ? parseInt(offset, RADIX_DECIMAL) : DEFAULT_OFFSET,
});

app.openapi(getJobsRoute, async (c) => {
  const query = c.req.valid("query");
  const { limit, offset } = parsePagination(query.limit, query.offset);

  // Use your database solution with limit/offset
  const results = await fetchJobs({ limit, offset });

  // Get total count with same filters for pagination UI
  const total = await countJobs();

  return c.json({ jobs: results, total, limit, offset }, 200);
});
```

**Why good:** Total count enables "Page X of Y" UI, radix 10 prevents `parseInt("08")` bugs, returning limit/offset in response lets clients track state

**Pagination response schema:**

```typescript
export const PaginatedJobsResponseSchema = z
  .object({
    jobs: z.array(JobSchema),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
  })
  .openapi("PaginatedJobsResponse");
```

### Bad Example - Missing best practices

```typescript
// BAD Example - Missing best practices
const limit = parseInt(c.req.query("limit") || "50"); // BAD: Magic numbers, no radix
const offset = parseInt(c.req.query("offset") || "0"); // BAD: Magic numbers, no radix

const results = await fetchJobs({ limit, offset });

// BAD: No total count - can't show "Page X of Y"
return c.json({ jobs: results });
```

**Why bad:** No radix causes `parseInt("08")=0` in some engines, missing total = can't build pagination UI, limit/offset not in response = client can't track state

---

## Data Transformation Patterns

### Good Example - Reusable Transformation Utilities

**File: `/app/api/utils/helpers.ts`**

```typescript
export const toISOString = (date: Date | string | null): string | null => {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : date;
};

const DEFAULT_CURRENCY = "EUR";

export const transformJobRow = (row: any) => {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    employmentType: row.employmentType,
    // Conditionally include salary only if showSalary is true
    salary:
      row.showSalary && row.salaryMin && row.salaryMax
        ? {
            min: row.salaryMin,
            max: row.salaryMax,
            currency: row.salaryCurrency || DEFAULT_CURRENCY,
          }
        : null,
    // Transform dates to ISO strings
    postedDate: toISOString(row.postedDate),
    createdAt: toISOString(row.createdAt)!,
    // Flatten joined company data into nested object
    company: {
      name: row.companyName,
      logoUrl: row.companyLogoUrl,
    },
  };
};
```

**Why good:** Reusable transform = DRY across routes, null-safe toISOString prevents crashes, conditional salary inclusion respects showSalary flag

**Usage in route:**

```typescript
app.openapi(getJobsRoute, async (c) => {
  // Fetch raw rows from your database
  const rows = await fetchJobRows();

  // Transform all rows using the reusable utility
  const transformedJobs = rows.map(transformJobRow);

  return c.json({ jobs: transformedJobs, total: transformedJobs.length }, 200);
});
```

### Bad Example - Inline transformations

```typescript
// BAD Example - Inline transformations
app.get("/jobs", async (c) => {
  const rows = await fetchJobRows();

  // BAD: Inline transformation makes code hard to read
  // BAD: No reusability across routes
  // BAD: Magic string "EUR"
  const jobs = rows.map((r) => ({
    ...r,
    salary: r.showSalary
      ? {
          min: r.salaryMin,
          max: r.salaryMax,
          currency: r.salaryCurrency || "EUR", // BAD: Magic string
        }
      : null,
    createdAt: r.createdAt.toISOString(), // BAD: Can crash if null
  }));

  return c.json(jobs);
});
```

**Why bad:** Inline transform duplicates across routes, r.createdAt.toISOString() crashes on null, magic "EUR" becomes inconsistent when changed

---
