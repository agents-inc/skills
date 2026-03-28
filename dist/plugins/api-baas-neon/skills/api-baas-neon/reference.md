# Neon Reference

> Quick lookup tables, CLI commands, and connection configuration. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Connection String Format

```
# Pooled (serverless / high-concurrency)
postgresql://[user]:[password]@[endpoint-id]-pooler.[region].aws.neon.tech/[dbname]?sslmode=require

# Direct (migrations / session features)
postgresql://[user]:[password]@[endpoint-id].[region].aws.neon.tech/[dbname]?sslmode=require
```

The only difference is the `-pooler` suffix on the endpoint ID.

---

## `neon()` Configuration Options

| Option         | Default     | Description                                                     |
| -------------- | ----------- | --------------------------------------------------------------- |
| `arrayMode`    | `false`     | Return rows as arrays instead of objects                        |
| `fullResults`  | `false`     | Include metadata (fields, rowCount, command) in result          |
| `fetchOptions` | `{}`        | Custom fetch config (signal, priority, cache, etc.)             |
| `authToken`    | `undefined` | JWT string or async function returning a JWT for Neon Authorize |

---

## `sql.transaction()` Options

| Option           | Values                                                               | Default         |
| ---------------- | -------------------------------------------------------------------- | --------------- |
| `isolationLevel` | `ReadUncommitted`, `ReadCommitted`, `RepeatableRead`, `Serializable` | `ReadCommitted` |
| `readOnly`       | `boolean`                                                            | `false`         |
| `deferrable`     | `boolean` (only with `readOnly: true` + `Serializable`)              | `false`         |

---

## PgBouncer Pooling Settings (Non-Configurable)

| Setting                   | Value                    |
| ------------------------- | ------------------------ |
| `pool_mode`               | `transaction`            |
| `max_client_conn`         | 10,000                   |
| `default_pool_size`       | 90% of `max_connections` |
| `max_prepared_statements` | 1,000                    |
| `query_wait_timeout`      | 120 seconds              |

---

## Connection Limits by Compute Size

| Compute (CU) | `max_connections` | Notes                                       |
| ------------ | ----------------- | ------------------------------------------- |
| 0.25         | ~104              | Free plan default                           |
| 1            | ~377              | Per-user-per-database pool in PgBouncer     |
| 2            | ~753              |                                             |
| 4            | ~1,507            |                                             |
| 8            | ~3,014            |                                             |
| 16           | ~4,000            | Maximum for scale-to-zero eligible computes |
| 56           | ~4,000            | Always-on, Scale plan only                  |

---

## neonctl CLI Quick Reference

```bash
# Install
npm install -g neonctl

# Authenticate
neonctl auth

# Branch management
neonctl branches list --project-id <pid>
neonctl branches create --name <name> --project-id <pid>
neonctl branches create --name <name> --project-id <pid> --expires-at "2025-04-01T00:00:00Z"
neonctl branches delete <name> --project-id <pid>
neonctl branches reset <name> --parent --project-id <pid>
neonctl branches restore <target> <source@timestamp> --project-id <pid>

# Connection string
neonctl connection-string --project-id <pid> --branch-id <bid>
neonctl connection-string --project-id <pid> --branch-id <bid> --pooled
```

**Authentication:** Use `--api-key` flag or `NEON_API_KEY` environment variable.

---

## Neon REST API Endpoints

| Operation      | Method   | Endpoint                                              |
| -------------- | -------- | ----------------------------------------------------- |
| List branches  | `GET`    | `/projects/{project_id}/branches`                     |
| Create branch  | `POST`   | `/projects/{project_id}/branches`                     |
| Delete branch  | `DELETE` | `/projects/{project_id}/branches/{branch_id}`         |
| Restore branch | `POST`   | `/projects/{project_id}/branches/{branch_id}/restore` |

**Base URL:** `https://console.neon.tech/api/v2`

**Auth header:** `Authorization: Bearer <NEON_API_KEY>`

---

## Branch History Retention

| Plan   | Retention Window |
| ------ | ---------------- |
| Free   | 6 hours          |
| Launch | 7 days           |
| Scale  | 30 days          |

---

## Scale-to-Zero Quick Reference

| Setting              | Default   | Configurable?                       |
| -------------------- | --------- | ----------------------------------- |
| Auto-suspend timeout | 5 minutes | Paid plans: up to 7 days or disable |
| Cold start latency   | 200-500ms | Not configurable                    |
| Max CU for suspend   | 16 CU     | Computes > 16 CU are always-on      |

---

## Environment Variables

```bash
# Application
DATABASE_URL=postgresql://...@ep-cool-dawn-123456-pooler.region.aws.neon.tech/dbname?sslmode=require
DIRECT_DATABASE_URL=postgresql://...@ep-cool-dawn-123456.region.aws.neon.tech/dbname?sslmode=require

# CI / Automation
NEON_API_KEY=neon_api_...
NEON_PROJECT_ID=your-project-id
```

---

## PostgreSQL Direct SSL Optimization

PostgreSQL 17+ supports direct SSL negotiation, reducing connection time by ~119ms:

```
DATABASE_URL=postgresql://...?sslmode=require&sslnegotiation=direct
```
