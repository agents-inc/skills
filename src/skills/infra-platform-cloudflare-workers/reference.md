# Cloudflare Workers Quick Reference

## Wrangler CLI Commands

### Development

```bash
# Start local dev server (http://localhost:8787)
npx wrangler dev

# Dev with remote bindings (real KV/D1/R2)
npx wrangler dev --remote

# Dev with cron trigger testing
npx wrangler dev --test-scheduled

# Trigger scheduled handler manually
curl "http://localhost:8787/__scheduled?cron=0+*/6+*+*+*"
```

### Deployment

```bash
# Deploy to production
npx wrangler deploy

# Deploy to specific environment
npx wrangler deploy --env staging

# Deploy with secrets file
npx wrangler deploy --secrets-file .env.production

# Tail live logs
npx wrangler tail
npx wrangler tail --env staging
```

### Type Generation

```bash
# Generate Env interface from wrangler.jsonc
npx wrangler types

# Output: worker-configuration.d.ts
```

### Secrets

```bash
# Set a secret (interactive prompt)
npx wrangler secret put API_KEY

# Set secret for specific environment
npx wrangler secret put API_KEY --env staging

# List secrets
npx wrangler secret list

# Delete a secret
npx wrangler secret delete API_KEY
```

### D1 Database

```bash
# Create database
npx wrangler d1 create my-database

# Create migration
npx wrangler d1 migrations create my-database migration_name

# Apply migrations locally
npx wrangler d1 migrations apply my-database --local

# Apply migrations remotely
npx wrangler d1 migrations apply my-database --remote

# Execute SQL
npx wrangler d1 execute my-database --command "SELECT * FROM users" --remote

# Export database
npx wrangler d1 export my-database --remote --output backup.sql
```

### KV Namespace

```bash
# Create namespace
npx wrangler kv namespace create CACHE

# List namespaces
npx wrangler kv namespace list

# Put a value
npx wrangler kv key put --namespace-id <id> "key" "value"

# Get a value
npx wrangler kv key get --namespace-id <id> "key"

# List keys
npx wrangler kv key list --namespace-id <id>
```

### R2 Bucket

```bash
# Create bucket
npx wrangler r2 bucket create my-files

# List buckets
npx wrangler r2 bucket list

# Upload object
npx wrangler r2 object put my-files/path/to/file.txt --file ./local-file.txt

# Download object
npx wrangler r2 object get my-files/path/to/file.txt

# Delete object
npx wrangler r2 object delete my-files/path/to/file.txt
```

### Queues

```bash
# Create queue
npx wrangler queues create my-queue

# List queues
npx wrangler queues list

# Delete queue
npx wrangler queues delete my-queue
```

---

## Handler Signatures

### Fetch Handler (HTTP)

```typescript
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return new Response("OK");
  },
} satisfies ExportedHandler<Env>;
```

### Scheduled Handler (Cron)

```typescript
export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    // event.cron — cron expression that triggered
    // event.scheduledTime — epoch ms when cron was supposed to run
  },
} satisfies ExportedHandler<Env>;
```

### Queue Handler (Consumer)

```typescript
export default {
  async queue(
    batch: MessageBatch<unknown>,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    for (const message of batch.messages) {
      // message.body — deserialized message content
      // message.id — unique message ID
      // message.timestamp — when message was sent
      message.ack(); // acknowledge
      message.retry(); // re-queue for retry
    }
  },
} satisfies ExportedHandler<Env>;
```

---

## Binding Type Reference

### KV Namespace

```typescript
interface KVNamespace {
  get(key: string, type?: "text"): Promise<string | null>;
  get<T>(key: string, type: "json"): Promise<T | null>;
  get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
  get(key: string, type: "stream"): Promise<ReadableStream | null>;

  put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: {
      expirationTtl?: number; // seconds until expiry
      expiration?: number; // unix epoch seconds
      metadata?: Record<string, unknown>;
    },
  ): Promise<void>;

  delete(key: string): Promise<void>;

  list(options?: {
    prefix?: string;
    limit?: number; // default 1000, max 1000
    cursor?: string;
  }): Promise<KVNamespaceListResult>;

  getWithMetadata<T>(
    key: string,
    type: "json",
  ): Promise<{
    value: T | null;
    metadata: Record<string, unknown> | null;
  }>;
}
```

### D1 Database

