# Caching Strategies Quick Reference

Lookup tables and comparisons. See [SKILL.md](SKILL.md) for decision frameworks, red flags, and philosophy.

---

## Cache-Control Quick Reference

| Use Case                | Header                                                        | Behavior                            |
| ----------------------- | ------------------------------------------------------------- | ----------------------------------- |
| Public list data        | `public, max-age=60, s-maxage=300`                            | Browser: 1m, CDN: 5m                |
| Public with SWR         | `public, max-age=60, s-maxage=300, stale-while-revalidate=60` | CDN serves stale during refresh     |
| User-specific data      | `private, no-cache`                                           | Always revalidate, no shared cache  |
| Sensitive data          | `no-store, private`                                           | Never cached anywhere               |
| Versioned static assets | `public, max-age=31536000, immutable`                         | Cache forever, version in URL       |
| API with ETag           | `max-age=0, must-revalidate`                                  | Always revalidate, 304 if unchanged |

---

## Conditional Request Flow

```
Client sends:    If-None-Match: "abc123"
                 If-Modified-Since: Tue, 01 Jan 2025 00:00:00 GMT

Server checks:  ETag matches? (takes precedence per RFC 9110)
+-- YES --> 304 Not Modified (no body)
+-- NO  --> Last-Modified changed?
    +-- NO  --> 304 Not Modified (no body)
    +-- YES --> 200 OK (full response)
```

---

## Strategy Comparison

| Strategy      | Read Perf            | Write Perf          | Consistency      | Complexity | Data Loss Risk        |
| ------------- | -------------------- | ------------------- | ---------------- | ---------- | --------------------- |
| Cache-aside   | Fast (on hit)        | N/A (reads only)    | Eventual (TTL)   | Low        | None                  |
| Write-through | Fast (on hit)        | Slower (dual write) | Strong           | Low        | None                  |
| Write-behind  | Fast (on hit)        | Fast (async)        | Eventual         | High       | Yes (buffer loss)     |
| HTTP caching  | Fastest (no request) | N/A                 | Eventual (TTL)   | Low        | None                  |
| In-memory LRU | Sub-ms               | Sub-ms              | Per-process only | Low        | Yes (process restart) |

---

## Stampede Prevention Comparison

| Technique                   | When to Use                          | Trade-off                          |
| --------------------------- | ------------------------------------ | ---------------------------------- |
| Distributed lock            | Multi-instance, critical keys        | Lock overhead, potential stalls    |
| Request coalescing          | Single-instance, bursty traffic      | In-process only, no cross-instance |
| Probabilistic early refresh | High-traffic, predictable patterns   | Slightly higher cache store load   |
| Background refresh (cron)   | Periodic data, known update schedule | Stale between refreshes            |

---

## Cache Key Conventions

```
{app}:{entity}:{id}              -- Entity by ID
{app}:{entity}:list:{hash}       -- Query result by hashed params
{app}:{entity}:{id}:{subentity}  -- Related entity
tag:{category}                   -- Tag set for bulk invalidation
lock:{key}                       -- Stampede prevention lock
```

**Rules:**

- Always prefix with application name (prevents cross-app collisions)
- Use colons as separators (convention for hierarchical keys)
- Hash complex query params for shorter keys (MD5 is fine for cache keys)
- Sort object keys before hashing (ensures deterministic output)
