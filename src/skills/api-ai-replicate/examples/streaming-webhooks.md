# Replicate SDK -- Streaming & Webhooks Examples

> Streaming output with SSE events, webhook setup, event filtering, and signature validation. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, predictions, file handling
- [deployments-training.md](deployments-training.md) -- Deployments, training, model management

---

## Basic Streaming with replicate.stream()

```typescript
import Replicate from "replicate";

const replicate = new Replicate();

const stream = replicate.stream("meta/meta-llama-3-70b-instruct", {
  input: {
    prompt: "Explain async/await in TypeScript.",
    max_tokens: 512,
  },
});

for await (const event of stream) {
  if (event.event === "output") {
    process.stdout.write(event.data);
  }
}
console.log(); // newline
```

---

## Handling All SSE Event Types

```typescript
const stream = replicate.stream("meta/meta-llama-3-70b-instruct", {
  input: { prompt: "Tell me a story." },
});

const chunks: string[] = [];

for await (const event of stream) {
  switch (event.event) {
    case "output":
      // Progressive text output
      chunks.push(event.data);
      process.stdout.write(event.data);
      break;

    case "error":
      // Prediction error (event.data is JSON with details)
      console.error("Stream error:", event.data);
      break;

    case "done":
      // Prediction complete (event.data may contain reason)
      console.log("\nStream complete");
      break;
  }
}

const fullOutput = chunks.join("");
console.log("Total length:", fullOutput.length);
```

### SSE Event Types Reference

| Event    | Data Format | Description                                                |
| -------- | ----------- | ---------------------------------------------------------- |
| `output` | Plain text  | New model output chunk                                     |
| `error`  | JSON string | Error details (e.g., `{"detail": "..."}`)                  |
| `done`   | JSON string | Completion signal (e.g., `{}` or `{"reason": "canceled"}`) |

---

## Streaming with Error Handling

```typescript
try {
  const stream = replicate.stream("meta/meta-llama-3-70b-instruct", {
    input: { prompt: "Hello" },
  });

  for await (const event of stream) {
    if (event.event === "output") {
      process.stdout.write(event.data);
    }
    if (event.event === "error") {
      throw new Error(`Prediction error: ${event.data}`);
    }
  }
} catch (error) {
  if (error instanceof Error) {
    console.error("Stream failed:", error.message);
  }
  throw error;
}
```

---

## Streaming on Deployments

```typescript
// Stream from a deployment (consistent latency if min_instances > 0)
const stream = replicate.stream("my-org/my-deployment", {
  input: { prompt: "Summarize this document..." },
});

for await (const event of stream) {
  if (event.event === "output") {
    process.stdout.write(event.data);
  }
}
```

---

## Webhook Setup

### Creating a Prediction with Webhooks

```typescript
const prediction = await replicate.predictions.create({
  version: "27b93a2413e7f36cd83da926f3656280b2931564ff050bf9575f1fdf9bcd7478",
  input: { prompt: "a painting of a sunset" },
  webhook: "https://my.app/webhooks/replicate",
  webhook_events_filter: ["completed"],
});

console.log(prediction.id); // Track via ID
```

### Webhook Events Filter Options

| Event       | Description                               | When to Use                              |
| ----------- | ----------------------------------------- | ---------------------------------------- |
| `start`     | Prediction has started processing         | Track cold start / queue time            |
| `output`    | New output is available (intermediate)    | Progressive updates for long predictions |
| `logs`      | New log output from the model             | Debugging, monitoring                    |
| `completed` | Prediction finished (succeeded or failed) | Most common -- final result notification |

```typescript
// Receive all events (verbose, useful for debugging)
const prediction = await replicate.predictions.create({
  version: "abc123...",
  input: { prompt: "hello" },
  webhook: "https://my.app/webhooks/replicate",
  webhook_events_filter: ["start", "output", "logs", "completed"],
});

// Receive only the final result (recommended for production)
const prediction = await replicate.predictions.create({
  version: "abc123...",
  input: { prompt: "hello" },
  webhook: "https://my.app/webhooks/replicate",
  webhook_events_filter: ["completed"],
});
```

---

## Webhook Signature Validation

### Using the Built-in Validator

```typescript
import { validateWebhook } from "replicate";

async function handleWebhook(request: Request): Promise<Response> {
  const secret = process.env.REPLICATE_WEBHOOK_SIGNING_SECRET;

  if (!secret) {
    throw new Error("REPLICATE_WEBHOOK_SIGNING_SECRET not set");
  }

  const isValid = await validateWebhook(request, secret);

  if (!isValid) {
    return new Response("Invalid webhook signature", { status: 401 });
  }

  const prediction = await request.json();

  // Safe to process -- signature verified
  console.log("Prediction status:", prediction.status);
  console.log("Prediction output:", prediction.output);

  if (prediction.status === "succeeded") {
    // Handle successful prediction
    await processOutput(prediction.output);
  } else if (prediction.status === "failed") {
    console.error("Prediction failed:", prediction.error);
  }

  return new Response("OK", { status: 200 });
}
```

### Manual Signature Validation

```typescript
import { validateWebhook } from "replicate";

// When you have raw request data instead of a Request object
const isValid = await validateWebhook({
  id: request.headers["webhook-id"],
  timestamp: request.headers["webhook-timestamp"],
  signature: request.headers["webhook-signature"],
  body: rawBody, // string | ArrayBuffer | ReadableStream
  secret: process.env.REPLICATE_WEBHOOK_SIGNING_SECRET,
});
```

---

## Webhook Payload Structure

```typescript
// The webhook POST body is the same as the prediction object
interface WebhookPayload {
  id: string;
  model: string;
  version: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  input: Record<string, unknown>;
  output: unknown; // Model-specific output
  error: string | null;
  logs: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  urls: {
    get: string;
    cancel: string;
    stream?: string;
  };
}
```

---

## Polling as Alternative to Webhooks

```typescript
// For environments where webhooks are not feasible
const prediction = await replicate.predictions.create({
  version: "abc123...",
  input: { prompt: "hello" },
});

// replicate.wait() polls until the prediction completes
const result = await replicate.wait(prediction);

if (result.status === "succeeded") {
  console.log(result.output);
} else if (result.status === "failed") {
  console.error("Failed:", result.error);
} else if (result.status === "canceled") {
  console.log("Prediction was canceled");
}
```

---

_For client setup and file handling, see [core.md](core.md). For deployments and training, see [deployments-training.md](deployments-training.md). For API reference tables, see [reference.md](../reference.md)._
