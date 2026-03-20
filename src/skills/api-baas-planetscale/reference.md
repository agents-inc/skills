# PlanetScale Reference

> Quick lookup tables, CLI commands, and configuration reference. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Connection Configuration

### Config Object

| Option     | Type       | Description                                                                   |
| ---------- | ---------- | ----------------------------------------------------------------------------- |
| `host`     | `string`   | Database hostname (e.g., `aws.connect.psdb.cloud`)                            |
| `username` | `string`   | Authentication username                                                       |
| `password` | `string`   | Authentication password                                                       |
| `url`      | `string`   | MySQL connection URL (alternative to host/username/password)                  |
| `fetch`    | `Function` | Custom fetch implementation (Node.js < 18)                                    |
| `format`   | `Function` | Custom query parameter formatting function                                    |
| `cast`     | `Function` | Custom type casting override (default cast handles INT8-32, FLOAT32/64, JSON) |

### URL Format

```
mysql://[username]:[password]@[host]/[database]
```

---

## Execute Options

| Option | Values                | Default    | Description                      |
| ------ | --------------------- | ---------- | -------------------------------- |
| `as`   | `"object"`, `"array"` | `"object"` | Return rows as objects or arrays |
| `cast` | `Function`            | —          | Per-query type casting override  |

---

## ExecutedQuery Result Shape

| Property       | Type       | Description                                       |
| -------------- | ---------- | ------------------------------------------------- |
| `rows`         | `T[]`      | Array of row objects (or arrays if `as: "array"`) |
| `headers`      | `string[]` | Column names in order                             |
| `types`        | `object`   | Column type information                           |
| `fields`       | `Field[]`  | Detailed column metadata                          |
| `size`         | `number`   | Number of rows returned                           |
| `statement`    | `string`   | The executed SQL statement                        |
| `insertId`     | `string`   | Last insert ID (string, not number)               |
| `rowsAffected` | `number`   | Rows affected by DML operations                   |
| `time`         | `number`   | Execution time in milliseconds                    |

---

## Field Type Strings

Vitess returns these type identifiers in `field.type`:

| Vitess Type | MySQL Type          | Recommended Cast         |
| ----------- | ------------------- | ------------------------ |
| `INT8`      | `TINYINT`           | `parseInt()` or boolean  |
| `INT16`     | `SMALLINT`          | `parseInt()`             |
| `INT24`     | `MEDIUMINT`         | `parseInt()`             |
| `INT32`     | `INT`               | `parseInt()`             |
| `INT64`     | `BIGINT`            | `BigInt()`               |
| `UINT8`     | `TINYINT UNSIGNED`  | `parseInt()`             |
| `UINT16`    | `SMALLINT UNSIGNED` | `parseInt()`             |
| `UINT32`    | `INT UNSIGNED`      | `parseInt()`             |
| `UINT64`    | `BIGINT UNSIGNED`   | `BigInt()`               |
| `FLOAT32`   | `FLOAT`             | `parseFloat()`           |
| `FLOAT64`   | `DOUBLE`            | `parseFloat()`           |
| `DECIMAL`   | `DECIMAL`           | `parseFloat()` or string |
| `VARCHAR`   | `VARCHAR`           | string (default)         |
| `VARBINARY` | `VARBINARY`         | string                   |
| `BLOB`      | `BLOB`              | string                   |
| `TEXT`      | `TEXT`              | string (default)         |
| `JSON`      | `JSON`              | `JSON.parse()`           |
| `DATETIME`  | `DATETIME`          | `new Date(value + "Z")`  |
| `TIMESTAMP` | `TIMESTAMP`         | `new Date(value + "Z")`  |
| `DATE`      | `DATE`              | `new Date(value)`        |
| `TIME`      | `TIME`              | string                   |
| `ENUM`      | `ENUM`              | string (default)         |
| `SET`       | `SET`               | string (default)         |
| `BIT`       | `BIT`               | `parseInt(value, 2)`     |
| `NULL_TYPE` | `NULL`              | `null`                   |

---

## Vitess SQL Compatibility

### Supported

- Standard DML: `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- DDL: `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `CREATE INDEX`
- JSON functions (except `JSON_TABLE`)
- Common Table Expressions (non-recursive)
- Window functions
- Subqueries, `UNION`, `INTERSECT`, `EXCEPT`
- `ON DUPLICATE KEY UPDATE`
- Foreign key constraints (opt-in, unsharded databases only)

### Not Supported

