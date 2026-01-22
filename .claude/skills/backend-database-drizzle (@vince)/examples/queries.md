# Query Examples

Patterns for relational queries with `.with()` and the Drizzle query builder for complex filtering.

---

## Relational Queries

### Efficient Relational Query with `.with()`

```typescript
// Good Example - Efficient relational query
import { and, eq, desc, asc, isNull } from "drizzle-orm";

const job = await db.query.jobs.findFirst({
  where: and(
    eq(jobs.id, jobId),
    eq(jobs.isActive, true),
    isNull(jobs.deletedAt),
  ),
  with: {
    company: {
      with: {
        locations: {
          orderBy: [
            desc(companyLocations.isHeadquarters),
            asc(companyLocations.name),
          ],
        },
      },
    },
    jobSkills: {
      where: eq(jobSkills.isRequired, true),
      with: {
        skill: true,
      },
    },
  },
});

// Result is fully typed and nested
if (job) {
  console.log(job.title); // string
  console.log(job.company.name); // string
  console.log(job.company.locations); // CompanyLocation[]
  console.log(job.jobSkills[0].skill.name); // string
}
```

**Why good:** Single SQL query eliminates N+1 problem, nested `.with()` loads deep relations efficiently, soft delete check prevents returning deleted records, ordering nested results provides predictable output, fully typed results catch errors at compile time

```typescript
// Bad Example - N+1 query problem
const job = await db.query.jobs.findFirst({
  where: eq(jobs.id, jobId), // Missing soft delete check
});

// Separate queries cause N+1 problem
const company = await db.query.companies.findFirst({
  where: eq(companies.id, job.companyId),
});

const locations = await db.query.companyLocations.findMany({
  where: eq(companyLocations.companyId, company.id),
});

const jobSkills = await db.query.jobSkills.findMany({
  where: eq(jobSkills.jobId, job.id),
});
```

**Why bad:** Multiple queries create N+1 problem degrading performance, missing soft delete check returns deleted records, manual relation loading is error-prone, no ordering means unpredictable results, more database round-trips = slower response times

---

## Query Builder

### Basic Query Builder

```typescript
// Good Example - Complex filtered query
import { and, eq, desc, isNull, sql } from "drizzle-orm";

const MAX_RESULTS = 100;

const results = await db
  .select({
    id: jobs.id,
    title: jobs.title,
    companyName: companies.name,
    companyLogo: companies.logoUrl,
  })
  .from(jobs)
  .leftJoin(companies, eq(jobs.companyId, companies.id))
  .where(
    and(
      eq(jobs.isActive, true),
      isNull(jobs.deletedAt),
      sql`LOWER(${jobs.country}) = ${country.toLowerCase()}`,
    ),
  )
  .orderBy(desc(jobs.createdAt))
  .limit(MAX_RESULTS);
```

**Why good:** Custom column selection reduces data transfer, named constant for limit improves maintainability, soft delete filter prevents returning deleted records, `LOWER()` makes country comparison case-insensitive, explicit ordering provides predictable results

```typescript
// Bad Example - Missing filters and magic numbers
const results = await db
  .select()
  .from(jobs)
  .leftJoin(companies, eq(jobs.companyId, companies.id))
  .where(sql`country = ${country}`) // Case-sensitive, no soft delete
  .limit(1000); // Magic number
```

**Why bad:** Missing soft delete check returns deleted records, case-sensitive comparison misses matches, magic number makes limit unclear and hard to change, selecting all columns wastes bandwidth, no ordering = unpredictable results

---

### Dynamic Filtering

```typescript
// Good Example - Dynamic filters with proper handling
import { inArray } from "drizzle-orm";

const conditions = [eq(jobs.isActive, true), isNull(jobs.deletedAt)];

// Country filter: support comma-separated values
if (country) {
  const countries = country.split(",").map((c) => c.trim().toLowerCase());
  if (countries.length === 1) {
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

// Single value filter
if (employment_type) {
  conditions.push(eq(jobs.employmentType, employment_type as any));
}

// Multiple value filter with enum
if (seniority_level) {
  const seniorities = seniority_level.split(",");
  if (seniorities.length === 1) {
    conditions.push(eq(jobs.seniorityLevel, seniorities[0] as any));
  } else {
    conditions.push(inArray(jobs.seniorityLevel, seniorities as any));
  }
}

const results = await db
  .select()
  .from(jobs)
  .where(and(...conditions))
  .limit(MAX_RESULTS);
```

**Why good:** Conditions array allows dynamic filter building, handles both single and multiple values correctly, `trim()` cleans whitespace from input, case-insensitive country matching prevents missed results, `inArray()` optimizes multiple value queries

---

## See Also

- [core.md](core.md) - Database connection and schema definition
- [transactions.md](transactions.md) - Atomic operations for complex queries