```typescript
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
  withSession(constraint?: string): D1DatabaseSession;
}

interface D1DatabaseSession {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  getBookmark(): string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
  raw<T = unknown[]>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    changed_db: boolean;
    changes: number;
    last_row_id: number;
    duration: number;
    rows_read: number;
    rows_written: number;
  };
}
```

### R2 Bucket

```typescript
interface R2Bucket {
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | string | Blob | null,
    options?: R2PutOptions,
  ): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
  head(key: string): Promise<R2Object | null>;
  createMultipartUpload(
    key: string,
    options?: R2MultipartOptions,
  ): Promise<R2MultipartUpload>;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  writeHttpMetadata(headers: Headers): void;
}
```

### Queue Producer

```typescript
interface Queue<Body = unknown> {
  send(
    message: Body,
    options?: { contentType?: string; delaySeconds?: number },
  ): Promise<void>;
  sendBatch(
    messages: { body: Body; contentType?: string; delaySeconds?: number }[],
  ): Promise<void>;
}
```

### Durable Object Namespace

```typescript
interface DurableObjectNamespace<T extends DurableObject = DurableObject> {
  idFromName(name: string): DurableObjectId;
  idFromString(hexId: string): DurableObjectId;
  newUniqueId(options?: { jurisdiction?: string }): DurableObjectId;
  get(
    id: DurableObjectId,
    options?: { locationHint?: string },
  ): DurableObjectStub<T>;
}
```

### AI Binding

```typescript
interface Ai {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: { gateway?: { id: string } },
  ): Promise<unknown>;
}
```

### Service Binding

```typescript
interface Fetcher {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
  // RPC methods are also available when the target worker exports a WorkerEntrypoint
}
```

---

## wrangler.jsonc Configuration Template

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",

  // Required
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2025-09-15",
  "compatibility_flags": ["nodejs_compat"],

  // Observability (recommended for production)
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1.0,
  },

  // Performance
  "placement": { "mode": "smart" },
  "upload_source_maps": true,

  // Cron triggers
  "triggers": {
    "crons": ["0 */6 * * *"],
  },

  // Static assets (optional)
  "assets": {
    "directory": "./public",
  },

  // Bindings
  "vars": {
    "ENVIRONMENT": "production",
  },
  "kv_namespaces": [{ "binding": "CACHE", "id": "namespace-id" }],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-db",
      "database_id": "db-id",
      "migrations_dir": "migrations",
    },
  ],
  "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "my-files" }],
  "durable_objects": {
    "bindings": [{ "name": "STATE", "class_name": "MyDurableObject" }],
  },
  "queues": {
    "producers": [{ "binding": "QUEUE", "queue": "my-queue" }],
    "consumers": [
      {
        "queue": "my-queue",
        "max_batch_size": 10,
        "max_batch_timeout": 30,
        "max_retries": 3,
      },
    ],
  },
  "services": [{ "binding": "AUTH", "service": "auth-worker" }],
  "ai": { "binding": "AI" },

  // Durable Object migrations
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["MyDurableObject"] }],

  // Environments
  "env": {
    "staging": {
      "name": "my-worker-staging",
      "vars": { "ENVIRONMENT": "staging" },
      "kv_namespaces": [{ "binding": "CACHE", "id": "staging-namespace-id" }],
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "my-db-staging",
          "database_id": "staging-db-id",
        },
      ],
    },
  },
}
```

---

## CPU Time Limits

| Plan                | Per-Request Limit | Cron Trigger Limit |
| ------------------- | ----------------- | ------------------ |
| Free                | 10 ms CPU time    | 15 minutes         |
| Paid (default)      | 30 seconds        | 15 minutes         |
| Paid (configurable) | Up to 15 minutes  | 15 minutes         |

**Note:** CPU time excludes I/O wait. A Worker that makes a 2-second fetch but uses 5ms CPU only consumes 5ms of its limit.

---

## Named Constants Reference

```typescript
// Common constants for Workers applications
const DEFAULT_PORT = 8_787;
const WORKER_MEMORY_LIMIT_MB = 128;
const KV_MAX_VALUE_SIZE = 25 * 1024 * 1024; // 25 MB
const KV_MAX_KEY_SIZE = 512; // 512 bytes
const KV_MAX_LIST_KEYS = 1_000;
const R2_MAX_PUT_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB (multipart)
const R2_MAX_SINGLE_PUT = 100 * 1024 * 1024; // 100 MB (single PUT)
const D1_MAX_DB_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
const QUEUE_MAX_MESSAGE_SIZE = 128 * 1024; // 128 KB
const QUEUE_MAX_BATCH_SIZE = 100;
```
