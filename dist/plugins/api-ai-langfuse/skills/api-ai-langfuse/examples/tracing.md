# Langfuse -- Tracing Examples

> Observation creation, nesting, context propagation, observation types, metadata, sessions, and user tracking. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Setup, environment config, flush/shutdown
- [openai-integration.md](openai-integration.md) -- OpenAI auto-instrumentation
- [prompt-management.md](prompt-management.md) -- Prompt management
- [scores-datasets.md](scores-datasets.md) -- Scores and datasets

---

## startActiveObservation -- Context Manager

The primary tracing method. Creates an observation, sets it as active context, and ends it automatically.

```typescript
import { startActiveObservation } from "@langfuse/tracing";

async function handleChatMessage(message: string): Promise<string> {
  return await startActiveObservation("chat-handler", async (span) => {
    span.update({ input: { message } });

    const intent = await classifyIntent(message);
    const response = await generateResponse(intent, message);

    span.update({ output: { response, intent } });
    return response;
  });
}
```

---

## Nested Observations

Child observations automatically inherit parent context when created during the parent's active scope.

```typescript
import { startActiveObservation } from "@langfuse/tracing";

async function ragPipeline(query: string): Promise<string> {
  return await startActiveObservation("rag-pipeline", async (rootSpan) => {
    rootSpan.update({ input: { query } });

    // Child 1: Retrieve documents (typed as retriever)
    const docs = await startActiveObservation(
      "retrieve-docs",
      async (span) => {
        span.update({ input: { query } });
        const results = await vectorStore.search(query);
        span.update({ output: { documentCount: results.length } });
        return results;
      },
      { asType: "retriever" },
    );

    // Child 2: Generate answer (typed as generation)
    const answer = await startActiveObservation(
      "generate-answer",
      async (span) => {
        span.update({
          input: { query, contextDocs: docs.length },
          model: "gpt-4o",
        });
        const result = await callLLM(query, docs);
        span.update({ output: { answer: result } });
        return result;
      },
      { asType: "generation" },
    );

    rootSpan.update({ output: { answer } });
    return answer;
  });
}
```

---

## observe() Function Wrapper

Wraps functions for declarative tracing. Inputs and outputs are captured automatically.

```typescript
import { observe } from "@langfuse/tracing";

const classifyIntent = observe(
  async (query: string): Promise<string> => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Classify the user intent." },
        { role: "user", content: query },
      ],
    });
    return completion.choices[0].message.content ?? "unknown";
  },
  { name: "classify-intent", asType: "generation" },
);

const searchDocuments = observe(
  async (query: string): Promise<Document[]> => {
    return await vectorStore.similaritySearch(query);
  },
  { name: "search-documents", asType: "retriever" },
);

// Usage -- both functions are automatically traced
const intent = await classifyIntent("Book a flight to Paris");
const docs = await searchDocuments("Paris flights availability");
```

### Controlling Input/Output Capture

```typescript
// Disable input capture (for sensitive data)
const secureFn = observe(
  async (sensitiveInput: string) => {
    /* ... */
  },
  { name: "secure-fn", captureInput: false },
);

// Disable output capture
const largeFn = observe(
  async (input: string) => {
    /* returns large object */
  },
  { name: "large-fn", captureOutput: false },
);
```

---

## Manual Observations with startObservation

For cases where you need explicit control over observation lifecycle.

```typescript
import { startObservation } from "@langfuse/tracing";

async function processItem(item: WorkItem): Promise<void> {
  const span = startObservation(
    "process-item",
    { input: { itemId: item.id } },
    { asType: "tool" },
  );

  try {
    const result = await performWork(item);
    span.update({ output: { result } });
  } catch (error) {
    span.update({
      output: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  } finally {
    span.end(); // REQUIRED -- must explicitly end
  }
}
```

---

## Observation Types

Use `asType` to give semantic meaning to observations.

