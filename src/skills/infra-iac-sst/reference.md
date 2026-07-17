# SST (Ion) Quick Reference

## CLI Commands

### Development

```bash
# Start live dev (deploys infra, proxies Lambda locally, starts frontends)
sst dev

# Dev in basic mode (no multiplexer, just links resources)
sst dev --mode basic

# Run a command with linked resources
sst shell

# Run a specific command with linked resources
sst shell -- node scripts/seed.ts
```

### Deployment

```bash
# Deploy to personal stage
sst deploy

# Deploy to a named stage
sst deploy --stage production

# Deploy a single component
sst deploy --target MyFunction

# Exclude a component from deploy
sst deploy --exclude MyFrontend

# Continue deploying despite errors
sst deploy --continue
```

### Removal

```bash
# Remove personal stage
sst remove

# Remove a named stage
sst remove --stage staging

# Remove a specific component
sst remove --target MyFunction
```

### Secrets

```bash
# Set a secret (prompts for value)
sst secret set DATABASE_URL

# Set with inline value
sst secret set STRIPE_KEY sk_live_xxx

# Set a fallback for all stages
sst secret set API_KEY xxx --fallback

# Load secrets from file (.env or bash format)
sst secret load .env.production

# List all secrets for current stage
sst secret list

# Remove a secret
sst secret remove OLD_KEY
```

### Maintenance

```bash
# Unlock stuck deployment state
sst unlock

# Sync local state with cloud
sst refresh

# Upgrade SST CLI
sst upgrade

# Upgrade to specific version
sst upgrade 3.5

# Show installed version
sst version
```

---

## Component Cheat Sheet

### Compute

| Component          | Service     | Key Props                                                                    |
| ------------------ | ----------- | ---------------------------------------------------------------------------- |
| `sst.aws.Function` | Lambda      | `handler`, `runtime`, `memory`, `timeout`, `link`, `url`, `streaming`, `vpc` |
| `sst.aws.Cluster`  | ECS         | `vpc`                                                                        |
| `sst.aws.Service`  | ECS Service | `cluster`, `image`, `link`, `scaling`                                        |
| `sst.aws.Task`     | ECS Task    | `cluster`, `image`, `link`                                                   |

### API & Routing

| Component              | Service        | Key Props                                                     |
| ---------------------- | -------------- | ------------------------------------------------------------- |
| `sst.aws.ApiGatewayV2` | API Gateway v2 | `domain`, `cors`, `accessLog`, `.route()`, `.addAuthorizer()` |
| `sst.aws.Router`       | CloudFront     | `domain`, `.route()`                                          |

### Data & Storage

| Component          | Service      | Key Props                                                  |
| ------------------ | ------------ | ---------------------------------------------------------- |
| `sst.aws.Dynamo`   | DynamoDB     | `fields`, `primaryIndex`, `globalIndexes`, `stream`, `ttl` |
| `sst.aws.Bucket`   | S3           | `access`, `cors`, `versioning`                             |
| `sst.aws.Postgres` | RDS Postgres | `vpc`, `scaling`                                           |

### Messaging & Scheduling

| Component       | Service     | Key Props                                          |
| --------------- | ----------- | -------------------------------------------------- |
| `sst.aws.Queue` | SQS         | `fifo`, `visibilityTimeout`, `dlq`, `.subscribe()` |
| `sst.aws.Topic` | SNS         | `.subscribe()`                                     |
| `sst.aws.Cron`  | EventBridge | `schedule`, `function` / `task`                    |

### Frontend Frameworks

| Component            | Framework      | Key Props                       |
| -------------------- | -------------- | ------------------------------- |
| `sst.aws.Nextjs`     | Next.js        | `link`, `domain`, `environment` |
| `sst.aws.Remix`      | Remix          | `link`, `domain`                |
| `sst.aws.Astro`      | Astro          | `link`, `domain`                |
| `sst.aws.SvelteKit`  | SvelteKit      | `link`, `domain`                |
| `sst.aws.SolidStart` | SolidStart     | `link`, `domain`                |
| `sst.aws.StaticSite` | Static HTML/JS | `path`, `domain`, `environment` |

