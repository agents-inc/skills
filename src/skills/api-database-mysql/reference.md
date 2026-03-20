# MySQL (mysql2) Quick Reference

> Type cheat sheet, pool options, error codes, and production checklist. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## TypeScript Type Cheat Sheet

### Query Result Types

| Operation                       | Generic Type                           | Return Shape                    |
| ------------------------------- | -------------------------------------- | ------------------------------- |
| `SELECT` (single statement)     | `RowDataPacket[]`                      | `[rows, fields]`                |
| `SELECT` (multiple statements)  | `RowDataPacket[][]`                    | `[[rows1, rows2, ...], fields]` |
| `INSERT / UPDATE / DELETE`      | `ResultSetHeader`                      | `[result, fields]`              |
| Multiple mutations              | `ResultSetHeader[]`                    | `[results[], fields]`           |
| Stored procedure (returns rows) | `ProcedureCallPacket<RowDataPacket[]>` | `[[rows, header], fields]`      |
| Stored procedure (mutation)     | `ProcedureCallPacket<ResultSetHeader>` | `[[header], fields]`            |

### Custom Row Interfaces

```typescript
import type { RowDataPacket } from "mysql2/promise";

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  name: string;
  created_at: Date;
}

// Usage: pool.execute<UserRow[]>("SELECT ...", params)
```

### ResultSetHeader Fields

| Field           | Type     | Description                                                                                                                                                                       |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `affectedRows`  | `number` | Rows affected by INSERT/UPDATE/DELETE                                                                                                                                             |
| `insertId`      | `number` | Auto-increment ID of inserted row                                                                                                                                                 |
| `changedRows`   | `number` | **Deprecated** -- rows actually changed (UPDATE only -- excludes unchanged matches). Parsed from server text messages, fragile across MySQL versions. Use `affectedRows` instead. |
| `fieldCount`    | `number` | Number of columns in result                                                                                                                                                       |
| `info`          | `string` | Server info message (e.g., `"Rows matched: 1  Changed: 1"`)                                                                                                                       |
| `warningStatus` | `number` | Number of server warnings (check after DDL)                                                                                                                                       |

---

## Pool Configuration Options

| Option                  | Default             | Description                                                   |
| ----------------------- | ------------------- | ------------------------------------------------------------- |
| `uri`                   | `undefined`         | Connection string (`mysql://user:pass@host:3306/db`)          |
| `host`                  | `"localhost"`       | MySQL server hostname                                         |
| `port`                  | `3306`              | MySQL server port                                             |
| `user`                  | `undefined`         | Authentication user                                           |
| `password`              | `undefined`         | Authentication password                                       |
| `database`              | `undefined`         | Default database                                              |
| `connectionLimit`       | `10`                | Max concurrent connections                                    |
| `maxIdle`               | `10`                | Max idle connections to keep (others are closed)              |
| `idleTimeout`           | `60000`             | Milliseconds before idle connection is closed                 |
| `waitForConnections`    | `true`              | Queue requests when all connections are busy                  |
| `queueLimit`            | `0`                 | Max queued requests (0 = unlimited)                           |
| `enableKeepAlive`       | `false`             | Send TCP keep-alive packets (set to `true` in production)     |
| `keepAliveInitialDelay` | `0`                 | Milliseconds before first keep-alive                          |
| `namedPlaceholders`     | `false`             | Enable `:name` syntax for parameters                          |
| `multipleStatements`    | `false`             | Allow multiple SQL statements per query (security risk)       |
| `charset`               | `"UTF8_GENERAL_CI"` | Connection character set                                      |
| `timezone`              | `"local"`           | Timezone for date conversion                                  |
| `dateStrings`           | `false`             | Return DATE/DATETIME as strings instead of Date objects       |
| `typeCast`              | `true`              | Convert MySQL types to JavaScript types                       |
| `decimalNumbers`        | `false`             | Return DECIMAL as numbers instead of strings (precision risk) |

### Recommended Configurations

