# Transaction Examples

Patterns for atomic database operations with proper error handling and rollback.

---

## Basic Transaction

```typescript
// Good Example - Proper transaction usage
await db.transaction(async (tx) => {
  // Insert parent
  const [company] = await tx
    .insert(companies)
    .values({
      name: "Acme Corp",
      slug: "acme-corp",
      websiteUrl: "https://acme.com",
    })
    .returning({ id: companies.id });

  // Insert children
  await tx.insert(jobs).values([
    {
      companyId: company.id,
      title: "Senior Engineer",
      description: "Build things",
      externalUrl: "https://acme.com/jobs/1",
    },
    {
      companyId: company.id,
      title: "Junior Designer",
      description: "Design things",
      externalUrl: "https://acme.com/jobs/2",
    },
  ]);

  // All succeed or all fail together
});
```

**Why good:** Uses `tx` parameter (not `db`) ensuring atomicity, `.returning()` gets inserted ID for child records, all operations succeed or fail together preventing partial data, transaction keeps related data consistent

```typescript
// Bad Example - Not using transaction parameter
await db.transaction(async (tx) => {
  const [company] = await db.insert(companies).values({...}); // Using db instead of tx
  await db.insert(jobs).values({...}); // Using db instead of tx
});
```

**Why bad:** Using `db` instead of `tx` bypasses transaction context breaking atomicity, operations can succeed/fail independently leaving inconsistent data, defeats entire purpose of transaction

---

## Transaction with Error Handling

```typescript
// Good Example - Transaction with proper error handling
try {
  await db.transaction(async (tx) => {
    const [job] = await tx
      .update(jobs)
      .set({ isActive: false })
      .where(eq(jobs.id, jobId))
      .returning();

    if (!job) {
      throw new Error("Job not found");
    }

    await tx.insert(auditLogs).values({
      entityType: "job",
      entityId: job.id,
      action: "deactivated",
      userId: currentUserId,
    });
  });
} catch (error) {
  console.error("Transaction failed:", error);
  // Nothing was changed in the database
}
```

**Why good:** Try-catch handles transaction failures, throwing error inside transaction rolls back all changes, validation ensures data exists before proceeding, audit log and update are atomic

---

## See Also

- [core.md](core.md) - Database connection setup
- [queries.md](queries.md) - Query patterns for reading data
