# SST (Ion) — API & Data Patterns

> API Gateway, DynamoDB, S3, Queue, Topic, and Cron patterns. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Core Patterns](core.md) — sst.config.ts, resource linking, live dev, secrets
- [Deployment & DevOps](deployment.md) — CI/CD, transforms, removal policies, VPC

---

## ApiGatewayV2 — HTTP API

```typescript
async run() {
  const table = new sst.aws.Dynamo("Notes", {
    fields: { userId: "string", noteId: "string" },
    primaryIndex: { hashKey: "userId", rangeKey: "noteId" },
  });

  const api = new sst.aws.ApiGatewayV2("Api", {
    cors: true,
    domain: $app.stage === "production" ? "api.example.com" : undefined,
    accessLog: { retention: "1 month" },
  });

  // Add routes — handler string or object with config
  api.route("GET /notes", {
    handler: "src/notes/list.handler",
    link: [table],
  });
  api.route("POST /notes", {
    handler: "src/notes/create.handler",
    link: [table],
    memory: "512 MB",
  });
  api.route("GET /notes/{id}", "src/notes/get.handler");
  api.route("$default", "src/fallback.handler"); // Catch-all route

  return { apiUrl: api.url };
}
```

**Why good:** Each route gets its own Lambda function (fine-grained scaling and permissions), `$default` catches unmatched routes, custom domain only in production, access logs for debugging

---

## ApiGatewayV2 — Authorization

### JWT Authorization

```typescript
const api = new sst.aws.ApiGatewayV2("Api");

const jwtAuth = api.addAuthorizer({
  name: "jwt",
  jwt: {
    issuer: "https://auth.example.com/",
    audiences: ["https://api.example.com"],
  },
});

api.route("GET /public", "src/public.handler"); // No auth
api.route("GET /private", "src/private.handler", {
  auth: { jwt: { authorizer: jwtAuth.id } },
});
api.route("GET /admin", "src/admin.handler", {
  auth: { jwt: { authorizer: jwtAuth.id, scopes: ["admin:read"] } },
});
```

### IAM Authorization

```typescript
api.route("POST /internal", "src/internal.handler", {
  auth: { iam: true },
});
```

### Lambda Authorizer

```typescript
const customAuth = api.addAuthorizer({
  name: "custom",
  lambda: { function: "src/authorizer.handler" },
});

api.route("GET /protected", "src/protected.handler", {
  auth: { lambda: customAuth.id },
});
```

---

## Dynamo — DynamoDB Table

```typescript
const table = new sst.aws.Dynamo("Orders", {
  fields: {
    orderId: "string",
    customerId: "string",
    createdAt: "number",
  },
  primaryIndex: { hashKey: "orderId" },
  globalIndexes: {
    CustomerIndex: {
      hashKey: "customerId",
      rangeKey: "createdAt",
    },
  },
  stream: "new-and-old-images",
  deletionProtection: $app.stage === "production",
});

// Subscribe to stream events
table.subscribe("OrderProcessor", "src/process-order.handler", {
  filters: [{ eventName: ["INSERT"] }],
});
```

**Why good:** Global secondary index for querying by customer, stream captures all changes, subscriber filters to only process new inserts, deletion protection in production

```typescript
// BAD: No indexes, no stream, no protection
const table = new sst.aws.Dynamo("Orders", {
  fields: { orderId: "string" },
  primaryIndex: { hashKey: "orderId" },
});
```

**Why bad:** No secondary indexes means table scans for any non-PK query, no stream means no reactive processing, no deletion protection in production

---

## Dynamo — TTL (Auto-Expiry)

```typescript
const sessions = new sst.aws.Dynamo("Sessions", {
  fields: { sessionId: "string" },
  primaryIndex: { hashKey: "sessionId" },
  ttl: "expiresAt", // DynamoDB auto-deletes when expiresAt < now
});
```

```typescript
// Runtime — set TTL value
const SESSION_TTL_SECONDS = 3_600;

await client.send(
  new PutItemCommand({
    TableName: Resource.Sessions.name,
    Item: {
      sessionId: { S: id },
      expiresAt: {
        N: String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS),
      },
    },
  }),
);
```

---

## Bucket — S3 Storage