```typescript
import { startActiveObservation } from "@langfuse/tracing";

// Agent step -- decision-making
await startActiveObservation(
  "plan-next-action",
  async (span) => {
    span.update({ input: { state: currentState } });
    const action = await agent.decide(currentState);
    span.update({ output: { action } });
  },
  { asType: "agent" },
);

// Tool call -- external API
await startActiveObservation(
  "call-weather-api",
  async (span) => {
    span.update({ input: { location: "Paris" } });
    const weather = await weatherAPI.get("Paris");
    span.update({ output: weather });
  },
  { asType: "tool" },
);

// Retriever -- vector search
await startActiveObservation(
  "vector-search",
  async (span) => {
    span.update({ input: { query: "climate change" } });
    const docs = await vectorStore.search("climate change");
    span.update({ output: { count: docs.length } });
  },
  { asType: "retriever" },
);

// Evaluator -- quality check
await startActiveObservation(
  "check-relevance",
  async (span) => {
    span.update({ input: { answer, query } });
    const score = await evaluateRelevance(answer, query);
    span.update({ output: { score } });
  },
  { asType: "evaluator" },
);

// Embedding call
await startActiveObservation(
  "create-embedding",
  async (span) => {
    span.update({
      input: { text: "Hello world" },
      model: "text-embedding-3-small",
    });
    const embedding = await createEmbedding("Hello world");
    span.update({ output: { dimensions: embedding.length } });
  },
  { asType: "embedding" },
);
```

---

## User and Session Tracking

Use `propagateAttributes()` to attach user, session, and metadata to all nested observations. It wraps a callback -- all observations created inside the callback inherit the attributes.

```typescript
import { startActiveObservation, propagateAttributes } from "@langfuse/tracing";

async function handleUserRequest(
  userId: string,
  sessionId: string,
  query: string,
) {
  return await propagateAttributes(
    {
      userId,
      sessionId,
      tags: ["production", "v2"],
      metadata: { environment: "prod", region: "eu-west-1" },
    },
    async () => {
      return await startActiveObservation("user-request", async (span) => {
        span.update({ input: { query } });
        const result = await processQuery(query);
        span.update({ output: { result } });
        return result;
      });
    },
  );
}
```

---

## Updating Active Observation Without Reference

```typescript
import {
  startActiveObservation,
  updateActiveObservation,
} from "@langfuse/tracing";

async function deeplyNestedFunction() {
  // Update the currently active observation from anywhere in the call stack
  updateActiveObservation({
    metadata: { step: "validation", validated: true },
  });
}

await startActiveObservation("outer", async () => {
  await deeplyNestedFunction(); // Updates "outer" observation's metadata
});
```

---

## Trace and Span ID Access

```typescript
import {
  startActiveObservation,
  getActiveTraceId,
  getActiveSpanId,
  createTraceId,
} from "@langfuse/tracing";

await startActiveObservation("my-trace", async () => {
  const traceId = getActiveTraceId();
  const spanId = getActiveSpanId();
  console.log(`Trace: ${traceId}, Span: ${spanId}`);
});

// Deterministic trace ID for correlation with external systems
const traceId = createTraceId("order-12345");
```

---

## Time to First Token (TTFT) Tracking

```typescript
import { startActiveObservation } from "@langfuse/tracing";

await startActiveObservation(
  "llm-call",
  async (span) => {
    span.update({ input: { prompt: "Tell me a story" }, model: "gpt-4o" });

    let firstTokenReceived = false;
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Tell me a story" }],
      stream: true,
    });

    for await (const chunk of stream) {
      if (!firstTokenReceived) {
        span.update({ completionStartTime: new Date().toISOString() });
        firstTokenReceived = true;
      }
      // Process chunk...
    }
  },
  { asType: "generation" },
);
```

---

## Cross-Service Context Propagation

Use `asBaggage: true` to propagate context across HTTP boundaries via W3C Baggage headers.

```typescript
import { propagateAttributes } from "@langfuse/tracing";

// In the upstream service -- wraps a callback
await propagateAttributes(
  { userId: "user-123", sessionId: "session-456" },
  async () => {
    // All observations created here inherit userId and sessionId
    await handleRequest();
  },
  { asBaggage: true }, // Propagates via HTTP headers
);
```

---

_For setup and configuration, see [core.md](core.md). For API reference, see [reference.md](../reference.md)._
