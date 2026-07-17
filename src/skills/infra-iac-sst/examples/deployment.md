# SST (Ion) — Deployment & DevOps Patterns

> Deployment, CI/CD, transforms, removal policies, VPC, containers, and frontend framework patterns. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Core Patterns](core.md) — sst.config.ts, resource linking, live dev, secrets
- [API & Data](api-data.md) — ApiGatewayV2, Dynamo, Bucket, Queue, Topic, Cron

---

## Multi-Stage Configuration

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
        aws: {
          region: "us-east-1",
          // Different AWS profile per stage (optional)
          ...(input.stage === "production" && { profile: "prod" }),
        },
      },
    };
  },
  async run() {
    const isProd = $app.stage === "production";
    const isStaging = $app.stage === "staging";

    const table = new sst.aws.Dynamo("Data", {
      fields: { pk: "string", sk: "string" },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      deletionProtection: isProd,
    });

    const api = new sst.aws.ApiGatewayV2("Api", {
      domain: isProd
        ? "api.example.com"
        : isStaging
          ? "api-staging.example.com"
          : undefined,
    });

    api.route("GET /", {
      handler: "src/index.handler",
      link: [table],
    });

    return { url: api.url };
  },
});
```

**Why good:** Stage-aware removal (retain prod data), stage-aware domain names, deletion protection only in production, TypeScript conditionals for stage logic

---

## Removal Policies

```typescript
app(input) {
  return {
    name: "my-app",
    home: "aws",
    // What happens when you run `sst remove`
    removal: input.stage === "production"
      ? "retain"      // Keep all resources (safe for production)
      : "remove",     // Delete everything (clean dev stages)
    // "retain-all" keeps everything including CloudWatch logs
  };
}
```

| Policy         | Behavior                                 | Use For                            |
| -------------- | ---------------------------------------- | ---------------------------------- |
| `"remove"`     | Deletes all resources                    | Dev stages, PR previews            |
| `"retain"`     | Keeps data resources (S3, DynamoDB, RDS) | Production                         |
| `"retain-all"` | Keeps everything including logs          | Production with audit requirements |

---

## Transforms — Per-Component

```typescript
// Customize underlying Lambda resource
new sst.aws.Function("Api", {
  handler: "src/api.handler",
  transform: {
    function: (args) => {
      // Enable X-Ray tracing (not exposed by SST)
      args.tracingConfig = { mode: "Active" };
    },
    role: (args) => {
      // Customize IAM role
      args.maxSessionDuration = 7200;
    },
  },
});

