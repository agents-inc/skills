# SST (Ion) — Core Patterns

> Core configuration, resource linking, live dev, and secrets patterns. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [API & Data](api-data.md) — ApiGatewayV2, Dynamo, Bucket, Queue, Topic, Cron
- [Deployment & DevOps](deployment.md) — CI/CD, transforms, removal policies, VPC, frontend frameworks

---

## sst.config.ts Structure

```typescript
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "my-app",
      home: "aws",
      removal: input.stage === "production" ? "retain" : "remove",
      protect: input.stage === "production",
      providers: {
        aws: { region: "us-east-1" },
      },
    };
  },
  async run() {
    // All resources defined here
    const bucket = new sst.aws.Bucket("Uploads");

    const api = new sst.aws.Function("Api", {
      handler: "src/api.handler",
      link: [bucket],
      url: true,
    });

    // Returned values become outputs in .sst/outputs.json
    return {
      apiUrl: api.url,
      bucketName: bucket.name,
    };
  },
});
```

**Why good:** `app()` configures metadata and stage-aware policies (retain prod data, protect prod from accidental removal), `run()` defines all resources with TypeScript, return values create CLI-accessible outputs

```typescript
// BAD: Missing stage-aware policies
export default $config({
  app(input) {
    return {
      name: "my-app",
      home: "aws",
      // No removal or protect — production data can be accidentally deleted
    };
  },
  async run() {
    const bucket = new sst.aws.Bucket("Uploads");
    // No return — outputs not available to other tools
  },
});
```

**Why bad:** No `removal: "retain"` for production means `sst remove` deletes all S3 data, no `protect` means accidental removal is possible, no return value means no outputs for scripts or CI

---

## Resource Linking — Infrastructure Side

```typescript
// sst.config.ts
async run() {
  const table = new sst.aws.Dynamo("Notes", {
    fields: { userId: "string", noteId: "string" },
    primaryIndex: { hashKey: "userId", rangeKey: "noteId" },
  });

  const bucket = new sst.aws.Bucket("Attachments");

  // Link grants IAM permissions AND injects type-safe references
  new sst.aws.Function("Api", {
    handler: "src/api.handler",
    link: [table, bucket],
  });

  // Link to frontend frameworks (server-side only)
  new sst.aws.Nextjs("Web", {
    link: [table, bucket],
  });
}
```

**Why good:** `link` automatically generates IAM policies (Function gets DynamoDB + S3 access), injects resource metadata into function bundle, and creates `sst-env.d.ts` type definitions

---

## Resource Linking — Runtime Side

```typescript
// src/api.ts — handler code
import { Resource } from "sst";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});

export async function handler(event: unknown) {
  // Resource.Notes.name is the DynamoDB table name — type-safe
  await client.send(
    new PutItemCommand({
      TableName: Resource.Notes.name,
      Item: {
        userId: { S: "user-123" },
        noteId: { S: "note-456" },
      },
    }),
  );

  // Resource.Attachments.name is the S3 bucket name
  console.log("Bucket:", Resource.Attachments.name);

  return { statusCode: 200, body: "Created" };
}
```

**Why good:** `Resource.*` is fully typed (autocomplete works), no hardcoded table/bucket names, no manual environment variable wiring, permissions already granted via `link`

```typescript
// BAD: Hardcoded resource names
const TABLE_NAME = "my-app-production-Notes";
await client.send(
  new PutItemCommand({
    TableName: TABLE_NAME, // Breaks across stages, no type safety
    Item: { userId: { S: "user-123" }, noteId: { S: "note-456" } },
  }),
);
```

**Why bad:** Hardcoded name breaks in dev/staging stages, no type safety, requires manual IAM policy management, no connection to SST infrastructure

---

## Custom Linkables

Link arbitrary values (API keys, config) or wrap raw Pulumi resources.

```typescript
// Link arbitrary values
const stripe = new sst.Linkable("Stripe", {
  properties: { publishableKey: "pk_live_xxx" },
});

new sst.aws.Function("Billing", {
  handler: "src/billing.handler",
  link: [stripe],
});
```

