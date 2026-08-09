# AWS SDK v3 — Core Patterns

> Client setup, S3 operations, DynamoDB basics, credential providers, error handling, and pagination. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Messaging](messaging.md) — SQS, SNS patterns
- [Advanced](advanced.md) — Lambda, Secrets Manager, presigned URLs, middleware

---

## Client Setup and Reuse

Create clients once at module scope and reuse them. Clients manage connection pooling internally.

```typescript
// lib/aws-clients.ts — shared client instances
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION ?? "us-east-1";

export const s3 = new S3Client({ region: REGION });

const ddbClient = new DynamoDBClient({ region: REGION });
export const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});
```

**Why good:** single client instance reuses TCP connections, `removeUndefinedValues` avoids marshalling errors from optional fields, region from env var with fallback

```typescript
// BAD: Creating a new client per request
async function getUser(userId: string) {
  const client = new DynamoDBClient({ region: "us-east-1" }); // New connection per call
  const ddb = DynamoDBDocumentClient.from(client);
  // ...
}
```

**Why bad:** creates new TCP connections per request, wastes resources, slower due to connection setup overhead

---

## S3 Upload

```typescript
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./lib/aws-clients.js";

const CONTENT_TYPE_JSON = "application/json";

export async function uploadJson(
  bucket: string,
  key: string,
  data: unknown,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: CONTENT_TYPE_JSON,
    }),
  );
}
```

**Why good:** explicit `ContentType` prevents S3 defaulting to `application/octet-stream`, reuses shared client

---

## S3 Download

```typescript
import { GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";
import { s3 } from "./lib/aws-clients.js";

export async function downloadJson<T>(
  bucket: string,
  key: string,
): Promise<T | null> {
  try {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = await response.Body?.transformToString();
    if (!body) return null;
    return JSON.parse(body) as T;
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    throw error;
  }
}
```

**Why good:** `transformToString()` properly consumes the stream, `instanceof NoSuchKey` gives typed error handling, returns `null` for missing keys instead of throwing

```typescript
// BAD: v2-style error handling
try {
  await s3.send(new GetObjectCommand({ Bucket: "b", Key: "k" }));
} catch (error: any) {
  if (error.code === "NoSuchKey") {
    // String comparison — fragile, no type narrowing
    return null;
  }
}
```

**Why bad:** `.code` is a v2 pattern, no TypeScript narrowing, `any` type loses safety

---

## S3 Delete

```typescript
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./lib/aws-clients.js";

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  // Note: DeleteObject succeeds even if the key doesn't exist (idempotent)
}
```

---

## S3 List with Pagination

```typescript
import { paginateListObjectsV2 } from "@aws-sdk/client-s3";
import { s3 } from "./lib/aws-clients.js";

const MAX_KEYS_PER_PAGE = 1_000;

export async function listAllKeys(
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paginator = paginateListObjectsV2(
    { client: s3, pageSize: MAX_KEYS_PER_PAGE },
    { Bucket: bucket, Prefix: prefix },
  );

  const keys: string[] = [];
  for await (const page of paginator) {
    const pageKeys = page.Contents?.map((obj) => obj.Key).filter(Boolean) ?? [];
    keys.push(...(pageKeys as string[]));
  }
  return keys;
}
```

**Why good:** built-in paginator handles continuation tokens automatically, `for await...of` is clean and readable, `pageSize` controls batch size

```typescript
// BAD: Manual pagination with token tracking
let token: string | undefined;
const keys: string[] = [];
do {
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: token,
    }),
  );
  keys.push(...(response.Contents?.map((o) => o.Key!).filter(Boolean) ?? []));
  token = response.NextContinuationToken;
} while (token);
```

**Why bad:** manual token tracking is error-prone and verbose, built-in paginators exist for this exact purpose

---

## DynamoDB Get

```typescript
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./lib/aws-clients.js";

interface User {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
}

export async function getUser(userId: string): Promise<User | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: "users",
      Key: { userId },
    }),
  );
  return (Item as User) ?? null;
}
```

**Why good:** `GetCommand` from `@aws-sdk/lib-dynamodb` accepts native JS objects (no marshalling), returns native JS objects

