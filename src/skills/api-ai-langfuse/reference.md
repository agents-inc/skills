# Langfuse Quick Reference

> Package index, environment variables, tracing API, observation types, score methods, and client API. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
# Core tracing (always required for observability)
npm install @langfuse/tracing @langfuse/otel @opentelemetry/sdk-node

# OpenAI auto-instrumentation (if using OpenAI SDK)
npm install @langfuse/openai

# Client API (prompts, scores, datasets)
npm install @langfuse/client
```

### Package Overview

| Package                   | Purpose                                                                      |
| ------------------------- | ---------------------------------------------------------------------------- |
| `@langfuse/tracing`       | `startActiveObservation`, `observe`, `startObservation`, context propagation |
| `@langfuse/otel`          | `LangfuseSpanProcessor` for OTel NodeSDK                                     |
| `@opentelemetry/sdk-node` | OpenTelemetry SDK (peer dependency)                                          |
| `@langfuse/client`        | `LangfuseClient` for prompts, scores, datasets                               |
| `@langfuse/openai`        | `observeOpenAI()` wrapper for OpenAI SDK                                     |
| `@langfuse/core`          | Shared utilities and types (transitive)                                      |

---

## Environment Variables

| Variable                  | Required | Default                      | Description                           |
| ------------------------- | -------- | ---------------------------- | ------------------------------------- |
| `LANGFUSE_SECRET_KEY`     | Yes      | --                           | Secret API key (`sk-lf-...`)          |
| `LANGFUSE_PUBLIC_KEY`     | Yes      | --                           | Public API key (`pk-lf-...`)          |
| `LANGFUSE_BASE_URL`       | Yes      | `https://cloud.langfuse.com` | Langfuse instance URL                 |
| `LANGFUSE_SAMPLE_RATE`    | No       | `1.0`                        | Trace sampling rate (0.0-1.0)         |
| `LANGFUSE_LOG_LEVEL`      | No       | `WARN`                       | SDK log level (DEBUG/INFO/WARN/ERROR) |
| `LANGFUSE_FLUSH_AT`       | No       | `10`                         | Flush after N queued events           |
| `LANGFUSE_FLUSH_INTERVAL` | No       | `1` (seconds)                | Flush interval in seconds             |
| `LANGFUSE_TIMEOUT`        | No       | `5000` (ms)                  | HTTP request timeout                  |

---

## Tracing API (`@langfuse/tracing`)

### Context Managers

```typescript
import {
  startActiveObservation,
  startObservation,
  observe,
  updateActiveObservation,
  propagateAttributes,
  getActiveTraceId,
  getActiveSpanId,
  createTraceId,
} from "@langfuse/tracing";

// Auto-context, auto-end
await startActiveObservation("name", async (span) => {
  span.update({ input: {...}, output: {...} });
}, { asType: "generation" });

// Manual control (requires explicit .end())
const span = startObservation("name", { input: {...} }, { asType: "tool" });
span.update({ output: {...} });
span.end();

// Function wrapper (auto-captures inputs/outputs)
const fn = observe(async (input: string) => { return output; }, {
  name: "fn-name",
  asType: "agent",
});

// Update active span without reference
updateActiveObservation({ metadata: { key: "value" } });

// Propagate attributes to all nested observations (wraps a callback)
await propagateAttributes(
  { userId: "user-1", sessionId: "session-1", tags: ["prod"] },
  async () => { /* observations created here inherit attributes */ },
);

// Get current trace/span IDs
const traceId = getActiveTraceId();
const spanId = getActiveSpanId();

// Deterministic trace ID from seed
const traceId = createTraceId("my-correlation-key");
```

### Span Update Properties

```typescript
span.update({
  input: any, // Observation input
  output: any, // Observation output
  metadata: Record<string, any>, // Custom key-value metadata
  model: string, // LLM model name (for generations)
  completionStartTime: string, // ISO timestamp for TTFT tracking
});
```

---

## Observation Types (`asType`)

| Type           | Semantic Meaning                     | Dashboard Icon |
| -------------- | ------------------------------------ | -------------- |
| `"span"`       | Generic duration (default)           | --             |
| `"event"`      | Point-in-time occurrence             | --             |
| `"generation"` | LLM call (prompt/completion, tokens) | AI icon        |
| `"agent"`      | AI agent decision step               | Agent icon     |
| `"tool"`       | External tool/API call               | Tool icon      |
| `"chain"`      | Link between application steps       | Chain icon     |
| `"retriever"`  | Vector store / DB retrieval          | Search icon    |
| `"evaluator"`  | Quality assessment function          | Check icon     |
| `"embedding"`  | Embedding model call                 | Vector icon    |
| `"guardrail"`  | Content safety / jailbreak check     | Shield icon    |

---

## OpenAI Integration (`@langfuse/openai`)

