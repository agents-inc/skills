# Seeding Examples

Patterns for populating development databases with test data. Includes manual seeding and the official `drizzle-seed` package for deterministic fake data generation.

---

## drizzle-seed Package (Recommended)

The official `drizzle-seed` package generates deterministic, realistic fake data. Requires `drizzle-orm@0.36.4+`.

### Installation

```bash
bun add drizzle-seed
```

### Basic Usage

```typescript
// Good Example - drizzle-seed basic usage
import { seed, reset } from "drizzle-seed";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./db/schema";

const db = drizzle(process.env.DATABASE_URL!, { schema });

const DEFAULT_SEED_COUNT = 10;
const SEED_VALUE = 42; // Deterministic seed for reproducibility

async function seedDatabase() {
  // Clear all tables (respects foreign keys)
  await reset(db, schema);

  // Seed with default options (10 rows per table)
  await seed(db, schema);

  // Or with custom count and deterministic seed
  await seed(db, schema, {
    count: DEFAULT_SEED_COUNT,
    seed: SEED_VALUE, // Same seed = same data every run
  });

  console.log("Database seeded");
}

seedDatabase().catch(console.error);
```

**Why good:** Deterministic seeding ensures reproducible data across test runs, `reset()` handles foreign key constraints automatically, respects schema relationships

### Refinements API

Customize data generation per table:

```typescript
// Good Example - drizzle-seed with refinements
import { seed } from "drizzle-seed";

const USERS_COUNT = 20;
const POSTS_PER_USER = 5;

await seed(db, schema).refine((f) => ({
  users: {
    columns: {
      name: f.fullName(),
      email: f.email(),
      avatar: f.valuesFromArray({ values: ["avatar1.png", "avatar2.png"] }),
    },
    count: USERS_COUNT,
    with: {
      posts: POSTS_PER_USER, // Create 5 posts per user
    },
  },
  posts: {
    columns: {
      title: f.loremIpsum({ sentencesCount: 1 }),
      content: f.loremIpsum({ sentencesCount: 10 }),
      publishedAt: f.date({ minDate: "2024-01-01", maxDate: "2024-12-31" }),
    },
  },
}));
```

**Why good:** Fine-grained control per column, built-in generators (`fullName`, `email`, `loremIpsum`, `date`), `with` creates related records automatically

### Available Generators

| Generator                                     | Description           |
| --------------------------------------------- | --------------------- |
| `f.fullName()`                                | Realistic full names  |
| `f.email()`                                   | Valid email addresses |
| `f.companyName()`                             | Company names         |
| `f.city()`                                    | City names            |
| `f.date({ minDate, maxDate })`                | Date range            |
| `f.int({ minValue, maxValue })`               | Integer range         |
| `f.number({ minValue, maxValue, precision })` | Decimal numbers       |
| `f.loremIpsum({ sentencesCount })`            | Lorem ipsum text      |
| `f.valuesFromArray({ values })`               | Pick from array       |
| `f.weightedRandom([{ weight, value }])`       | Weighted distribution |

### Reset Behavior

The `reset()` function uses database-specific strategies:

- **PostgreSQL/CockroachDB:** `TRUNCATE ... CASCADE`
- **MySQL:** `DELETE` with foreign key check disable
- **SQLite:** `DELETE` with pragma foreign_keys off

```typescript
// Reset specific tables only
await reset(db, { users: schema.users, posts: schema.posts });
```

---

## Manual Seeding (Simple Cases)

For simple cases or when you need full control over seed data.

### Safe Seeding with Cleanup

```typescript
// Good Example - Safe seeding with cleanup
import { db } from "./db";
import { companies, jobs, skills } from "./db/schema";

async function seed() {
  console.log("Seeding database...");

  // Clear existing data (development only!)
  await db.delete(jobs);
  await db.delete(companies);

  // Seed companies
  const [acme] = await db
    .insert(companies)
    .values({
      name: "Acme Corp",
      slug: "acme-corp",
      websiteUrl: "https://acme.com",
    })
    .returning();

  // Seed jobs
  await db.insert(jobs).values([
    {
      companyId: acme.id,
      title: "Senior Engineer",
      description: "Build amazing products",
      externalUrl: "https://acme.com/jobs/1",
      employmentType: "full_time",
    },
    {
      companyId: acme.id,
      title: "Product Designer",
      description: "Design user experiences",
      externalUrl: "https://acme.com/jobs/2",
      employmentType: "full_time",
    },
  ]);

  console.log("Database seeded");
}

seed().catch(console.error);
```

**Why good:** Cleanup ensures clean slate, `.returning()` gets IDs for dependent records, error handling with `.catch()` surfaces failures, uses enum values for type safety

```typescript
// Bad Example - Unsafe seeding
async function seed() {
  // No cleanup - causes duplicate errors on re-run
  await db.insert(companies).values({
    name: "Acme Corp",
  }); // Missing .returning()

  // Hard-coded UUID - fragile
  await db.insert(jobs).values({
    companyId: "12345",
  });
}
```

**Why bad:** No cleanup causes errors on re-run, missing `.returning()` prevents getting generated IDs, hard-coded UUIDs are fragile and break easily, no error handling hides failures

---

## Package.json Script

```json
{
  "scripts": {
    "db:seed": "bun run scripts/seed.ts"
  }
}
```

---

## See Also

- [core.md](core.md) - Schema definition for seeding
- [migrations.md](migrations.md) - Apply migrations before seeding
- [transactions.md](transactions.md) - Wrap seeding in transaction for atomicity
- [drizzle-seed Docs](https://orm.drizzle.team/docs/seed-overview) - Official documentation
- [drizzle-seed Generators](https://orm.drizzle.team/docs/seed-functions) - All available generators
