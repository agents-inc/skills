# Replicate SDK Quick Reference

> Constructor options, API methods, error types, model reference format, and webhook events. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
npm install replicate
```

---

## Client Configuration

```typescript
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN, // Auto-reads from env if omitted
  baseUrl: "https://api.replicate.com/v1", // Override for proxies
  userAgent: "my-app/1.0.0", // Custom user agent string
  fetch: globalThis.fetch, // Custom fetch implementation (Node.js 18+)
  fileEncodingStrategy: "default", // "default" | "upload" | "data-uri"
  useFileOutput: true, // Return FileOutput objects for file outputs (default: true)
});
```

### Environment Variables

| Variable                           | Purpose                             |
| ---------------------------------- | ----------------------------------- |
| `REPLICATE_API_TOKEN`              | API token (auto-detected)           |
| `REPLICATE_WEBHOOK_SIGNING_SECRET` | Webhook signature validation secret |

---

## Model Reference Format

```
owner/model                          -- Uses latest version (convenient, not reproducible)
owner/model:sha256hash               -- Pinned to a specific version (production use)
```

### Examples

| Reference                        | Type                     |
| -------------------------------- | ------------------------ |
| `meta/meta-llama-3-70b-instruct` | Latest version           |
| `black-forest-labs/flux-schnell` | Latest version           |
| `stability-ai/sdxl:39ed52f2...`  | Pinned version (SHA-256) |

---

## API Methods Reference

### Core Methods

```typescript
// Run a model synchronously (waits for completion)
const output = await replicate.run(
  "owner/model",               // or "owner/model:version"
  {
    input: { prompt: "..." },  // Model-specific input parameters
  },
  onProgress?,                 // Optional: (prediction: Prediction) => void
);

// Stream model output as SSE events
const stream = replicate.stream(
  "owner/model",               // or deployment name
  {
    input: { prompt: "..." },  // Model-specific input parameters
  },
);
// Returns AsyncGenerator<ServerSentEvent>

// Wait for a prediction to complete (polling)
const result = await replicate.wait(prediction);
```

### Predictions

```typescript
// Create (async, returns immediately)
const prediction = await replicate.predictions.create({
  version: "sha256hash",                    // Required: model version hash
  input: { prompt: "..." },                 // Required: model inputs
  webhook?: "https://...",                   // Optional: webhook URL
  webhook_events_filter?: ["completed"],     // Optional: event filter
});

// Get prediction status
const prediction = await replicate.predictions.get(prediction.id);

// List predictions (paginated)
const page = await replicate.predictions.list();

// Cancel a running prediction
await replicate.predictions.cancel(prediction.id);
```

### Models

```typescript
// Get model info
const model = await replicate.models.get("owner", "name");

// List models (paginated)
const models = await replicate.models.list();

// Search models
const results = await replicate.models.search("query");

// Create a model
await replicate.models.create("owner", "name", {
  description?: string,
  visibility: "public" | "private",
  hardware?: string,
});

// List model versions
const versions = await replicate.models.versions.list("owner", "name");

// Get a specific version
const version = await replicate.models.versions.get("owner", "name", "version_id");
```

### Deployments

```typescript
// Create a deployment
await replicate.deployments.create({
  name: string,
  model: string,
  version: string,
  hardware: string,
  min_instances?: number,
  max_instances?: number,
});

// Run prediction on deployment
await replicate.deployments.predictions.create("owner/deployment", {
  input: { ... },
  webhook?: string,
});

// Get deployment info
await replicate.deployments.get("owner/deployment");

// List deployments
await replicate.deployments.list();

// Update deployment
await replicate.deployments.update("owner/deployment", { ... });

// Delete deployment
await replicate.deployments.delete("owner/deployment");
```

### Trainings

```typescript
// Start training
await replicate.trainings.create("owner", "model", "version", {
  input: { train_data: "https://...", ... },
  destination: "owner/new-model",
  webhook?: string,
  webhook_events_filter?: string[],
});

// Get training status
await replicate.trainings.get(training.id);