// Customize underlying API Gateway resource
new sst.aws.ApiGatewayV2("Api", {
  transform: {
    route: {
      handler: (args) => {
        // Set default memory for all route handlers
        args.memory ??= "2048 MB";
      },
    },
  },
});
```

**Why good:** `transform` modifies the underlying Pulumi resource properties without abandoning SST's abstractions — you get both SST's linking/permissions AND low-level customization

---

## Transforms — Global Defaults

```typescript
async run() {
  // Apply to ALL Functions in the app
  $transform(sst.aws.Function, (args) => {
    args.runtime ??= "nodejs22.x";
    args.architecture ??= "arm64";
    args.memory ??= "512 MB";
    args.timeout ??= "30 seconds";
  });

  // Apply to ALL Dynamo tables
  $transform(sst.aws.Dynamo, (args) => {
    args.deletionProtection ??= $app.stage === "production";
  });

  // Now every Function and Dynamo table inherits these defaults
  // unless explicitly overridden
  const api = new sst.aws.Function("Api", {
    handler: "src/api.handler",
    // memory: "512 MB" and architecture: "arm64" from $transform
  });
}
```

**Why good:** `$transform` sets defaults once instead of repeating on every component, `??=` only applies if not already set (overridable)

---

## VPC and Containers

```typescript
async run() {
  const vpc = new sst.aws.Vpc("AppVpc", {
    bastion: true, // EC2 bastion for SSH tunneling to private subnets
    nat: "managed", // NAT Gateway for private subnet internet access
  });

  const db = new sst.aws.Postgres("Database", {
    vpc,
    scaling: {
      min: "0.5 ACU",
      max: "4 ACU",
    },
  });

  const cluster = new sst.aws.Cluster("AppCluster", { vpc });

  cluster.addService("Api", {
    link: [db],
    scaling: { min: 1, max: 10 },
    image: { context: "./api" }, // Dockerfile in ./api
    dev: {
      command: "node --watch src/index.ts",
    },
  });

  // Lambda functions can also use VPC
  new sst.aws.Function("Migration", {
    handler: "src/migrate.handler",
    vpc,
    link: [db],
    timeout: "5 minutes",
  });
}
```

**Why good:** VPC with bastion for database access, Postgres with autoscaling, ECS service with auto-scaling, Lambda in VPC for migrations, all connected via resource linking

---

## Frontend Framework Deployments

### Next.js

```typescript
const web = new sst.aws.Nextjs("Web", {
  link: [api, table, bucket],
  domain: $app.stage === "production" ? "example.com" : undefined,
  environment: {
    // Public env vars use the framework's prefix (e.g., NEXT_PUBLIC_ for Next.js)
    PUBLIC_API_URL: api.url,
  },
});
```

### Remix

```typescript
const web = new sst.aws.Remix("Web", {
  link: [table],
  domain: "app.example.com",
});
```

### Astro

```typescript
const web = new sst.aws.Astro("Web", {
  link: [bucket],
  domain: "docs.example.com",
});
```

### Static Site

```typescript
const site = new sst.aws.StaticSite("Docs", {
  path: "./docs",
  domain: "docs.example.com",
  environment: {
    API_URL: api.url,
  },
});
```

**Key point:** Frontend `link` values are only accessible in server-side code (SSR, API routes, server loaders). Client-side code must use `environment` for public values.

---

## CI/CD with GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

# Prevent concurrent deployments to the same stage
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - run: npm ci

      # OIDC auth (recommended over long-lived keys)
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-deploy
          aws-region: us-east-1

      - name: Deploy to production
        run: npx sst deploy --stage production
```

### PR Preview Environments

```yaml
# .github/workflows/preview.yml
name: Preview

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-deploy
          aws-region: us-east-1

      - name: Deploy preview
        run: npx sst deploy --stage pr-${{ github.event.pull_request.number }}

  cleanup:
    runs-on: ubuntu-latest
    if: github.event.action == 'closed'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-deploy
          aws-region: us-east-1

      - name: Remove preview
        run: npx sst remove --stage pr-${{ github.event.pull_request.number }}
```

**Why good:** OIDC authentication (no long-lived AWS keys), PR-based preview environments with automatic cleanup, concurrency group prevents race conditions

---

## Monorepo Structure

For larger projects, split infrastructure into an `infra/` directory:

```typescript
// sst.config.ts
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "my-app",
      home: "aws",
      removal: input.stage === "production" ? "retain" : "remove",
    };
  },
  async run() {
    // Split infra into focused modules
    const { table, bucket } = await import("./infra/storage");
    const { api } = await import("./infra/api");
    const { web } = await import("./infra/web");

    return {
      apiUrl: api.url,
      webUrl: web.url,
    };
  },
});
```

```typescript
// infra/storage.ts
export const table = new sst.aws.Dynamo("Data", {
  fields: { pk: "string", sk: "string" },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
});

export const bucket = new sst.aws.Bucket("Uploads");
```

```typescript
// infra/api.ts
import { table, bucket } from "./storage";

export const api = new sst.aws.ApiGatewayV2("Api");
api.route("GET /items", {
  handler: "src/items/list.handler",
  link: [table],
});
api.route("POST /upload", {
  handler: "src/upload.handler",
  link: [bucket],
});
```

**Why good:** `sst.config.ts` stays clean, infrastructure modules can import from each other, resources are co-located with their related config