---

## DynamoDB Put

```typescript
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./lib/aws-clients.js";

export async function createUser(user: User): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: "users",
      Item: user,
      ConditionExpression: "attribute_not_exists(userId)", // Prevent overwrite
    }),
  );
}
```

---

## DynamoDB Query

```typescript
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./lib/aws-clients.js";

const DEFAULT_LIMIT = 20;

export async function getUserOrders(
  userId: string,
  limit = DEFAULT_LIMIT,
): Promise<Order[]> {
  const { Items } = await ddb.send(
    new QueryCommand({
      TableName: "orders",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
      ScanIndexForward: false, // newest first
      Limit: limit,
    }),
  );
  return (Items as Order[]) ?? [];
}
```

---

## DynamoDB Update

```typescript
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./lib/aws-clients.js";

export async function updateUserName(
  userId: string,
  name: string,
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: "users",
      Key: { userId },
      UpdateExpression: "SET #name = :name, updatedAt = :now",
      ExpressionAttributeNames: { "#name": "name" }, // "name" is a DynamoDB reserved word
      ExpressionAttributeValues: {
        ":name": name,
        ":now": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(userId)", // Fail if user doesn't exist
    }),
  );
}
```

**Why good:** `ExpressionAttributeNames` handles the reserved word "name", `ConditionExpression` prevents updating non-existent items, timestamps updated atomically

---

## DynamoDB Delete

```typescript
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./lib/aws-clients.js";

export async function deleteUser(userId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: "users",
      Key: { userId },
      ConditionExpression: "attribute_exists(userId)", // Fail if already deleted
    }),
  );
}
```

---

## Credential Providers

```typescript
import { S3Client } from "@aws-sdk/client-s3";
import {
  fromIni,
  fromTemporaryCredentials,
} from "@aws-sdk/credential-providers";

// Local development — use a named AWS profile
const devClient = new S3Client({
  region: "us-east-1",
  credentials: fromIni({ profile: "my-dev-profile" }),
});

// Cross-account access — assume a role in another account
const crossAccountClient = new S3Client({
  region: "us-east-1",
  credentials: fromTemporaryCredentials({
    params: {
      RoleArn: "arn:aws:iam::123456789012:role/cross-account-role",
      RoleSessionName: "my-app-session",
    },
  }),
});
```

**Why good:** explicit credential providers for specific use cases, no hardcoded keys, `fromTemporaryCredentials` uses STS AssumeRole under the hood

**Note:** In Lambda, ECS, and EC2, don't configure credentials at all — the default chain picks up the IAM role automatically.

---

## Error Handling — Full Pattern

```typescript
import {
  GetObjectCommand,
  NoSuchKey,
  NoSuchBucket,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { s3 } from "./lib/aws-clients.js";

export async function safeGetObject(
  bucket: string,
  key: string,
): Promise<string | null> {
  try {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    return (await response.Body?.transformToString()) ?? null;
  } catch (error) {
    // 1. Check specific exception types first
    if (error instanceof NoSuchKey) {
      return null; // Expected — object doesn't exist
    }
    if (error instanceof NoSuchBucket) {
      throw new Error(`Bucket "${bucket}" does not exist`);
    }

    // 2. Check general service exception
    if (error instanceof S3ServiceException) {
      // Access $metadata for HTTP status and request ID
      const { httpStatusCode, requestId } = error.$metadata;
      throw new Error(
        `S3 error [${httpStatusCode}]: ${error.message} (requestId: ${requestId})`,
      );
    }

    // 3. Non-AWS error (network timeout, DNS failure, etc.)
    throw error;
  }
}
```

---

## Retry Configuration

```typescript
import { S3Client } from "@aws-sdk/client-s3";

const MAX_RETRY_ATTEMPTS = 5;

const s3 = new S3Client({
  region: "us-east-1",
  maxAttempts: MAX_RETRY_ATTEMPTS, // Default is 3
});
```

The SDK automatically retries throttling errors (429) and transient server errors (500, 502, 503) with exponential backoff. Increase `maxAttempts` for high-throughput workloads.
