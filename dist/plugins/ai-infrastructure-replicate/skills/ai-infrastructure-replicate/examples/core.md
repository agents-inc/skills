# Replicate SDK -- Setup, Predictions & File Handling Examples

> Client initialization, production config, running predictions, file I/O, model versioning, and error handling. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [streaming-webhooks.md](streaming-webhooks.md) -- Streaming output, SSE events, webhooks
- [deployments-training.md](deployments-training.md) -- Deployments, training, model management

---

## Basic Client Setup

```typescript
// lib/replicate.ts
import Replicate from "replicate";

// Reads REPLICATE_API_TOKEN from env automatically
const replicate = new Replicate();

export { replicate };
```

---

## Production Configuration

```typescript
// lib/replicate.ts
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  userAgent: "my-app/1.0.0",
});

export { replicate };
```

### Constructor Options

```typescript
new Replicate({
  auth: process.env.REPLICATE_API_TOKEN, // Auto-reads from env if omitted
  baseUrl: "https://api.replicate.com/v1", // Override for proxies
  userAgent: "my-app/1.0.0", // Custom user agent string
  fetch: globalThis.fetch, // Custom fetch implementation
  fileEncodingStrategy: "default", // "default" | "upload" | "data-uri"
  useFileOutput: true, // Return FileOutput objects (default: true)
});
```

---

## Running Predictions with replicate.run()

### Image Generation

```typescript
import Replicate from "replicate";

const replicate = new Replicate();

// Image models return arrays of FileOutput objects
const [output] = await replicate.run("black-forest-labs/flux-schnell", {
  input: {
    prompt: "a serene mountain landscape at sunset, photorealistic",
    aspect_ratio: "16:9",
    num_outputs: 1,
  },
});

console.log(output.url()); // Temporary URL to generated image
```

### Text Generation (LLM)

```typescript
const output = await replicate.run("meta/meta-llama-3-70b-instruct", {
  input: {
    prompt: "Explain the difference between TCP and UDP in 3 sentences.",
    max_tokens: 256,
    temperature: 0.7,
  },
});

// LLM output is a string (or array of strings for some models)
console.log(output);
```

### Audio Transcription

```typescript
const output = await replicate.run("openai/whisper", {
  input: {
    audio: "https://example.com/audio-file.mp3",
    model: "large-v3",
    language: "en",
  },
});

// Output contains transcription text and segments
console.log(output.text);
```

---

## Version Pinning

```typescript
// Development: latest version (convenient but unpredictable)
const output = await replicate.run("stability-ai/sdxl", {
  input: { prompt: "a cat" },
});

// Production: pin to a specific version hash
const SDXL_VERSION =
  "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";
const output = await replicate.run(`stability-ai/sdxl:${SDXL_VERSION}`, {
  input: { prompt: "a cat" },
});
```

### Listing Model Versions

```typescript
// Get all versions of a model
const versions = await replicate.models.versions.list("stability-ai", "sdxl");
for (const version of versions.results) {
  console.log(version.id, version.created_at);
}

// Get a specific version
const version = await replicate.models.versions.get(
  "stability-ai",
  "sdxl",
  "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
);
console.log(version.openapi_schema); // Model's input/output schema
```

---

## Async Predictions with predictions.create()

```typescript
// Create a prediction (returns immediately, does not wait for completion)
// Use `version` for pinned reproducibility, or `model` for latest-version convenience
const prediction = await replicate.predictions.create({
  model: "owner/model", // OR version: "sha256hash" for pinned version
  input: {
    prompt: "a painting of a cat in the style of Van Gogh",
  },
  webhook: "https://my.app/webhooks/replicate",
  webhook_events_filter: ["completed"],
});

console.log(prediction.id); // "abc123xyz"
console.log(prediction.status); // "starting"

// Option 1: Poll until complete
const result = await replicate.wait(prediction);
console.log(result.output);
console.log(result.status); // "succeeded" | "failed" | "canceled"

// Option 2: Check status manually
const updated = await replicate.predictions.get(prediction.id);
console.log(updated.status);

// Option 3: Cancel if no longer needed
await replicate.predictions.cancel(prediction.id);
```