See [examples/core.md](examples/core.md) for the production pool setup pattern and [examples/configuration.md](examples/configuration.md) for environment-specific configurations (standard, serverless, batch, test).

---

## MySQL Error Codes

### Common Error Codes

| Code                       | errno | Description                    | Typical Response                             |
| -------------------------- | ----- | ------------------------------ | -------------------------------------------- |
| `ER_DUP_ENTRY`             | 1062  | Duplicate unique key violation | Return conflict, don't throw                 |
| `ER_LOCK_DEADLOCK`         | 1213  | Transaction deadlocked         | Retry entire transaction                     |
| `ER_LOCK_WAIT_TIMEOUT`     | 1205  | Lock wait timeout exceeded     | Retry or fail with message                   |
| `ER_ACCESS_DENIED_ERROR`   | 1045  | Bad credentials                | Fail fast, log config issue                  |
| `ER_BAD_DB_ERROR`          | 1049  | Unknown database               | Fail fast, check DATABASE_URL                |
| `ER_NO_SUCH_TABLE`         | 1146  | Table doesn't exist            | Migration issue                              |
| `ER_PARSE_ERROR`           | 1064  | SQL syntax error               | Fix the query                                |
| `ER_DATA_TOO_LONG`         | 1406  | Data exceeds column length     | Validate input before insert                 |
| `ER_TRUNCATED_WRONG_VALUE` | 1292  | Invalid date/datetime value    | Validate date format                         |
| `ER_BAD_NULL_ERROR`        | 1048  | Column cannot be NULL          | Provide required value                       |
| `ER_BAD_FIELD_ERROR`       | 1054  | Unknown column                 | Fix column name                              |
| `ER_TABLE_EXISTS_ERROR`    | 1050  | Table already exists           | Use IF NOT EXISTS                            |
| `ER_CON_COUNT_ERROR`       | 1040  | Too many connections           | Increase max_connections or reduce pool size |

### Connection-Level Errors

| Error                      | Description                      | Recovery                      |
| -------------------------- | -------------------------------- | ----------------------------- |
| `ECONNREFUSED`             | Server not accepting connections | Check if MySQL is running     |
| `ECONNRESET`               | Connection reset by server       | Pool reconnects automatically |
| `PROTOCOL_CONNECTION_LOST` | Server closed connection         | Pool reconnects automatically |
| `ETIMEDOUT`                | Connection timed out             | Check network, firewall       |
| `ER_SERVER_SHUTDOWN`       | Server shutting down             | Wait and retry                |

---

## SSL/TLS Configuration

See [examples/configuration.md](examples/configuration.md) for SSL/TLS setup patterns (cloud, CA cert, mutual TLS).

---

## Production Checklist

### Connection Management

- [ ] Using `createPool()` (not `createConnection()`)
- [ ] `DATABASE_URL` from environment variable (not hardcoded)
- [ ] `enableKeepAlive: true` to prevent stale connections
- [ ] `waitForConnections: true` (default) to queue under load
- [ ] Pool `error` event handler registered
- [ ] `connectionLimit` appropriate for server capacity (start at 10)
- [ ] SSL/TLS enabled for production connections
- [ ] Pool `end()` called on graceful shutdown

### Query Safety

- [ ] All parameterized queries use `execute()` with `?` placeholders
- [ ] No string interpolation in SQL statements
- [ ] `multipleStatements` disabled (default) unless explicitly needed
- [ ] User-facing queries have LIMIT clauses to prevent unbounded results
- [ ] BIGINT and DECIMAL columns handled as strings (not numbers)

### Transaction Safety

- [ ] `pool.getConnection()` used for all transactions
- [ ] `connection.release()` in `finally` block
- [ ] `connection.rollback()` in `catch` block
- [ ] `ER_LOCK_DEADLOCK` handled with retry logic
- [ ] Transaction scope is as narrow as possible (hold locks briefly)

### Monitoring

- [ ] Pool `enqueue` event logged (indicates pool exhaustion)
- [ ] Query execution time tracked
- [ ] Connection count monitored
- [ ] Error rates tracked by error code

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/](examples/)_