// List trainings
await replicate.trainings.list();

// Cancel training
await replicate.trainings.cancel(training.id);
```

### Files

```typescript
// Upload file
await replicate.files.create(buffer, { filename: "data.zip" });

// Get file info
await replicate.files.get(file.id);

// List files
await replicate.files.list();

// Delete file
await replicate.files.delete(file.id);
```

### Hardware

```typescript
const hardware = await replicate.hardware.list();
// Returns: Array<{ name: string, sku: string }>
```

### Collections

```typescript
await replicate.collections.get("collection-slug");
await replicate.collections.list();
```

---

## Prediction Status Values

| Status       | Description                          |
| ------------ | ------------------------------------ |
| `starting`   | Prediction is queued / model booting |
| `processing` | Model is running                     |
| `succeeded`  | Prediction completed successfully    |
| `failed`     | Prediction encountered an error      |
| `canceled`   | Prediction was canceled by the user  |

---

## SSE Event Types (Streaming)

| Event    | Data Format | Description                                                |
| -------- | ----------- | ---------------------------------------------------------- |
| `output` | Plain text  | New model output chunk                                     |
| `error`  | JSON string | Error details (e.g., `{"detail": "Something went wrong"}`) |
| `done`   | JSON string | Completion signal (e.g., `{}` or `{"reason": "canceled"}`) |

---

## Webhook Events

| Event       | Description                               |
| ----------- | ----------------------------------------- |
| `start`     | Prediction has started processing         |
| `output`    | New output is available (intermediate)    |
| `logs`      | New log output from the model             |
| `completed` | Prediction finished (succeeded or failed) |

Webhook payload is the same as the prediction object (JSON POST to your URL).

---

## Webhook Signature Validation

```typescript
import { validateWebhook } from "replicate";

// With a Request object
const isValid = await validateWebhook(request, secret);

// With raw data
const isValid = await validateWebhook({
  id: headers["webhook-id"],
  timestamp: headers["webhook-timestamp"],
  signature: headers["webhook-signature"],
  body: rawBody,
  secret: process.env.REPLICATE_WEBHOOK_SIGNING_SECRET,
});
```

---

## FileOutput Object

```typescript
// Returned by replicate.run() for models that output files
interface FileOutput extends ReadableStream {
  url(): URL; // Get the underlying URL object (temporary -- download promptly)
  blob(): Promise<Blob>; // Get as Blob
  toString(): string; // String representation
}
```

---

## Error Types

The SDK throws errors with HTTP status codes for API failures:

| Status | Description          | Auto-Retried? |
| ------ | -------------------- | ------------- |
| 400    | Bad Request          | No            |
| 401    | Authentication Error | No            |
| 403    | Permission Denied    | No            |
| 404    | Not Found            | No            |
| 422    | Unprocessable Entity | No            |
| 429    | Rate Limit Exceeded  | Yes           |
| >= 500 | Server Error         | Yes           |

The SDK automatically retries on 429 and 5xx errors (5 retries by default with exponential backoff). GET requests retry on 429 and 5xx; non-GET requests retry only on 429.

---

## Hardware SKUs

| SKU              | Description        |
| ---------------- | ------------------ |
| `cpu`            | CPU only           |
| `gpu-t4-nano`    | Nvidia T4 (small)  |
| `gpu-t4-small`   | Nvidia T4          |
| `gpu-a40-small`  | Nvidia A40 (small) |
| `gpu-a40-large`  | Nvidia A40 (large) |
| `gpu-a100-large` | Nvidia A100 (80GB) |

---

## Platform Support

| Platform            | Minimum Version                          |
| ------------------- | ---------------------------------------- |
| Node.js             | 18+                                      |
| Bun                 | 1.0+                                     |
| Deno                | 1.28+                                    |
| Cloudflare Workers  | Supported                                |
| Vercel Edge Runtime | Supported                                |
| AWS Lambda          | Supported                                |
| **Browsers**        | **Not supported** -- use a backend proxy |
