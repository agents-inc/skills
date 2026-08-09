# AWS SDK v3 Quick Reference

## Package Cheat Sheet

| Service         | Client Package                    | Key Commands                                              |
| --------------- | --------------------------------- | --------------------------------------------------------- |
| S3              | `@aws-sdk/client-s3`              | `PutObject`, `GetObject`, `DeleteObject`, `ListObjectsV2` |
| S3 Presigning   | `@aws-sdk/s3-request-presigner`   | `getSignedUrl`                                            |
| DynamoDB (raw)  | `@aws-sdk/client-dynamodb`        | `GetItem`, `PutItem`, `Query`, `Scan`, `UpdateItem`       |
| DynamoDB (doc)  | `@aws-sdk/lib-dynamodb`           | `Get`, `Put`, `Query`, `Scan`, `Update`, `Delete`         |
| SQS             | `@aws-sdk/client-sqs`             | `SendMessage`, `ReceiveMessage`, `DeleteMessage`          |
| SNS             | `@aws-sdk/client-sns`             | `Publish`, `Subscribe`, `CreateTopic`                     |
| Lambda          | `@aws-sdk/client-lambda`          | `Invoke`, `InvokeAsync`                                   |
| Secrets Manager | `@aws-sdk/client-secrets-manager` | `GetSecretValue`, `CreateSecret`, `UpdateSecret`          |
| STS             | `@aws-sdk/client-sts`             | `AssumeRole`, `GetCallerIdentity`                         |
| Credentials     | `@aws-sdk/credential-providers`   | `fromEnv`, `fromIni`, `fromTemporaryCredentials`          |
| DynamoDB Utils  | `@aws-sdk/util-dynamodb`          | `marshall`, `unmarshall` (only if using raw client)       |

---

## Import Pattern

```typescript
// Client + commands from the same package
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

// Exception classes also exported from client package
import { NoSuchKey, S3ServiceException } from "@aws-sdk/client-s3";

// Types use `import type`
import type {
  PutObjectCommandInput,
  GetObjectCommandOutput,
} from "@aws-sdk/client-s3";

// Presigning is a separate package
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// DynamoDB Document Client — commands from lib-dynamodb, NOT client-dynamodb
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

// Credential providers
import {
  fromIni,
  fromTemporaryCredentials,
} from "@aws-sdk/credential-providers";
```

---

## Error Handling Decision Tree

```
Caught an error from client.send()?
  |
  +-- Is it a specific exception you expect?
  |     +-- YES --> instanceof SpecificException (e.g., NoSuchKey, ConditionalCheckFailedException)
  |                 Access: error.name, error.message, error.$metadata
  |
  +-- Is it any service error?
  |     +-- YES --> instanceof ServiceException (e.g., S3ServiceException)
  |                 Check: error.$metadata.httpStatusCode
  |
  +-- Is it a network/timeout error?
        +-- YES --> Likely not an AWS exception, check error.message
        +-- Rethrow if unrecognized
```

---

## Credential Provider Chain (Default Order)

When no explicit credentials are configured, the SDK resolves credentials in this order:

1. **Environment variables** — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
2. **SSO credentials** — `~/.aws/sso/cache/`
3. **Shared credentials file** — `~/.aws/credentials` (default profile or `AWS_PROFILE`)
4. **ECS container credentials** — `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI`
5. **EC2 instance metadata** — IMDSv2 role credentials
6. **SSO token provider** — If configured in `~/.aws/config`

In Lambda, ECS, and EC2 the default chain resolves automatically via IAM roles — no configuration needed.

---

## Client Configuration Options

```typescript
const client = new S3Client({
  region: "us-east-1", // Required (or set AWS_REGION env var)
  credentials: fromIni({ profile: "dev" }), // Explicit provider (optional)
  maxAttempts: 5, // Retry attempts (default: 3)
  requestHandler: new NodeHttpHandler({
    // Custom HTTP settings
    connectionTimeout: 5_000,
    socketTimeout: 10_000,
  }),
  logger: console, // SDK debug logging
});
```

---

## DynamoDB Expression Patterns

| Operation            | Expression                                                        |
| -------------------- | ----------------------------------------------------------------- |
| Query by PK          | `KeyConditionExpression: "pk = :pk"`                              |
| Query PK + SK prefix | `KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)"` |
| Filter results       | `FilterExpression: "status = :status"`                            |
| Update attribute     | `UpdateExpression: "SET #name = :name"`                           |
| Increment counter    | `UpdateExpression: "SET viewCount = viewCount + :inc"`            |
| Remove attribute     | `UpdateExpression: "REMOVE deletedAt"`                            |
| Conditional write    | `ConditionExpression: "attribute_not_exists(pk)"`                 |

**Expression attribute names** (`#name`) are required when the attribute name is a DynamoDB reserved word. **Expression attribute values** (`:value`) are always required in expressions.
