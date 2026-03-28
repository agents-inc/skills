# CockroachDB Quick Reference

> PostgreSQL compatibility gaps, CockroachDB-specific error codes, type differences, and production checklist. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## PostgreSQL Compatibility Gaps

### Unsupported Features

| Feature                                    | PostgreSQL                                     | CockroachDB                                                | Workaround                                                             |
| ------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| Advisory locks                             | `pg_advisory_lock()`, `pg_try_advisory_lock()` | No-op stubs (silently do nothing)                          | Use `SELECT ... FOR UPDATE` on a lock table                            |
| `LISTEN` / `NOTIFY`                        | Fully supported                                | Not supported                                              | Use `CHANGEFEED` for CDC                                               |
| `CREATE DOMAIN`                            | Fully supported                                | Not supported                                              | Use `CHECK` constraints                                                |
| Range types                                | `int4range`, `tsrange`, etc.                   | Not supported                                              | Use two columns (lower/upper bound)                                    |
| XML functions                              | `xmlparse()`, `xpath()`, etc.                  | Not supported                                              | Handle XML in application code                                         |
| Foreign data wrappers                      | `CREATE FOREIGN TABLE`                         | Not supported                                              | Use application-level data federation                                  |
| Full text search (`tsvector`)              | Native GIN indexes                             | Limited support                                            | Use an external search engine                                          |
| Column-level privileges                    | `GRANT SELECT(col)`                            | Not supported                                              | Use views to restrict column access                                    |
| `CREATE TABLE ... PARTITION BY` (PG-style) | Fully supported                                | Different syntax -- uses CockroachDB-specific partitioning |
| Table inheritance                          | `INHERITS` clause                              | Not supported                                              | Use separate tables with shared schema                                 |
| Deferrable constraints                     | `DEFERRABLE INITIALLY DEFERRED`                | Not supported                                              | Validate constraints in application code or order operations carefully |
| `%TYPE` / `%ROWTYPE` in PL/pgSQL           | Fully supported                                | Not supported                                              | Declare types explicitly                                               |
| `UPDATE OF` column-list triggers           | Fully supported                                | Not supported                                              | Use full `UPDATE` triggers with condition checks                       |
| `DROP TRIGGER ... CASCADE`                 | Fully supported                                | Not supported                                              | Drop dependent objects manually                                        |
| Multiple arbiter indexes in `ON CONFLICT`  | Supported                                      | Not supported                                              | Use a single unique constraint per `ON CONFLICT`                       |

### Behavioral Differences

| Behavior                    | PostgreSQL                     | CockroachDB                                                                |
| --------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| Default isolation level     | READ COMMITTED                 | SERIALIZABLE                                                               |
| Float overflow              | Returns error                  | Returns `Infinity`                                                         |
| Bitwise operator precedence | Standard SQL                   | Differs -- use explicit parentheses                                        |
| `SERIAL` implementation     | Backed by sequence             | Backed by `unique_rowid()` (time-ordered, not sequential)                  |
| DDL in transactions         | Fully supported                | Limited -- most DDL can fail at COMMIT; `CREATE TABLE`/`CREATE INDEX` work |
| Schema changes              | Locks table briefly            | Online -- table remains available                                          |
| Default port                | 5432                           | 26257                                                                      |
| `numeric`/`decimal` returns | String (in pg driver)          | String (same as PostgreSQL)                                                |
| `bigint` returns            | String when > MAX_SAFE_INTEGER | String (same as PostgreSQL)                                                |
| Temporary tables            | Native                         | Experimental (`SET experimental_enable_temp_tables = 'on'`)                |
| Stored procedures           | Full PL/pgSQL                  | Limited PL/pgSQL support                                                   |
| `pg_catalog`                | Complete                       | Populated but may differ from PostgreSQL                                   |

---

## CockroachDB-Specific Error Codes

### Transaction Retry Errors (Class 40)

| Code    | Name                                            | Action                              | When It Fires                                 |
| ------- | ----------------------------------------------- | ----------------------------------- | --------------------------------------------- |
| `40001` | `serialization_failure` / `restart transaction` | Retry full transaction with backoff | Concurrent SERIALIZABLE transactions conflict |
| `40003` | `statement_completion_unknown`                  | Retry full transaction              | Ambiguous commit result (network partition)   |

### CockroachDB-Specific Errors

| Code    | Name              | Action                 | When It Fires                     |
| ------- | ----------------- | ---------------------- | --------------------------------- |
| `XXUUU` | Internal error    | Report to CockroachDB  | Internal database error           |
| `CR000` | CockroachDB retry | Retry full transaction | CockroachDB-specific retry signal |

### Constraint Violations (Same as PostgreSQL)

| Code    | Name                    | Typical HTTP    | When It Fires                                |
| ------- | ----------------------- | --------------- | -------------------------------------------- |
| `23505` | `unique_violation`      | 409 Conflict    | INSERT/UPDATE violates UNIQUE or PRIMARY KEY |
| `23503` | `foreign_key_violation` | 400 Bad Request | Referenced row does not exist                |
| `23502` | `not_null_violation`    | 400 Bad Request | NULL in a NOT NULL column                    |
| `23514` | `check_violation`       | 400 Bad Request | CHECK constraint failed                      |

### Connection Errors (Same as PostgreSQL)

| Code    | Name                        | Action                    | When It Fires               |
| ------- | --------------------------- | ------------------------- | --------------------------- |
| `08000` | `connection_exception`      | Pool handles reconnection | General connection failure  |
| `08003` | `connection_does_not_exist` | Pool handles              | Client disconnected         |
| `08006` | `connection_failure`        | Pool handles              | Could not connect to server |

---

## Detecting CockroachDB Retry Errors