---

## Progress Callbacks

```typescript
import type { Prediction } from "replicate";

function onProgress(prediction: Prediction): void {
  console.log(`Status: ${prediction.status}`);
  if (prediction.logs) {
    console.log(prediction.logs);
  }
}

const output = await replicate.run(
  "black-forest-labs/flux-schnell",
  { input: { prompt: "a sunset" } },
  onProgress,
);
```

---

## File Input Handling

### URL Input (Recommended for Large Files)

```typescript
// Pass a URL -- no upload needed, no size limit
const output = await replicate.run("owner/image-upscaler", {
  input: {
    image: "https://example.com/photo.jpg",
    scale: 4,
  },
});
```

### Buffer Input (Auto-Uploaded, Max 100 MiB)

```typescript
import { readFile } from "node:fs/promises";

const imageBuffer = await readFile("./input.png");

const output = await replicate.run("owner/image-upscaler", {
  input: {
    image: imageBuffer, // Automatically uploaded to Replicate
    scale: 4,
  },
});
```

### Explicit File Upload via Files API

```typescript
// Upload a file and get a persistent reference
const file = await replicate.files.create(
  await readFile("./training-data.zip"),
  { filename: "training-data.zip" },
);

console.log(file.id); // File ID for later reference
console.log(file.urls); // Temporary download URLs
```

---

## File Output Handling

```typescript
import { writeFile } from "node:fs/promises";

const [output] = await replicate.run("black-forest-labs/flux-schnell", {
  input: { prompt: "a beautiful garden" },
});

// FileOutput implements ReadableStream
// Method 1: Get the URL
const url = output.url();
console.log(url); // Temporary URL (expires -- download promptly)

// Method 2: Get as Blob, then save
const blob = await output.blob();
const buffer = Buffer.from(await blob.arrayBuffer());
await writeFile("./output.png", buffer);

// Method 3: Write directly using Node.js stream utilities
await writeFile("./output.png", output);
```

---

## Error Handling

```typescript
import Replicate from "replicate";

const replicate = new Replicate();

async function safePrediction(prompt: string): Promise<string | null> {
  try {
    const output = await replicate.run("meta/meta-llama-3-70b-instruct", {
      input: { prompt, max_tokens: 512 },
    });

    return String(output);
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }

    console.error(`Replicate error: ${error.message}`);

    // Check for HTTP status codes
    if ("status" in error) {
      const status = (error as { status: number }).status;

      switch (status) {
        case 401:
          throw new Error("Invalid API token. Check REPLICATE_API_TOKEN.");
        case 404:
          console.error("Model not found. Check the model identifier.");
          return null;
        case 422:
          console.error("Invalid input parameters for this model.");
          return null;
        case 429:
          console.error("Rate limited. All retries exhausted.");
          return null;
      }

      // 5xx errors -- SDK auto-retried, all attempts failed
      if (status >= 500) {
        console.error("Server error after all retries.");
        return null;
      }
    }

    throw error; // Re-throw unexpected errors
  }
}

const result = await safePrediction("Hello!");
if (result) {
  console.log(result);
}
```

---

## Listing Predictions

```typescript
// List recent predictions (paginated)
const page = await replicate.predictions.list();

for (const prediction of page.results) {
  console.log(prediction.id, prediction.status, prediction.model);
}

// Get next page
if (page.next) {
  const nextPage = await replicate.predictions.list({ cursor: page.next });
}
```

---

_For streaming and webhooks, see [streaming-webhooks.md](streaming-webhooks.md). For deployments and training, see [deployments-training.md](deployments-training.md). For API reference tables, see [reference.md](../reference.md)._
