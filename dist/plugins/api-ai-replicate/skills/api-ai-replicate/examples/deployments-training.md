# Replicate SDK -- Deployments & Training Examples

> Deployment management, custom hardware, scaling configuration, fine-tuning models, and model CRUD operations. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, predictions, file handling
- [streaming-webhooks.md](streaming-webhooks.md) -- Streaming output, webhooks

---

## Deployments

### Why Use Deployments

Deployments give you a **private, fixed API endpoint** with control over:

- **Hardware** -- Choose specific GPU types (e.g., A40, A100)
- **Scaling** -- Set `min_instances` to keep models warm (eliminates cold starts)
- **Versioning** -- Pin to a model version independently of the public model page

### Creating a Deployment

```typescript
const deployment = await replicate.deployments.create({
  name: "my-llama-deployment",
  model: "meta/meta-llama-3-70b-instruct",
  version: "abc123...",
  hardware: "gpu-a100-large",
  min_instances: 1, // Always warm -- no cold starts
  max_instances: 5, // Auto-scale up to 5 instances
});

console.log(deployment.name);
console.log(deployment.current_release);
```

### Running Predictions on a Deployment

```typescript
// Use the deployment name instead of model identifier
const prediction = await replicate.deployments.predictions.create(
  "my-org/my-llama-deployment",
  {
    input: {
      prompt: "Summarize this article...",
      max_tokens: 1024,
    },
  },
);

// Wait for result
const result = await replicate.wait(prediction);
console.log(result.output);
```

### Streaming from a Deployment

```typescript
const stream = replicate.stream("my-org/my-llama-deployment", {
  input: { prompt: "Hello world" },
});

for await (const event of stream) {
  if (event.event === "output") {
    process.stdout.write(event.data);
  }
}
```

### Managing Deployments

```typescript
// List all deployments
const deployments = await replicate.deployments.list();
for (const d of deployments.results) {
  console.log(d.name, d.current_release?.model);
}

// Get a specific deployment
const deployment = await replicate.deployments.get(
  "my-org/my-llama-deployment",
);

// Update deployment (change hardware, version, or scaling)
await replicate.deployments.update("my-org/my-llama-deployment", {
  version: "new-version-hash",
  hardware: "gpu-a100-large",
  min_instances: 2,
  max_instances: 10,
});

// Delete a deployment
await replicate.deployments.delete("my-org/my-llama-deployment");
```

### Available Hardware

```typescript
const hardware = await replicate.hardware.list();
for (const hw of hardware) {
  console.log(hw.name, hw.sku);
}
```

Common hardware SKUs:

| SKU              | Description        |
| ---------------- | ------------------ |
| `cpu`            | CPU only           |
| `gpu-t4-nano`    | Nvidia T4 (small)  |
| `gpu-t4-small`   | Nvidia T4          |
| `gpu-a40-small`  | Nvidia A40 (small) |
| `gpu-a40-large`  | Nvidia A40 (large) |
| `gpu-a100-large` | Nvidia A100 (80GB) |

---

## Training (Fine-Tuning)

### Starting a Training Job

```typescript
const training = await replicate.trainings.create(
  "owner",
  "model-name",
  "version-hash",
  {
    input: {
      train_data: "https://example.com/my-training-data.zip",
      num_train_epochs: 4,
      learning_rate: 0.0001,
    },
    destination: "my-org/my-fine-tuned-model",
    webhook: "https://my.app/webhooks/training",
    webhook_events_filter: ["completed"],
  },
);

console.log(training.id);
console.log(training.status); // "starting"
```

### Monitoring Training Progress

```typescript
// Poll for training status
const training = await replicate.trainings.get(training.id);
console.log(training.status); // "starting" | "processing" | "succeeded" | "failed"
console.log(training.logs); // Training logs

// Wait for completion
const result = await replicate.wait(training);

if (result.status === "succeeded") {
  console.log("Training complete!");
  console.log("New model version:", result.output?.version);
} else {
  console.error("Training failed:", result.error);
}
```

### Listing and Canceling Trainings

```typescript
// List all trainings
const trainings = await replicate.trainings.list();
for (const t of trainings.results) {
  console.log(t.id, t.status, t.model);
}

// Cancel a running training
await replicate.trainings.cancel(training.id);
```

---

## Model Management

### Getting Model Info

```typescript
const model = await replicate.models.get("stability-ai", "sdxl");

console.log(model.owner);
console.log(model.name);
console.log(model.description);
console.log(model.visibility); // "public" | "private"
console.log(model.latest_version?.id);
```

### Creating a Model

```typescript
// Create a new model (for training destinations or custom models)
const model = await replicate.models.create("my-org", "my-custom-model", {
  description: "A fine-tuned image generation model",
  visibility: "private",
  hardware: "gpu-a40-large",
});
```

### Listing Models

```typescript
// List your models
const models = await replicate.models.list();
for (const m of models.results) {
  console.log(m.owner, m.name, m.run_count);
}

// Search public models
const results = await replicate.models.search("text to image");
for (const m of results.results) {
  console.log(m.owner, m.name, m.description);
}
```

### Model Versions

```typescript
// List all versions
const versions = await replicate.models.versions.list("stability-ai", "sdxl");
for (const v of versions.results) {
  console.log(v.id, v.created_at);
}

// Get a specific version (includes input/output schema)
const version = await replicate.models.versions.get(
  "stability-ai",
  "sdxl",
  "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
);

// Access input/output schema from OpenAPI spec
console.log(version.openapi_schema);
```

---

## Collections

```typescript
// List model collections
const collections = await replicate.collections.list();
for (const c of collections.results) {
  console.log(c.slug, c.name, c.description);
}

// Get a specific collection
const collection = await replicate.collections.get("text-to-image");
for (const model of collection.models) {
  console.log(model.owner, model.name);
}
```

---

## Files API

```typescript
import { readFile } from "node:fs/promises";

// Upload a file
const file = await replicate.files.create(await readFile("./data.zip"), {
  filename: "data.zip",
});
console.log(file.id);

// List files
const files = await replicate.files.list();
for (const f of files.results) {
  console.log(f.id, f.name, f.size);
}

// Get file info
const fileInfo = await replicate.files.get(file.id);

// Delete a file
await replicate.files.delete(file.id);
```

---

_For client setup and predictions, see [core.md](core.md). For streaming and webhooks, see [streaming-webhooks.md](streaming-webhooks.md). For API reference tables, see [reference.md](../reference.md)._
