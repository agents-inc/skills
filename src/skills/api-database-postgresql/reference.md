# PostgreSQL (pg) Quick Reference

> Pool configuration, QueryResult properties, PostgreSQL error codes, type mapping, and production checklist. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Pool Configuration Options

| Option                    | Type                       | Default     | Description                                                         |
| ------------------------- | -------------------------- | ----------- | ------------------------------------------------------------------- |
| `connectionString`        | string                     | —           | PostgreSQL connection URI (`postgresql://user:pass@host:5432/db`)   |
| `host`                    | string                     | `localhost` | Server hostname (or env `PGHOST`)                                   |
| `port`                    | number                     | `5432`      | Server port (or env `PGPORT`)                                       |
| `database`                | string                     | —           | Database name (or env `PGDATABASE`)                                 |
| `user`                    | string                     | —           | Username (or env `PGUSER`)                                          |
| `password`                | string \| function         | —           | Password or async callback (or env `PGPASSWORD`)                    |
| `max`                     | number                     | `10`        | Maximum clients in the pool                                         |
| `min`                     | number                     | `0`         | Minimum idle clients to retain                                      |
| `idleTimeoutMillis`       | number                     | `10000`     | Idle time before client is disconnected (0 = disabled)              |
| `connectionTimeoutMillis` | number                     | `0`         | Timeout for new connections (0 = no timeout)                        |
| `maxUses`                 | number                     | `Infinity`  | Max times a client can be checked out before replacement            |
| `maxLifetimeSeconds`      | number                     | `0`         | Max age for connections (0 = disabled)                              |
| `allowExitOnIdle`         | boolean                    | `false`     | Let event loop exit when all clients idle                           |
| `ssl`                     | boolean \| TlsOptions      | —           | SSL/TLS configuration (see SSL section)                             |
| `onConnect`               | function \| async function | —           | Setup callback invoked once per new client before it joins the pool |

### Recommended Production Configuration

```typescript
const POOL_MAX = 20;
const IDLE_TIMEOUT_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 5_000;
const MAX_LIFETIME_SECONDS = 1800; // 30 minutes

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: POOL_MAX,
  idleTimeoutMillis: IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  maxLifetimeSeconds: MAX_LIFETIME_SECONDS,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: true }
      : undefined,
});
```

### Recommended Test Configuration

```typescript
const pool = new pg.Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 1_000,
  connectionTimeoutMillis: 3_000,
  allowExitOnIdle: true,
});
```

---

## Pool Properties

| Property            | Type   | Description                                    |
| ------------------- | ------ | ---------------------------------------------- |
| `pool.totalCount`   | number | Total clients in the pool (idle + checked out) |
| `pool.idleCount`    | number | Clients currently idle                         |
| `pool.waitingCount` | number | Queued requests waiting for a client           |

---

## Pool Events

| Event     | Callback Signature             | Description                             |
| --------- | ------------------------------ | --------------------------------------- |
| `error`   | `(err: Error, client: Client)` | Idle client backend error (MUST handle) |
| `connect` | `(client: Client)`             | New client connected to backend         |
| `acquire` | `(client: Client)`             | Client checked out from pool            |
| `release` | `(err: Error, client: Client)` | Client returned to pool                 |
| `remove`  | `(client: Client)`             | Client disconnected and removed         |

---

## QueryResult Properties

| Property          | Type             | Description                                                                   |
| ----------------- | ---------------- | ----------------------------------------------------------------------------- |
| `result.rows`     | `T[]`            | Array of row objects (typed via generic)                                      |
| `result.rowCount` | `number \| null` | Rows affected by INSERT/UPDATE/DELETE. For SELECT, use `rows.length` instead. |
| `result.command`  | `string`         | SQL command executed (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, etc.)           |
| `result.fields`   | `FieldInfo[]`    | Column metadata (name, dataTypeID)                                            |

---

## PostgreSQL Error Codes (Common)

### Constraint Violations (Class 23)

| Code    | Name                    | Typical HTTP    | When It Fires                                |
| ------- | ----------------------- | --------------- | -------------------------------------------- |
| `23505` | `unique_violation`      | 409 Conflict    | INSERT/UPDATE violates UNIQUE or PRIMARY KEY |
| `23503` | `foreign_key_violation` | 400 Bad Request | Referenced row does not exist                |
| `23502` | `not_null_violation`    | 400 Bad Request | NULL in a NOT NULL column                    |
| `23514` | `check_violation`       | 400 Bad Request | CHECK constraint failed                      |

### Transaction / Concurrency (Class 40)

| Code    | Name                    | Action             | When It Fires                                 |
| ------- | ----------------------- | ------------------ | --------------------------------------------- |
| `40P01` | `deadlock_detected`     | Retry with backoff | Two transactions waiting on each other        |
| `40001` | `serialization_failure` | Retry with backoff | Concurrent SERIALIZABLE transactions conflict |

### Connection (Class 08)

| Code    | Name                        | Action       | When It Fires               |
| ------- | --------------------------- | ------------ | --------------------------- |
| `08000` | `connection_exception`      | Pool handles | General connection failure  |
| `08003` | `connection_does_not_exist` | Pool handles | Client disconnected         |
| `08006` | `connection_failure`        | Pool handles | Could not connect to server |

