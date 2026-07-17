# AWS SDK v3 — Advanced Patterns

> Lambda invocation, Secrets Manager, presigned URLs, middleware, and streaming. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Core Patterns](core.md) — Client setup, S3, DynamoDB, error handling
- [Messaging](messaging.md) — SQS, SNS patterns

---

## Lambda — Synchronous Invocation

```typescript
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({});

interface ProcessResult {
  status: string;
  processedAt: string;
}

export async function invokeProcessor(orderId: string): Promise<ProcessResult> {
  const response = await lambda.send(
    new InvokeCommand({
      FunctionName: "order-processor",
      InvocationType: "RequestResponse", // Synchronous — waits for result
      Payload: JSON.stringify({ orderId }),
    }),
  );

  if (response.FunctionError) {
    const errorPayload = JSON.parse(new TextDecoder().decode(response.Payload));
    throw new Error(`Lambda error: ${errorPayload.errorMessage}`);
  }

  return JSON.parse(
    new TextDecoder().decode(response.Payload),
  ) as ProcessResult;
}
```

**Why good:** checks `FunctionError` before parsing payload (Lambda sets this on unhandled exceptions), `TextDecoder` properly decodes the `Uint8Array` payload

**Gotcha:** `response.Payload` is a `Uint8Array`, not a string — always decode with `new TextDecoder().decode()` before `JSON.parse()`.

---

## Lambda — Asynchronous Invocation

```typescript
export async function triggerAsync(
  functionName: string,
  payload: unknown,
): Promise<void> {
  await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "Event", // Async — returns immediately, Lambda retries up to 2 times
      Payload: JSON.stringify(payload),
    }),
  );
  // Returns 202 Accepted — no response payload
}
```

**When to use:** fire-and-forget operations where you don't need the result (notifications, background processing, fan-out).

---

## Secrets Manager — Retrieve Secret

```typescript
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const secretsManager = new SecretsManagerClient({});

export async function getSecret(secretName: string): Promise<string> {
  const { SecretString } = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: secretName }),
  );
  if (!SecretString) {
    throw new Error(`Secret "${secretName}" has no string value`);
  }
  return SecretString;
}

// For JSON secrets (common pattern: DB credentials, API keys)
interface DbCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
}

export async function getDbCredentials(
  secretName: string,
): Promise<DbCredentials> {
  const secretString = await getSecret(secretName);
  return JSON.parse(secretString) as DbCredentials;
}
```

---

## Secrets Manager — Cached Secret

Secrets don't change frequently. Cache them to avoid API calls on every request.

```typescript
const SECRET_CACHE_TTL_MS = 300_000; // 5 minutes

interface CachedSecret {
  value: string;
  expiresAt: number;
}

const secretCache = new Map<string, CachedSecret>();

export async function getCachedSecret(secretName: string): Promise<string> {
  const cached = secretCache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await getSecret(secretName);
  secretCache.set(secretName, {
    value,
    expiresAt: Date.now() + SECRET_CACHE_TTL_MS,
  });
  return value;
}
```

**Why good:** avoids Secrets Manager API call on every request, TTL ensures secrets refresh periodically, simple in-memory cache works well in Lambda (cache persists across warm invocations)

---

## S3 — Presigned URLs

Presigned URLs grant temporary access to S3 objects without exposing AWS credentials.

```typescript
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "./lib/aws-clients.js";

const DOWNLOAD_EXPIRY_SECONDS = 3_600; // 1 hour
const UPLOAD_EXPIRY_SECONDS = 900; // 15 minutes
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

// Generate a download URL
export async function getDownloadUrl(
  bucket: string,
  key: string,
): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: DOWNLOAD_EXPIRY_SECONDS,
  });
}

// Generate an upload URL with content-type restriction
export async function getUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: MAX_UPLOAD_SIZE, // Enforces max file size
    }),
    { expiresIn: UPLOAD_EXPIRY_SECONDS },
  );
}
```

**Why good:** separate expiry times for download vs upload, `ContentType` on upload prevents wrong file types, named constants for all limits

**Gotcha:** Presigned URL expiry is capped at 7 days. If using temporary credentials (IAM role, STS), the URL stops working when the signing credentials expire — even if `expiresIn` is longer.

---

## S3 — Streaming Large Files

For large files, stream directly without buffering the entire content in memory.

```typescript
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { s3 } from "./lib/aws-clients.js";

export async function downloadToFile(
  bucket: string,
  key: string,
  outputPath: string,
): Promise<void> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!response.Body) throw new Error(`Empty response for ${key}`);

  // Convert web ReadableStream to Node.js Readable
  const nodeStream = Readable.fromWeb(response.Body.transformToWebStream());
  await pipeline(nodeStream, createWriteStream(outputPath));
}
```

**Why good:** `pipeline` handles backpressure and cleanup, no memory buffering for large files, `Readable.fromWeb()` bridges web streams to Node.js streams

---

## Middleware — Custom Request Logging

The middleware stack lets you intercept and modify requests at various stages.

```typescript
import { S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "us-east-1" });

s3.middlewareStack.add(
  (next, context) => async (args) => {
    const startTime = Date.now();
    const result = await next(args);
    const duration = Date.now() - startTime;

    console.log(
      JSON.stringify({
        service: "s3",
        operation: context.commandName,
        durationMs: duration,
        statusCode: result.response.statusCode,
      }),
    );

    return result;
  },
  {
    step: "deserialize", // Run after response is received
    name: "requestLogger",
    priority: "low",
  },
);
```

**Why good:** middleware runs for every request through this client, structured JSON logging, minimal overhead at the deserialize step

---

## Middleware — Add Custom Headers

```typescript
s3.middlewareStack.add(
  (next) => async (args: any) => {
    args.request.headers["x-correlation-id"] = getCorrelationId();
    return next(args);
  },
  {
    step: "build", // Run before request is signed
    name: "correlationId",
  },
);
```

**Why good:** adding headers at the `build` step means they get included in request signing, correlation ID enables request tracing across services

**Gotcha:** Adding headers at the `finalize` step (after signing) will cause signature mismatch errors for services that verify all headers.

---

## STS — Assume Role for Cross-Account Access

```typescript
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { S3Client } from "@aws-sdk/client-s3";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";

// Option 1: Using credential provider (recommended — auto-refreshes)
const crossAccountS3 = new S3Client({
  region: "us-east-1",
  credentials: fromTemporaryCredentials({
    params: {
      RoleArn: "arn:aws:iam::987654321098:role/data-reader",
      RoleSessionName: "my-app",
    },
  }),
});

// Option 2: Manual AssumeRole (when you need the credentials object)
const sts = new STSClient({});
const SESSION_DURATION_SECONDS = 3_600;

export async function assumeRole(roleArn: string) {
  const { Credentials } = await sts.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: "my-app",
      DurationSeconds: SESSION_DURATION_SECONDS,
    }),
  );
  return {
    accessKeyId: Credentials!.AccessKeyId!,
    secretAccessKey: Credentials!.SecretAccessKey!,
    sessionToken: Credentials!.SessionToken!,
    expiration: Credentials!.Expiration!,
  };
}
```

**Why good:** `fromTemporaryCredentials` auto-refreshes when credentials expire, manual option available when you need to pass credentials to external systems