| Feature                  | Alternative                                      |
| ------------------------ | ------------------------------------------------ |
| Stored procedures        | Application logic                                |
| Stored functions         | Application logic                                |
| Triggers                 | Application logic or event-driven hooks          |
| Events (scheduled tasks) | External cron or job scheduler                   |
| `RENAME COLUMN`          | Add new column + migrate data + drop old (3 DRs) |
| `:=` assignment operator | `SET @var = 1` (use `=` instead)                 |
| `LOAD DATA INFILE`       | `INSERT` statements or bulk import via API       |
| `CREATE DATABASE`        | PlanetScale dashboard, API, or `pscale` CLI      |
| `DROP DATABASE`          | PlanetScale dashboard, API, or `pscale` CLI      |
| `JSON_TABLE`             | Application-side JSON processing                 |
| `KILL` (query killing)   | Not available from CLI connections               |
| Recursive CTEs           | Experimental SELECT-only support (Vitess 21+)    |

### SQL Mode Restrictions

- Global timezone is UTC (not configurable)
- `SET sql_mode` is session-only (single request on HTTP driver)
- Avoid `PIPES_AS_CONCAT` and `ANSI_QUOTES` (interfere with Vitess query parsing)

---

## pscale CLI Quick Reference

```bash
# Install
brew install planetscale/tap/pscale   # macOS
scoop install pscale                    # Windows

# Authenticate
pscale auth login

# Branch management
pscale branch list <DATABASE>
pscale branch create <DATABASE> <BRANCH>
pscale branch delete <DATABASE> <BRANCH>
pscale branch show <DATABASE> <BRANCH>
pscale shell <DATABASE> <BRANCH>                 # Interactive MySQL shell
pscale connect <DATABASE> <BRANCH> --port 3306   # Local tunnel

# Safe migrations
pscale branch safe-migrations enable <DATABASE> <BRANCH>
pscale branch safe-migrations disable <DATABASE> <BRANCH>

# Deploy requests
pscale deploy-request create <DATABASE> <BRANCH> --into main
pscale deploy-request create <DATABASE> <BRANCH> --disable-auto-apply  # Gated
pscale deploy-request list <DATABASE>
pscale deploy-request show <DATABASE> <DR_NUMBER>
pscale deploy-request diff <DATABASE> <DR_NUMBER>
pscale deploy-request deploy <DATABASE> <DR_NUMBER>
pscale deploy-request deploy <DATABASE> <DR_NUMBER> --instant
pscale deploy-request apply <DATABASE> <DR_NUMBER>       # For gated deployments
pscale deploy-request revert <DATABASE> <DR_NUMBER>      # Within 30-minute window
pscale deploy-request skip-revert <DATABASE> <DR_NUMBER> # Close revert window early
pscale deploy-request close <DATABASE> <DR_NUMBER>       # Cancel without deploying
pscale deploy-request review <DATABASE> <DR_NUMBER> --approve
pscale deploy-request review <DATABASE> <DR_NUMBER> --comment "LGTM"

# Passwords (connection credentials)
pscale password create <DATABASE> <BRANCH> <PASSWORD_NAME>
pscale password list <DATABASE> <BRANCH>
pscale password delete <DATABASE> <BRANCH> <PASSWORD_ID>
```

**Authentication:** Use `PLANETSCALE_SERVICE_TOKEN` and `PLANETSCALE_SERVICE_TOKEN_ID` environment variables for CI, or `pscale auth login` for interactive use.

---

## Deploy Request Revert Rules

| Scenario                                     | Can Revert? | Notes                                           |
| -------------------------------------------- | ----------- | ----------------------------------------------- |
| Standard deployment (within 30 min)          | Yes         | Original table preserved as shadow              |
| Standard deployment (after 30 min)           | No          | Create new deploy request to undo               |
| Instant deployment (`--instant`)             | No          | `ALGORITHM=INSTANT` skips revert infrastructure |
| New column added, data written to it         | Yes         | Data in new column is lost on revert            |
| Column dropped, data existed                 | Yes         | Dropped column data is preserved in shadow      |
| FK dropped, new non-conforming data inserted | Partial     | Revert may fail if new data violates constraint |
| Expanded field size, larger data inserted    | Partial     | Revert may fail if data exceeds original size   |

---

## Environment Variables

```bash
# Application (serverless driver)
DATABASE_HOST=aws.connect.psdb.cloud
DATABASE_USERNAME=your-username
DATABASE_PASSWORD=pscale_pw_...

# Or single URL
DATABASE_URL=mysql://user:pass@aws.connect.psdb.cloud/dbname

# CI / Automation
PLANETSCALE_SERVICE_TOKEN=pscale_tkn_...
PLANETSCALE_SERVICE_TOKEN_ID=your-token-id
PLANETSCALE_ORG=your-org-name
```
