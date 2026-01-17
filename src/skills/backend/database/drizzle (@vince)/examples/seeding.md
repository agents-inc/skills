# Seeding Examples

Patterns for populating development databases with test data.

---

## Safe Seeding with Cleanup

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
