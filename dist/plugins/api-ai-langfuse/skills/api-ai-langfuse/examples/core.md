# Langfuse -- Setup & Configuration Examples

> OpenTelemetry initialization, environment config, sampling, data masking, multi-project setup, and lifecycle management. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [tracing.md](tracing.md) -- Tracing with observations, nesting, metadata
- [openai-integration.md](openai-integration.md) -- OpenAI SDK auto-instrumentation
- [prompt-management.md](prompt-management.md) -- Prompt management and versioning
- [scores-datasets.md](scores-datasets.md) -- Scores, datasets, experiments

---

## Basic Setup

```typescript
// instrumentation.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

export { sdk };
```

```bash
# .env
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_BASE_URL="https://cloud.langfuse.com"   # EU region
# LANGFUSE_BASE_URL="https://us.cloud.langfuse.com"  # US region
```

```typescript
// index.ts -- instrumentation MUST be imported first
import { sdk } from "./instrumentation";
import { startActiveObservation } from "@langfuse/tracing";

async function main() {
  await startActiveObservation("my-trace", async (span) => {
    span.update({
      input: "Hello, Langfuse!",
      output: "Trace captured successfully.",
    });
  });
}

main().finally(() => sdk.shutdown());
```

---

## Client Initialization

```typescript
// lib/langfuse.ts
import { LangfuseClient } from "@langfuse/client";

// Reads credentials from environment variables automatically
const langfuse = new LangfuseClient();

export { langfuse };
```

```typescript
// lib/langfuse.ts -- explicit configuration
import { LangfuseClient } from "@langfuse/client";

const TIMEOUT_MS = 10_000;

const langfuse = new LangfuseClient({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
  timeout: TIMEOUT_MS,
});

export { langfuse };
```

---

## Sampling for High-Volume Applications

```typescript
// instrumentation.ts -- sample 20% of traces
import { NodeSDK } from "@opentelemetry/sdk-node";
import { TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const SAMPLE_RATE = 0.2;

const sdk = new NodeSDK({
  sampler: new TraceIdRatioBasedSampler(SAMPLE_RATE),
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

export { sdk };
```

Or via environment variable: `LANGFUSE_SAMPLE_RATE=0.2`

---

## Data Masking

```typescript
// instrumentation.ts -- redact PII before sending to Langfuse
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const CREDIT_CARD_PATTERN = /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

const processor = new LangfuseSpanProcessor({
  mask: ({ data }) =>
    data
      .replace(CREDIT_CARD_PATTERN, "***MASKED_CC***")
      .replace(EMAIL_PATTERN, "***MASKED_EMAIL***"),
});

const sdk = new NodeSDK({
  spanProcessors: [processor],
});

sdk.start();

export { sdk };
```

---

## Span Filtering

```typescript
// instrumentation.ts -- only export Langfuse + custom spans
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor, isDefaultExportSpan } from "@langfuse/otel";

const processor = new LangfuseSpanProcessor({
  shouldExportSpan: ({ otelSpan }) =>
    isDefaultExportSpan(otelSpan) ||
    otelSpan.instrumentationScope.name.startsWith("my-app"),
});

const sdk = new NodeSDK({
  spanProcessors: [processor],
});

sdk.start();

export { sdk };
```

---

## Isolated TracerProvider

Separate Langfuse tracing from other observability backends:

```typescript
// instrumentation.ts -- isolated provider
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { setLangfuseTracerProvider } from "@langfuse/tracing";

const langfuseProvider = new NodeTracerProvider({
  spanProcessors: [new LangfuseSpanProcessor()],
});

setLangfuseTracerProvider(langfuseProvider);
```

---

## Multi-Project Setup

```typescript
// instrumentation.ts -- send spans to multiple Langfuse projects
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const sdk = new NodeSDK({
  spanProcessors: [
    new LangfuseSpanProcessor({
      publicKey: "pk-lf-project-1",
      secretKey: "sk-lf-project-1",
    }),
    new LangfuseSpanProcessor({
      publicKey: "pk-lf-project-2",
      secretKey: "sk-lf-project-2",
    }),
  ],
});

sdk.start();

export { sdk };
```

---

## Debug Logging

```bash
# Via environment variable
LANGFUSE_LOG_LEVEL=DEBUG

# Or via code
```

```typescript
import { configureGlobalLogger } from "@langfuse/core";

configureGlobalLogger({ level: "DEBUG" });
```

---

## Serverless / Short-Lived Process Pattern

```typescript
import { sdk } from "./instrumentation";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { startActiveObservation } from "@langfuse/tracing";
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

export async function handler(event: unknown) {
  try {
    return await startActiveObservation("lambda-handler", async (span) => {
      span.update({ input: event });
      const result = await processEvent(event);
      span.update({ output: result });

      // Score the result
      langfuse.score.activeTrace({
        name: "success",
        value: 1,
        dataType: "BOOLEAN",
      });

      return result;
    });
  } finally {
    // CRITICAL: flush before Lambda freezes
    await langfuse.score.flush();
    await sdk.shutdown();
  }
}
```

---

_For tracing patterns, see [tracing.md](tracing.md). For API reference, see [reference.md](../reference.md)._