```typescript
import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";

// Wrap OpenAI client -- all calls automatically traced
const openai = observeOpenAI(new OpenAI());

// Optional: custom trace attributes per call
const openai = observeOpenAI(new OpenAI(), {
  generationName: "classify-intent",
  sessionId: "session-123",
  userId: "user-456",
  tags: ["production"],
  generationMetadata: { feature: "intent-classifier" },
});
```

**Auto-captured data:** model, token counts (prompt/completion), estimated cost, latency, time-to-first-token (streaming), errors, function calls.

**Stream token tracking:** Set `stream_options: { include_usage: true }` on OpenAI streaming calls.

---

## Client API (`@langfuse/client`)

```typescript
import { LangfuseClient } from "@langfuse/client";
const langfuse = new LangfuseClient();
```

### Prompt Manager (`langfuse.prompt`)

```typescript
// Get text prompt (production label by default)
const prompt = await langfuse.prompt.get("name");
const compiled = prompt.compile({ var1: "value1" });

// Get chat prompt
const chatPrompt = await langfuse.prompt.get("name", { type: "chat" });
const messages = chatPrompt.compile({ var1: "value1" });

// Specific version or label
await langfuse.prompt.get("name", { version: 2 });
await langfuse.prompt.get("name", { label: "staging" });

// Bypass cache
await langfuse.prompt.get("name", { cacheTtlSeconds: 0 });

// Create prompt
await langfuse.prompt.create({
  name: "name",
  prompt: "Template {{var}}",
  type: "text",
});
```

### Score Manager (`langfuse.score`)

```typescript
// By trace ID
langfuse.score.create({
  traceId,
  name: "quality",
  value: 0.9,
  dataType: "NUMERIC",
});
langfuse.score.create({
  traceId,
  name: "label",
  value: "good",
  dataType: "CATEGORICAL",
});
langfuse.score.create({
  traceId,
  name: "passed",
  value: 1,
  dataType: "BOOLEAN",
});

// By observation ID
langfuse.score.create({
  traceId,
  observationId,
  name: "accuracy",
  value: 0.8,
  dataType: "NUMERIC",
});

// By active OTel span
langfuse.score.activeObservation({
  name: "quality",
  value: 0.9,
  dataType: "NUMERIC",
});
langfuse.score.activeTrace({
  name: "quality",
  value: 0.9,
  dataType: "NUMERIC",
});

// By OTel span reference
langfuse.score.observation(
  { otelSpan },
  { name: "quality", value: 0.9, dataType: "NUMERIC" },
);
langfuse.score.trace(
  { otelSpan },
  { name: "quality", value: 0.9, dataType: "NUMERIC" },
);

// Flush pending scores
await langfuse.score.flush();
```

### Dataset Manager (`langfuse.dataset`)

```typescript
// Get dataset
const dataset = await langfuse.dataset.get("dataset-name");

// Run experiment
const result = await dataset.runExperiment({
  name: "experiment-v1",
  task: async ({ item }) => {
    const output = await myLLMFunction(item.input);
    return output;
  },
});
```

### Direct API Access (`langfuse.api`)

```typescript
// Create dataset
await langfuse.api.datasets.create({ name: "my-dataset" });

// Add dataset item
await langfuse.api.datasetItems.create({
  datasetName: "my-dataset",
  input: { text: "hello" },
  expectedOutput: { text: "world" },
});

// Get trace
await langfuse.api.trace.get("trace-id");

// Get observation
await langfuse.api.observations.get("observation-id");
```

### Utility Methods

```typescript
// Get dashboard URL for a trace
langfuse.getTraceUrl("trace-id");

// Flush all pending client data (scores, prompts)
await langfuse.flush();

// Graceful shutdown
await langfuse.shutdown();
```

### Flushing OTel Spans (Short-Lived Processes)

```typescript
// Flush pending spans via the processor
await langfuseSpanProcessor.forceFlush();

// Or shutdown the entire OTel SDK (flushes + closes)
await sdk.shutdown();
```

---

## LangfuseSpanProcessor Configuration

```typescript
import { LangfuseSpanProcessor, isDefaultExportSpan } from "@langfuse/otel";

const processor = new LangfuseSpanProcessor({
  // Credentials (optional -- falls back to env vars)
  publicKey: "pk-lf-...",
  secretKey: "sk-lf-...",
  baseUrl: "https://cloud.langfuse.com",

  // Data masking
  mask: ({ data }) => data.replace(/\b\d{16}\b/g, "***MASKED***"),

  // Span filtering
  shouldExportSpan: ({ otelSpan }) =>
    isDefaultExportSpan(otelSpan) ||
    otelSpan.instrumentationScope.name.startsWith("my-app"),
});
```

---

## Score Data Types

| Type          | Value Type        | Example                 |
| ------------- | ----------------- | ----------------------- |
| `NUMERIC`     | `number` (float)  | `0.95`, `42`, `-1.5`    |
| `CATEGORICAL` | `string`          | `"good"`, `"incorrect"` |
| `BOOLEAN`     | `number` (0 or 1) | `0` (false), `1` (true) |