```typescript
// Runtime access
import { Resource } from "sst";
const key = Resource.Stripe.publishableKey;
```

```typescript
// Wrap a raw Pulumi resource to make it linkable
sst.Linkable.wrap(aws.dynamodb.Table, (table) => ({
  properties: { tableName: table.name },
  include: [
    sst.aws.permission({
      actions: ["dynamodb:*"],
      resources: [table.arn],
    }),
  ],
}));

// Now raw Pulumi tables can be linked like SST components
const rawTable = new aws.dynamodb.Table("Legacy", {
  /* ... */
});
new sst.aws.Function("Handler", {
  handler: "src/handler.handler",
  link: [rawTable],
});
```

**Why good:** `sst.Linkable` links arbitrary config, `Linkable.wrap` makes any Pulumi resource linkable with permissions — useful for AWS services without an SST component

---

## Secrets

```bash
# Set secrets (per-stage, encrypted in S3)
sst secret set DATABASE_URL "postgres://..."
sst secret set STRIPE_SECRET_KEY "sk_live_xxx"

# Set fallback value for all stages
sst secret set API_KEY "key-xxx" --fallback
```

```typescript
// sst.config.ts — link secrets like any resource
const dbUrl = new sst.Secret("DatabaseUrl");
const stripeKey = new sst.Secret("StripeSecretKey");

new sst.aws.Function("Api", {
  handler: "src/api.handler",
  link: [dbUrl, stripeKey],
});
```

```typescript
// Runtime — access via Resource
import { Resource } from "sst";
const connectionString = Resource.DatabaseUrl.value;
const stripe = new Stripe(Resource.StripeSecretKey.value);
```

**Why good:** Secrets are encrypted at rest in S3, per-stage isolation, accessed through the same `Resource.*` pattern as other links, no `.env` files to manage

---

## Global Helpers

```typescript
// $app — app context
const isProd = $app.stage === "production";
const appName = $app.name;

// $dev — boolean, true during sst dev
if ($dev) {
  // Skip expensive resources in dev mode
}

// $concat — join Output values (can't use template literals with Outputs)
const bucketArn = $concat("arn:aws:s3:::", bucket.name);

// $interpolate — template literal syntax for Outputs
const policy = $interpolate`arn:aws:s3:::${bucket.name}/*`;

// $resolve — await multiple Outputs
$resolve([bucket.name, table.name]).apply(([b, t]) => {
  console.log(`Bucket: ${b}, Table: ${t}`);
});

// $transform — set global defaults for a component type
$transform(sst.aws.Function, (args) => {
  args.runtime ??= "nodejs22.x";
  args.memory ??= "512 MB";
  args.architecture ??= "arm64";
});
```

**Why good:** Global helpers handle Pulumi Output resolution — you cannot use standard template literals or string concatenation with Output values. `$transform` sets defaults across all instances without repeating configuration.

```typescript
// BAD: Using template literals with Outputs
const arn = `arn:aws:s3:::${bucket.name}`; // ERROR: bucket.name is an Output, not a string
```

**Why bad:** Pulumi Outputs are not strings — template literals produce `[object Object]`. Must use `$concat()` or `$interpolate` instead.

---

## Dev Workflow

```bash
# 1. Start live development (personal stage)
sst dev

# 2. The multiplexer:
#    - Deploys infrastructure to your personal stage
#    - Proxies Lambda invocations to your local machine
#    - Starts frontend dev servers (Next.js, Vite, etc.)
#    - Creates VPC tunnel if needed

# 3. Make code changes — Lambda reloads in <10ms

# 4. When done, either:
#    a) Run sst dev again next time (stubs still deployed)
#    b) Deploy real code: sst deploy
```

### VS Code Debugging

Enable "Debug: Toggle Auto Attach" -> "Always" in VS Code, then start `sst dev` in a new terminal. Set breakpoints in your Lambda handlers — they'll hit when invoked.

### Detect Dev Mode in Handlers

```typescript
export async function handler(event: unknown) {
  if (process.env.SST_DEV) {
    // Local dev behavior (e.g., skip rate limiting, use local DB)
  }
}
```