### Infrastructure

| Component      | Service | Key Props               |
| -------------- | ------- | ----------------------- |
| `sst.aws.Vpc`  | VPC     | `bastion`, `nat`        |
| `sst.Linkable` | Custom  | `properties`, `include` |

---

## Global Helpers (Available in `sst.config.ts` `run()`)

| Helper                  | Purpose                   | Example                                           |
| ----------------------- | ------------------------- | ------------------------------------------------- |
| `$app.name`             | App name                  | `$app.name`                                       |
| `$app.stage`            | Current stage             | `$app.stage === "production"`                     |
| `$app.protect`          | Protect flag              | `$app.protect`                                    |
| `$app.removal`          | Removal policy            | `$app.removal`                                    |
| `$dev`                  | Is `sst dev` mode         | `if ($dev) { ... }`                               |
| `$concat(...vals)`      | Join Output strings       | `$concat("prefix-", bucket.name)`                 |
| `` $interpolate`...` `` | Template literal Outputs  | `` $interpolate`arn:aws:s3:::${bucket.name}` ``   |
| `$resolve(vals)`        | Await multiple Outputs    | `$resolve([a, b]).apply(([a, b]) => ...)`         |
| `$transform(Type, fn)`  | Global component defaults | `$transform(sst.aws.Function, (args) => { ... })` |
| `$asset(path)`          | File/dir as Pulumi asset  | `$asset("./files/config.json")`                   |
| `$jsonParse(str)`       | Parse JSON Output         | `$jsonParse(secret.value)`                        |
| `$jsonStringify(obj)`   | Stringify Output          | `$jsonStringify({ key: output })`                 |

---

## Function Configuration Defaults

```typescript
// sst.aws.Function defaults
{
  runtime: "nodejs22.x",    // Also supports go, python, rust
  memory: "1024 MB",        // Range: 128 MB - 10240 MB
  timeout: "20 seconds",    // Range: 1 second - 900 seconds
  storage: "512 MB",        // Ephemeral storage: 512 MB - 10240 MB
  architecture: "x86_64",   // Also supports "arm64"
}
```

---

## Named Constants

```typescript
// SST / Lambda limits
const LAMBDA_MAX_MEMORY_MB = 10_240;
const LAMBDA_MAX_TIMEOUT_SECONDS = 900;
const LAMBDA_MAX_STORAGE_MB = 10_240;
const LAMBDA_MAX_ENV_SIZE_BYTES = 4_096;
const DYNAMO_MAX_ITEM_SIZE_BYTES = 400 * 1024; // 400 KB
const DYNAMO_MAX_BATCH_WRITE = 25;
const DYNAMO_MAX_BATCH_GET = 100;
const SQS_MAX_MESSAGE_SIZE_BYTES = 256 * 1024; // 256 KB
const SQS_MAX_VISIBILITY_TIMEOUT_HOURS = 12;
const SQS_DEFAULT_VISIBILITY_TIMEOUT_SECONDS = 30;
const S3_MAX_SINGLE_PUT_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
```

---

## Environment Files

SST automatically loads environment files in this order:

1. `.env` — Always loaded (highest priority)
2. `.env.<stage>` — Stage-specific overrides

Both are available as `process.env` in `sst.config.ts` and in Lambda functions.

**Note:** `.env` takes precedence over `.env.<stage>`. This is the opposite of some frameworks.

---

## Concurrency Environment Variables

Control build parallelism during `sst deploy`:

| Variable                          | Default | Purpose                      |
| --------------------------------- | ------- | ---------------------------- |
| `SST_BUILD_CONCURRENCY_SITE`      | 1       | Frontend builds in parallel  |
| `SST_BUILD_CONCURRENCY_FUNCTION`  | 4       | Function bundles in parallel |
| `SST_BUILD_CONCURRENCY_CONTAINER` | 1       | Container builds in parallel |