See [examples/core.md](examples/core.md) for the full `isCrdbRetryError` type guard and `withCrdbRetry` helper. Key points:

- Check for SQLSTATE `40001` (serialization failure) and `40003` (statement completion unknown)
- Also check `err.message.startsWith("restart transaction")` for CockroachDB-specific retry signals
- Constraint violations (`23xxx`) are application errors -- do NOT retry those

---

## CockroachDB Connection String Format

```
postgresql://<username>:<password>@<host>:<port>/<database>?sslmode=verify-full

# Self-hosted cluster
postgresql://root@crdb-lb.internal:26257/mydb?sslmode=verify-full&sslrootcert=/certs/ca.crt

# CockroachDB Cloud (Serverless or Dedicated)
postgresql://<user>:<password>@<cluster-host>:26257/defaultdb?sslmode=verify-full

# Multiple nodes (client-side load balancing)
# Use a load balancer -- pg driver connects to a single host
# Point at HAProxy/nginx that round-robins across nodes
```

**Key differences from PostgreSQL:**

- Default port is **26257**, not 5432
- `sslmode=verify-full` is recommended for all production connections
- CockroachDB Cloud always requires SSL

---

## Primary Key Recommendations

| Strategy                                 | Recommendation           | Reason                                      |
| ---------------------------------------- | ------------------------ | ------------------------------------------- |
| `UUID DEFAULT gen_random_uuid()`         | **Strongly recommended** | Evenly distributes writes across all ranges |
| `UUID` with application-generated UUIDv7 | Good                     | Time-ordered but still distributed enough   |
| `SERIAL` / `unique_rowid()`              | **Avoid**                | Creates write hotspot on latest range       |
| Sequential integer                       | **Avoid**                | Same hotspot issue as SERIAL                |
| `BYTES` with hash prefix                 | Advanced                 | Good for hash-sharded indexes               |

---

## Multi-Region SQL Reference

### Database-Level Configuration

```sql
-- Add regions to the database
ALTER DATABASE mydb PRIMARY REGION "us-east1";
ALTER DATABASE mydb ADD REGION "us-west1";
ALTER DATABASE mydb ADD REGION "eu-west1";

-- Set survival goal
ALTER DATABASE mydb SURVIVE ZONE FAILURE;    -- Default: tolerate single zone loss
ALTER DATABASE mydb SURVIVE REGION FAILURE;  -- Tolerate entire region loss (needs 3+ regions)
```

### Table Locality Options

```sql
-- Regional table (data in primary region, reads/writes go there)
ALTER TABLE users SET LOCALITY REGIONAL BY TABLE IN PRIMARY REGION;

-- Regional by row (each row lives in a specified region)
ALTER TABLE users SET LOCALITY REGIONAL BY ROW;
-- Requires a crdb_region column: ALTER TABLE users ADD COLUMN crdb_region crdb_internal_region

-- Global table (reads from any region without latency, writes are slower)
ALTER TABLE config SET LOCALITY GLOBAL;
```

| Locality          | Read Latency       | Write Latency                     | Use Case                       |
| ----------------- | ------------------ | --------------------------------- | ------------------------------ |
| REGIONAL BY TABLE | Low in home region | Low in home region                | User data homed to one region  |
| REGIONAL BY ROW   | Low for local rows | Low for local rows                | Per-user data in user's region |
| GLOBAL            | Low everywhere     | Higher (consensus across regions) | Config tables, reference data  |

---

## cockroach CLI Quick Reference

| Command                            | Purpose                             |
| ---------------------------------- | ----------------------------------- |
| `cockroach start`                  | Start a node                        |
| `cockroach init`                   | Initialize a new cluster            |
| `cockroach sql`                    | Open SQL shell                      |
| `cockroach node status`            | Show cluster node status            |
| `cockroach node decommission <id>` | Gracefully remove a node            |
| `cockroach demo`                   | Start a temporary in-memory cluster |
| `cockroach workload init`          | Initialize sample workloads         |
| `cockroach debug zip`              | Collect debug information           |
| `cockroach version`                | Show version                        |

---

## Production Checklist

### Connection Management

- [ ] Pool `error` event handler on every pool instance
- [ ] `connectionTimeoutMillis` set (not default 0 = infinite wait)
- [ ] Connection string points to load balancer, not a single node
- [ ] SSL enabled (`sslmode=verify-full`)
- [ ] All `pool.connect()` calls release clients in `finally` blocks

### Transaction Safety

- [ ] Transaction retry logic implemented for ALL write transactions
- [ ] Retry handles `40001` AND `40003` error codes
- [ ] Retry handles errors from `COMMIT` (not just from statements)
- [ ] Exponential backoff with jitter in retry loop
- [ ] Maximum retry count is bounded (3-5 retries)
- [ ] Read-only transactions use `AS OF SYSTEM TIME` where staleness is acceptable

### Schema Design

- [ ] All primary keys use `UUID DEFAULT gen_random_uuid()`
- [ ] No `SERIAL` or sequential integer primary keys
- [ ] Indexes designed for distributed access patterns
- [ ] Foreign keys reference UUID columns

### Schema Changes

- [ ] DDL runs outside explicit transactions
- [ ] One DDL statement at a time in production
- [ ] Large backfills monitored via `SHOW JOBS`
- [ ] Schema changes tested in staging first

### Multi-Region (if applicable)

- [ ] Regions added to database
- [ ] Survival goal set appropriately
- [ ] Table localities configured per access pattern
- [ ] Follower reads enabled for read-heavy tables

### Monitoring

- [ ] Track `SHOW JOBS` for running schema changes
- [ ] Monitor transaction retry rates
- [ ] Alert on high `40001` error rates (indicates contention)
- [ ] Monitor node health via `cockroach node status`
- [ ] Track range distribution for hotspot detection

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/](examples/)_