### Other

| Code    | Name                          | Action                    | When It Fires                                         |
| ------- | ----------------------------- | ------------------------- | ----------------------------------------------------- |
| `57014` | `query_canceled`              | Check `statement_timeout` | Query exceeded timeout                                |
| `42P01` | `undefined_table`             | Fix SQL                   | Table does not exist                                  |
| `42703` | `undefined_column`            | Fix SQL                   | Column does not exist                                 |
| `22P02` | `invalid_text_representation` | Fix input                 | Invalid input for data type (e.g., string to integer) |

---

## PostgreSQL-to-JavaScript Type Mapping

| PostgreSQL Type                 | JavaScript Type        | Notes                                                        |
| ------------------------------- | ---------------------- | ------------------------------------------------------------ |
| `integer`, `smallint`, `bigint` | `number` / `string`    | `bigint` returns as string (exceeds JS Number range)         |
| `real`, `double precision`      | `number`               | Standard JS float                                            |
| `numeric`, `decimal`            | **`string`**           | Preserved as string to avoid precision loss                  |
| `boolean`                       | `boolean`              |                                                              |
| `text`, `varchar`, `char`       | `string`               |                                                              |
| `timestamp`, `timestamptz`      | `Date`                 | Parsed to JS Date object                                     |
| `date`                          | `Date`                 | Parsed to JS Date object                                     |
| `json`, `jsonb`                 | `object`               | Auto-parsed from JSON                                        |
| `uuid`                          | `string`               |                                                              |
| `bytea`                         | `Buffer`               | Binary data                                                  |
| `interval`                      | `object`               | Parsed to `{ years, months, days, hours, minutes, seconds }` |
| `integer[]`, `text[]`           | `number[]`, `string[]` | Parsed to JS arrays                                          |

**Gotcha:** `numeric`/`decimal` returns as **string** by default. This is intentional -- JavaScript `number` cannot represent arbitrary-precision decimals. Parse manually if you need a number: `parseFloat(row.price)`.

**Gotcha:** `bigint` returns as **string** when the value exceeds `Number.MAX_SAFE_INTEGER`. Use `BigInt(row.id)` for arithmetic.

---

## SSL/TLS Quick Reference

See [examples/advanced.md](examples/advanced.md) for full SSL/TLS code examples (cloud, mTLS, dynamic passwords).

| Scenario                       | `ssl` value                                   | Notes                           |
| ------------------------------ | --------------------------------------------- | ------------------------------- |
| Cloud-managed (RDS, Cloud SQL) | `{ rejectUnauthorized: true }`                | Trusted CA, just enable         |
| Self-signed / mTLS             | `{ ca, key, cert, rejectUnauthorized: true }` | Provide cert files via env vars |
| Development only               | `{ rejectUnauthorized: false }`               | Never in production             |

**Gotcha:** If the connection string contains any SSL parameters (`sslmode`, `sslcert`, `sslkey`, `sslrootcert`), the entire `ssl` config object is replaced and any additional options are lost. Use one or the other, not both.

**Gotcha:** `ssl: true` relies on Node.js TLS defaults (which reject unauthorized certs), but does not explicitly set `rejectUnauthorized`. Always use the object form (`ssl: { rejectUnauthorized: true }`) to be explicit about intent.

---

## Production Checklist

### Connection Management

- [ ] Pool `error` event handler on every pool instance
- [ ] `connectionTimeoutMillis` set (not default 0 = infinite wait)
- [ ] `maxLifetimeSeconds` set to rotate connections (helps with DNS changes, PgBouncer)
- [ ] `pool.end()` called on graceful shutdown (SIGTERM handler)
- [ ] All `pool.connect()` calls release clients in `finally` blocks

### Security

- [ ] Parameterized queries for ALL user input (`$1`, `$2`, ...)
- [ ] SSL enabled in production (`ssl: { rejectUnauthorized: true }`)
- [ ] Connection credentials from environment variables (not hardcoded)
- [ ] Least-privilege database user (not superuser)
- [ ] `statement_timeout` configured to prevent runaway queries

### Data Integrity

- [ ] Transactions for multi-statement operations
- [ ] Constraint violation errors handled (23505, 23503, etc.)
- [ ] Deadlock/serialization errors handled with retry logic (40P01, 40001)
- [ ] `numeric`/`decimal` values handled as strings (not silently converted to floats)

### Performance

- [ ] Pool `max` sized appropriately (rule of thumb: 2-4x CPU cores)
- [ ] Streaming for result sets > 1,000 rows
- [ ] No `SELECT *` in production queries
- [ ] Indexes on frequently queried columns
- [ ] `EXPLAIN ANALYZE` for slow queries

### Monitoring

- [ ] Track `pool.totalCount`, `pool.idleCount`, `pool.waitingCount`
- [ ] Alert when `waitingCount > 0` sustained (pool exhaustion)
- [ ] Log slow queries (`log_min_duration_statement` in postgresql.conf)
- [ ] Monitor connection count against PostgreSQL `max_connections`

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/](examples/)_
