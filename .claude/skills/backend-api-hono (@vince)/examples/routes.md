# Hono + OpenAPI - Route Examples

> Filtering, pagination, and data transformation patterns. See [core.md](core.md) for basic route setup.

**Prerequisites**: Understand Pattern 2 (List Endpoint) and Pattern 3 (Detail Endpoint) from core examples first.

---

## Filtering Patterns

### Good Example - Multiple Values with Case-Insensitive Matching

```typescript
import { sql } from "drizzle-orm";

const SINGLE_VALUE_COUNT = 1;

// Query: ?country=germany,france,spain
const { country } = c.req.valid("query");

const conditions = [eq(jobs.isActive, true), isNull(jobs.deletedAt)];

if (country) {
  const countries = country.split(",").map((c) => c.trim().toLowerCase());

  if (countries.length === SINGLE_VALUE_COUNT) {
    // Single value: use simple equality with case-insensitive comparison
    conditions.push(sql`LOWER(${jobs.country}) = ${countries[0]}`);
  } else {
    // Multiple values: use IN clause with case-insensitive comparison
    conditions.push(
      sql`LOWER(${jobs.country}) IN (${sql.join(
        countries.map((c) => sql`${c}`),
        sql`, `,
      )})`,
    );
  }
}

const results = await db
  .select()
  .from(jobs)
  .where(and(...conditions));
```

**Why good:** LOWER() prevents "Germany" vs "germany" mismatches, sql template prevents SQL injection, handling both single/multiple covers all URL patterns

### Good Example - Multiple Filter Types

```typescript
import { and, eq, ne, inArray, sql } from "drizzle-orm";

const SINGLE_VALUE_COUNT = 1;

app.openapi(getJobsRoute, async (c) => {
  const { country, employment_type, seniority_level, visa_sponsorship } =
    c.req.valid("query");

  const conditions = [eq(jobs.isActive, true), isNull(jobs.deletedAt)];

  // Country filter: comma-separated with case-insensitive matching
  if (country) {
    const countries = country.split(",").map((c) => c.trim().toLowerCase());
    if (countries.length === SINGLE_VALUE_COUNT) {
      conditions.push(sql`LOWER(${jobs.country}) = ${countries[0]}`);
    } else {
      conditions.push(
        sql`LOWER(${jobs.country}) IN (${sql.join(
          countries.map((c) => sql`${c}`),
          sql`, `,
        )})`,
      );
    }
  }

  // Single enum value filter
  if (employment_type) {
    conditions.push(eq(jobs.employmentType, employment_type as any));
  }

  // Multiple enum values filter
  if (seniority_level) {
    const seniorities = seniority_level.split(",");
    if (seniorities.length === SINGLE_VALUE_COUNT) {
      conditions.push(eq(jobs.seniorityLevel, seniorities[0] as any));
    } else {
      conditions.push(inArray(jobs.seniorityLevel, seniorities as any));
    }
  }

  // Boolean filter (string to boolean logic)
  if (visa_sponsorship === "true") {
    conditions.push(ne(jobs.visaSponsorshipType, "none"));
  }

  const results = await db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .limit(DEFAULT_QUERY_LIMIT);

  return c.json({ jobs: results, total: results.length }, 200);
});
```

**Why good:** inArray() for multiple enums is cleaner than chained OR, ne() for visa check handles null correctly, case-insensitive = better UX

### Bad Example - No multiple value support

```typescript
// BAD Example - No multiple value support
const { country } = c.req.query();

// BAD: Only handles single value
// BAD: Case-sensitive (won't match "Germany" vs "germany")
const results = await db
  .select()
  .from(jobs)
  .where(eq(jobs.country, country))
  .limit(100); // BAD: Magic number
```

**Why bad:** Single-value filter forces multiple API calls, case-sensitive breaks when user types "GERMANY", magic 100 can't be easily changed

---

## Pagination Patterns

### Good Example - Offset-Based Pagination

```typescript
import { sql } from "drizzle-orm";

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

  // Apply filters
  const conditions = [eq(jobs.isActive, true), isNull(jobs.deletedAt)];

  // Get paginated results
  const results = await db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset)
    .orderBy(desc(jobs.createdAt));

  // Get total count for pagination (with same filters)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(...conditions));

  return c.json(
    {
      jobs: results,
      total: count,
      limit,
      offset,
    },
    200,
  );
});
```

**Why good:** Total count enables "Page X of Y" UI, radix 10 prevents parseInt("08") bugs, same conditions for count = accurate totals

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

const results = await db.select().from(jobs).limit(limit).offset(offset);

// BAD: No total count - can't show "Page X of Y"
return c.json({ jobs: results });
```

**Why bad:** No radix causes parseInt("08")=0 in some engines, missing total = can't build pagination UI, limit/offset not in response = client can't track state

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
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      // ... all fields
      showSalary: jobs.showSalary,
      salaryMin: jobs.salaryMin,
      salaryMax: jobs.salaryMax,
      salaryCurrency: jobs.salaryCurrency,
      companyName: companies.name,
      companyLogoUrl: companies.logoUrl,
    })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id));

  // Transform all rows
  const transformedJobs = rows.map(transformJobRow);

  return c.json({ jobs: transformedJobs, total: transformedJobs.length }, 200);
});
```

### Bad Example - Inline transformations

```typescript
// BAD Example - Inline transformations
app.get("/jobs", async (c) => {
  const rows = await db.select().from(jobs);

  // BAD: Inline transformation makes code hard to read
  // BAD: No reusability
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
