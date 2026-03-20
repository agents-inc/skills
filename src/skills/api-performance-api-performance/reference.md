# Performance Reference

Decision frameworks and performance monitoring for backend optimization. See [SKILL.md](SKILL.md) for red flags and anti-patterns.

---

<decision_framework>

## Decision Framework

### When to Add Caching?

```
Is response time > 100ms?
├─ YES → Is data read more than written?
│   ├─ YES → Is staleness acceptable (even 60s)?
│   │   ├─ YES → Add caching (cache-aside pattern)
│   │   └─ NO → Use write-through or real-time sync
│   └─ NO → Focus on write optimization instead
└─ NO → Don't cache (premature optimization)
```

### Which Caching Strategy?

| Scenario         | Strategy               | TTL    |
| ---------------- | ---------------------- | ------ |
| User profiles    | Cache-aside            | 300s   |
| Product catalog  | Cache-aside            | 3600s  |
| Session data     | Write-through          | 86400s |
| Real-time prices | No cache or very short | 10-60s |
| Static config    | Cache-aside            | 3600s+ |

### When to Add an Index?

```
Is the query slow (> 100ms)?
├─ YES → Run EXPLAIN ANALYZE
│   ├─ Full table scan? → Add index on WHERE columns
│   ├─ Index exists but not used? → Check column order, data types
│   └─ Index scan but still slow? → Consider covering index
└─ NO → Don't add index (premature, adds write overhead)
```

### Composite Index Column Order

Order columns by:

1. **Equality conditions first** (exact matches)
2. **Range conditions last** (>, <, BETWEEN)
3. **High selectivity first** (more unique values)

```sql
-- Query: WHERE status = 'active' AND created_at > '2024-01-01'
-- Optimal index: (status, created_at) - equality first, then range
CREATE INDEX idx_status_created ON orders(status, created_at);
```

### Connection Pool vs External Pooler?

```
Are you hitting connection limits?
├─ YES → How many application instances?
│   ├─ Many (> 5) → Use external pooler (PgBouncer)
│   └─ Few → Tune pool size per instance
└─ NO → Default pool settings are fine
```

**Pool size formula:** `connections = (core_count * 2) + disk_spindles`

- For SSDs, approximate spindles as 1-2
- PostgreSQL default max is 100 connections
- Leave headroom for admin connections

</decision_framework>

---

<performance_monitoring>

## Performance Monitoring

### Key Metrics to Track

| Metric                | Warning Threshold | Critical Threshold |
| --------------------- | ----------------- | ------------------ |
| Query p95 latency     | > 100ms           | > 500ms            |
| Connection pool usage | > 70%             | > 90%              |
| Cache hit rate        | < 80%             | < 50%              |
| Event loop lag        | > 50ms            | > 200ms            |
| Database CPU          | > 60%             | > 85%              |

### EXPLAIN ANALYZE

Always check query plans before adding indexes:

```sql
-- Check if index is being used
EXPLAIN ANALYZE SELECT * FROM jobs
WHERE country = 'germany' AND employment_type = 'full_time';

-- Look for:
-- - "Seq Scan" = full table scan (bad for large tables)
-- - "Index Scan" or "Index Only Scan" = good
-- - "Bitmap Index Scan" = acceptable for low selectivity
-- - "actual time" = real execution time
-- - "rows" = actual vs estimated rows (big difference = stale stats)
```

### Identifying N+1 Queries

Signs of N+1:

- Many small identical queries in logs
- Response time scales linearly with result count
- Database shows high query count but low total time

### Cache Hit/Miss Monitoring

See [examples/caching.md](examples/caching.md) for cache hit/miss tracking implementation.

</performance_monitoring>