```typescript
const uploads = new sst.aws.Bucket("Uploads", {
  cors: {
    allowOrigins: ["https://example.com"],
    allowMethods: ["GET", "PUT"],
    allowHeaders: ["content-type"],
    maxAge: "1 day",
  },
});

// Subscribe to object events
uploads.notify({
  notifications: [
    {
      name: "ImageProcessor",
      function: "src/process-image.handler",
      events: ["s3:ObjectCreated:*"],
      filterPrefix: "images/",
    },
  ],
});
```

### Public Bucket

```typescript
// Public read access for all objects (static assets, public downloads)
const assets = new sst.aws.Bucket("Assets", {
  access: "public",
});
```

---

## Queue — SQS

```typescript
const dlq = new sst.aws.Queue("EmailDLQ");

const emailQueue = new sst.aws.Queue("EmailQueue", {
  visibilityTimeout: "5 minutes",
  dlq: { queue: dlq.arn, retry: 3 },
});

// Subscribe a handler to process messages
emailQueue.subscribe("EmailSender", "src/send-email.handler");
```

### FIFO Queue

```typescript
const orderQueue = new sst.aws.Queue("OrderQueue", {
  fifo: { contentBasedDeduplication: true },
});

orderQueue.subscribe("OrderProcessor", "src/process-order.handler");
```

### Sending Messages (Runtime)

```typescript
import { Resource } from "sst";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});

export async function handler() {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: Resource.EmailQueue.url,
      MessageBody: JSON.stringify({ to: "user@example.com", subject: "Hello" }),
    }),
  );
}
```

---

## Cron — Scheduled Tasks

```typescript
// Rate-based schedule
new sst.aws.Cron("DailyCleanup", {
  function: "src/cleanup.handler",
  schedule: "rate(1 day)",
});

// Cron expression (UTC)
new sst.aws.Cron("WeeklyReport", {
  function: {
    handler: "src/report.handler",
    timeout: "5 minutes",
    memory: "2048 MB",
  },
  schedule: "cron(0 9 ? * MON *)", // Every Monday at 9:00 AM UTC
});

// Disable in dev
new sst.aws.Cron("HourlySync", {
  function: "src/sync.handler",
  schedule: "rate(1 hour)",
  enabled: $app.stage === "production",
});
```

**Why good:** Cron disabled in non-production stages to avoid unnecessary executions, custom timeout/memory for heavy report, rate expression for simple intervals

---

## Function — Direct Lambda

```typescript
// Function with URL endpoint (no API Gateway)
const webhook = new sst.aws.Function("StripeWebhook", {
  handler: "src/webhook.handler",
  url: {
    cors: {
      allowOrigins: ["https://stripe.com"],
      allowMethods: ["POST"],
    },
  },
  timeout: "60 seconds",
  link: [ordersTable],
});

// Streaming response
const streamer = new sst.aws.Function("StreamResponse", {
  handler: "src/stream.handler",
  url: true,
  streaming: true,
});

// ARM64 for cost savings (~20% cheaper, often faster)
const compute = new sst.aws.Function("Compute", {
  handler: "src/compute.handler",
  architecture: "arm64",
  memory: "2048 MB",
});
```

---

## Combining Components

```typescript
async run() {
  // Data layer
  const table = new sst.aws.Dynamo("Tasks", {
    fields: { taskId: "string", status: "string" },
    primaryIndex: { hashKey: "taskId" },
    globalIndexes: {
      StatusIndex: { hashKey: "status" },
    },
    stream: "new-image",
  });

  const bucket = new sst.aws.Bucket("Files");

  // Async processing
  const queue = new sst.aws.Queue("TaskQueue");
  queue.subscribe("TaskWorker", {
    handler: "src/worker.handler",
    link: [table, bucket],
    timeout: "5 minutes",
  });

  // API layer
  const api = new sst.aws.ApiGatewayV2("Api");
  api.route("GET /tasks", {
    handler: "src/tasks/list.handler",
    link: [table],
  });
  api.route("POST /tasks", {
    handler: "src/tasks/create.handler",
    link: [table, queue],
  });
  api.route("POST /tasks/{id}/upload", {
    handler: "src/tasks/upload.handler",
    link: [bucket],
  });

  // React to changes
  table.subscribe("TaskNotifier", "src/notify.handler", {
    filters: [{ eventName: ["INSERT", "MODIFY"] }],
  });

  return { apiUrl: api.url };
}
```

**Why good:** Each handler gets only the permissions it needs via `link`, async work offloaded to queue, stream subscriber reacts to data changes, single `return` exposes the API URL
