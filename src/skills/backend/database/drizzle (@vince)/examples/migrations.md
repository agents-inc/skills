# Migration Examples

Patterns for managing database schema changes with Drizzle Kit.

---

## Migration Workflow

```bash
# 1. Make schema changes in your schema file
# 2. Generate migration
bun run drizzle-kit generate

# 3. Review generated SQL in drizzle/ directory
# 4. Apply migration (development)
bun run drizzle-kit migrate

# 5. For serverless/production, use push for direct schema sync
bun run drizzle-kit push
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## When to Use `generate` vs `push`

| Command | Use Case | Notes |
|---------|----------|-------|
| `generate` + `migrate` | Development | Trackable migration files |
| `push` | Serverless/CI | Direct schema sync |

**Critical:** Never use `push` in production with existing data without backup

---

## Migration Naming Convention

Follow this pattern for migration file names:

- `0001_create_companies_table.sql`
- `0002_add_salary_fields_to_jobs.sql`
- `0003_create_job_skills_junction_table.sql`

Use incrementing numbers and descriptive snake_case names.

---

## See Also

- [core.md](core.md) - Drizzle Kit configuration
- [seeding.md](seeding.md) - Populating development data after migrations
